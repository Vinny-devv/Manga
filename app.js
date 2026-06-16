// ============================================================
// app.js — V Scans SPA main application
// ============================================================
import { signInWithGoogle, signOutUser, onAuthChange, updateUserProfile, isAdmin, getCurrentUser } from "./auth.js";
import {
  getAllManga, getMangaById, addManga, updateManga, deleteManga,
  getChapters, getChapterById, addChapter, deleteChapter,
  listenToComments, addComment, deleteComment,
  upsertUserProfile
} from "./db.js";
import { uploadMultipleImages, uploadAvatarToImgBB } from "./imgbb.js";
import { router } from "./router.js";

// ─── State ────────────────────────────────────────────────────
let currentUser = null;
let commentUnsubscribe = null; // Firestore listener cleanup

// ─── Utility: Toast Notifications ────────────────────────────
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === "success" ? "fa-circle-check" : "fa-circle-xmark"}"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ─── Utility: Format Firestore timestamp ─────────────────────
function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Utility: Set loading state on a button ──────────────────
function setButtonLoading(btn, loading, originalText) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.original = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Loading…`;
  } else {
    btn.disabled = false;
    btn.innerHTML = originalText || btn.dataset.original || btn.innerHTML;
  }
}

// ─── Sidebar Toggle ───────────────────────────────────────────
function initSidebar() {
  const toggle = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  toggle?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("visible");
  });

  overlay?.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("visible");
  });

  // Close sidebar on sidebar link click (mobile)
  sidebar?.querySelectorAll(".sidebar-link").forEach(link => {
    link.addEventListener("click", () => {
      if (window.innerWidth < 768) {
        sidebar.classList.remove("open");
        overlay.classList.remove("visible");
      }
    });
  });
}

// ─── Navbar Auth UI ───────────────────────────────────────────
function updateNavbar(user) {
  const signinBtn = document.getElementById("btn-google-signin");
  const userMenuTrigger = document.getElementById("user-menu-trigger");
  const userDropdown = document.getElementById("user-dropdown");
  const displayNameEl = document.getElementById("user-display-name");
  const avatarEl = document.getElementById("user-avatar");
  const adminNavLink = document.getElementById("admin-nav-link");

  if (user) {
    signinBtn.style.display = "none";
    userMenuTrigger.style.display = "flex";
    displayNameEl.textContent = user.displayName || "User";
    avatarEl.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "U")}&background=7c3aed&color=fff`;
    // Show admin link in sidebar if admin
    if (adminNavLink) adminNavLink.style.display = user.email === "anwarbah96@gmail.com" ? "flex" : "none";
  } else {
    signinBtn.style.display = "flex";
    userMenuTrigger.style.display = "none";
    if (userDropdown) userDropdown.style.display = "none";
    if (adminNavLink) adminNavLink.style.display = "none";
  }
}

function initNavbarDropdown() {
  const trigger = document.getElementById("user-menu-trigger");
  const dropdown = document.getElementById("user-dropdown");

  trigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isVisible = dropdown.style.display === "block";
    dropdown.style.display = isVisible ? "none" : "block";
  });

  document.addEventListener("click", () => {
    if (dropdown) dropdown.style.display = "none";
  });

  document.getElementById("btn-signout")?.addEventListener("click", async () => {
    await signOutUser();
    showToast("Signed out successfully");
    router.navigate("#/");
  });

  document.getElementById("btn-open-profile")?.addEventListener("click", () => {
    if (dropdown) dropdown.style.display = "none";
    openProfileModal();
  });

  document.getElementById("btn-google-signin")?.addEventListener("click", async () => {
    try {
      await signInWithGoogle();
      showToast("Signed in successfully!");
    } catch (e) {
      showToast("Sign-in failed. Please try again.", "error");
    }
  });
}

