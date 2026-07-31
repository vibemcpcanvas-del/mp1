/**
 * LayoutManager.js (Refactored)
 * Legacy Golden Layout wrapper refactored away in M1.
 * Delegates to GlassHUDManager.
 */
import { initGlassHUD, getGlassHUDManager } from './GlassHUDManager.js';

export class LayoutManager {
  constructor(options = {}) {
    this.hudManager = options.hudManager || getGlassHUDManager();
  }

  init() {
    return this.hudManager.init();
  }

  getGlassHUDManager() {
    return this.hudManager;
  }
}

export function initLayout() {
  const hud = initGlassHUD();
  return hud;
}

