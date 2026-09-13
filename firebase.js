// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB9yV6wi5FxUyGe0zO36T2i6fXKGib84mE",
  authDomain: "cbtwebapp-a5c83.firebaseapp.com",
  projectId: "cbtwebapp-a5c83",
  storageBucket: "cbtwebapp-a5c83.firebasestorage.app",
  messagingSenderId: "840520466561",
  appId: "1:840520466561:web:e8e61343742305dd450d80",
  measurementId: "G-E2TJDCNF90"
};

// Initialize Firebase singleton safely to avoid duplicate app errors
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
const db = getFirestore(app);

export { app, analytics, db, firebaseConfig };
export default app;

