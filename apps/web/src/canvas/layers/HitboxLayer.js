/**
 * HitboxLayer.js
 * 사냥터 히트박스(지형/플랫폼) PNG 오버레이 렌더링 레이어
 * @module canvas/layers/HitboxLayer
 */
import tokens from '@tokens/tokens.json';

export class HitboxLayer {
  constructor() {
    this._hitboxImage = null;
    this._currentUrl = null;
  }

  /**
   * 히트박스 이미지 비동기 로딩
   * @param {string} url - 히트박스 이미지 URL
   */
  setImage(url) {
    if (this._currentUrl === url) return;
    this._currentUrl = url;
    this._hitboxImage = null;

    if (!url) return;

    const img = new Image();
    img.src = url;
    img.onload = () => {
      if (this._currentUrl === url) {
        this._hitboxImage = img;
      }
    };
    img.onerror = () => {
      console.warn(`HitboxLayer: Failed to load image ${url}`);
    };
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} playerScreen - (미사용)
   * @param {import('../../core/MapManager').MapManager} mapManager
   */
  render(ctx, playerScreen, mapManager) {
    if (this._hitboxImage) {
      const mapper = mapManager.mapper;
      if (mapper) {
        const p1 = mapper.map(0, 0);
        const p2 = mapper.map(mapper.worldWidth, mapper.worldHeight);
        
        ctx.save();
        ctx.globalAlpha = 0.6; // 히트박스는 반투명 오버레이
        ctx.drawImage(
          this._hitboxImage, 
          p1.px, p1.py, 
          p2.px - p1.px, p2.py - p1.py
        );
        ctx.restore();
      }
    }
  }
}
