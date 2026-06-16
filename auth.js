// ============================================================
// auth.js — Authentication logic (Google Sign-In, profile updates)
// ============================================================
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth, googleProvider, ADMIN_EMAIL } from "./firebase-config.js";

/**
 * Sign in with Google popup.
 * Returns the signed-in user or throws an error.
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error("Google Sign-In error:", err);
    throw err;
  }
}

/**
 * Sign out the current user.
 */
export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Sign-out error:", err);
    throw err;
  }
}

/**
 * Listen to auth state changes.
 * @param {Function} callback - Called with (user | null) on every auth change.
 */
export function onAuthChange(callback) {
  onAuthStateChanged(auth, callback);
}

/**
 * Update the current user's display name and/or photo URL.
 * Persists to Firebase Auth profile.
 * @param {string|null} displayName
 * @param {string|null} photoURL
 */
export async function updateUserProfile(displayName, photoURL) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user is currently signed in.");
  const updates = {};
  if (displayName !== null && displayName.trim() !== "") updates.displayName = displayName.trim();
  if (photoURL !== null && photoURL.trim() !== "") updates.photoURL = photoURL.trim();
  await updateProfile(user, updates);
  return auth.currentUser;
}

/**
 * Check whether the currently signed-in user is the admin.
 * @returns {boolean}
 */
export function isAdmin() {
  const user = auth.currentUser;
  return !!(user && user.email === ADMIN_EMAIL);
}

/**
 * Get the current Firebase Auth user synchronously.
 * @returns {import("firebase/auth").User | null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}
