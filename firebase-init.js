import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, setDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

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
const auth = getAuth(app);

console.log("🔥 Firebase Initialized with Auth");

// --- Expose Services to Global Scope (Bridge) ---
window.firebaseDB = db;
window.firebaseStorage = storage;
window.firebaseAuth = auth;

// --- Auth Helper Functions ---
window.fbSignUp = (email, password) => createUserWithEmailAndPassword(auth, email, password);
window.fbSignIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
window.fbSignOut = () => signOut(auth);
window.fbOnAuthStateChanged = (callback) => onAuthStateChanged(auth, callback);

// --- Helper Functions (Exposed) ---

// 1. Upload File (Scoped to User)
window.fbUploadFile = async (file, parentId) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized: No user logged in.");

    try {
        // Enforce 5MB Limit
        if (file.size > 5 * 1024 * 1024) {
            throw new Error("File is too large. limit is 5MB.");
        }

        let url;
        let storagePath = null;
        const timestamp = Date.now();

        if (file.size < 500 * 1024) {
            url = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(file);
            });
        } else {
            storagePath = `users/${user.uid}/files/${timestamp}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const snapshot = await uploadBytes(storageRef, file);
            url = await getDownloadURL(snapshot.ref);
        }

        // Save Metadata to Firestore with userId
        const docRef = await addDoc(collection(db, "files"), {
            userId: user.uid,
            name: file.name,
            type: file.type,
            size: file.size,
            url: url,
            storagePath: storagePath,
            parentId: parentId || 'root',
            isFolder: false,
            createdAt: new Date().toISOString()
        });

        return { id: docRef.id, ...file, url };
    } catch (error) {
        console.error("Upload Error:", error);
        throw error;
    }
};

// 2. Create Folder (Scoped to User)
window.fbCreateFolder = async (folderName, parentId) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");

    try {
        const docRef = await addDoc(collection(db, "files"), {
            userId: user.uid,
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

// 3. Fetch Files (Filtered by User)
window.fbFetchFiles = async () => {
    const user = auth.currentUser;
    if (!user) return [];

    try {
        // Fetch only files belonging to THIS user
        const q = query(
            collection(db, "files"),
            where("userId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const files = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (!data.isTrashed) {
                files.push({ id: doc.id, ...data });
            }
        });

        // Sort client-side by createdAt descending
        return files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (e) {
        console.error("Fetch Error:", e);
        return [];
    }
};

// 4. Delete Item (Soft Delete)
window.fbDeleteItem = async (id, isFolder, storagePath) => {
    try {
        const docRef = doc(db, "files", id);
        await updateDoc(docRef, {
            isTrashed: true,
            trashedAt: new Date().toISOString()
        });
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
        throw e;
    }
};

// 5. Submit Feedback (Scoped to User)
window.fbSubmitFeedback = async (data) => {
    const user = auth.currentUser;
    const docRef = await addDoc(collection(db, "feedback"), {
        ...data,
        userId: user ? user.uid : 'anonymous',
        createdAt: new Date().toISOString()
    });
    return { id: docRef.id };
};

// Update feedback document status (e.g., emailSent)
window.fbUpdateFeedbackStatus = async (id, statusObj) => {
    const docRef = doc(db, "feedback", id);
    await updateDoc(docRef, statusObj);
    return true;
};

// 6. Submit Support Ticket (Scoped to User)
window.fbSubmitTicket = async (data) => {
    const user = auth.currentUser;
    const docRef = await addDoc(collection(db, "tickets"), {
        ...data,
        userId: user ? user.uid : 'anonymous',
        createdAt: new Date().toISOString(),
        status: 'Open'
    });
    return { id: docRef.id };
};

// Update ticket document status (e.g., emailSent)
window.fbUpdateTicketStatus = async (id, statusObj) => {
    const docRef = doc(db, "tickets", id);
    await updateDoc(docRef, statusObj);
    return true;
};

// 7. Fetch Feedback (Only yours)
window.fbFetchFeedback = async () => {
    const user = auth.currentUser;
    if (!user) return [];
    const q = query(
        collection(db, "feedback"),
        where("userId", "==", user.uid)
    );
    const snap = await getDocs(q);
    const feedback = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return feedback.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// 8. Fetch Tickets (Only yours)
window.fbFetchTickets = async () => {
    const user = auth.currentUser;
    if (!user) return [];
    const q = query(
        collection(db, "tickets"),
        where("userId", "==", user.uid)
    );
    const snap = await getDocs(q);
    const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// 9. Save Settings (Scoped to User)
window.fbSaveSettings = async (data) => {
    const user = auth.currentUser;
    if (!user) return;

    await setDoc(doc(db, "users", user.uid), {
        ...data,
        updatedAt: new Date().toISOString()
    }, { merge: true });
};

// 10. Load Settings
window.fbLoadSettings = async () => {
    const user = auth.currentUser;
    if (!user) return null;
    const docSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", user.uid)));
    if (!docSnap.empty) return docSnap.docs[0].data();
    return null;
};
