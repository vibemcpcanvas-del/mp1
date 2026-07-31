/**
 * GlassHUDManager.js
 * Hoyoverse Floating Glass HUD UI Manager
 *
 * Handles floating glass HUD initialization, layout setup, panel visibility states,
 * glass card toggle handlers, z-index management, backdrop-filter blur controls,
 * and pointer events isolation rules. Replaces legacy Golden Layout dynamic reparenting.
 */

export class GlassHUDManager {
  /**
   * @param {object} [options]
   * @param {string} [options.containerId='hud-overlay-container']
   * @param {number} [options.baseZIndex=20]
   * @param {number} [options.defaultBlurPx=12]
   */
  constructor(options = {}) {
    this.containerId = options.containerId || 'hud-overlay-container';
    this.panels = new Map();
    this.baseZIndex = options.baseZIndex || 20;
    this.highestZIndex = this.baseZIndex;
    this.defaultBlurPx = options.defaultBlurPx !== undefined ? options.defaultBlurPx : 12;
    this.blurEnabled = true;
  }

  /**
   * HUD 오버레이 영역 및 패널 포인터 이벤트 격리 규칙 초기화
   */
  init() {
    if (typeof document === 'undefined') return this;

    const container = document.getElementById(this.containerId);
    if (container) {
      container.style.pointerEvents = 'none';
      container.style.position = 'absolute';
      container.style.inset = '0';
      container.style.zIndex = '10';
    }

    // 기본 패널 등록 (Vision PIP, Sensor Controls, Calibration Panel, Skill Toolbar)
    const defaultPanels = [
      'vision-viewport',
      'sensor-panel',
      'calibration-panel',
      'skill-sidebar-content',
      'workspace-toolbar',
    ];

    defaultPanels.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        this.registerPanel(id, el);
      }
    });

    this.applyPointerEventsIsolation();
    return this;
  }

  /**
   * 개별 패널 등록 및 pointer-events, backdrop blur 설정
   */
  registerPanel(panelId, element, options = {}) {
    if (typeof document === 'undefined') return null;

    if (typeof element === 'string') {
      element = document.getElementById(element);
    }
    if (!element) return null;

    element.style.pointerEvents = 'auto';

    const blurPx = options.blurPx !== undefined ? options.blurPx : (options.blurAmount ? parseInt(options.blurAmount, 10) : this.defaultBlurPx);
    this.applyBackdropBlur(element, blurPx);

    const panelState = {
      id: panelId,
      element,
      visible: element.style.display !== 'none',
      zIndex: parseInt(element.style.zIndex || String(this.baseZIndex), 10),
      blurPx,
    };

    this.panels.set(panelId, panelState);

    element.addEventListener('mousedown', () => {
      this.bringToFront(panelId);
    });

    return panelState;
  }

  /**
   * 모든 래퍼 및 카드 패널에 대한 pointer-events 규칙 및 backdrop blur 강제 적용
   */
  applyPointerEventsIsolation() {
    if (typeof document === 'undefined') return;

    const container = document.getElementById(this.containerId);
    if (container) {
      container.style.pointerEvents = 'none';
    }

    const cards = document.querySelectorAll('.hud-glass-card, .hud-panel, .hud-modal');
    cards.forEach(card => {
      card.style.pointerEvents = 'auto';
      if (!card.style.backdropFilter || card.style.backdropFilter === 'none') {
        this.applyBackdropBlur(card, this.defaultBlurPx);
      }
    });
  }

  /**
   * 특정 패널 표시/숨김 토글
   */
  togglePanel(panelId) {
    const panel = this.panels.get(panelId);
    if (panel) {
      this.setPanelVisibility(panelId, !panel.visible);
    } else if (typeof document !== 'undefined') {
      const el = document.getElementById(panelId);
      if (el) {
        const isCurrentlyVisible = el.style.display !== 'none';
        this.setPanelVisibility(panelId, !isCurrentlyVisible);
      }
    }
  }

  /**
   * 특정 패널 표시 상태 설정
   */
  setPanelVisibility(panelId, visible) {
    if (typeof document === 'undefined') return;

    const panel = this.panels.get(panelId);
    const element = panel ? panel.element : document.getElementById(panelId);
    if (!element) return;

    element.style.display = visible ? 'flex' : 'none';
    if (panel) {
      panel.visible = visible;
    }
    if (visible) {
      this.bringToFront(panelId);
    }
  }

  /**
   * 특정 패널 가시성 여부 확인
   */
  isPanelVisible(panelId) {
    const panel = this.panels.get(panelId);
    if (panel) return panel.visible;
    if (typeof document === 'undefined') return false;
    const element = document.getElementById(panelId);
    return element ? element.style.display !== 'none' : false;
  }

  /**
   * 요소를 위한 backdrop-filter blur 적용 유틸리티
   */
  applyBackdropBlur(element, blurPx) {
    if (!element || !element.style) return;
    if (blurPx > 0 && this.blurEnabled) {
      const str = typeof blurPx === 'string' ? blurPx : `${blurPx}px`;
      element.style.backdropFilter = str.includes('blur') ? str : `blur(${str})`;
      element.style.webkitBackdropFilter = str.includes('blur') ? str : `blur(${str})`;
    } else {
      element.style.backdropFilter = 'none';
      element.style.webkitBackdropFilter = 'none';
    }
  }

  /**
   * 특정 패널의 backdrop-filter blur 효과 조절
   * @param {string} panelId
   * @param {number|string} blurPx
   */
  setPanelBlur(panelId, blurPx = 12) {
    const panel = this.panels.get(panelId);
    const element = panel ? panel.element : (typeof document !== 'undefined' ? document.getElementById(panelId) : null);
    if (!element) return;

    if (panel) panel.blurPx = blurPx;
    this.applyBackdropBlur(element, blurPx);
  }

  /**
   * 전체 HUD의 블러 효과 토글
   * @param {boolean} enabled
   */
  setGlobalBlur(enabled) {
    this.blurEnabled = Boolean(enabled);
    if (typeof document === 'undefined') return;

    this.panels.forEach((panel) => {
      this.applyBackdropBlur(panel.element, this.blurEnabled ? panel.blurPx : 0);
    });
  }

  /**
   * 특정 패널을 최상위 z-index로 배치
   */
  bringToFront(panelId) {
    if (typeof document === 'undefined') return;

    const panel = this.panels.get(panelId);
    const element = panel ? panel.element : document.getElementById(panelId);
    if (!element) return;

    this.highestZIndex += 1;
    element.style.zIndex = String(this.highestZIndex);
    if (panel) {
      panel.zIndex = this.highestZIndex;
    }
  }
}

let defaultHUDManager = null;

export function getGlassHUDManager() {
  if (!defaultHUDManager) {
    defaultHUDManager = new GlassHUDManager();
  }
  return defaultHUDManager;
}

export function initGlassHUD() {
  const manager = getGlassHUDManager();
  manager.init();
  return manager;
}
