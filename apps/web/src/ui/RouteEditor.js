/**
 * RouteEditor.js
 * Interactive waypoint / route editor that bridges DOM controls,
 * the RouteManager data model, and the canvas renderer.
 *
 * Expected DOM IDs (must be present in index.html):
 *   #route-list          <ul> or <ol> for the waypoint list
 *   #route-add-btn       Button – manually append a waypoint (no map-click needed)
 *   #route-mode-select   <select> to choose movement mode per waypoint
 *   #route-save-btn      Button – persist the current route
 *
 * routeManager API expectations:
 *   routeManager.addWaypoint(worldX, worldY, opts?)  → waypoint object
 *   routeManager.getWaypoints()                      → waypoint[]
 *   routeManager.setWaypointSkill(id, key)           → void   (id = waypoint UUID, not index)
 *   routeManager.save()                              → void   (optional, falls back to no-op)
 *
 * renderer API expectations:
 *   renderer.routeLayer.setWaypoints(waypoints)
 *   renderer.skillLayer.setWaypoints(waypoints)      (optional layer)
 */

export class RouteEditor {
  /**
   * @param {object}  opts
   * @param {object}  opts.routeManager   - Route data model
   * @param {object}  opts.renderer       - Canvas renderer with routeLayer / skillLayer
   */
  constructor({ routeManager, renderer }) {
    if (!routeManager) throw new Error('[RouteEditor] routeManager is required');
    if (!renderer)     throw new Error('[RouteEditor] renderer is required');

    this._routeManager = routeManager;
    this._renderer     = renderer;

    // DOM references — populated in init()
    this._listEl      = null;
    this._addBtn      = null;
    this._modeSelect  = null;
    this._saveBtn     = null;
  }

  // ─────────────────────────────────────────────────────── Public API ──

  /**
   * Bind DOM elements and attach event listeners.
   * Call once after the DOM is ready.
   */
  init() {
    this._listEl     = document.getElementById('route-list');
    this._addBtn     = document.getElementById('route-add-btn');
    this._modeSelect = document.getElementById('route-mode-select');
    this._saveBtn    = document.getElementById('route-save-btn');

    if (!this._listEl)     console.warn('[RouteEditor] #route-list not found');
    if (!this._addBtn)     console.warn('[RouteEditor] #route-add-btn not found');
    if (!this._modeSelect) console.warn('[RouteEditor] #route-mode-select not found');
    if (!this._saveBtn)    console.warn('[RouteEditor] #route-save-btn not found');

    // "Add waypoint" button – adds a placeholder waypoint at (0,0)
    this._addBtn?.addEventListener('click', () => {
      this._routeManager.addWaypoint(0, 0, { mode: this._currentMode() });
      this.refresh();
      this._pushToRenderer();
    });

    // Save button
    this._saveBtn?.addEventListener('click', () => {
      try {
        this._routeManager.save?.();
        console.info('[RouteEditor] Route saved.');
      } catch (e) {
        console.error('[RouteEditor] save() failed:', e);
      }
    });

    // Initial render
    this.refresh();
  }

  /**
   * Re-render the waypoint list from the current routeManager state.
   */
  refresh() {
    if (!this._listEl) return;

    const waypoints = this._getWaypoints();
    this._listEl.innerHTML = '';

    if (waypoints.length === 0) {
      const empty = document.createElement('li');
      empty.className   = 'route-list__empty';
      empty.textContent = 'No waypoints. Click the map to add.';
      this._listEl.appendChild(empty);
      return;
    }

    waypoints.forEach((wp, index) => {
      const li = document.createElement('li');
      li.className   = 'route-list__item';
      li.dataset.idx = String(index);

      const label = document.createElement('span');
      label.className   = 'route-list__label';
      label.textContent =
        `#${index + 1}  (${Math.round(wp.worldX ?? wp.x ?? 0)}, ${Math.round(wp.worldY ?? wp.y ?? 0)})` +
        (wp.skillKey ? `  🎯 ${wp.skillKey}` : '') +
        (wp.mode     ? `  [${wp.mode}]`       : '');

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className   = 'route-list__remove-btn';
      removeBtn.textContent = '✕';
      removeBtn.title       = 'Remove waypoint';
      removeBtn.addEventListener('click', () => {
        const wps = this._getWaypoints();
        wps.splice(index, 1);
        // Sync back if routeManager exposes setWaypoints
        this._routeManager.setWaypoints?.(wps);
        this.refresh();
        this._pushToRenderer();
      });

      li.append(label, removeBtn);
      this._listEl.appendChild(li);
    });
  }

  /**
   * Called when the user left-clicks on the map canvas.
   * Adds a new waypoint at the world-space position.
   *
   * @param {number} worldX
   * @param {number} worldY
   */
  onMapClick(worldX, worldY) {
    const opts = { mode: this._currentMode() };
    this._routeManager.addWaypoint(worldX, worldY, opts);
    this.refresh();
    this._pushToRenderer();
  }

  /**
   * Called when the user right-clicks on the map canvas.
   * Prompts for a skill key and assigns it to the last waypoint.
   *
   * @param {number} worldX  (unused but kept for signature symmetry)
   * @param {number} worldY  (unused)
   */
  // eslint-disable-next-line no-unused-vars
  onMapRightClick(worldX, worldY) {
    const waypoints = this._getWaypoints();
    if (waypoints.length === 0) {
      console.warn('[RouteEditor] No waypoints to assign a skill key to.');
      return;
    }

    const key = prompt('키를 입력하세요 (예: z, x, a)');
    if (key === null || key.trim() === '') return;  // cancelled or empty

    // RouteManager API uses setWaypointSkill(id, key) — id is the UUID of the waypoint
    const lastWaypoint = waypoints[waypoints.length - 1];
    if (!lastWaypoint?.id) {
      console.warn('[RouteEditor] Last waypoint has no id — cannot assign skill key.');
      return;
    }
    this._routeManager.setWaypointSkill(lastWaypoint.id, key.trim());
    this.refresh();
    this._pushSkillsToRenderer();
  }

  // ──────────────────────────────────────────────────── Internal Helpers ──

  /**
   * Safely retrieve waypoints from the routeManager.
   * @private
   * @returns {Array<object>}
   */
  _getWaypoints() {
    try {
      return this._routeManager.getWaypoints() ?? [];
    } catch (e) {
      console.error('[RouteEditor] getWaypoints() failed:', e);
      return [];
    }
  }

  /**
   * Read the currently selected movement mode from #route-mode-select.
   * @private
   * @returns {string}
   */
  _currentMode() {
    return this._modeSelect?.value ?? 'walk';
  }

  /**
   * Push the full waypoint list to renderer.routeLayer.
   * @private
   */
  _pushToRenderer() {
    const waypoints = this._getWaypoints();
    try {
      this._renderer.routeLayer?.setWaypoints(waypoints);
    } catch (e) {
      console.error('[RouteEditor] routeLayer.setWaypoints() failed:', e);
    }
    // Also refresh skill layer in case skill keys are embedded in waypoints
    this._pushSkillsToRenderer();
  }

  /**
   * Push the full waypoint list to renderer.skillLayer (optional layer).
   * @private
   */
  _pushSkillsToRenderer() {
    const waypoints = this._getWaypoints();
    try {
      this._renderer.skillLayer?.setWaypoints(waypoints);
    } catch (e) {
      console.error('[RouteEditor] skillLayer.setWaypoints() failed:', e);
    }
  }
}
