// script.js v8.1 - Finalized Auth Sync & Global Scoping
let allFilesData = [];
let currentFolderId = 'root';
let folderHistory = [];

document.addEventListener('DOMContentLoaded', () => {

    // --- Firebase Bridge Initialization ---
    // This ensures script.js only starts talking to Firebase once firebase-init.js (module) is ready.
    function initFirebaseLogic() {
        if (!window.fbOnAuthStateChanged) return;

        window.fbOnAuthStateChanged(async (user) => {
            const logoutBtn = document.getElementById('btn-logout');
            
            if (user) {
                console.log("👤 User Logged In:", user.email);
                
                // Show logout button when user is logged in
                if (logoutBtn) logoutBtn.style.display = 'block';

                // If on entry page, check if profile exists
                if (window.location.pathname.endsWith('entry.html') || window.location.pathname.endsWith('index.html')) {
                    const settings = await window.fbLoadSettings();
                    if (settings && settings.collegeName) {
                        window.location.href = 'store.html';
                    } else {
                        // Profile incomplete, show details form
                        const authSection = document.getElementById('auth-section');
                        const detailsSection = document.getElementById('details-section');
                        if (authSection) authSection.style.display = 'none';
                        if (detailsSection) detailsSection.style.display = 'block';
                    }
                }

                // Update UI in Store (if exists)
                const userEmailDisp = document.getElementById('user-email-display');
                if (userEmailDisp) userEmailDisp.textContent = user.email;

                // Debug: Log user info
                console.log("🔑 User ID:", user.uid);
                console.log("📧 Email:", user.email);

                // Load and display user profile
                if (typeof window.fbLoadSettings === 'function') {
                    window.fbLoadSettings().then(settings => {
                        if (settings && settings.collegeName) {
                            localStorage.setItem('docStore_collegeName', settings.collegeName);
                            localStorage.setItem('docStore_userName', settings.userName || '');
                            localStorage.setItem('docStore_userRole', settings.userRole || '');
                            const nameDisplay = document.getElementById('college-name-display');
                            if (nameDisplay) nameDisplay.textContent = settings.collegeName;
                        }
                    }).catch(err => console.error("Profile load error:", err));
                }

                // Load data for store display
                loadFilesFromDB();
                if (document.getElementById('feedback-list')) loadFeedback();
                if (document.getElementById('ticket-list')) loadTickets();

            } else {
                console.log("👤 No user logged in.");
                
                // Hide logout button when user is not logged in
                if (logoutBtn) logoutBtn.style.display = 'none';
                
                // Protected route protection: Redirect to entry
                if (window.location.pathname.endsWith('store.html') ||
                    window.location.pathname.endsWith('feedback.html') ||
                    window.location.pathname.endsWith('support.html')) {
                    window.location.href = 'entry.html';
                }
            }
        });
    }

    // Bridge Wait Helper - Optimized for fast loading
    function waitForBridge(retries = 0) {
        if (window.fbOnAuthStateChanged && window.fbFetchFiles) {
            console.log("✅ Firebase Bridge Ready");
            initFirebaseLogic();
        } else if (retries < 60) {
            setTimeout(() => waitForBridge(retries + 1), 50);
        } else {
            console.error("❌ Firebase Bridge Timeout.");
        }
    }

    waitForBridge();

    // --- Logout Button Handler ---
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                logoutBtn.disabled = true;
                logoutBtn.textContent = "Logging out...";
                await window.fbSignOut();
                console.log("✅ User Logged Out Successfully");
                // Clear local storage
                localStorage.removeItem('docStore_collegeName');
                localStorage.removeItem('docStore_userName');
                localStorage.removeItem('docStore_userRole');
                // Redirect to entry page
                window.location.href = 'entry.html';
            } catch (err) {
                console.error("❌ Logout Failed:", err);
                logoutBtn.disabled = false;
                logoutBtn.textContent = "Logout";
                showModal("Logout failed: " + err.message);
            }
        });
    }

    // --- Auth UI Interaction (entry.html) ---
    const authTitle = document.getElementById('auth-title');
    const authBtn = document.getElementById('btn-auth-primary');
    const authToggle = document.getElementById('auth-toggle-text');
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-password');
    let isSignupMode = false;

    if (authToggle) {
        authToggle.addEventListener('click', () => {
            isSignupMode = !isSignupMode;
            if (isSignupMode) {
                authTitle.textContent = "Sign Up";
                authBtn.textContent = "Create Account";
                authToggle.textContent = "Already have an account? Login";
            } else {
                authTitle.textContent = "Login";
                authBtn.textContent = "Login";
                authToggle.textContent = "Don't have an account? Sign Up";
            }
        });
    }

    if (authBtn) {
        authBtn.addEventListener('click', async () => {
            const email = emailInput.value;
            const password = passInput.value;
            if (!email || !password) { showModal("Please enter email and password."); return; }

            try {
                authBtn.disabled = true; authBtn.textContent = "Processing...";
                if (isSignupMode) { await window.fbSignUp(email, password); showModal("Account created! Please complete your profile."); }
                else { await window.fbSignIn(email, password); }
            } catch (err) {
                showModal("Auth Failed: " + err.message);
                authBtn.disabled = false; authBtn.textContent = isSignupMode ? "Create Account" : "Login";
            }
        });
    }

    // --- Profile Setup Logic ---
    const btnSaveProfile = document.getElementById('btn-save-profile');
    if (btnSaveProfile) {
        btnSaveProfile.addEventListener('click', async () => {
            const collegeName = document.getElementById('college-name').value;
            const userName = document.getElementById('user-name').value;
            const userRole = document.getElementById('user-role').value;
            const courses = document.getElementById('courses').value;
            const collegeAddress = document.getElementById('college-address').value;
            const erpName = document.getElementById('erp-name').value;

            if (!collegeName || !userName) { showModal("College Name and Your Name are required."); return; }

            try {
                btnSaveProfile.disabled = true; btnSaveProfile.textContent = "Saving...";
                await window.fbSaveSettings({ collegeName, userName, userRole, courses, collegeAddress, erpName });
                localStorage.setItem('docStore_collegeName', collegeName);
                window.location.href = 'store.html';
            } catch (err) {
                showModal("Error saving profile: " + err.message);
                btnSaveProfile.disabled = false; btnSaveProfile.textContent = "Finish Setup";
            }
        });
    }


    // --- Store Page Logic ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const sections = document.querySelectorAll('.content-section');
    const noteArea = document.getElementById('note-area');
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const fileListDisplay = document.getElementById('file-list-display');
    const collegeNameDisplay = document.getElementById('college-name-display');
    const storeSubHeader = document.getElementById('store-sub-header');

    // Load College Name and Details
    if (collegeNameDisplay) {
        const savedName = localStorage.getItem('docStore_collegeName');
        const savedUser = localStorage.getItem('docStore_userName');
        const savedRole = localStorage.getItem('docStore_userRole');

        if (savedName) {
            collegeNameDisplay.textContent = savedName;

            let subText = 'Document Store ERP';
            if (savedUser) {
                subText += ` | Welcome, ${savedUser}`;
                if (savedRole && savedRole !== 'null') subText += ` (${savedRole})`;
            }
            if (storeSubHeader) storeSubHeader.textContent = subText;
        }


        // --- Header Actions ---
        const btnLogout = document.getElementById('btn-logout');
        const btnSettings = document.getElementById('btn-settings');

        if (btnSettings) {
            btnSettings.addEventListener('click', () => {
                showModal("Settings Module: Coming Soon!");
                // Or navigate to details if we want them to re-edit
                // window.location.href = 'details.html';
            });
        }
    }

    // Tab Switching
    if (tabBtns.length > 0) {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));

                btn.classList.add('active');
                const tabId = btn.getAttribute('data-tab');
                document.getElementById(`${tabId}-section`).classList.add('active');
            });
        });
    }

    // Write Logic (Auto-save)
    if (noteArea) {
        // Load Saved Save
        const savedNote = localStorage.getItem('documentStore_note');
        if (savedNote) {
            // New Format: Check if content seems to be HTML (starts with <)
            // Ideally we just set innerHTML. Old plain text will format fine.
            noteArea.innerHTML = savedNote;
        }

        noteArea.addEventListener('input', () => {
            localStorage.setItem('documentStore_note', noteArea.innerHTML);
            const msg = document.getElementById('save-msg');
            msg.textContent = 'Saved...';
            setTimeout(() => { msg.textContent = ''; }, 1000);
        });
    }

    // --- Rich Text Formatting ---
    window.formatText = (command, value = null) => {
        document.execCommand(command, false, value);
        // Trigger auto-save manually since execCommand might not trigger 'input' in all browsers exactly when expected, though usually it does.
        // Let's be safe.
        if (noteArea) {
            noteArea.dispatchEvent(new Event('input'));
            updateToolbarState(); // Check state immediately after click
        }
        document.getElementById('note-area').focus();
    };

    window.changeFontSize = (delta, btn) => {
        let currentSize = document.queryCommandValue('fontSize');
        // If content is empty or no size set, default might be empty string or usually '3' (normal).
        // Sometimes it returns a pixel string in some browsers, but execCommand 'fontSize' works with 1-7 integers.
        // Let's parse securely.
        let size = parseInt(currentSize);
        if (isNaN(size)) size = 3; // Default HTML font size is usually 3

        let newSize = size + delta;

        // Clamp between 1 and 7
        if (newSize < 1) newSize = 1;
        if (newSize > 7) newSize = 7;

        window.formatText('fontSize', newSize);

        // Update Display
        const select = document.getElementById('font-size-select');
        if (select) select.value = newSize;

        if (btn) {
            btn.classList.add('active');
            setTimeout(() => {
                btn.classList.remove('active');
            }, 200);
        }
    };

    window.insertTable = (btn) => {
        // Visual Feedback
        if (btn) {
            btn.classList.add('active');
            setTimeout(() => btn.classList.remove('active'), 200);
        }

        showPrompt("Enter number of rows:", (rows) => {
            if (!rows || isNaN(rows) || rows < 1) {
                closeModal();
                return;
            }
            showPrompt("Enter number of columns:", (cols) => {
                if (!cols || isNaN(cols) || cols < 1) {
                    closeModal();
                    return;
                }

                showPrompt("Enter Column Headers (comma separated):", (headerStr) => {

                    let tableHTML = `<table style="border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #ccc;">`;

                    // Header Logic
                    if (headerStr && headerStr.trim() !== '') {
                        const headers = headerStr.split(',').map(h => h.trim());
                        tableHTML += `<thead><tr>`;
                        // Loop up to 'cols' count. Use provided header or empty if not enough headers provided.
                        for (let k = 0; k < cols; k++) {
                            const hText = headers[k] || `Col ${k + 1}`;
                            tableHTML += `<th style="border: 1px solid #ccc; padding: 8px; background-color: #f4f4f4; text-align: left;">${hText}</th>`;
                        }
                        tableHTML += `</tr></thead>`;
                    }

                    tableHTML += `<tbody>`;

                    for (let i = 0; i < rows; i++) {
                        tableHTML += `<tr>`;
                        for (let j = 0; j < cols; j++) {
                            tableHTML += `<td style="border: 1px solid #ccc; padding: 8px; min-width: 50px;">&nbsp;</td>`;
                        }
                        tableHTML += `</tr>`;
                    }

                    tableHTML += `</tbody></table><p><br/></p>`; // Add break after table

                    document.getElementById('note-area').focus();
                    document.execCommand('insertHTML', false, tableHTML);
                }, true); // Last one closes
            }, false); // Don't close
        }, false); // Don't close
    };

    function updateToolbarState() {
        const commands = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight'];
        commands.forEach(cmd => {
            const isActive = document.queryCommandState(cmd);
            const btn = document.querySelector(`.btn-toolbar[onclick*="'${cmd}'"]`);
            if (btn) {
                if (isActive) btn.classList.add('active');
                else btn.classList.remove('active');
            }
        });

        // Update Font Size Select
        const sizeVal = document.queryCommandValue('fontSize');
        const sizeSelect = document.getElementById('font-size-select');
        if (sizeSelect && sizeVal) {
            // queryCommandValue returns "3" or "10px" etc depending on browser.
            // standard execCommand usually works with 1-7.
            // Let's assume integer for now
            sizeSelect.value = sizeVal;
        }
    }

    if (noteArea) {
        // Update toolbar buttons when moving cursor or typing
        noteArea.addEventListener('keyup', updateToolbarState);
        noteArea.addEventListener('mouseup', updateToolbarState);
        noteArea.addEventListener('click', updateToolbarState);

        // --- Image Paste/Drop Logic (Static Size) ---
        const insertResizedImage = (file) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                // Resize logic: default 300x200
                const img = `<img src="${event.target.result}" width="300" height="200" style="max-width: 100%; vertical-align: middle;">`;
                // Check if we have focus, if not, try to focus
                noteArea.focus();
                document.execCommand('insertHTML', false, img);
                // Trigger input for auto-save
                noteArea.dispatchEvent(new Event('input'));
            };
            reader.readAsDataURL(file);
        };

        noteArea.addEventListener('paste', (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
                    e.preventDefault();
                    insertResizedImage(items[i].getAsFile());
                }
            }
        });

        noteArea.addEventListener('drop', (e) => {
            // Check if dropping files (images)
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const files = Array.from(e.dataTransfer.files);
                const imageFiles = files.filter(f => f.type.startsWith('image/'));

                if (imageFiles.length > 0) {
                    e.preventDefault();
                    imageFiles.forEach(file => {
                        insertResizedImage(file);
                    });
                }
            }
        });

        // Initial Toolbar State Check
        setTimeout(updateToolbarState, 500);
    }

    // --- Dark Mode Logic ---
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const body = document.body;

    // Check saved preference
    if (localStorage.getItem('docStore_theme') === 'dark') {
        body.classList.add('dark-mode');
        if (btnThemeToggle) btnThemeToggle.textContent = '☀️';
    }

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const isDark = body.classList.contains('dark-mode');
            localStorage.setItem('docStore_theme', isDark ? 'dark' : 'light');
            btnThemeToggle.textContent = isDark ? '☀️' : '🌙';
        });
    }

    // --- Real-time Search Logic ---
    const searchInput = document.getElementById('file-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderFileList();
        });
    }

    // --- Grid/List View Logic ---
    const btnViewToggle = document.getElementById('btn-view-toggle');
    const iconGrid = document.getElementById('icon-grid');
    const iconList = document.getElementById('icon-list');
    let isGridView = localStorage.getItem('docStore_view') === 'grid';

    function updateView() {
        if (isGridView) {
            fileListDisplay.classList.add('grid-view');
            iconGrid.style.display = 'none';
            iconList.style.display = 'block';
        } else {
            fileListDisplay.classList.remove('grid-view');
            iconGrid.style.display = 'block';
            iconList.style.display = 'none';
        }
        localStorage.setItem('docStore_view', isGridView ? 'grid' : 'list');
    }

    // Initialize View
    if (fileListDisplay) updateView();

    if (btnViewToggle) {
        btnViewToggle.addEventListener('click', () => {
            isGridView = !isGridView;
            updateView();
        });
    }

    // --- Firebase Integration State ---
    const btnCreateFolder = document.getElementById('btn-create-folder');
    const btnBack = document.getElementById('btn-back');
    const breadcrumbs = document.getElementById('breadcrumbs');

    if (btnCreateFolder) {
        btnCreateFolder.addEventListener('click', () => {
            // Replace native prompt with custom prompt
            showPrompt("Enter folder name:", (folderName) => {
                if (folderName && folderName.trim()) {
                    saveFolderToDB(folderName.trim());
                }
            });
        });
    }

    if (dropZone && fileInput) {
        // Click to Open
        dropZone.addEventListener('click', () => fileInput.click());

        // File Selection (Click)
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => saveFileToDB(file));
            fileInput.value = ''; // Reset
        });

        // Drag & Drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
            dropZone.style.backgroundColor = '#fff0d4'; // Visual feedback
            dropZone.style.borderColor = '#e69500';
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
            dropZone.style.backgroundColor = '#fffaf0'; // Reset
            dropZone.style.borderColor = 'var(--primary-orange)';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            dropZone.style.backgroundColor = '#fffaf0'; // Reset
            dropZone.style.borderColor = 'var(--primary-orange)';

            const files = Array.from(e.dataTransfer.files);
            files.forEach(file => saveFileToDB(file));
        });
    }

    if (btnBack) {
        // ... existing back logic ...
        btnBack.addEventListener('click', () => {
            if (folderHistory.length > 0) {
                const prev = folderHistory.pop();
                currentFolderId = prev.id;
                updateBreadcrumbs();
                renderFileList();
            }
        });
    }
    // ...
    // ... existing code ...
    // ...

    // Custom Modal Functions - Exposed to Global Scope
    window.showModal = function (message) {
        const modal = document.getElementById('custom-modal');
        const msg = document.getElementById('modal-message');
        const actions = document.getElementById('modal-actions');
        const input = document.getElementById('modal-input');
        const select = document.getElementById('modal-select');
        const title = document.getElementById('modal-title');

        if (modal && msg && actions) {
            msg.textContent = message;
            if (title) title.textContent = 'Notification';
            if (input) input.style.display = 'none';
            if (select) select.style.display = 'none';

            actions.innerHTML = '<button class="btn primary" onclick="closeModal()">OK</button>';
            modal.style.display = 'flex';
        } else {
            alert(message);
        }
    };

    function showConfirm(message, onConfirm) {
        const modal = document.getElementById('custom-modal');
        const msg = document.getElementById('modal-message');
        const actions = document.getElementById('modal-actions');
        const input = document.getElementById('modal-input');
        const title = document.getElementById('modal-title');

        if (modal && msg && actions) {
            msg.textContent = message;
            if (title) title.textContent = 'Confirm Action';
            if (input) input.style.display = 'none'; // Hide input

            actions.innerHTML = '';

            const btnYes = document.createElement('button');
            btnYes.className = 'btn primary';
            btnYes.textContent = 'Yes';
            btnYes.onclick = () => {
                onConfirm();
                closeModal();
            };

            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn secondary';
            btnCancel.textContent = 'Cancel';
            btnCancel.onclick = closeModal;

            actions.appendChild(btnYes);
            actions.appendChild(btnCancel);

            modal.style.display = 'flex';
        } else {
            if (confirm(message)) {
                onConfirm();
            }
        }
    }

    function showPrompt(message, onConfirm, autoClose = true) {
        const modal = document.getElementById('custom-modal');
        const msg = document.getElementById('modal-message');
        const actions = document.getElementById('modal-actions');
        const input = document.getElementById('modal-input');
        const title = document.getElementById('modal-title');

        if (modal && msg && actions && input) {
            msg.textContent = message;
            if (title) title.textContent = 'Input Required';
            input.style.display = 'block'; // Show input
            input.value = ''; // Clear previous
            input.focus();

            actions.innerHTML = '';

            const btnOk = document.createElement('button');
            btnOk.className = 'btn primary';
            btnOk.textContent = 'OK';
            btnOk.onclick = () => {
                onConfirm(input.value);
                if (autoClose) closeModal();
            };

            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn secondary';
            btnCancel.textContent = 'Cancel';
            btnCancel.onclick = closeModal;

            actions.appendChild(btnOk);
            actions.appendChild(btnCancel);

            modal.style.display = 'flex';

            // Focus input after modal is shown
            setTimeout(() => input.focus(), 50);
        } else {
            const result = prompt(message);
            if (result !== null) onConfirm(result);
        }
    }

    function closeModal() {
        const modal = document.getElementById('custom-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    if (btnBack) {
        btnBack.addEventListener('click', () => {
            if (folderHistory.length > 0) {
                const prev = folderHistory.pop();
                currentFolderId = prev.id;
                updateBreadcrumbs();
                renderFileList();
            }
        });
    }

    // --- Render File List ---
    function renderFileList() {
        if (!fileListDisplay) return;

        fileListDisplay.innerHTML = '';
        updateBreadcrumbs();

        // Get search term if any
        const searchInput = document.getElementById('file-search');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        // Separate Folders and Files for sorting
        let files = allFilesData.filter(f => f.parentId === currentFolderId);

        // Apply Search Filter
        if (searchTerm) {
            files = files.filter(f => f.name.toLowerCase().includes(searchTerm));
        }

        // Sort: Folders first, then Files. Both alphabetical.
        files.sort((a, b) => {
            if (a.isFolder && !b.isFolder) return -1;
            if (!a.isFolder && b.isFolder) return 1;
            return a.name.localeCompare(b.name);
        });

        if (files.length === 0) {
            const emptyMsg = searchTerm ? 'No matching files found' : 'Folder is empty';
            fileListDisplay.innerHTML = `<div style="text-align: center; color: #888; padding: 20px;">${emptyMsg}</div>`;
            return;
        }

        files.forEach(file => {
            addFileToList(file);
        });
    }

    function updateBreadcrumbs() {
        let pathName = 'Home';
        folderHistory.forEach(f => {
            if (f.id !== 'root') pathName += ` > ${f.name}`;
        });

        // Find current folder name if not root
        if (currentFolderId !== 'root') {
            const currentFolder = allFilesData.find(f => f.id === currentFolderId);
            if (currentFolder) pathName += ` > ${currentFolder.name}`;
        }

        if (breadcrumbs) breadcrumbs.textContent = pathName;

        if (btnBack) {
            btnBack.style.display = currentFolderId === 'root' ? 'none' : 'block';
        }
    }

    // --- Firebase Integration ---


    // Load Files from Firebase
    async function loadFilesFromDB() {
        const fileListDisplay = document.getElementById('file-list-display');
        if (fileListDisplay) {
            fileListDisplay.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;"><div style="font-size: 2rem; margin-bottom: 10px;">⏳</div>Loading your files...</div>';
        }

        try {
            if (window.fbFetchFiles) {
                allFilesData = await window.fbFetchFiles();
                console.log(`📁 Loaded ${allFilesData.length} items`);
                renderFileList();
            }
        } catch (e) {
            console.error("Error loading files:", e);
            if (fileListDisplay) {
                fileListDisplay.innerHTML = '<div style="text-align: center; padding: 40px; color: #d32f2f;">❌ Error loading files. Please refresh the page.</div>';
            }
        }
    }

    // Initialize if on Store Page
    if (document.getElementById('file-list-display')) {
        loadFilesFromDB();
    }

    // Save Folder
    async function saveFolderToDB(folderName) {
        try {
            await window.fbCreateFolder(folderName, currentFolderId);
            loadFilesFromDB();
        } catch (e) {
            showModal("Error creating folder.");
        }
    }

    // Save File
    async function saveFileToDB(file, targetFolderId = 'current') {
        const folderIdToUse = targetFolderId === 'current' ? currentFolderId : targetFolderId;
        showModal("Uploading to Cloud...");

        try {
            await window.fbUploadFile(file, folderIdToUse);
            showModal("Upload Successful!");
            loadFilesFromDB();
        } catch (e) {
            showModal("Upload Failed: " + e.message);
        }
    }

    // Delete File
    async function deleteFileFromDB(id) {
        const file = allFilesData.find(f => f.id === id);
        if (!file) return;

        showConfirm(`Are you sure you want to delete "${file.name}"?`, async () => {
            try {
                await window.fbDeleteItem(id, file.isFolder, file.storagePath);
                loadFilesFromDB();
            } catch (e) {
                showModal("Delete failed.");
            }
        });
    }

    // Move File
    async function moveFileInDB(fileId, newParentId) {
        try {
            await window.fbMoveFile(fileId, newParentId);
            showModal("Moved successfully!");
            loadFilesFromDB();
        } catch (e) {
            showModal("Move failed.");
        }
    }

    function addFileToList(fileRecord) {

        const item = document.createElement('div');
        item.className = 'file-item';

        let iconContent;
        if (fileRecord.isFolder) {
            item.classList.add('is-folder');
            // Use SVG for Folder
            iconContent = `<svg class="folder-icon-svg" viewBox="0 0 24 24" width="24" height="24">
                <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"></path>
            </svg>`;
        } else {
            let iconChar = '📄';
            if (fileRecord.name.toLowerCase().includes('.pdf')) iconChar = '📕';
            else if (fileRecord.name.toLowerCase().includes('.xls') || fileRecord.name.toLowerCase().includes('.csv')) iconChar = '📗';
            else if (fileRecord.name.toLowerCase().includes('.ppt')) iconChar = '📙';
            else if (fileRecord.name.toLowerCase().includes('.doc')) iconChar = '📘';
            else if (fileRecord.name.toLowerCase().includes('.txt')) iconChar = '📝';
            else if (fileRecord.type && fileRecord.type.startsWith('image/')) iconChar = '🖼️';
            iconContent = iconChar;
        }

        let sizeText;
        if (fileRecord.isFolder) {
            sizeText = 'Folder';
        } else {
            if (fileRecord.size < 1024) {
                sizeText = `${fileRecord.size} B`;
            } else {
                sizeText = `${(fileRecord.size / 1024).toFixed(1)} KB`;
            }
        }

        item.innerHTML = `
            <div class="file-info-clickable" style="display: flex; align-items: center; flex-grow: 1; cursor: pointer;">
                <span class="file-icon">${iconContent}</span>
                <div>
                    <div class="file-name" style="font-weight: ${fileRecord.isFolder ? 'bold' : 'normal'}">${fileRecord.name}</div>
                    <div style="font-size: 0.8rem; color: #888;">${sizeText}</div>
                </div>
            </div>
            <div class="file-actions">
                ${!fileRecord.isFolder ? `<button class="btn-action view" title="View">👁️</button>` : ''}
                ${!fileRecord.isFolder ? `<button class="btn-action download" title="Download">📥</button>` : ''}
                <button class="btn-action rename" title="Rename">✏️</button>
                <button class="btn-action move" title="Move to Folder">📂</button>
                <button class="btn-action delete" title="Delete" style="color: red;">❌</button>
            </div >
        `;

        // Rename Action
        item.querySelector('.rename').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent folder entry if it's a folder
            showPrompt(`Enter new name for "${fileRecord.name}": `, async (newName) => {
                if (newName && newName.trim() !== '' && newName !== fileRecord.name) {
                    try {
                        await window.fbRenameItem(fileRecord.id, newName.trim());
                        loadFilesFromDB(); // Refresh list
                    } catch (err) {
                        showModal("Error renaming file.");
                    }
                }
            });
        });


        // Click to enter folder
        if (fileRecord.isFolder) {
            item.querySelector('.file-info-clickable').addEventListener('click', () => {
                // Push current to history
                // We need the Name of the current folder to push to history, right?
                // History tracks PARENTS.
                // If I am at 'root', name is 'Home'.
                // If I am browsing 'Docs' (id=1), Current is 1. Parent is root.

                // Let's rely on looking up currentFolderId in allFilesData to get name if needed
                let cName = 'Home';
                if (currentFolderId !== 'root') {
                    const c = allFilesData.find(f => f.id === currentFolderId);
                    if (c) cName = c.name;
                }

                folderHistory.push({ id: currentFolderId, name: cName });
                currentFolderId = fileRecord.id;
                renderFileList();
            });
        }

        // Actions
        if (!fileRecord.isFolder) {
            item.querySelector('.view').addEventListener('click', () => {
                const fileUrl = fileRecord.url;
                if (!fileUrl) {
                    showModal("Error: File URL not found.");
                    return;
                }

                const name = fileRecord.name.toLowerCase();
                // Check if file is viewable in browser
                const isViewable = name.endsWith('.pdf') ||
                    name.endsWith('.txt') ||
                    name.endsWith('.html') ||
                    name.endsWith('.jpg') ||
                    name.endsWith('.jpeg') ||
                    name.endsWith('.png') ||
                    name.endsWith('.gif') ||
                    name.endsWith('.webp');

                // IMPROVEMENT: Universal In-App Preview for ALL viewable files
                if (isViewable) {
                    showPreviewModal(fileRecord.name, fileUrl, true);
                    return;
                }

                // Handling for Word Documents
                if (name.endsWith('.docx')) {
                    showModal("Generating document preview...");
                    const processWordBuffer = (arrayBuffer) => {
                        mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
                            .then(result => {
                                closeModal();
                                showPreviewModal(fileRecord.name, result.value, false);
                            })
                            .catch(err => {
                                console.error(err);
                                showModal("Error rendering document.");
                            });
                    };

                    if (fileUrl.startsWith('data:')) {
                        try {
                            const base64 = fileUrl.split(',')[1];
                            const binaryString = window.atob(base64);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            processWordBuffer(bytes.buffer);
                        } catch (e) {
                            showModal("Error parsing file data.");
                        }
                    } else {
                        fetch(fileUrl)
                            .then(response => response.arrayBuffer())
                            .then(processWordBuffer)
                            .catch(err => showModal("Error loading file."));
                    }
                    return;
                }

                // Handling for Excel Files
                if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
                    // Check if library is loaded
                    if (typeof XLSX === 'undefined') {
                        showModal("Excel helper library not loaded. Please check your internet connection and refresh.");
                        return;
                    }

                    showModal("Generating Excel preview...");

                    const processExcelBuffer = (arrayBuffer) => {
                        try {
                            const data = new Uint8Array(arrayBuffer);
                            const workbook = XLSX.read(data, { type: 'array' });

                            // Check if workbook has any sheets
                            if (workbook.SheetNames && workbook.SheetNames.length > 0) {
                                const firstSheetName = workbook.SheetNames[0];
                                const worksheet = workbook.Sheets[firstSheetName];
                                const html = XLSX.utils.sheet_to_html(worksheet);
                                closeModal();
                                showPreviewModal(fileRecord.name, html, false);
                            } else {
                                // Fallback for HTML-disguised XLS files (created by our export)
                                const decoder = new TextDecoder();
                                const text = decoder.decode(data);
                                if (text.includes('<html') || text.includes('<body')) {
                                    closeModal();
                                    showPreviewModal(fileRecord.name, text, false);
                                } else {
                                    throw new Error("The file exists but contains no spreadsheet data.");
                                }
                            }
                        } catch (err) {
                            console.error("Excel Parsing Error:", err);
                            // Secondary fallback: try reading as raw text if parsing fails
                            try {
                                const text = new TextDecoder().decode(arrayBuffer);
                                if (text.includes('<html') || text.includes('<body')) {
                                    closeModal();
                                    showPreviewModal(fileRecord.name, text, false);
                                    return;
                                }
                            } catch (e) { }
                            showModal("Error rendering Excel file: " + (err.message || "Unknown error"));
                        }
                    };

                    // Use fetch for both data URIs and URLs - it's cleaner and more robust
                    fetch(fileUrl)
                        .then(response => {
                            if (!response.ok) throw new Error("Could not fetch file content.");
                            return response.arrayBuffer();
                        })
                        .then(processExcelBuffer)
                        .catch(err => {
                            console.error("Fetch Error:", err);
                            showModal("Error loading file: " + err.message);
                        });
                    return;
                }

                // Force Download for everything else
                const a = document.createElement('a');
                a.href = fileUrl;
                a.download = fileRecord.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });

            item.querySelector('.download').addEventListener('click', () => {
                if (fileRecord.url) {
                    const a = document.createElement('a');
                    a.href = fileRecord.url;
                    a.download = fileRecord.name;
                    a.target = "_blank";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else {
                    showModal("Error: File URL not found.");
                }
            });
        }

        // Move Action
        item.querySelector('.move').addEventListener('click', () => {
            const isMovingFolder = fileRecord.isFolder;

            // Helper to check if folder 'candidate' is a descendant of 'source'
            function isDescendant(candidateId, sourceId) {
                let current = allFilesData.find(f => f.id === candidateId);
                while (current && current.parentId !== 'root') {
                    if (current.parentId === sourceId) return true;
                    current = allFilesData.find(f => f.id === current.parentId);
                }
                return false;
            }

            // Filter Valid Targets
            const validTargets = allFilesData.filter(f => {
                if (!f.isFolder) return false; // Must be a folder
                if (f.id === fileRecord.id) return false; // Cannot move to self
                if (f.id === currentFolderId) return false; // Cannot move to current location

                // If moving a folder, exclude its own children/descendants
                if (isMovingFolder) {
                    if (f.parentId === fileRecord.id) return false;
                    if (isDescendant(f.id, fileRecord.id)) return false;
                }
                return true;
            });

            const options = [];

            // Option 1: Move to Root (if not already there)
            if (currentFolderId !== 'root') {
                options.push({ value: 'root', text: '🏠 Home (Root)' });
            }

            // Add other valid folders
            validTargets.forEach(f => {
                // Sort/indent could be added here for better UX in future
                options.push({ value: f.id, text: `📁 ${f.name} ` });
            });

            if (options.length === 0) {
                showModal("No valid folders to move to.");
                return;
            }

            const title = isMovingFolder ? `Move Folder "${fileRecord.name}" to: ` : `Move File "${fileRecord.name}" to: `;

            showSelect(title, options, (selectedId) => {
                // FIXED: Firestore IDs are strings, DO NOT convert to Number
                const targetId = selectedId;
                moveFileInDB(fileRecord.id, targetId, item);

                // Show feedback
                const targetName = options.find(o => o.value == selectedId)?.text || 'Folder';
                showModal(`Successfully moved to: ${targetName} `);
            });
        });

        item.querySelector('.delete').addEventListener('click', () => {
            deleteFileFromDB(fileRecord.id);
        });

        fileListDisplay.append(item); // Append because we sort before logic
    }

    // Listen for Note Save Event
    // Listen for Note Save Event
    document.addEventListener('save-note-file', async (e) => {
        // Handle both old (direct file) and new (object with parentId) formats
        let file, targetId;
        if (e.detail.file) {
            file = e.detail.file;
            targetId = e.detail.parentId;
        } else {
            file = e.detail;
            targetId = 'current';
        }

        // Wait for usage to finish (shows "Uploading..." -> "Success")
        await saveFileToDB(file, targetId);

        // Optional: Switch to Store tab to see it
        const storeTabBtn = document.querySelector('[data-tab="store"]');
        if (storeTabBtn) storeTabBtn.click();
    });

    // Listen for Request Save Folder Event
    document.addEventListener('request-save-folder', () => {
        // Reuse the logic from Move File to get options
        const options = [{ value: 'root', text: '🏠 Home (Root)' }];

        // Helper to add folders recursively
        function addFolders(list, depth = 0) {
            list.forEach(f => {
                if (f.isFolder) {
                    const prefix = '&nbsp;&nbsp;'.repeat(depth) + (depth > 0 ? '└─ ' : '');
                    options.push({ value: f.id, text: `${prefix}📁 ${f.name} ` });
                    // Find children
                    const children = allFilesData.filter(child => child.parentId === f.id);
                    addFolders(children, depth + 1);
                }
            });
        }

        // Start with root folders
        const rootFolders = allFilesData.filter(f => f.parentId === 'root');
        addFolders(rootFolders);

        showSelect("Save Note to which folder?", options, (selectedId) => {
            const targetId = selectedId;
            processSaveNote(targetId);
        });
    });


    // --- Feedback Page Logic ---
    const btnSubmitFeedback = document.getElementById('btn-submit-feedback');
    const feedbackList = document.getElementById('feedback-list');

    // Star Rating Logic
    const stars = document.querySelectorAll('.star-rating .star');
    const ratingInput = document.getElementById('feedback-rating');
    const ratingText = document.getElementById('rating-text');

    if (stars.length > 0 && ratingInput) {
        stars.forEach(star => {
            star.addEventListener('mouseover', () => {
                const value = parseInt(star.getAttribute('data-value'));
                highlightStars(value, 'hovered');
            });
            star.addEventListener('mouseout', () => {
                resetStars('hovered');
            });
            star.addEventListener('click', () => {
                const value = parseInt(star.getAttribute('data-value'));
                ratingInput.value = value;
                ratingText.textContent = `You selected: ${value} Star${value > 1 ? 's' : ''} `;
                resetStars('selected');
                highlightStars(value, 'selected');
            });
        });

        function highlightStars(value, className) {
            stars.forEach(s => {
                if (parseInt(s.getAttribute('data-value')) <= value) {
                    s.classList.add(className);
                }
            });
        }

        function resetStars(className) {
            stars.forEach(s => s.classList.remove(className));
        }
    }

    if (btnSubmitFeedback) {
        btnSubmitFeedback.addEventListener('click', async () => {
            const name = document.getElementById('feedback-name').value;
            const rating = document.getElementById('feedback-rating').value;
            const comment = document.getElementById('feedback-comment').value;

            if (!name || !comment || rating === '0') {
                showModal("Please fill in name, rating, and comments.");
                return;
            }

            const feedbackData = { name, rating, comment };

            try {
                await window.fbSubmitFeedback(feedbackData);
                showModal("Thank you for your feedback!");
                document.getElementById('feedback-name').value = '';
                document.getElementById('feedback-comment').value = '';
                document.getElementById('feedback-rating').value = '0';
                resetStars('selected');
                ratingText.textContent = 'Select a rating';

                loadFeedback();
            } catch (e) {
                console.error(e);
                showModal("Error submitting feedback: " + (e.message || e));
            }
        });
    }

    async function loadFeedback() {
        if (!feedbackList) return;
        try {
            const feedbacks = await window.fbFetchFeedback();
            feedbackList.innerHTML = '';
            if (feedbacks.length === 0) {
                feedbackList.innerHTML = '<div style="text-align: center; color: #666; padding: 2rem;">No feedback yet.</div>';
                return;
            }

            feedbacks.forEach(fb => {
                const item = document.createElement('div');
                item.className = 'file-item';
                item.style.flexDirection = 'column';
                item.style.alignItems = 'flex-start';
                item.style.padding = '15px';

                const stars = '⭐'.repeat(fb.rating);
                item.innerHTML = `
        < div style = "font-weight: bold; font-size: 1.1rem;" > ${stars}</div >
                    <div style="font-weight: 600; margin-top: 5px;">${fb.name}</div>
                    <div style="color: #555; margin-top: 5px;">${fb.comment}</div>
                    <div style="font-size: 0.8rem; color: #999; margin-top: 10px; align-self: flex-end;">${new Date(fb.createdAt).toLocaleDateString()}</div>
    `;
                feedbackList.appendChild(item);
            });
        } catch (e) { console.error(e); }
    }

    // --- Support Page Logic ---
    const btnSubmitSupport = document.getElementById('btn-submit-support');
    const ticketList = document.getElementById('ticket-list');

    if (btnSubmitSupport) {
        btnSubmitSupport.addEventListener('click', async () => {
            const email = document.getElementById('support-email').value;
            const type = document.getElementById('support-type').value;
            const desc = document.getElementById('support-desc').value;

            if (!email || !desc) {
                showModal("Please fill in all fields.");
                return;
            }

            const ticketData = { email, type, desc };

            try {
                await window.fbSubmitTicket(ticketData);
                showModal("Ticket submitted! We will contact you soon.");
                document.getElementById('support-desc').value = '';
                loadTickets();
            } catch (e) {
                showModal("Error submitting ticket.");
            }
        });
    }

    async function loadTickets() {
        if (!ticketList) return;
        try {
            // We need to fetch tickets... but wait, did I define fbFetchTickets in script.js scope? 
            // It's in window.fbFetchTickets.
            const tickets = await window.fbFetchTickets();
            ticketList.innerHTML = '';
            if (tickets.length === 0) {
                ticketList.innerHTML = '<div style="text-align: center; color: #666; padding: 2rem;">No support tickets found.</div>';
                return;
            }

            tickets.forEach(ticket => {
                const item = document.createElement('div');
                item.className = 'file-item';
                item.style.justifyContent = 'space-between';

                item.innerHTML = `
        < div >
                        <div style="font-weight: bold;">${ticket.type}</div>
                        <div style="font-size: 0.9rem; color: #555;">${ticket.desc}</div>
                    </div >
        <div style="text-align: right;">
            <div style="font-weight: bold; color: ${ticket.status === 'Open' ? 'green' : 'gray'};">${ticket.status}</div>
            <div style="font-size: 0.8rem; color: #999;">${new Date(ticket.createdAt).toLocaleDateString()}</div>
        </div>
    `;
                ticketList.appendChild(item);
            });
        } catch (e) { console.error(e); }
    }

    // --- Initialize ---
    // Note: Data loading (files, feedback, tickets) is triggered inside window.fbOnAuthStateChanged
    // to ensure we have a valid user context and avoid redundant requests.

    // Note Export Functions - Exposed to Global Scope
    window.saveNoteToStore = function () {
        processSaveNote('current');
    };

    window.saveNoteToFolder = function () {
        document.dispatchEvent(new CustomEvent('request-save-folder'));
    };


    // Export Note to PDF - Global
    window.saveNoteToPDF = async function () {
        const noteContent = document.getElementById('note-area').innerText;
        if (!noteContent.trim()) {
            window.showModal('Note is empty.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const margin = 10;
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        const maxLineWidth = pageWidth - margin * 2;

        const lines = doc.splitTextToSize(noteContent, maxLineWidth);

        let y = 10;
        lines.forEach(line => {
            if (y > pageHeight - 10) {
                doc.addPage();
                y = 10;
            }
            doc.text(line, margin, y);
            y += 10;
        });

        const fileName = `Note_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`;
        doc.save(fileName);

        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

        document.dispatchEvent(new CustomEvent('save-note-file', {
            detail: { file: file, parentId: 'current' }
        }));

        window.showModal('PDF Downloaded & Saved to Store!');
    };


    // Export Note to Word - Global
    window.saveNoteToWord = function () {
        const noteContent = document.getElementById('note-area').innerText;
        if (!noteContent.trim()) {
            window.showModal('Note is empty.');
            return;
        }

        const doc = new docx.Document({
            sections: [{
                properties: {},
                children: [
                    new docx.Paragraph({
                        children: [
                            new docx.TextRun(noteContent),
                        ],
                    }),
                ],
            }],
        });

        docx.Packer.toBlob(doc).then(blob => {
            const fileName = `Note_${new Date().toLocaleDateString().replace(/\//g, '-')}.docx`;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            document.body.appendChild(a);
            a.style = "display: none";
            a.href = url;
            a.download = fileName;
            a.click();
            window.URL.revokeObjectURL(url);

            const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            document.dispatchEvent(new CustomEvent('save-note-file', {
                detail: { file: file, parentId: 'current' }
            }));

            window.showModal('Word Doc Downloaded & Saved to Store!');
        });
    };


    // Export Note to Excel - Global
    window.saveNoteToExcel = function () {
        const noteContent = document.getElementById('note-area').innerHTML;
        if (!document.getElementById('note-area').innerText.trim()) {
            window.showModal('Note is empty.');
            return;
        }

        const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Note Data</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <meta charset="UTF-8">
        </head>
        <body>
            ${noteContent}
        </body>
        </html>
    `;

        const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const fileName = `Note_${new Date().toLocaleDateString().replace(/\//g, '-')}.xls`;

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const file = new File([blob], fileName, { type: 'application/vnd.ms-excel' });
        document.dispatchEvent(new CustomEvent('save-note-file', {
            detail: { file: file, parentId: 'current' }
        }));

        window.showModal('Excel File Downloaded & Saved to Store!');
    };



    function processSaveNote(targetId) {
        const noteContent = document.getElementById('note-area').innerHTML;
        if (!document.getElementById('note-area').innerText.trim()) {
            showModal('Note is empty.');
            return;
        }

        const fileName = `Note_${new Date().toLocaleDateString().replace(/\//g, '-')}_${new Date().toLocaleTimeString().replace(/:/g, '-')}.html`;

        // Create File Object with extra metadata
        const file = new File([noteContent], fileName, { type: 'text/html' });
        // Attach targetId property to the file object itself doesn't persist well across Events if standard File.
        // Instead we pass a detail object.

        document.dispatchEvent(new CustomEvent('save-note-file', {
            detail: { file: file, parentId: targetId }
        }));
    }

    // Custom Modal Functions (Global Scope)
    function showModal(message) {
        const modal = document.getElementById('custom-modal');
        const msg = document.getElementById('modal-message');
        const actions = document.getElementById('modal-actions');
        const input = document.getElementById('modal-input');
        const select = document.getElementById('modal-select');
        const title = document.getElementById('modal-title');

        if (modal && msg && actions) {
            msg.textContent = message;
            if (title) title.textContent = 'Notification';
            if (input) input.style.display = 'none';
            if (select) select.style.display = 'none';

            actions.innerHTML = '<button class="btn primary" onclick="closeModal()">OK</button>';
            modal.style.display = 'flex';
        } else {
            alert(message);
        }
    }

    function showConfirm(message, onConfirm) {
        const modal = document.getElementById('custom-modal');
        const msg = document.getElementById('modal-message');
        const actions = document.getElementById('modal-actions');
        const input = document.getElementById('modal-input');
        const select = document.getElementById('modal-select');
        const title = document.getElementById('modal-title');

        if (modal && msg && actions) {
            msg.textContent = message;
            if (title) title.textContent = 'Confirm Action';
            if (input) input.style.display = 'none';
            if (select) select.style.display = 'none';

            actions.innerHTML = '';

            const btnYes = document.createElement('button');
            btnYes.className = 'btn primary';
            btnYes.textContent = 'Yes';
            btnYes.onclick = () => {
                onConfirm();
                closeModal();
            };

            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn secondary';
            btnCancel.textContent = 'Cancel';
            btnCancel.onclick = closeModal;

            actions.appendChild(btnYes);
            actions.appendChild(btnCancel);

            modal.style.display = 'flex';
        } else {
            if (confirm(message)) {
                onConfirm();
            }
        }
    }

    function showPrompt(message, onConfirm) {
        const modal = document.getElementById('custom-modal');
        const msg = document.getElementById('modal-message');
        const actions = document.getElementById('modal-actions');
        const input = document.getElementById('modal-input');
        const select = document.getElementById('modal-select');
        const title = document.getElementById('modal-title');

        if (modal && msg && actions && input) {
            msg.textContent = message;
            if (title) title.textContent = 'Input Required';
            input.style.display = 'block';
            if (select) select.style.display = 'none';
            input.value = '';
            input.focus();

            actions.innerHTML = '';

            const btnOk = document.createElement('button');
            btnOk.className = 'btn primary';
            btnOk.textContent = 'OK';
            btnOk.onclick = () => {
                onConfirm(input.value);
                closeModal();
            };

            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn secondary';
            btnCancel.textContent = 'Cancel';
            btnCancel.onclick = closeModal;

            actions.appendChild(btnOk);
            actions.appendChild(btnCancel);

            modal.style.display = 'flex';
            setTimeout(() => input.focus(), 50);
        } else {
            const result = prompt(message);
            if (result !== null) onConfirm(result);
        }
    }

    function showSelect(message, options, onConfirm) {
        const modal = document.getElementById('custom-modal');
        const msg = document.getElementById('modal-message');
        const actions = document.getElementById('modal-actions');
        const input = document.getElementById('modal-input');
        const select = document.getElementById('modal-select');
        const title = document.getElementById('modal-title');

        if (modal && msg && actions && select) {
            msg.textContent = message;
            if (title) title.textContent = 'Select Option';
            if (input) input.style.display = 'none';
            select.style.display = 'block';
            select.innerHTML = '';

            options.forEach(opt => {
                const el = document.createElement('option');
                el.value = opt.value;
                el.textContent = opt.text;
                select.appendChild(el);
            });

            actions.innerHTML = '';

            const btnOk = document.createElement('button');
            btnOk.className = 'btn primary';
            btnOk.textContent = 'Move';
            btnOk.onclick = () => {
                onConfirm(select.value);
                closeModal();
            };

            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn secondary';
            btnCancel.textContent = 'Cancel';
            btnCancel.onclick = closeModal;

            actions.appendChild(btnOk);
            actions.appendChild(btnCancel);

            modal.style.display = 'flex';
            setTimeout(() => select.focus(), 50);
        }
    }

    window.closeModal = function () {
        const modal = document.getElementById('custom-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    };

    // Preview Modal Logic
    window.closePreview = () => {
        const previewModal = document.getElementById('preview-modal');
        const previewContent = document.getElementById('preview-content');
        if (previewModal) {
            previewModal.style.display = 'none';
            if (previewContent) previewContent.innerHTML = ''; // Clear to stop iframes/media
            document.body.style.overflow = ''; // Restore scroll
        }
    };

    function showPreviewModal(filename, content, isUrl = false) {
        const previewModal = document.getElementById('preview-modal');
        const previewContent = document.getElementById('preview-content');
        const previewFilename = document.getElementById('preview-filename');

        if (previewModal && previewContent && previewFilename) {
            previewFilename.textContent = filename;
            if (isUrl) {
                previewContent.innerHTML = `<iframe src="${content}" style="width:100%; height:100%; border:none; background:white;"></iframe>`;
                previewContent.classList.add('frame-mode');
            } else {
                previewContent.innerHTML = `<div class="page">${content}</div>`;
                previewContent.classList.remove('frame-mode');
            }
            previewModal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent main page scroll
        }
    }
});
