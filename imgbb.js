// ============================================================
// imgbb.js — Upload images to ImgBB and return public URLs
// ============================================================
import { IMGBB_API_KEY } from "./firebase-config.js";

/**
 * Upload a single File object to ImgBB.
 * @param {File} file - The image file to upload.
 * @returns {Promise<string>} The direct public URL of the uploaded image.
 */
export async function uploadImageToImgBB(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      // Get base64 content (strip the data URL prefix)
      const base64 = reader.result.split(",")[1];
      const formData = new FormData();
      formData.append("key", IMGBB_API_KEY);
      formData.append("image", base64);
      formData.append("name", file.name);

      try {
        const res = await fetch("https://api.imgbb.com/1/upload", {
          method: "POST",
          body: formData
        });
        const json = await res.json();
        if (json.success) {
          // Use the direct image URL (not the page URL)
          resolve(json.data.url);
        } else {
          reject(new Error("ImgBB upload failed: " + JSON.stringify(json)));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload multiple files to ImgBB with progress callback.
 * @param {FileList|File[]} files - Array of image files.
 * @param {Function} onProgress - Called with (uploaded, total) after each upload.
 * @returns {Promise<string[]>} Array of public image URLs in order.
 */
export async function uploadMultipleImages(files, onProgress) {
  const urls = [];
  const total = files.length;
  for (let i = 0; i < total; i++) {
    const url = await uploadImageToImgBB(files[i]);
    urls.push(url);
    if (typeof onProgress === "function") onProgress(i + 1, total);
  }
  return urls;
}

/**
 * Upload a single avatar/profile-picture File to ImgBB.
 *
 * Differences from the generic uploadImageToImgBB:
 *  - Validates that the file is an image (MIME check).
 *  - Enforces a 5 MB size cap to avoid wasting the API quota.
 *  - Accepts an optional onProgress(pct: 0–100) callback so the UI
 *    can show a determinate progress bar while the XHR is in flight.
 *
 * @param {File}     file        - The avatar image file selected by the user.
 * @param {Function} [onProgress] - Optional. Called with a number 0–100.
 * @returns {Promise<string>}    Direct public image URL from ImgBB.
 */
export function uploadAvatarToImgBB(file, onProgress) {
  return new Promise((resolve, reject) => {
    // ── Validation ────────────────────────────────────────────
    if (!file.type.startsWith("image/")) {
      return reject(new Error("Selected file is not an image."));
    }
    const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_BYTES) {
      return reject(new Error("Image must be smaller than 5 MB."));
    }

    // ── Read as base64 ────────────────────────────────────────
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read the selected file."));

    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      const formData = new FormData();
      formData.append("key", IMGBB_API_KEY);
      formData.append("image", base64);
      // Give the hosted image a recognisable name (strip path separators)
      formData.append("name", file.name.replace(/[/\\]/g, "_"));

      // ── XHR so we can track upload progress ───────────────
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && typeof onProgress === "function") {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener("load", () => {
        try {
          const json = JSON.parse(xhr.responseText);
          if (json.success) {
            // Signal 100 % before resolving
            if (typeof onProgress === "function") onProgress(100);
            resolve(json.data.url);
          } else {
            reject(new Error("ImgBB rejected the upload: " + (json.error?.message ?? xhr.responseText)));
          }
        } catch {
          reject(new Error("Unexpected response from ImgBB."));
        }
      });

      xhr.addEventListener("error",   () => reject(new Error("Network error while uploading avatar.")));
      xhr.addEventListener("timeout", () => reject(new Error("Upload timed out.")));

      xhr.timeout = 60_000; // 60 s hard cap
      xhr.open("POST", "https://api.imgbb.com/1/upload");
      xhr.send(formData);
    };

    reader.readAsDataURL(file);
  });
}
