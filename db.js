// ============================================================
// db.js — Firestore CRUD operations for Manga, Chapters, Comments
// ============================================================
import {
  collection, doc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, setDoc, query, orderBy, serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// ─── Collection references ────────────────────────────────────
const mangaCol = () => collection(db, "manga");
const chaptersCol = (mangaId) => collection(db, "manga", mangaId, "chapters");
const commentsCol = (mangaId, chapterId) =>
  collection(db, "manga", mangaId, "chapters", chapterId, "comments");

// ─── MANGA ────────────────────────────────────────────────────

/**
 * Fetch all manga documents, ordered by title.
 * @returns {Promise<Array>} Array of { id, ...data }
 */
export async function getAllManga() {
  const snap = await getDocs(query(mangaCol(), orderBy("title")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch a single manga document by ID.
 * @param {string} mangaId
 * @returns {Promise<Object|null>}
 */
export async function getMangaById(mangaId) {
  const snap = await getDoc(doc(db, "manga", mangaId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Add a new manga document.
 * @param {{ title, coverUrl, genres, description }} data
 * @returns {Promise<string>} New document ID
 */
export async function addManga({ title, coverUrl, genres, description }) {
  const ref = await addDoc(mangaCol(), {
    title: title.trim(),
    coverUrl: coverUrl.trim(),
    genres: Array.isArray(genres) ? genres : [genres],
    description: description.trim(),
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Update an existing manga document.
 * @param {string} mangaId
 * @param {Object} updates
 */
export async function updateManga(mangaId, updates) {
  await updateDoc(doc(db, "manga", mangaId), updates);
}

/**
 * Delete a manga document and all sub-collections (chapters).
 * Note: Firestore does NOT auto-delete sub-collections; do a best-effort batch.
 * @param {string} mangaId
 */
export async function deleteManga(mangaId) {
  // Delete all chapters first
  const chaps = await getDocs(chaptersCol(mangaId));
  for (const chap of chaps.docs) {
    // Delete comments inside chapter
    const comSnap = await getDocs(commentsCol(mangaId, chap.id));
    for (const com of comSnap.docs) await deleteDoc(com.ref);
    await deleteDoc(chap.ref);
  }
  await deleteDoc(doc(db, "manga", mangaId));
}

// ─── CHAPTERS ─────────────────────────────────────────────────

/**
 * Fetch all chapters for a manga, ordered by chapter number.
 * @param {string} mangaId
 * @returns {Promise<Array>}
 */
export async function getChapters(mangaId) {
  const snap = await getDocs(query(chaptersCol(mangaId), orderBy("number")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetch a single chapter.
 * @param {string} mangaId
 * @param {string} chapterId
 * @returns {Promise<Object|null>}
 */
export async function getChapterById(mangaId, chapterId) {
  const snap = await getDoc(doc(db, "manga", mangaId, "chapters", chapterId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Add a new chapter with an array of image URLs.
 * @param {string} mangaId
 * @param {{ number, title, imageUrls }} data
 * @returns {Promise<string>} New chapter ID
 */
export async function addChapter(mangaId, { number, title, imageUrls }) {
  const ref = await addDoc(chaptersCol(mangaId), {
    number: Number(number),
    title: title ? title.trim() : `Chapter ${number}`,
    imageUrls: imageUrls,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Delete a chapter and its comments.
 * @param {string} mangaId
 * @param {string} chapterId
 */
export async function deleteChapter(mangaId, chapterId) {
  const comSnap = await getDocs(commentsCol(mangaId, chapterId));
  for (const com of comSnap.docs) await deleteDoc(com.ref);
  await deleteDoc(doc(db, "manga", mangaId, "chapters", chapterId));
}

// ─── USER PROFILES ────────────────────────────────────────────

/**
 * Create or update a user's profile document in the "users" collection.
 * Uses setDoc with merge:true so it never overwrites unrelated fields.
 * Called after every successful profile save so Firestore stays in sync
 * with Firebase Auth (which is the source of truth for displayName/photoURL).
 *
 * @param {string} uid        - Firebase Auth user UID (used as document ID)
 * @param {string} displayName
 * @param {string} photoURL
 */
export async function upsertUserProfile(uid, displayName, photoURL) {
  await setDoc(
    doc(db, "users", uid),
    { displayName, photoURL, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ─── COMMENTS ─────────────────────────────────────────────────

/**
 * Listen to comments for a chapter in real-time.
 * @param {string} mangaId
 * @param {string} chapterId
 * @param {Function} callback - Receives array of comment objects
 * @returns {Function} Unsubscribe function
 */
export function listenToComments(mangaId, chapterId, callback) {
  const q = query(commentsCol(mangaId, chapterId), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(comments);
  });
}

/**
 * Add a comment to a chapter.
 * @param {string} mangaId
 * @param {string} chapterId
 * @param {{ uid, displayName, photoURL, text }} data
 */
export async function addComment(mangaId, chapterId, { uid, displayName, photoURL, text }) {
  await addDoc(commentsCol(mangaId, chapterId), {
    uid,
    displayName: displayName || "Anonymous",
    photoURL: photoURL || "",
    text: text.trim(),
    createdAt: serverTimestamp()
  });
}

/**
 * Delete a comment (admin or own comment).
 */
export async function deleteComment(mangaId, chapterId, commentId) {
  await deleteDoc(doc(db, "manga", mangaId, "chapters", chapterId, "comments", commentId));
}
