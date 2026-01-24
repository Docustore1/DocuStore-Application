// script.js v8.1 - Finalized Auth Sync & Global Scoping
let allFilesData = [];
let currentFolderId = 'root';
let folderHistory = [];

// Backend URL configuration - auto-detect environment
const BACKEND_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:5000'
    : 'https://docustore-backend.onrender.com';

document.addEventListener('DOMContentLoaded', () => {

    // --- Firebase Bridge Initialization ---
    // This ensures script.js only starts talking to Firebase once firebase-init.js (module) is ready.
    function initFirebaseLogic() {
        if (!window.fbOnAuthStateChanged) return;

        window.fbOnAuthStateChanged(async (user) => {
            if (user) {
                console.log("👤 User Logged In:", user.email);

                const settings = await window.fbLoadSettings();
                const hasProfile = settings && settings.collegeName;

                // 1. If Profile Complete -> Go to Store (if on entry or details)
                if (hasProfile) {
                    if (window.location.pathname.endsWith('entry.html') ||
                        window.location.pathname.endsWith('index.html') ||
                        window.location.pathname.endsWith('details.html')) {
                        window.location.href = 'store.html';
                    }
                }
                // 2. If Profile Incomplete -> Go to Details (if on entry)
                else {
                    if (window.location.pathname.endsWith('entry.html') ||
                        window.location.pathname.endsWith('index.html')) {
                        window.location.href = 'details.html';
                    }
                }

                // Update UI in Store (if exists)
                const userEmailDisp = document.getElementById('user-email-display');
                if (userEmailDisp) userEmailDisp.textContent = user.email;

                // Debug: Log user info
                console.log("🔍 User ID:", user.uid);
                console.log("📧 Email:", user.email);

                // Load and display user profile
                if (hasProfile) {
                    localStorage.setItem('docStore_collegeName', settings.collegeName);
                    localStorage.setItem('docStore_userName', settings.userName || '');
                    localStorage.setItem('docStore_userRole', settings.userRole || '');
                    const nameDisplay = document.getElementById('college-name-display');
                    if (nameDisplay) nameDisplay.textContent = settings.collegeName;
                }

                // Load data for store display
                loadFilesFromDB();
                if (document.getElementById('feedback-list')) loadFeedback();
                if (document.getElementById('ticket-list')) loadTickets();

            } else {
                console.log("👤 No user logged in.");
                // Protected route protection: Redirect to entry
                if (window.location.pathname.endsWith('store.html') ||
                    window.location.pathname.endsWith('feedback.html') ||
                    window.location.pathname.endsWith('support.html') ||
                    window.location.pathname.endsWith('details.html')) {
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
            const email = emailInput.value.trim();
            const password = passInput.value;

            // Validation
            if (!email || !password) {
                showModal("Please enter email and password.");
                return;
            }

            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showModal("Please enter a valid email address (e.g., user@example.com)");
                return;
            }

            // Password validation
            if (password.length < 6) {
                showModal("Password must be at least 6 characters long.");
                return;
            }

            try {
                authBtn.disabled = true; authBtn.textContent = "Processing...";
                if (isSignupMode) {
                    await window.fbSignUp(email, password);
                    showModal("Account created! Please complete your profile.");
                }
                else {
                    await window.fbSignIn(email, password);
                }
            } catch (err) {
                let errorMsg = err.message;
                // Handle specific Firebase errors
                if (errorMsg.includes('auth/invalid-email')) errorMsg = "Invalid email format.";
                else if (errorMsg.includes('auth/user-not-found')) errorMsg = "No account found with this email.";
                else if (errorMsg.includes('auth/wrong-password')) errorMsg = "Incorrect password.";
                else if (errorMsg.includes('auth/email-already-in-use')) errorMsg = "Email already in use.";
                else if (errorMsg.includes('auth/weak-password')) errorMsg = "Password is too weak (min 6 characters).";
                else if (errorMsg.includes('auth/invalid-credential')) errorMsg = "Incorrect Email or Password.";

                showModal("Auth Failed: " + errorMsg);
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

        if (btnLogout) {
            btnLogout.addEventListener('click', async () => {
                try {
                    await window.fbSignOut();
                    localStorage.clear();
                    window.location.href = 'entry.html';
                } catch (err) {
                    showModal("Logout Failed: " + err.message);
                }
            });
        }

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
            showModal("Saved to Store Successfully!");
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


        // Click to enter folder OR preview file
        const clickArea = item.querySelector('.file-info-clickable');
        if (fileRecord.isFolder) {
            clickArea.addEventListener('click', (e) => {
                e.preventDefault();
                console.log(`📂 Entering folder: ${fileRecord.name} (${fileRecord.id})`);

                // Construct history item
                let cName = 'Home';
                if (currentFolderId !== 'root') {
                    const c = allFilesData.find(f => f.id === currentFolderId);
                    if (c) cName = c.name;
                }

                folderHistory.push({ id: currentFolderId, name: cName });
                currentFolderId = fileRecord.id;

                // Force update
                renderFileList();
            });
        } else {
            // Click on file to preview it (same as clicking View button)
            clickArea.addEventListener('click', (e) => {
                e.preventDefault();
                const viewBtn = item.querySelector('.view');
                if (viewBtn) viewBtn.click();
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
                    name.endsWith('.htm') ||
                    name.endsWith('.md') ||
                    name.endsWith('.svg') ||
                    name.endsWith('.xml') ||
                    name.endsWith('.jpg') ||
                    name.endsWith('.jpeg') ||
                    name.endsWith('.png') ||
                    name.endsWith('.gif') ||
                    name.endsWith('.webp') ||
                    name.endsWith('.bmp') ||
                    name.endsWith('.ico');

                // IMPROVEMENT: Universal In-App Preview for ALL viewable files
                if (isViewable) {
                    showPreviewModal(fileRecord.name, fileUrl, true);
                    return;
                }

                // Handling for Word Documents (.docx and .doc)
                if (name.endsWith('.docx') || name.endsWith('.doc')) {
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

                // Fallback: Try to preview as text/HTML for unknown file types
                // This handles files without extensions or unrecognized types
                showModal("Loading preview...");
                fetch(fileUrl)
                    .then(response => {
                        if (!response.ok) throw new Error("Could not fetch file content.");
                        return response.text();
                    })
                    .then(text => {
                        closeModal();
                        // Check if content looks like HTML
                        if (text.trim().startsWith('<') && (text.includes('<html') || text.includes('<body') || text.includes('<div') || text.includes('<p'))) {
                            showPreviewModal(fileRecord.name, text, false);
                        } else {
                            // Display as plain text with preformatted styling
                            const escapedText = text
                                .replace(/&/g, '&amp;')
                                .replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;');
                            const formattedContent = `<pre style="white-space: pre-wrap; word-wrap: break-word; font-family: 'Consolas', 'Monaco', monospace; font-size: 14px; line-height: 1.5;">${escapedText}</pre>`;
                            showPreviewModal(fileRecord.name, formattedContent, false);
                        }
                    })
                    .catch(err => {
                        console.error("Preview Error:", err);
                        closeModal();
                        // If can't preview, fall back to download
                        const a = document.createElement('a');
                        a.href = fileUrl;
                        a.download = fileRecord.name;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    });
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

            const ticketData = {
                email,
                type,
                desc,
                submittedAt: new Date().toISOString(),
                id: Date.now().toString()
            };

            let ticketId = null;
            try {
                showModal("Submitting ticket...");

                // Save ticket to localStorage for immediate viewing
                const storedTickets = JSON.parse(localStorage.getItem('docStore_tickets') || '[]');
                storedTickets.unshift(ticketData); // Add to beginning
                localStorage.setItem('docStore_tickets', JSON.stringify(storedTickets));

                // Save ticket to Firebase (if available)
                if (window.fbSubmitTicket) {
                    const res = await window.fbSubmitTicket(ticketData);
                    ticketId = res && res.id;
                }

                // Trigger backend support email (don't block on failure)
                try {
                    const resp = await fetch(`${BACKEND_URL}/api/send-support-email`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, type, desc })
                    });
                    const j = await resp.json().catch(() => null);
                    const ok = resp.ok || (j && j.success);

                    if (ticketId && window.fbUpdateTicketStatus) {
                        await window.fbUpdateTicketStatus(ticketId, { emailSent: ok, emailSentAt: ok ? new Date().toISOString() : null });
                    }

                    if (!ok) console.warn('Support email failed', j || resp.statusText);
                } catch (e) {
                    console.warn('Support email failed (backend may be offline)', e);
                    if (ticketId && window.fbUpdateTicketStatus) {
                        await window.fbUpdateTicketStatus(ticketId, { emailSent: false });
                    }
                }

                showModal("Ticket submitted! We will contact you soon.");
                document.getElementById('support-email').value = '';
                document.getElementById('support-desc').value = '';
                loadTickets();
            } catch (e) {
                console.error(e);
                showModal("Error submitting ticket.");
            }
        });
    }


    // --- Feedback Page Logic ---
    const btnSubmitFeedback = document.getElementById('btn-submit-feedback');
    const feedbackList = document.getElementById('feedback-list');

    if (btnSubmitFeedback) {
        // Star Rating Logic
        const starRating = document.getElementById('star-rating');
        const ratingInput = document.getElementById('feedback-rating');
        const ratingText = document.getElementById('rating-text');

        if (starRating) {
            const stars = starRating.querySelectorAll('.star');
            stars.forEach(star => {
                star.addEventListener('click', () => {
                    const val = parseInt(star.getAttribute('data-value'));
                    ratingInput.value = val;
                    ratingText.textContent = `You selected: ${val} Star${val > 1 ? 's' : ''}`;

                    // Visual update
                    stars.forEach(s => {
                        if (parseInt(s.getAttribute('data-value')) <= val) s.style.color = 'orange';
                        else s.style.color = '#ccc';
                    });
                });
            });
        }

        btnSubmitFeedback.addEventListener('click', async () => {
            const name = document.getElementById('feedback-name').value.trim();
            const rating = document.getElementById('feedback-rating').value;
            const comment = document.getElementById('feedback-comment').value.trim();

            if (!name || rating === "0" || !comment) {
                showModal("Please provide your name, a rating, and a comment.");
                return;
            }

            // Optional: User email (not in form, maybe from auth or prompt?)
            const email = localStorage.getItem('docStore_userEmail') || '';

            const feedbackData = {
                name,
                rating,
                comment,
                email,
                submittedAt: new Date().toISOString(),
                id: Date.now().toString()
            };

            showModal("Sending feedback...");

            try {
                // Save feedback to localStorage for immediate viewing
                const storedFeedback = JSON.parse(localStorage.getItem('docStore_feedback') || '[]');
                storedFeedback.unshift(feedbackData);
                localStorage.setItem('docStore_feedback', JSON.stringify(storedFeedback));

                // Try to send to Backend (SMTP) - don't block on failure
                try {
                    const resp = await fetch(`${BACKEND_URL}/api/send-feedback-notification`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, rating, comment, email })
                    });
                    const j = await resp.json().catch(() => null);
                    if (!resp.ok) {
                        console.warn("Feedback email failed:", j?.message || resp.statusText);
                    }
                } catch (e) {
                    console.warn('Feedback email failed (backend may be offline)', e);
                }

                showModal("Feedback Sent! Thank you.");
                // Clear form
                document.getElementById('feedback-name').value = '';
                document.getElementById('feedback-comment').value = '';
                // Reset stars
                document.querySelectorAll('.star').forEach(s => s.style.color = '#ccc');
                document.getElementById('feedback-rating').value = '0';
                document.getElementById('rating-text').textContent = 'Select a rating';

                // Automatically switch to Feedback Review tab
                const reviewTabBtn = document.querySelector('.tab-btn[data-tab="review-feedback"]');
                if (reviewTabBtn) reviewTabBtn.click();

                loadFeedback(); // Refresh list
            } catch (e) {
                console.error(e);
                showModal("Error submitting feedback.");
            }
        });
    }

    // Helper to fetch emails
    async function fetchEmailsFromBackend(subject) {
        try {
            const resp = await fetch(`${BACKEND_URL}/api/search-emails?subject=${encodeURIComponent(subject)}&max=20`);
            const data = await resp.json();
            return data.emails || [];
        } catch (e) {
            console.error("Error fetching emails:", e);
            return [];
        }
    }

    async function loadFeedback() {
        if (!feedbackList) return;
        feedbackList.innerHTML = '<div style="text-align:center;">Loading reviews...</div>';

        // Get feedback from localStorage
        const storedFeedback = JSON.parse(localStorage.getItem('docStore_feedback') || '[]');

        // Also try to get feedback from email backend
        let emailFeedback = [];
        try {
            emailFeedback = await fetchEmailsFromBackend("Feedback");
        } catch (e) {
            console.warn("Could not fetch feedback from email backend:", e);
        }

        feedbackList.innerHTML = '';

        // Display locally stored feedback first
        if (storedFeedback.length > 0) {
            storedFeedback.forEach(fb => {
                const item = document.createElement('div');
                item.className = 'file-item';
                const date = fb.submittedAt ? new Date(fb.submittedAt).toLocaleString() : 'Unknown';
                const stars = '⭐'.repeat(parseInt(fb.rating) || 0);
                item.innerHTML = `
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--primary-orange);">💬 ${fb.name}</div>
                        <div style="font-size: 1rem; margin-top: 4px;">${stars} (${fb.rating}/5)</div>
                        <div style="font-size: 0.9rem; color: #555; margin-top: 4px;">"${fb.comment}"</div>
                        <div style="font-size: 0.8rem; color: #999; margin-top: 8px;">📅 ${date}</div>
                    </div>
                    <button class="btn-action delete-feedback" data-id="${fb.id}" title="Delete" style="color: red;">❌</button>
                `;
                feedbackList.appendChild(item);

                // Add delete handler
                item.querySelector('.delete-feedback').addEventListener('click', () => {
                    const fbs = JSON.parse(localStorage.getItem('docStore_feedback') || '[]');
                    const updated = fbs.filter(f => f.id !== fb.id);
                    localStorage.setItem('docStore_feedback', JSON.stringify(updated));
                    loadFeedback(); // Refresh
                });
            });
        }

        // Also display email-based feedback if any
        if (emailFeedback.length > 0) {
            emailFeedback.forEach(email => {
                const item = document.createElement('div');
                item.className = 'file-item';
                item.innerHTML = `
                    <div>
                        <div style="font-weight: 600;">${email.subject}</div>
                        <div style="font-size: 0.9rem; color: #555; margin-top: 4px;">${email.snippet}</div>
                        <div style="font-size: 0.8rem; color: #999; margin-top: 8px;">From: ${email.from} | ${email.date}</div>
                    </div>
                `;
                feedbackList.appendChild(item);
            });
        }

        // Show empty state if no feedback
        if (storedFeedback.length === 0 && emailFeedback.length === 0) {
            feedbackList.innerHTML = '<div style="text-align: center; color: #666; padding: 2rem;">No feedback submitted yet.</div>';
        }
    }

    async function loadTickets() {
        const ticketList = document.getElementById('ticket-list');
        if (!ticketList) return;

        ticketList.innerHTML = '<div style="text-align:center;">Loading tickets...</div>';

        // Get tickets from localStorage
        const storedTickets = JSON.parse(localStorage.getItem('docStore_tickets') || '[]');

        // Also try to get tickets from email backend (optional enhancement)
        let emailTickets = [];
        try {
            emailTickets = await fetchEmailsFromBackend("Support");
        } catch (e) {
            console.warn("Could not fetch tickets from email backend:", e);
        }

        ticketList.innerHTML = '';

        // Display locally stored tickets first
        if (storedTickets.length > 0) {
            storedTickets.forEach(ticket => {
                const item = document.createElement('div');
                item.className = 'file-item';
                const date = ticket.submittedAt ? new Date(ticket.submittedAt).toLocaleString() : 'Unknown';
                item.innerHTML = `
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--primary-orange);">🎫 ${ticket.type || 'Support Ticket'}</div>
                        <div style="font-size: 0.9rem; color: #555; margin-top: 4px;">${ticket.desc}</div>
                        <div style="font-size: 0.8rem; color: #999; margin-top: 8px;">
                            📧 ${ticket.email} | 📅 ${date}
                        </div>
                    </div>
                    <button class="btn-action delete-ticket" data-id="${ticket.id}" title="Delete" style="color: red;">❌</button>
                `;
                ticketList.appendChild(item);

                // Add delete handler
                item.querySelector('.delete-ticket').addEventListener('click', () => {
                    const tickets = JSON.parse(localStorage.getItem('docStore_tickets') || '[]');
                    const updated = tickets.filter(t => t.id !== ticket.id);
                    localStorage.setItem('docStore_tickets', JSON.stringify(updated));
                    loadTickets(); // Refresh
                });
            });
        }

        // Also display email-based tickets if any (from backend)
        if (emailTickets.length > 0) {
            emailTickets.forEach(email => {
                const item = document.createElement('div');
                item.className = 'file-item';
                item.innerHTML = `
                    <div>
                        <div style="font-weight: 600;">${email.subject}</div>
                        <div style="font-size: 0.9rem; color: #555; margin-top: 4px;">${email.snippet}</div>
                        <div style="font-size: 0.8rem; color: #999; margin-top: 8px;">From: ${email.from} | ${email.date}</div>
                    </div>
                `;
                ticketList.appendChild(item);
            });
        }

        // Show empty state if no tickets
        if (storedTickets.length === 0 && emailTickets.length === 0) {
            ticketList.innerHTML = '<div style="text-align: center; color: #666; padding: 2rem;">No support tickets submitted yet.</div>';
        }
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

    // Helper for XSS prevention
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"]+/g, function (s) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[s];
        });
    }

    // --- Feedback Page Logic (Email Based) ---
    // (Consolidated above)

    // --- End of DOMContentLoaded ---
});