// ─── Profile Modal ────────────────────────────────────────────
function openProfileModal() {
  const user = getCurrentUser();
  if (!user) return;

  closeAllModals();

  // Fallback avatar (ui-avatars) used when user has no photo yet
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "U")}&background=7c3aed&color=fff`;
  const currentAvatar  = user.photoURL || fallbackAvatar;

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.id = "modal-profile";

  modal.innerHTML = `
    <div class="modal-box">

      <!-- Header -->
      <div class="modal-header">
        <h2><i class="fa-solid fa-user-pen"></i> Profile Settings</h2>
        <button class="modal-close" aria-label="Close"
                onclick="document.getElementById('modal-profile').remove()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Avatar picker widget -->
      <div class="avatar-picker">
        <!-- Clickable ring that opens the hidden file input -->
        <button class="avatar-picker-ring" id="avatar-ring-btn"
                type="button" title="Click to change profile picture"
                aria-label="Change profile picture">
          <img id="profile-preview-img"
               src="${currentAvatar}"
               alt="Avatar preview"
               onerror="this.src='${fallbackAvatar}'">
          <!-- Camera overlay icon -->
          <span class="avatar-picker-overlay" aria-hidden="true">
            <i class="fa-solid fa-camera"></i>
          </span>
        </button>
        <!-- Hidden real file input -->
        <input type="file" id="profile-photo-file"
               accept="image/*" hidden aria-hidden="true">
        <!-- Status label shown below the ring -->
        <p class="avatar-picker-label" id="avatar-file-label">
          Click the image to choose a new photo
        </p>
        <!-- Upload progress bar (hidden until upload starts) -->
        <div class="upload-progress" id="avatar-progress-wrap" style="display:none">
          <div class="upload-progress-bar" id="avatar-progress-bar" style="width:0%"></div>
        </div>
      </div>

      <!-- Display name field -->
      <div class="form-group">
        <label class="form-label" for="profile-name">
          <i class="fa-solid fa-signature" style="margin-right:0.35rem;color:var(--accent-cyan)"></i>
          Display Name
        </label>
        <input class="form-input" id="profile-name" type="text"
               value="${escHtml(user.displayName || "")}"
               placeholder="Your display name" autocomplete="nickname">
      </div>

      <!-- Save button -->
      <button class="btn btn-primary" id="btn-save-profile"
              style="width:100%;margin-top:0.25rem">
        <i class="fa-solid fa-floppy-disk"></i> Save Changes
      </button>

    </div>
  `;

  document.body.appendChild(modal);

  // ── Wire up the avatar picker ──────────────────────────────
  const ringBtn    = document.getElementById("avatar-ring-btn");
  const fileInput  = document.getElementById("profile-photo-file");
  const previewImg = document.getElementById("profile-preview-img");
  const fileLabel  = document.getElementById("avatar-file-label");

  // Clicking the ring / preview image opens the file picker
  ringBtn.addEventListener("click", () => fileInput.click());

  // When the user selects a file: validate + show local preview immediately
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    // Quick client-side MIME check before we even try to upload
    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid image file.", "error");
      fileInput.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be smaller than 5 MB.", "error");
      fileInput.value = "";
      return;
    }

    // Show instant local preview via Object URL (no upload yet)
    const localURL = URL.createObjectURL(file);
    previewImg.src = localURL;
    fileLabel.textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    fileLabel.style.color = "var(--accent-cyan)";
  });

  // ── Save Changes handler ───────────────────────────────────
  document.getElementById("btn-save-profile")
    .addEventListener("click", async () => {
      const btn         = document.getElementById("btn-save-profile");
      const displayName = document.getElementById("profile-name").value.trim();
      const file        = fileInput.files[0] ?? null;

      // Validation
      if (!displayName) {
        showToast("Display name cannot be empty.", "error");
        return;
      }

      setButtonLoading(btn, true);

      const progressWrap = document.getElementById("avatar-progress-wrap");
      const progressBar  = document.getElementById("avatar-progress-bar");
      const statusLabel  = document.getElementById("avatar-file-label");

      try {
        let finalPhotoURL = user.photoURL || ""; // keep existing if no new file chosen

        // ── Step 1: Upload new avatar if a file was selected ──
        if (file) {
          progressWrap.style.display = "block";
          statusLabel.textContent    = "Uploading to ImgBB…";

          finalPhotoURL = await uploadAvatarToImgBB(file, (pct) => {
            progressBar.style.width = pct + "%";
            statusLabel.textContent = `Uploading… ${pct}%`;
          });

          statusLabel.textContent    = "Upload complete ✓";
          progressBar.style.width    = "100%";
        }

        // ── Step 2: Update Firebase Auth profile ───────────────
        await updateUserProfile(displayName, finalPhotoURL);

        // ── Step 3: Sync to Firestore "users" collection ───────
        // This lets comment avatars auto-update for future comments
        const freshUser = getCurrentUser();
        await upsertUserProfile(freshUser.uid, displayName, finalPhotoURL);

        // ── Step 4: Refresh navbar avatar + name ──────────────
        updateNavbar(freshUser);

        showToast("Profile updated successfully!");
        document.getElementById("modal-profile")?.remove();

      } catch (err) {
        console.error("Profile save error:", err);
        showToast(err.message || "Failed to update profile.", "error");
        progressBar.style.width = "0%";
        statusLabel.textContent = "Upload failed — please try again.";
        statusLabel.style.color = "var(--accent-pink)";
      } finally {
        setButtonLoading(btn, false);
      }
    });

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

// ─── Close All Modals ─────────────────────────────────────────
function closeAllModals() {
  document.querySelectorAll(".modal-backdrop").forEach(m => m.remove());
}

// ─── Render: Loading State ────────────────────────────────────
function renderLoading() {
  document.getElementById("main-content").innerHTML = `
    <div class="loading-overlay">
      <div class="spinner"></div>
      <p>Loading…</p>
    </div>
  `;
}

// ─── PAGE: Home ───────────────────────────────────────────────
async function renderHome() {
  document.title = "V Scans — Home";
  renderLoading();

  try {
    const mangaList = await getAllManga();
    const main = document.getElementById("main-content");

    let cardsHTML = "";
    if (mangaList.length === 0) {
      cardsHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-book-open"></i>
          <p>No manga available yet. Check back soon!</p>
        </div>`;
    } else {
      cardsHTML = mangaList.map(m => `
        <div class="manga-card" data-id="${m.id}" onclick="window.location.hash='#/manga/${m.id}'">
          <div class="manga-card-cover">
            <img src="${m.coverUrl || 'https://via.placeholder.com/200x290/1a1a2e/7c3aed?text=No+Cover'}"
                 alt="${escHtml(m.title)}" loading="lazy"
                 onerror="this.src='https://via.placeholder.com/200x290/1a1a2e/7c3aed?text=No+Cover'">
            <div class="manga-card-overlay">
              <span>${Array.isArray(m.genres) ? escHtml(m.genres[0]) : escHtml(m.genres || "")}</span>
            </div>
          </div>
          <div class="manga-card-body">
            <div class="manga-card-title">${escHtml(m.title)}</div>
            <div class="manga-card-genre">${Array.isArray(m.genres) ? m.genres.map(escHtml).join(", ") : escHtml(m.genres || "")}</div>
          </div>
        </div>
      `).join("");
    }

    main.innerHTML = `
      <div class="hero-banner">
        <div class="hero-banner-content">
          <h1><i class="fa-solid fa-book-open-reader"></i> V Scans</h1>
          <p>Your ultimate destination for Manga & Manhwa — read free, read now.</p>
        </div>
      </div>
      <div class="section-title"><span>Latest Manga</span></div>
      <div id="manga-grid">${cardsHTML}</div>
    `;
  } catch (err) {
    document.getElementById("main-content").innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>Failed to load manga. Please refresh the page.</p>
      </div>`;
    console.error("Home load error:", err);
  }
}

// ─── PAGE: Manga Detail ───────────────────────────────────────
async function renderMangaDetail(mangaId) {
  document.title = "V Scans — Loading…";
  renderLoading();
  try {
    const [manga, chapters] = await Promise.all([getMangaById(mangaId), getChapters(mangaId)]);
    if (!manga) {
      document.getElementById("main-content").innerHTML = `<div class="empty-state"><p>Manga not found.</p></div>`;
      return;
    }
    document.title = `V Scans — ${manga.title}`;

    const admin = isAdmin();
    const genreList = Array.isArray(manga.genres) ? manga.genres : [manga.genres || ""];

    let chaptersHTML = "";
    if (chapters.length === 0) {
      chaptersHTML = `<div class="empty-state"><i class="fa-solid fa-book"></i><p>No chapters yet.</p></div>`;
    } else {
      chaptersHTML = chapters.map(ch => `
        <div class="chapter-item" id="chap-item-${ch.id}">
          <span class="chap-num">Ch. ${ch.number}</span>
          <span class="chap-title" onclick="window.location.hash='#/manga/${mangaId}/chapter/${ch.id}'" style="cursor:pointer;flex:1">
            ${escHtml(ch.title || `Chapter ${ch.number}`)}
          </span>
          <span class="chap-date">${formatDate(ch.createdAt)}</span>
          ${admin ? `
            <div class="admin-chap-actions">
              <button class="btn btn-danger btn-sm" onclick="handleDeleteChapter('${mangaId}','${ch.id}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          ` : ""}
        </div>
      `).join("");
    }

    document.getElementById("main-content").innerHTML = `
      <div id="manga-detail-page">
        <button class="back-btn" onclick="window.location.hash='#/'">
          <i class="fa-solid fa-arrow-left"></i> Back to Home
        </button>
        <div class="manga-detail-hero">
          <div class="manga-detail-cover">
            <img src="${manga.coverUrl || 'https://via.placeholder.com/200x290/1a1a2e/7c3aed?text=No+Cover'}"
                 alt="${escHtml(manga.title)}"
                 onerror="this.src='https://via.placeholder.com/200x290/1a1a2e/7c3aed?text=No+Cover'">
          </div>
          <div class="manga-detail-info">
            <h1>${escHtml(manga.title)}</h1>
            <div class="genre-tags">
              ${genreList.map(g => `<span class="genre-tag">${escHtml(g)}</span>`).join("")}
            </div>
            <p>${escHtml(manga.description || "No description available.")}</p>
            ${admin ? `
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
                <button class="btn btn-ghost btn-sm" onclick="openEditMangaModal('${mangaId}')">
                  <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button class="btn btn-danger btn-sm" onclick="handleDeleteManga('${mangaId}')">
                  <i class="fa-solid fa-trash"></i> Delete
                </button>
                <button class="btn btn-primary btn-sm" onclick="openAddChapterModal('${mangaId}')">
                  <i class="fa-solid fa-plus"></i> Add Chapter
                </button>
              </div>
            ` : ""}
          </div>
        </div>
        <div class="section-title"><span>Chapters (${chapters.length})</span></div>
        <div class="chapter-list">${chaptersHTML}</div>
      </div>
    `;

    // Expose admin handlers
    window.handleDeleteChapter = handleDeleteChapter;
    window.handleDeleteManga = handleDeleteManga;
    window.openEditMangaModal = openEditMangaModal;
    window.openAddChapterModal = openAddChapterModal;

  } catch (err) {
    console.error("Manga detail error:", err);
    document.getElementById("main-content").innerHTML = `<div class="empty-state"><p>Error loading manga.</p></div>`;
  }
}

// ─── PAGE: Chapter Reader ─────────────────────────────────────
async function renderReader(mangaId, chapterId) {
  document.title = "V Scans — Reading…";
  renderLoading();

  // Cleanup previous comment listener
  if (commentUnsubscribe) { commentUnsubscribe(); commentUnsubscribe = null; }

  try {
    const [manga, chapter, chapters] = await Promise.all([
      getMangaById(mangaId),
      getChapterById(mangaId, chapterId),
      getChapters(mangaId)
    ]);

    if (!chapter) {
      document.getElementById("main-content").innerHTML = `<div class="empty-state"><p>Chapter not found.</p></div>`;
      return;
    }
    document.title = `V Scans — ${manga?.title} Ch.${chapter.number}`;

    // Build prev/next chapter navigation
    const idx = chapters.findIndex(c => c.id === chapterId);
    const prevChap = idx > 0 ? chapters[idx - 1] : null;
    const nextChap = idx < chapters.length - 1 ? chapters[idx + 1] : null;

    const imagesHTML = (chapter.imageUrls || []).map((url, i) => `
      <img src="${url}" alt="Page ${i + 1}" loading="lazy"
           onerror="this.style.display='none'">
    `).join("");

    document.getElementById("main-content").innerHTML = `
      <div id="reader-page">
        <button class="back-btn" onclick="window.location.hash='#/manga/${mangaId}'">
          <i class="fa-solid fa-arrow-left"></i> Back to ${escHtml(manga?.title || "Manga")}
        </button>
        <div class="reader-nav-bar">
          <h2>${escHtml(manga?.title || "")} — Ch.${chapter.number}: ${escHtml(chapter.title || "")}</h2>
          <div style="display:flex;gap:0.5rem;flex-shrink:0">
            ${prevChap ? `<button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/manga/${mangaId}/chapter/${prevChap.id}'"><i class="fa-solid fa-chevron-left"></i> Prev</button>` : ""}
            ${nextChap ? `<button class="btn btn-primary btn-sm" onclick="window.location.hash='#/manga/${mangaId}/chapter/${nextChap.id}'">Next <i class="fa-solid fa-chevron-right"></i></button>` : ""}
          </div>
        </div>
        <div class="reader-images">
          ${imagesHTML || `<div class="empty-state"><i class="fa-solid fa-image-slash"></i><p>No images found for this chapter.</p></div>`}
        </div>
        <div class="reader-nav-bar" style="margin-top:1rem">
          ${prevChap ? `<button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/manga/${mangaId}/chapter/${prevChap.id}'"><i class="fa-solid fa-chevron-left"></i> Prev Chapter</button>` : "<span></span>"}
          ${nextChap ? `<button class="btn btn-primary btn-sm" onclick="window.location.hash='#/manga/${mangaId}/chapter/${nextChap.id}'">Next Chapter <i class="fa-solid fa-chevron-right"></i></button>` : "<span></span>"}
        </div>
        <!-- Comments -->
        <div class="comments-section">
          <div class="section-title" style="margin-bottom:1rem"><span>Comments</span></div>
          ${renderCommentForm(mangaId, chapterId)}
          <div class="comment-list" id="comment-list"></div>
        </div>
      </div>
    `;

    initCommentForm(mangaId, chapterId);

    // Real-time comments
    commentUnsubscribe = listenToComments(mangaId, chapterId, (comments) => {
      renderCommentList(comments, mangaId, chapterId);
    });

  } catch (err) {
    console.error("Reader error:", err);
    document.getElementById("main-content").innerHTML = `<div class="empty-state"><p>Error loading chapter.</p></div>`;
  }
}

// ─── Comments ─────────────────────────────────────────────────
function renderCommentForm(mangaId, chapterId) {
  if (!currentUser) {
    return `<div class="comment-login-prompt">
      <i class="fa-solid fa-lock"></i> 
      <a href="#" onclick="document.getElementById('btn-google-signin').click();return false;" style="color:var(--accent-cyan)">Sign in</a> to leave a comment.
    </div>`;
  }
  const avatar = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || "U")}&background=7c3aed&color=fff`;
  return `
    <div class="comment-input-area">
      <img src="${avatar}" alt="You" onerror="this.src='https://ui-avatars.com/api/?name=U&background=7c3aed&color=fff'">
      <textarea id="comment-text" placeholder="Write a comment…" rows="2"></textarea>
      <button class="btn-post-comment" id="btn-post-comment"><i class="fa-solid fa-paper-plane"></i></button>
    </div>
  `;
}

