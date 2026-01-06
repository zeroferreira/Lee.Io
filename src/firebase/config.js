// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBqAknzI2MSUX14hEbdMTIkE_kc30jsqdk",
  authDomain: "leeio-f1ab6.firebaseapp.com",
  projectId: "leeio-f1ab6",
  storageBucket: "leeio-f1ab6.firebasestorage.app",
  messagingSenderId: "741889878750",
  appId: "1:741889878750:web:da7d9f3c9facfc5a9db04f",
  measurementId: "G-GY5RC0L38D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics only in production/non-localhost to avoid ad-blocker errors
export const analytics = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
  ? getAnalytics(app) 
  : null;

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
