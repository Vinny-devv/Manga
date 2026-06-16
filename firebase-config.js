// ============================================================
// firebase-config.js — Firebase initialization & exports
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyB9Z5Tjc0yWg69GlWdUBTZ9VgUcGrh5mMU",
  authDomain: "v-scans.firebaseapp.com",
  projectId: "v-scans",
  storageBucket: "v-scans.firebasestorage.app",
  messagingSenderId: "545198752043",
  appId: "1:545198752043:web:efdc1656b5fd4f354ec56e",
  measurementId: "G-NDQER8NPM9"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with Google Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore database
export const db = getFirestore(app);

// Admin email — ONLY this user has admin access
export const ADMIN_EMAIL = "anwarbah96@gmail.com";

// ImgBB API key for image uploads
export const IMGBB_API_KEY = "bf32151ce65f47f2707753b98cfa9b67";