function initCommentForm(mangaId, chapterId) {
  const btn = document.getElementById("btn-post-comment");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const text = document.getElementById("comment-text")?.value.trim();
    if (!text) { showToast("Comment cannot be empty.", "error"); return; }
    if (!currentUser) { showToast("Please sign in to comment.", "error"); return; }
    btn.disabled = true;
    try {
      await addComment(mangaId, chapterId, {
        uid: currentUser.uid,
        displayName: currentUser.displayName || "Anonymous",
        photoURL: currentUser.photoURL || "",
        text
      });
      document.getElementById("comment-text").value = "";
    } catch (e) {
      showToast("Failed to post comment.", "error");
    } finally {
      btn.disabled = false;
    }
  });
}

function renderCommentList(comments, mangaId, chapterId) {
  const list = document.getElementById("comment-list");
  if (!list) return;
  if (comments.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:1.5rem"><p>No comments yet. Be the first!</p></div>`;
    return;
  }
  const admin = isAdmin();
  list.innerHTML = comments.map(c => {
    const avatar = c.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.displayName || "U")}&background=7c3aed&color=fff`;
    const canDelete = admin || (currentUser && currentUser.uid === c.uid);
    return `
      <div class="comment-item">
        <img src="${avatar}" alt="${escHtml(c.displayName)}" onerror="this.src='https://ui-avatars.com/api/?name=U&background=7c3aed&color=fff'">
        <div class="comment-bubble">
          <div class="comment-meta">
            <span class="comment-name">${escHtml(c.displayName)}</span>
            <span class="comment-time">${formatDate(c.createdAt)}</span>
            ${canDelete ? `<button class="btn btn-danger btn-sm" style="margin-left:auto;padding:0.2rem 0.5rem" onclick="handleDeleteComment('${mangaId}','${chapterId}','${c.id}')"><i class="fa-solid fa-trash"></i></button>` : ""}
          </div>
          <div class="comment-text">${escHtml(c.text)}</div>
        </div>
      </div>
    `;
  }).join("");
  window.handleDeleteComment = handleDeleteComment;
}

async function handleDeleteComment(mangaId, chapterId, commentId) {
  if (!confirm("Delete this comment?")) return;
  try {
    await deleteComment(mangaId, chapterId, commentId);
    showToast("Comment deleted.");
  } catch (e) {
    showToast("Failed to delete comment.", "error");
  }
}

// ─── PAGE: Categories ─────────────────────────────────────────
async function renderCategories(filterGenre) {
  document.title = "V Scans — Categories";
  renderLoading();

  try {
    const mangaList = await getAllManga();
    // Collect all unique genres
    const genreSet = new Set();
    mangaList.forEach(m => {
      const genres = Array.isArray(m.genres) ? m.genres : [m.genres || ""];
      genres.forEach(g => { if (g) genreSet.add(g); });
    });
    const allGenres = [...genreSet].sort();

    const filtered = filterGenre
      ? mangaList.filter(m => {
          const genres = Array.isArray(m.genres) ? m.genres : [m.genres || ""];
          return genres.includes(filterGenre);
        })
      : mangaList;

    const pillsHTML = allGenres.map(g => `
      <a class="category-pill ${g === filterGenre ? "active" : ""}"
         href="#/categories/${encodeURIComponent(g)}">${escHtml(g)}</a>
    `).join("");

    const cardsHTML = filtered.length === 0
      ? `<div class="empty-state"><p>No manga in this category.</p></div>`
      : filtered.map(m => `
          <div class="manga-card" onclick="window.location.hash='#/manga/${m.id}'">
            <div class="manga-card-cover">
              <img src="${m.coverUrl || 'https://via.placeholder.com/200x290/1a1a2e/7c3aed?text=No+Cover'}"
                   alt="${escHtml(m.title)}" loading="lazy"
                   onerror="this.src='https://via.placeholder.com/200x290/1a1a2e/7c3aed?text=No+Cover'">
              <div class="manga-card-overlay">
                <span>${Array.isArray(m.genres) ? escHtml(m.genres[0]) : ""}</span>
              </div>
            </div>
            <div class="manga-card-body">
              <div class="manga-card-title">${escHtml(m.title)}</div>
            </div>
          </div>
        `).join("");

    document.getElementById("main-content").innerHTML = `
      <div class="section-title"><span>Categories</span></div>
      <div class="category-grid" style="margin-bottom:1.5rem">
        <a class="category-pill ${!filterGenre ? "active" : ""}" href="#/categories">All</a>
        ${pillsHTML}
      </div>
      ${filterGenre ? `<div class="section-title"><span>${escHtml(filterGenre)}</span></div>` : `<div class="section-title"><span>All Manga</span></div>`}
      <div id="manga-grid">${cardsHTML}</div>
    `;
  } catch (err) {
    console.error(err);
    document.getElementById("main-content").innerHTML = `<div class="empty-state"><p>Error loading categories.</p></div>`;
  }
}

// ─── PAGE: Donate ─────────────────────────────────────────────
function renderDonate() {
  document.title = "V Scans — Donate";
  document.getElementById("main-content").innerHTML = `
    <div class="donate-card">
      <i class="fa-brands fa-paypal"></i>
      <h2>Support V Scans</h2>
      <p>
        V Scans is a passion project. If you enjoy reading manga here for free,
        consider supporting us! Every contribution helps keep the site running.
      </p>
      <a href="https://www.paypal.me/AnouarBah" target="_blank" rel="noopener" class="btn btn-primary">
        <i class="fa-brands fa-paypal"></i> Donate via PayPal
      </a>
    </div>
  `;
}

// ─── PAGE: Admin Panel ────────────────────────────────────────
async function renderAdminPanel() {
  if (!isAdmin()) {
    router.navigate("#/");
    return;
  }
  document.title = "V Scans — Admin Panel";
  renderLoading();

  try {
    const mangaList = await getAllManga();

    const rowsHTML = mangaList.length === 0
      ? `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">No manga yet.</td></tr>`
      : mangaList.map(m => `
          <tr>
            <td><img src="${m.coverUrl || 'https://via.placeholder.com/40x55/1a1a2e/7c3aed?text=N'}" alt="" onerror="this.src='https://via.placeholder.com/40x55/1a1a2e/7c3aed?text=N'"></td>
            <td style="word-break:break-word;max-width:180px">${escHtml(m.title)}</td>
            <td style="color:var(--text-secondary);font-size:0.8rem">${Array.isArray(m.genres) ? m.genres.join(", ") : m.genres || ""}</td>
            <td>
              <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
                <button class="btn btn-ghost btn-sm" onclick="openEditMangaModal('${m.id}')">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-primary btn-sm" onclick="openAddChapterModal('${m.id}')">
                  <i class="fa-solid fa-plus"></i> Ch
                </button>
                <button class="btn btn-danger btn-sm" onclick="handleDeleteManga('${m.id}')">
                  <i class="fa-solid fa-trash"></i>
                </button>
                <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/manga/${m.id}'">
                  <i class="fa-solid fa-eye"></i>
                </button>
              </div>
            </td>
          </tr>
        `).join("");

    document.getElementById("main-content").innerHTML = `
      <div id="admin-panel">
        <div class="section-title"><span><i class="fa-solid fa-shield-halved"></i> Admin Panel</span></div>
        <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="openAddMangaModal()">
            <i class="fa-solid fa-plus"></i> Add New Manga
          </button>
        </div>
        <div style="overflow-x:auto">
          <table class="admin-manga-table">
            <thead>
              <tr>
                <th>Cover</th>
                <th>Title</th>
                <th>Genres</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
          </table>
        </div>
      </div>
    `;

    // Expose handlers
    window.openEditMangaModal = openEditMangaModal;
    window.openAddChapterModal = openAddChapterModal;
    window.handleDeleteManga = handleDeleteManga;

  } catch (err) {
    console.error(err);
    document.getElementById("main-content").innerHTML = `<div class="empty-state"><p>Failed to load admin panel.</p></div>`;
  }
}

