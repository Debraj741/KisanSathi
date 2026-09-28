import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDuwV6SASHCG98WJUlsL6eZsZ4Qq_6jqig",
  authDomain: "kisansathi-5f384.firebaseapp.com",
  projectId: "kisansathi-5f384",
  storageBucket: "kisansathi-5f384.firebasestorage.app",
  messagingSenderId: "1009666527006",
  appId: "1:1009666527006:web:35e205843ef77e2547030f",
  measurementId: "G-F2L97RD6NM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, provider);
export const logout = () => signOut(auth);
export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);