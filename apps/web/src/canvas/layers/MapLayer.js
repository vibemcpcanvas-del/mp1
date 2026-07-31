/**
 * MapLayer.js
 * 사냥터 배경 이미지 렌더링 레이어
 * @module canvas/layers/MapLayer
 */
import { BaseLayer } from './BaseLayer.js';
import tokens from '@tokens/tokens.json';

export class MapLayer extends BaseLayer {
  /**
   * @param {object} [assetLoader] - 선택적 커스텀 비동기 로더
   */
  constructor(assetLoader) {
    super('map');
    this._loader = assetLoader || null;
    this._bgImage = null;
    this._previousImg = null;
    this._currentUrl = null;
    this._status = 'idle'; // 'idle' | 'loading' | 'loaded' | 'error'
    this.visible = true;
    this.opacity = 1.0;
    this._errorMsg = null;
  }

  get status() { return this._status; }
  set status(v) { this._status = v; }
  get currentUrl() { return this._currentUrl; }

  /**
   * 배경 이미지 비동기 로딩
   * @param {string} url - 배경 이미지 URL
   */
  setImage(url) {
    if (this._currentUrl === url) return;
    this._currentUrl = url;

    if (!url) {
      this._bgImage = null;
      this._previousImg = null;
      this._status = 'idle';
      this._errorMsg = null;
      return;
    }

    this._status = 'loading';
    this._previousImg = this._bgImage;

    if (this._loader && typeof this._loader.loadImage === 'function') {
      this._loader.loadImage(url)
        .then(img => {
          if (this._currentUrl === url) {
            this._bgImage = img;
            this._previousImg = null;
            this._status = 'loaded';
            this._errorMsg = null;
          }
        })
        .catch(err => {
          if (this._currentUrl === url) {
            this._status = 'error';
            this._previousImg = null;
            this._errorMsg = err?.message || `Failed to load image ${url}`;
            console.error(`MapLayer: ${this._errorMsg}`);
          }
        });
    } else {
      const ImageConstructor = typeof Image !== 'undefined' ? Image : class { constructor() { this.src = ''; } };
      const img = new ImageConstructor();
      img.src = url;
      img.onload = () => {
        if (this._currentUrl === url) {
          this._bgImage = img;
          this._previousImg = null;
          this._status = 'loaded';
          this._errorMsg = null;
        }
      };
      img.onerror = () => {
        if (this._currentUrl === url) {
          this._status = 'error';
          this._previousImg = null;
          this._errorMsg = `Failed to load image ${url}`;
          console.error(`MapLayer: ${this._errorMsg}`);
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

    const canvas = ctx.canvas;
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.globalAlpha = this.opacity;

    // 1. 배경 단색 채우기
    ctx.fillStyle = tokens.color['map-bg'] || '#12151b';
    ctx.fillRect(0, 0, w, h);

    const imgToDraw = this._bgImage || this._previousImg;
    const mapper = mapManager ? mapManager.mapper : null;

    if (imgToDraw && mapper) {
      const p1 = mapper.map(0, 0);
      const p2 = mapper.map(mapper.worldWidth, mapper.worldHeight);
      
      ctx.drawImage(
        imgToDraw, 
        p1.px, p1.py, 
        p2.px - p1.px, p2.py - p1.py
      );
    }

    if (this._status === 'loading' && !imgToDraw) {
      this._renderSpinner(ctx, '맵 배경 로딩 중...', now);
    } else if (this._status === 'error') {
      this._renderErrorBadge(ctx, `⚠️ 맵 이미지 로드 실패: ${this._errorMsg || '네트워크 오류'}`);
    }

    ctx.restore();
  }

  _renderSpinner(ctx, text, now) {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const cx = (ctx.canvas.width / dpr) / 2;
    const cy = (ctx.canvas.height / dpr) / 2;
    const radius = 20;
    const angle = ((now % 1000) / 1000) * Math.PI * 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, angle, angle + Math.PI * 1.5);
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(text, cx, cy + radius + 12);
    ctx.restore();
  }

  _renderErrorBadge(ctx, text) {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const cx = (ctx.canvas.width / dpr) / 2;
    const cy = (ctx.canvas.height / dpr) / 2;
    const bw = Math.max(220, text.length * 8);
    const bh = 40;

    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 1;
    ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
    ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);

    ctx.fillStyle = '#ef4444';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }
}