// ─── Admin: Add Manga Modal ───────────────────────────────────
function openAddMangaModal() {
  closeAllModals();
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.id = "modal-add-manga";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2><i class="fa-solid fa-plus"></i> Add New Manga</h2>
        <button class="modal-close" onclick="document.getElementById('modal-add-manga').remove()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="form-input" id="am-title" type="text" placeholder="Manga title">
      </div>
      <div class="form-group">
        <label class="form-label">Cover Image URL *</label>
        <input class="form-input" id="am-cover" type="url" placeholder="https://...">
      </div>
      <div class="form-group">
        <label class="form-label">Genres (comma-separated) *</label>
        <input class="form-input" id="am-genres" type="text" placeholder="Action, Fantasy, Romance">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="am-desc" placeholder="Synopsis…"></textarea>
      </div>
      <button class="btn btn-primary" id="btn-submit-manga" style="width:100%">
        <i class="fa-solid fa-floppy-disk"></i> Add Manga
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });

  document.getElementById("btn-submit-manga")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-submit-manga");
    const title = document.getElementById("am-title").value.trim();
    const coverUrl = document.getElementById("am-cover").value.trim();
    const genresRaw = document.getElementById("am-genres").value.trim();
    const description = document.getElementById("am-desc").value.trim();
    if (!title || !coverUrl || !genresRaw) { showToast("Please fill in all required fields.", "error"); return; }
    const genres = genresRaw.split(",").map(g => g.trim()).filter(Boolean);
    setButtonLoading(btn, true);
    try {
      await addManga({ title, coverUrl, genres, description });
      showToast("Manga added successfully!");
      modal.remove();
      renderAdminPanel();
    } catch (e) {
      showToast("Failed to add manga: " + e.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// ─── Admin: Edit Manga Modal ──────────────────────────────────
async function openEditMangaModal(mangaId) {
  closeAllModals();
  const manga = await getMangaById(mangaId);
  if (!manga) { showToast("Manga not found.", "error"); return; }

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.id = "modal-edit-manga";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2><i class="fa-solid fa-pen"></i> Edit Manga</h2>
        <button class="modal-close" onclick="document.getElementById('modal-edit-manga').remove()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-input" id="em-title" type="text" value="${escHtml(manga.title)}">
      </div>
      <div class="form-group">
        <label class="form-label">Cover Image URL</label>
        <input class="form-input" id="em-cover" type="url" value="${manga.coverUrl || ""}">
      </div>
      <div class="form-group">
        <label class="form-label">Genres (comma-separated)</label>
        <input class="form-input" id="em-genres" type="text" value="${Array.isArray(manga.genres) ? manga.genres.join(", ") : (manga.genres || "")}">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-textarea" id="em-desc">${escHtml(manga.description || "")}</textarea>
      </div>
      <button class="btn btn-primary" id="btn-update-manga" style="width:100%">
        <i class="fa-solid fa-floppy-disk"></i> Save Changes
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });

  document.getElementById("btn-update-manga")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-update-manga");
    const title = document.getElementById("em-title").value.trim();
    const coverUrl = document.getElementById("em-cover").value.trim();
    const genresRaw = document.getElementById("em-genres").value.trim();
    const description = document.getElementById("em-desc").value.trim();
    if (!title) { showToast("Title is required.", "error"); return; }
    const genres = genresRaw.split(",").map(g => g.trim()).filter(Boolean);
    setButtonLoading(btn, true);
    try {
      await updateManga(mangaId, { title, coverUrl, genres, description });
      showToast("Manga updated!");
      modal.remove();
      // Refresh whatever page we're on
      router.dispatch();
    } catch (e) {
      showToast("Failed to update: " + e.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// ─── Admin: Add Chapter Modal (with ImgBB upload) ─────────────
function openAddChapterModal(mangaId) {
  closeAllModals();
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.id = "modal-add-chapter";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2><i class="fa-solid fa-plus"></i> Add New Chapter</h2>
        <button class="modal-close" onclick="document.getElementById('modal-add-chapter').remove()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="form-group">
        <label class="form-label">Chapter Number *</label>
        <input class="form-input" id="ch-num" type="number" min="1" placeholder="1">
      </div>
      <div class="form-group">
        <label class="form-label">Chapter Title (optional)</label>
        <input class="form-input" id="ch-title" type="text" placeholder="The Beginning">
      </div>
      <div class="form-group">
        <label class="form-label">Upload Chapter Images *</label>
        <input class="form-input" id="ch-images" type="file" accept="image/*" multiple style="padding:0.4rem">
        <div id="ch-file-info" style="margin-top:0.4rem;font-size:0.8rem;color:var(--text-muted)">No files selected</div>
        <div class="upload-progress" style="display:none" id="ch-progress-wrap">
          <div class="upload-progress-bar" id="ch-progress-bar" style="width:0%"></div>
        </div>
        <div id="ch-progress-label" style="font-size:0.78rem;color:var(--text-muted);margin-top:0.3rem"></div>
      </div>
      <button class="btn btn-primary" id="btn-submit-chapter" style="width:100%">
        <i class="fa-solid fa-upload"></i> Upload & Add Chapter
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });

  // File selection info
  document.getElementById("ch-images")?.addEventListener("change", (e) => {
    const files = e.target.files;
    document.getElementById("ch-file-info").textContent =
      files.length > 0 ? `${files.length} file(s) selected` : "No files selected";
  });

  document.getElementById("btn-submit-chapter")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-submit-chapter");
    const numVal = document.getElementById("ch-num").value;
    const chTitle = document.getElementById("ch-title").value.trim();
    const filesInput = document.getElementById("ch-images");
    const files = filesInput.files;

    if (!numVal || isNaN(numVal)) { showToast("Please enter a valid chapter number.", "error"); return; }
    if (!files || files.length === 0) { showToast("Please select at least one image.", "error"); return; }

    setButtonLoading(btn, true);
    const progressWrap = document.getElementById("ch-progress-wrap");
    const progressBar = document.getElementById("ch-progress-bar");
    const progressLabel = document.getElementById("ch-progress-label");
    progressWrap.style.display = "block";

    try {
      const imageUrls = await uploadMultipleImages(files, (done, total) => {
        const pct = Math.round((done / total) * 100);
        progressBar.style.width = pct + "%";
        progressLabel.textContent = `Uploading… ${done} / ${total} images`;
      });
      progressLabel.textContent = "Saving to database…";
      await addChapter(mangaId, {
        number: Number(numVal),
        title: chTitle || `Chapter ${numVal}`,
        imageUrls
      });
      showToast("Chapter added successfully!");
      modal.remove();
      // Refresh the manga detail page if we're on it
      const hash = window.location.hash;
      if (hash.includes(mangaId)) router.dispatch();
    } catch (e) {
      showToast("Failed to add chapter: " + e.message, "error");
      progressBar.style.width = "0%";
      progressLabel.textContent = "";
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// ─── Admin: Delete Handlers ───────────────────────────────────
async function handleDeleteManga(mangaId) {
  if (!confirm("Delete this manga and ALL its chapters? This cannot be undone.")) return;
  try {
    await deleteManga(mangaId);
    showToast("Manga deleted.");
    router.navigate("#/admin");
  } catch (e) {
    showToast("Failed to delete: " + e.message, "error");
  }
}

async function handleDeleteChapter(mangaId, chapterId) {
  if (!confirm("Delete this chapter and its comments?")) return;
  try {
    await deleteChapter(mangaId, chapterId);
    showToast("Chapter deleted.");
    document.getElementById(`chap-item-${chapterId}`)?.remove();
  } catch (e) {
    showToast("Failed to delete chapter: " + e.message, "error");
  }
}

// ─── HTML Escape Utility ──────────────────────────────────────
function escHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Expose globally (used in onclick attrs) ──────────────────
window.openAddMangaModal = openAddMangaModal;
window.openEditMangaModal = openEditMangaModal;
window.openAddChapterModal = openAddChapterModal;
window.handleDeleteManga = handleDeleteManga;
window.handleDeleteChapter = handleDeleteChapter;
window.handleDeleteComment = handleDeleteComment;

// ─── Router Setup ─────────────────────────────────────────────
function initRouter() {
  router
    .on(/^(#\/)?$/, () => renderHome())
    .on(/^#\/$/, () => renderHome())
    .on(/^#\/manga\/([^/]+)$/, (id) => renderMangaDetail(id))
    .on(/^#\/manga\/([^/]+)\/chapter\/([^/]+)$/, (mId, cId) => renderReader(mId, cId))
    .on(/^#\/categories$/, () => renderCategories(null))
    .on(/^#\/categories\/([^/]+)$/, (genre) => renderCategories(decodeURIComponent(genre)))
    .on(/^#\/donate$/, () => renderDonate())
    .on(/^#\/admin$/, () => renderAdminPanel());

  router.init();
}

// ─── Active Sidebar Link ──────────────────────────────────────
function syncActiveLink() {
  const hash = window.location.hash || "#/";
  document.querySelectorAll(".sidebar-link").forEach(link => {
    link.classList.remove("active");
    const href = link.getAttribute("href");
    if (href && (hash === href || (href === "#/" && hash === ""))) {
      link.classList.add("active");
    } else if (href && href !== "#/" && hash.startsWith(href)) {
      link.classList.add("active");
    }
  });
}

// ─── Bootstrap ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
  initNavbarDropdown();
  initRouter();

  // Listen to hash changes for sidebar active state
  window.addEventListener("hashchange", syncActiveLink);
  syncActiveLink();

  // Firebase Auth listener — keeps user state fresh
  onAuthChange((user) => {
    currentUser = user;
    updateNavbar(user);

    // Re-render current page to update auth-dependent UI
    // (e.g. comment forms, admin buttons)
    router.dispatch();
  });
});
