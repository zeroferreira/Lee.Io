// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBqAknzI2MSUX14hEbdMTIkE_kc30jsqdk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "leeio-f1ab6.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "leeio-f1ab6",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "leeio-f1ab6.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "741889878750",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:741889878750:web:da7d9f3c9facfc5a9db04f",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-GY5RC0L38D"
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
