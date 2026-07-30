/**
 * MapLayer.js
 * 사냥터 배경 이미지 렌더링 레이어
 * @module canvas/layers/MapLayer
 */
import tokens from '@tokens/tokens.json';

export class MapLayer {
  constructor() {
    this._bgImage = null;
    this._currentUrl = null;
  }

  /**
   * 배경 이미지 비동기 로딩
   * @param {string} url - 배경 이미지 URL
   */
  setImage(url) {
    if (this._currentUrl === url) return;
    this._currentUrl = url;
    this._bgImage = null; // 로딩 중에는 표시하지 않거나 단색

    if (!url) return;

    const img = new Image();
    img.src = url;
    img.onload = () => {
      if (this._currentUrl === url) {
        this._bgImage = img;
      }
    };
    img.onerror = () => {
      console.error(`MapLayer: Failed to load image ${url}`);
    };
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} playerScreen - (미사용)
   * @param {import('../../core/MapManager').MapManager} mapManager
   */
  render(ctx, playerScreen, mapManager) {
    const canvas = ctx.canvas;
    
    // 배경색 (로딩 전 또는 이미지 없을 때)
    ctx.fillStyle = tokens.color['map-bg'];
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this._bgImage) {
      // CoordinateMapper를 통해 원본 해상도와 스크린 매핑 비율을 알 수 있음
      const mapper = mapManager.mapper;
      if (mapper) {
        // 이미지를 캔버스 크기에 맞게 그리기 (mapper가 스케일링을 담당하므로)
        // mapper.map(worldX, worldY)는 화면 좌표를 줌.
        // 배경 이미지는 (0,0)에서 (worldWidth, worldHeight)까지.
        const p1 = mapper.map(0, 0);
        const p2 = mapper.map(mapper.worldWidth, mapper.worldHeight);
        
        ctx.drawImage(
          this._bgImage, 
          p1.px, p1.py, 
          p2.px - p1.px, p2.py - p1.py
        );
      }
    }
  }
}
