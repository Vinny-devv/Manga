// ============================================================
// router.js — Lightweight hash-based SPA router
// ============================================================

/**
 * A minimal hash router.
 * Routes are defined as { pattern: RegExp, handler: Function }.
 * The handler receives an array of captured groups from the pattern.
 *
 * Usage:
 *   import { router } from './router.js';
 *   router.on(/^#\/manga\/([^/]+)$/, (id) => renderMangaDetail(id));
 *   router.init();
 */

class HashRouter {
  constructor() {
    /** @type {Array<{pattern: RegExp, handler: Function}>} */
    this.routes = [];
  }

  /**
   * Register a route.
   * @param {RegExp} pattern
   * @param {Function} handler
   */
  on(pattern, handler) {
    this.routes.push({ pattern, handler });
    return this;
  }

  /**
   * Dispatch the current hash to the matching route.
   */
  dispatch() {
    const hash = window.location.hash || "#/";
    for (const route of this.routes) {
      const match = hash.match(route.pattern);
      if (match) {
        // Pass captured groups (indices 1+) as arguments
        route.handler(...match.slice(1));
        return;
      }
    }
    // No route matched — trigger the fallback (first route / home)
    if (this.routes.length > 0) {
      this.routes[0].handler();
    }
  }

  /**
   * Initialize the router and listen for hash changes.
   */
  init() {
    window.addEventListener("hashchange", () => this.dispatch());
    this.dispatch(); // Run on page load
  }

  /**
   * Programmatically navigate to a hash.
   * @param {string} hash e.g. "#/manga/abc123"
   */
  navigate(hash) {
    window.location.hash = hash;
  }
}

export const router = new HashRouter();
