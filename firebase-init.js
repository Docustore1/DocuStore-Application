import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, setDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

// Configuration
const firebaseConfig = {
    apiKey: "AIzaSyArNEB56qk8CjC1N7SLhQ87IIN7rUMjnDw",
    authDomain: "docu-store-college-erp.firebaseapp.com",
    projectId: "docu-store-college-erp",
    storageBucket: "docu-store-college-erp.firebasestorage.app",
    messagingSenderId: "436397409420",
    appId: "1:436397409420:web:87e38538e8866cf65b27a9",
    measurementId: "G-LZLZWBEJ7P"
};

// Initialize
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const storage = getStorage(app);

console.log("🔥 Firebase Initialized");

// --- Expose Services to Global Scope (Bridge) ---
window.firebaseDB = db;
window.firebaseStorage = storage;

// --- Helper Functions (Exposed) ---

// 1. Upload File
window.fbUploadFile = async (file, parentId) => {
    try {
        // Enforce 5MB Limit
        if (file.size > 5 * 1024 * 1024) {
            throw new Error("File is too large. limit is 5MB.");
        }

        let url;
        let storagePath = null;
        const timestamp = Date.now();

        // SMART UPLOAD STRATEGY:
        // If file is small (< 500KB), store as Data URI in Firestore directly.
        // This BYPASSES CORS issues on localhost and makes it faster for small notes/images.
        if (file.size < 500 * 1024) {
            console.log("ℹ️ Small file detected: Saving to Firestore as Data URI.");
            url = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(file);
            });
        } else {
            // Larger files go to Storage
            storagePath = `files/${timestamp}_${file.name}`;

            // CHECK HOSTNAME: Warn about CORS if on localhost for large files
            if ((window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')) {
                console.warn("⚠️ Uploading large file on localhost. If this fails, it is due to CORS.");
            }

            const storageRef = ref(storage, storagePath);
            const snapshot = await uploadBytes(storageRef, file);
            url = await getDownloadURL(snapshot.ref);
        }

        // Save Metadata to Firestore
        const docRef = await addDoc(collection(db, "files"), {
            name: file.name,
            type: file.type,
            size: file.size,
            url: url,
            storagePath: storagePath, // Null for Data URI files
            parentId: parentId || 'root', // root or folder ID
            isFolder: false,
            createdAt: new Date().toISOString()
        });

        return { id: docRef.id, ...file, url };
    } catch (error) {
        console.error("Upload Error:", error);
        // Clean up error message for user
        if (error.code === 'storage/unauthorized') {
            throw new Error("Storage Unauthorized. Check Firebase Rules.");
        } else if (error.message.includes('network error') || error.code === 'storage/canceled') {
            throw new Error("Network/CORS Error. (Data URI fallback used for small files, but this file was too big)");
        }
        throw error;
    }
};

// 2. Create Folder
window.fbCreateFolder = async (folderName, parentId) => {
    try {
        const docRef = await addDoc(collection(db, "files"), {
            name: folderName,
            isFolder: true,
            parentId: parentId || 'root',
            createdAt: new Date().toISOString()
        });
        return { id: docRef.id, name: folderName, isFolder: true, parentId };
    } catch (e) {
        console.error("Create Folder Error:", e);
        throw e;
    }
};

// 3. Fetch Files
window.fbFetchFiles = async () => {
    try {
        // Query files where 'isTrashed' is not true (false or undefined)
        // complex queries in firebase need index. easier to just fetch all and filter client side for small apps
        // or simple where clause if possible. 
        // Let's filter client side to avoid index creation issues for now, or use a simple where if index exists.
        // Given previous context of "index error", let's be safe and filter client side or use basic queries.
        // Actually, let's try a strict query but handle potential index requirements if they arise. 
        // Safest for "quick fix": Fetch all, filter in JS. 
        const q = query(collection(db, "files"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const files = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (!data.isTrashed) {
                files.push({ id: doc.id, ...data });
            }
        });
        return files;
    } catch (e) {
        console.error("Fetch Error:", e);
        return [];
    }
};

// 4. Delete Item (Soft Delete)
window.fbDeleteItem = async (id, isFolder, storagePath) => {
    try {
        // Soft Delete: Just mark as trashed
        const docRef = doc(db, "files", id);
        await updateDoc(docRef, {
            isTrashed: true,
            trashedAt: new Date().toISOString()
        });

        // We do NOT delete from storage in soft delete
        console.log(`Soft deleted item ${id}`);
    } catch (e) {
        console.error("Delete Error:", e);
        throw e;
    }
};

// 4.5 Rename Item
window.fbRenameItem = async (id, newName) => {
    try {
        const docRef = doc(db, "files", id);
        await updateDoc(docRef, {
            name: newName
        });
    } catch (e) {
        console.error("Rename Error:", e);
        throw e;
    }
};

// 4.6 Move Item
window.fbMoveFile = async (id, newParentId) => {
    try {
        const docRef = doc(db, "files", id);
        await updateDoc(docRef, {
            parentId: newParentId
        });
    } catch (e) {
        console.error("Move Error:", e);
        throw e;
    }
};

// 5. Submit Feedback
window.fbSubmitFeedback = async (data) => {
    await addDoc(collection(db, "feedback"), {
        ...data,
        createdAt: new Date().toISOString()
    });
};

// 6. Submit Support Ticket
window.fbSubmitTicket = async (data) => {
    await addDoc(collection(db, "tickets"), {
        ...data,
        createdAt: new Date().toISOString(),
        status: 'Open'
    });
};

// 7. Fetch Feedback
window.fbFetchFeedback = async () => {
    const q = query(collection(db, "feedback"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// 8. Fetch Tickets
window.fbFetchTickets = async () => {
    const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// 9. Save Settings
window.fbSaveSettings = async (data) => {
    console.log("Saving settings to Firestore:", data);
    await setDoc(doc(db, "settings", "college_profile"), {
        ...data,
        updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log("Settings saved successfully.");
};
