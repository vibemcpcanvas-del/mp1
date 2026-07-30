/**
 * Renderer.js
 * rAF 기반 60fps 렌더 루프 + Canvas 오버레이 관리
 * 
 * 역할: DOM 맵 위에 position:absolute Canvas를 겹쳐서
 *       PlayerLayer만 렌더링한다 (HitboxLayer/MapLayer는 DOM이 담당).
 * 
 * @module canvas/Renderer
 */
import { PlayerLayer } from './layers/PlayerLayer.js';
import { MapLayer } from './layers/MapLayer.js';
import { HitboxLayer } from './layers/HitboxLayer.js';

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas - 오버레이할 Canvas 요소
   * @param {import('../../core/MapManager').MapManager} mapManager
   */
  constructor(canvas, mapManager) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._mapManager = mapManager;

    /** @type {Array<{ render: Function }>} 레이어 배열 (확장 가능 구조) */
    this._layers = [new MapLayer(), new HitboxLayer(), new PlayerLayer()];

    /** 최신 수신 위치 (월드좌표) */
    this._latestPos = null;
    /** 선형 보간 현재 위치 (화면좌표) */
    this._currentScreen = null;
    /** 이전 렌더 시각 */
    this._lastRenderTime = null;

    this._rafId = null;
    this._running = false;

    // 리사이즈 옵저버
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(canvas.parentElement || canvas);
    this._onResize();
  }

  destroy() {
    this.stop();
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  get mapLayer() { return this._layers[0]; }
  get hitboxLayer() { return this._layers[1]; }
  get playerLayer() { return this._layers[2]; }

  /**
   * 센서에서 새 좌표 수신 (렌더 루프와 분리)
   * @param {{ x: number, y: number, confidence: number }} pos - 월드좌표
   */
  onPosition(pos) {
    this._latestPos = pos;
    const mapper = this._mapManager.mapper;
    if (mapper && pos) {
      const target = mapper.map(pos.x, pos.y);
      this.playerLayer.onPosition(target.px, target.py);
    }
  }

  /** 렌더 루프 시작 */
  start() {
    if (this._running) return;
    this._running = true;
    this._loop(performance.now());
  }

  /** 렌더 루프 정지 */
  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // ─── 내부 ──────────────────────────────────────────────────

  _loop(now) {
    if (!this._running) return;

    const dt = this._lastRenderTime ? (now - this._lastRenderTime) / 1000 : 0;
    this._lastRenderTime = now;

    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    const mapper = this._mapManager.mapper;

    if (mapper && this._latestPos) {
      // 화면 좌표 계산
      const target = mapper.map(this._latestPos.x, this._latestPos.y);

      // 선형 보간 (lerp): 센서 업데이트 주기와 렌더 주기 분리
      const lerpSpeed = 8; // 초당 목표 지점으로 이동 속도 (값이 클수록 빠름)
      if (this._currentScreen === null) {
        this._currentScreen = { ...target };
      } else {
        const alpha = Math.min(1, lerpSpeed * dt);
        this._currentScreen.px += (target.px - this._currentScreen.px) * alpha;
        this._currentScreen.py += (target.py - this._currentScreen.py) * alpha;
      }

      // 각 레이어 렌더
      const screenPos = {
        px: this._currentScreen.px,
        py: this._currentScreen.py,
        confidence: this._latestPos.confidence ?? 1.0,
      };
      this._layers.forEach(layer => layer.render(this._ctx, screenPos, this._mapManager));
    }

    this._rafId = requestAnimationFrame(t => this._loop(t));
  }

  _onResize() {
    const parent = this._canvas.parentElement;
    if (!parent) return;

    const w = parent.clientWidth;
    const h = parent.clientHeight;

    // Canvas 해상도를 부모 크기에 맞춤
    this._canvas.width = w;
    this._canvas.height = h;

    // MapManager에 화면 크기 갱신
    this._mapManager.updateScreenSize(w, h);

    // 보간 좌표 초기화 (리사이즈 시 좌표 점프 방지)
    this._currentScreen = null;
  }

  /** 지역 전환 시 호출 — 궤적 초기화 */
  onRegionChange() {
    this.playerLayer.clearTrail();
    this._currentScreen = null;
    this._latestPos = null;
    
    const hg = this._mapManager.currentHG;
    if (hg) {
      this.mapLayer.setImage(hg.backgroundImageUrl || hg.mapImg);
      this.hitboxLayer.setImage(hg.hitboxDataUrl || hg.hitboxImg);
    }
  }
}
