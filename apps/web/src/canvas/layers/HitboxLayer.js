/**
 * HitboxLayer.js
 * 사냥터 히트박스(지형/플랫폼) PNG 오버레이 렌더링 레이어
 * @module canvas/layers/HitboxLayer
 */
import { BaseLayer } from './BaseLayer.js';
import tokens from '@tokens/tokens.json';

export class HitboxLayer extends BaseLayer {
  /**
   * @param {object} [assetLoader] - 선택적 커스텀 비동기 로더
   */
  constructor(assetLoader) {
    super('hitbox');
    this._loader = assetLoader || null;
    this._hitboxImage = null;
    this._currentUrl = null;
    this._status = 'idle'; // 'idle' | 'loading' | 'loaded' | 'error'
    this.visible = true;
    this.opacity = 0.6;
    this.mode = 'image'; // 'image' | 'polygon'
    this.polygons = [];
    this._errorMsg = null;
  }

  get status() { return this._status; }
  set status(v) { this._status = v; }
  get currentUrl() { return this._currentUrl; }

  setPolygons(poly) {
    this.polygons = Array.isArray(poly) ? poly : [];
  }

  /**
   * 히트박스 이미지 비동기 로딩
   * @param {string} url - 히트박스 이미지 URL
   */
  setImage(url) {
    if (this._currentUrl === url) return;
    this._currentUrl = url;
    this._hitboxImage = null;

    if (!url) {
      this._status = 'idle';
      this._errorMsg = null;
      return;
    }

    this._status = 'loading';

    if (this._loader && typeof this._loader.loadImage === 'function') {
      this._loader.loadImage(url)
        .then(img => {
          if (this._currentUrl === url) {
            this._hitboxImage = img;
            this._status = 'loaded';
            this._errorMsg = null;
          }
        })
        .catch(err => {
          if (this._currentUrl === url) {
            this._status = 'error';
            this._errorMsg = err?.message || `Failed to load image ${url}`;
            console.warn(`HitboxLayer: ${this._errorMsg}`);
          }
        });
    } else {
      const ImageConstructor = typeof Image !== 'undefined' ? Image : class { constructor() { this.src = ''; } };
      const img = new ImageConstructor();
      img.src = url;
      img.onload = () => {
        if (this._currentUrl === url) {
          this._hitboxImage = img;
          this._status = 'loaded';
          this._errorMsg = null;
        }
      };
      img.onerror = () => {
        if (this._currentUrl === url) {
          this._status = 'error';
          this._errorMsg = `Failed to load image ${url}`;
          console.warn(`HitboxLayer: ${this._errorMsg}`);
        }
      };
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} playerScreen - (미사용)
   * @param {import('../../core/MapManager').MapManager} mapManager
   * @param {number} [now] - timestamp
   */
  render(ctx, playerScreen, mapManager, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (!this.visible) return;

    ctx.save();
    ctx.globalAlpha = this.opacity;

    if (this.mode === 'polygon') {
      this._renderPolygons(ctx, mapManager);
    } else if (this._status === 'loaded' && this._hitboxImage) {
      const mapper = mapManager ? mapManager.mapper : null;
      if (mapper) {
        const p1 = mapper.map(0, 0);
        const p2 = mapper.map(mapper.worldWidth, mapper.worldHeight);
        
        ctx.drawImage(
          this._hitboxImage, 
          p1.px, p1.py, 
          p2.px - p1.px, p2.py - p1.py
        );
      }
    } else if (this._status === 'loading') {
      this._renderSpinner(ctx, '히트박스 오버레이 로딩 중...', now);
    } else if (this._status === 'error') {
      this._renderErrorBadge(ctx, '히트박스 이미지 미지원/오류');
    }

    ctx.restore();
  }

  _renderPolygons(ctx, mapManager) {
    const mapper = mapManager ? mapManager.mapper : null;
    if (!mapper || !this.polygons.length) return;

    ctx.fillStyle = 'rgba(212, 255, 0, 0.2)';
    ctx.strokeStyle = '#d4ff00';
    ctx.lineWidth = 2;

    for (const poly of this.polygons) {
      if (!poly.points || poly.points.length < 2) continue;
      ctx.beginPath();
      const p0 = mapper.map(poly.points[0].x, poly.points[0].y);
      ctx.moveTo(p0.px, p0.py);
      for (let i = 1; i < poly.points.length; i++) {
        const pt = mapper.map(poly.points[i].x, poly.points[i].y);
        ctx.lineTo(pt.px, pt.py);
      }
      if (poly.closed) {
        ctx.closePath();
        ctx.fill();
      }
      ctx.stroke();
    }
  }

  _renderSpinner(ctx, text, now) {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const cx = (ctx.canvas.width / dpr) / 2;
    const cy = (ctx.canvas.height / dpr) / 2;
    const radius = 16;
    const angle = ((now % 1000) / 1000) * Math.PI * 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle, angle + Math.PI * 1.5);
    ctx.strokeStyle = '#d4ff00';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(212, 255, 0, 0.85)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(text, cx, cy + radius + 10);
    ctx.restore();
  }

  _renderErrorBadge(ctx, text) {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const cx = (ctx.canvas.width / dpr) / 2;
    const cy = (ctx.canvas.height / dpr) / 2;
    const bw = 200;
    const bh = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(234, 179, 8, 0.15)';
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.5)';
    ctx.lineWidth = 1;
    ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
    ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);

    ctx.fillStyle = '#eab308';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }
}
