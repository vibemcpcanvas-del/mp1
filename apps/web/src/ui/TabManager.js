/**
 * TabManager.js
 * Manages the two top-level tabs: "Map" and "Live".
 *
 * Expected DOM structure (must be present in index.html):
 *   <button id="tab-btn-map">Map</button>
 *   <button id="tab-btn-live">Live</button>
 *   <div id="tab-map-content"> … </div>
 *   <div id="tab-live-content"> … </div>
 */

const TAB_MAP  = 'map';
const TAB_LIVE = 'live';

export class TabManager {
  /**
   * @param {object}            opts
   * @param {() => void}        [opts.onSwitchToLive]  - fired when Live tab is activated
   * @param {() => void}        [opts.onSwitchToMap]   - fired when Map tab is activated
   */
  constructor({ onSwitchToLive = null, onSwitchToMap = null } = {}) {
    this._onSwitchToLive = typeof onSwitchToLive === 'function' ? onSwitchToLive : null;
    this._onSwitchToMap  = typeof onSwitchToMap  === 'function' ? onSwitchToMap  : null;

    /** @type {'map'|'live'} */
    this._currentTab = TAB_MAP;

    // DOM references — populated in init()
    this._btnMap        = null;
    this._btnLive       = null;
    this._contentMap    = null;
    this._contentLive   = null;
  }

  // ─────────────────────────────────────────────────────── Public API ──

  /**
   * Bind DOM elements and attach click listeners.
   * Safe to call multiple times (idempotent after first call).
   */
  init() {
    this._btnMap      = document.getElementById('tab-btn-map');
    this._btnLive     = document.getElementById('tab-btn-live');
    this._contentMap  = document.getElementById('tab-map-content');
    this._contentLive = document.getElementById('tab-live-content');

    if (!this._btnMap || !this._btnLive) {
      console.warn('[TabManager] Tab buttons not found in DOM. Check ids: #tab-btn-map, #tab-btn-live');
    }
    if (!this._contentMap || !this._contentLive) {
      console.warn('[TabManager] Tab content panels not found in DOM. Check ids: #tab-map-content, #tab-live-content');
    }

    this._btnMap?.addEventListener('click',  () => this.switchTo(TAB_MAP));
    this._btnLive?.addEventListener('click', () => this.switchTo(TAB_LIVE));

    // Render initial state
    this._apply(this._currentTab);
  }

  /**
   * Programmatically switch to the given tab.
   * @param {'map'|'live'} tab
   */
  switchTo(tab) {
    if (tab !== TAB_MAP && tab !== TAB_LIVE) {
      console.warn(`[TabManager] Unknown tab "${tab}". Expected "map" or "live".`);
      return;
    }
    if (this._currentTab === tab) return;

    this._currentTab = tab;
    this._apply(tab);

    // Fire caller callbacks
    if (tab === TAB_LIVE) {
      try { this._onSwitchToLive?.(); } catch (e) { console.error('[TabManager] onSwitchToLive error:', e); }
    } else {
      try { this._onSwitchToMap?.();  } catch (e) { console.error('[TabManager] onSwitchToMap error:', e);  }
    }
  }

  /**
   * Currently active tab identifier.
   * @type {'map'|'live'}
   */
  get currentTab() {
    return this._currentTab;
  }

  // ──────────────────────────────────────────────────── Internal Helpers ──

  /**
   * Update button active-class and content visibility.
   * @private
   * @param {'map'|'live'} tab
   */
  _apply(tab) {
    const isMap = tab === TAB_MAP;

    // Toggle active class on buttons
    this._btnMap?.classList.toggle('tab-btn--active',  isMap);
    this._btnLive?.classList.toggle('tab-btn--active', !isMap);

    // Toggle content visibility
    if (this._contentMap)  this._contentMap.hidden  = !isMap;
    if (this._contentLive) this._contentLive.hidden = isMap;
  }
}
