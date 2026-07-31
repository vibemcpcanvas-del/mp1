/**
 * Renderer.js
 * rAF 기반 60fps 렌더 루프 + Canvas 오버레이 관리
 * @module canvas/Renderer
 */
import { PlayerLayer } from './layers/PlayerLayer.js';
import { MapLayer } from './layers/MapLayer.js';
import { HitboxLayer } from './layers/HitboxLayer.js';
import { RouteLayer } from './layers/RouteLayer.js';
import { SkillLayer } from './layers/SkillLayer.js';

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas - 오버레이할 Canvas 요소
   * @param {import('../../core/MapManager').MapManager} mapManager
   */
  constructor(canvas, mapManager) {
    this._canvas = canvas;
    this._ctx = canvas ? canvas.getContext('2d') : null;
    this._mapManager = mapManager;

    /** @type {Array<import('./layers/BaseLayer').BaseLayer>} 레이어 배열 */
    this._layers = [new MapLayer(), new HitboxLayer(), new RouteLayer(), new SkillLayer(), new PlayerLayer()];

    /** 최신 수신 위치 (월드좌표) */
    this._latestPos = null;
    /** 선형 보간 현재 위치 (화면좌표) */
    this._currentScreen = null;
    /** 이전 렌더 시각 */
    this._lastRenderTime = null;

    this._rafId = null;
    this._running = false;

    // 리사이즈 옵저버
    if (typeof ResizeObserver !== 'undefined' && canvas) {
      this._resizeObserver = new ResizeObserver(() => this._onResize());
      this._resizeObserver.observe(canvas.parentElement || canvas);
    }
    this._onResize();
  }

  destroy() {
    this.stop();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  get layers() { return [...this._layers]; }
  get mapLayer() { return this.getLayer('map') || this._layers[0]; }
  get hitboxLayer() { return this.getLayer('hitbox') || this._layers[1]; }
  get playerLayer() { return this.getLayer('player') || this._layers[4]; }
  get routeLayer() { return this.getLayer('route'); }
  get skillLayer() { return this.getLayer('skill'); }

  setLayers(layersArray) {
    if (!Array.isArray(layersArray)) {
      throw new TypeError('setLayers expects an Array of Layer instances');
    }
    this._layers = layersArray;
  }

  /**
   * 레이어 식별자 또는 이름으로 검색
   * @param {string} layerName
   * @returns {import('./layers/BaseLayer').BaseLayer|null}
   */
  getLayer(layerName) {
    if (!layerName) return null;
    const name = String(layerName).toLowerCase();
    return this._layers.find(l => {
      if (!l) return false;
      const layerId = l.id ? String(l.id).toLowerCase() : '';
      if (layerId === name) return true;
      const className = l.constructor ? String(l.constructor.name).toLowerCase() : '';
      if (className === name || className === `${name}layer`) return true;
      return false;
    }) || null;
  }

  /**
   * 레이어 가시성 설정
   * @param {string} layerName - 'map' | 'hitbox' | 'player'
   * @param {boolean} visible
   */
  setLayerVisibility(layerName, visible) {
    const layer = this.getLayer(layerName);
    if (layer) {
      layer.visible = Boolean(visible);
    }
  }

  /**
   * 레이어 투명도 설정 (0.0 ~ 1.0)
   * @param {string} layerName - 'map' | 'hitbox' | 'player'
   * @param {number} opacity
   */
  setLayerOpacity(layerName, opacity) {
    const layer = this.getLayer(layerName);
    if (layer && typeof opacity === 'number' && !Number.isNaN(opacity)) {
      layer.opacity = Math.max(0, Math.min(1, opacity));
    }
  }

  /**
   * 명시적 캔버스 크기 조정
   * @param {number} width
   * @param {number} height
   * @param {number} [dpr]
   */
  resize(width, height, dpr = (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)) {
    if (!this._canvas) return;

    this._canvas.width = Math.floor(width * dpr);
    this._canvas.height = Math.floor(height * dpr);
    if (this._canvas.style) {
      this._canvas.style.width = `${width}px`;
      this._canvas.style.height = `${height}px`;
    }

    if (this._ctx && typeof this._ctx.setTransform === 'function') {
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    if (this._mapManager) {
      this._mapManager.updateScreenSize(width, height);
    }

    this._currentScreen = null;
    for (const layer of this._layers) {
      if (layer && typeof layer.onResize === 'function') {
        layer.onResize(width, height, dpr);
      }
    }
  }

  /**
   * 센서에서 새 좌표 수신 (렌더 루프와 분리)
   * @param {{ x: number, y: number, confidence: number }} pos - 월드좌표
   */
  onPosition(pos) {
    this._latestPos = pos;
    const mapper = this._mapManager ? this._mapManager.mapper : null;
    if (mapper && pos) {
      const target = mapper.map(pos.x, pos.y);
      if (this.playerLayer && typeof this.playerLayer.onPosition === 'function') {
        this.playerLayer.onPosition(target.px, target.py);
      }
    }
  }

  /** 렌더 루프 시작 */
  start() {
    if (this._running) return;
    this._running = true;
    this._loop(typeof performance !== 'undefined' ? performance.now() : Date.now());
  }

  /** 렌더 루프 정지 */
  stop() {
    this._running = false;
    if (this._rafId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // ─── 내부 ──────────────────────────────────────────────────

  _loop(now) {
    const dt = this._lastRenderTime ? Math.min(0.1, (now - this._lastRenderTime) / 1000) : 0;
    this._lastRenderTime = now;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const w = this._canvas ? this._canvas.width / dpr : 800;
    const h = this._canvas ? this._canvas.height / dpr : 600;
    if (this._ctx && typeof this._ctx.clearRect === 'function') {
      this._ctx.clearRect(0, 0, w, h);
    }

    const mapper = this._mapManager ? this._mapManager.mapper : null;

    let screenPos = null;
    if (mapper && this._latestPos) {
      const target = mapper.map(this._latestPos.x, this._latestPos.y);

      const lerpSpeed = 8;
      if (this._currentScreen === null) {
        this._currentScreen = { ...target };
      } else {
        const alpha = Math.min(1, lerpSpeed * dt);
        this._currentScreen.px += (target.px - this._currentScreen.px) * alpha;
        this._currentScreen.py += (target.py - this._currentScreen.py) * alpha;
      }

      screenPos = {
        px: this._currentScreen.px,
        py: this._currentScreen.py,
        confidence: this._latestPos.confidence ?? 1.0,
      };
    }

    for (const layer of this._layers) {
      if (layer && layer.visible !== false) {
        if (this._ctx && typeof this._ctx.save === 'function') this._ctx.save();
        layer.render(this._ctx, screenPos, this._mapManager, now);
        if (this._ctx && typeof this._ctx.restore === 'function') this._ctx.restore();
      }
    }

    if (this._running && typeof requestAnimationFrame !== 'undefined') {
      this._rafId = requestAnimationFrame(t => this._loop(t));
    }
  }

  _onResize() {
    const parent = this._canvas ? this._canvas.parentElement : null;
    if (!parent) return;

    const w = parent.clientWidth || 800;
    const h = parent.clientHeight || 600;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.resize(w, h, dpr);
  }

  /** 지역 전환 시 호출 — 궤적 및 위치 초기화 */
  onRegionChange() {
    if (this.playerLayer && typeof this.playerLayer.clearTrail === 'function') {
      this.playerLayer.clearTrail();
    }
    this._currentScreen = null;
    this._latestPos = null;
    
    const hg = this._mapManager ? this._mapManager.currentHuntingGround : null;
    if (hg) {
      if (this.mapLayer) {
        this.mapLayer.setImage(hg.backgroundImageUrl || hg.mapImg);
      }
      if (this.hitboxLayer) {
        this.hitboxLayer.setImage(hg.hitboxDataUrl || hg.hitboxImg);
      }
    }
  }
}
