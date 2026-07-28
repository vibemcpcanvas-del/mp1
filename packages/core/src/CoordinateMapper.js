/**
 * CoordinateMapper.js
 * 월드 좌표 → 화면 픽셀 좌표 변환
 * @module @core/CoordinateMapper
 */
export class CoordinateMapper {
  /**
   * @param {object} config
   * @param {number} config.worldWidth  - 월드 너비 (px)
   * @param {number} config.worldHeight - 월드 높이 (px)
   * @param {number} config.screenWidth - 화면 너비 (px)
   * @param {number} config.screenHeight- 화면 높이 (px)
   * @param {boolean} [config.clamp=true] - 결과 좌표 경계 고정 여부
   */
  constructor({ worldWidth, worldHeight, screenWidth, screenHeight, clamp = true }) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.clamp = clamp;
  }

  /**
   * 월드 좌표 → 화면 픽셀 좌표
   * @param {number} worldX
   * @param {number} worldY
   * @returns {{ px: number, py: number }}
   */
  map(worldX, worldY) {
    let px = (worldX / this.worldWidth) * this.screenWidth;
    let py = (worldY / this.worldHeight) * this.screenHeight;

    if (this.clamp) {
      px = Math.max(0, Math.min(this.screenWidth, px));
      py = Math.max(0, Math.min(this.screenHeight, py));
    }

    return { px, py };
  }

  /**
   * 화면 픽셀 좌표 → 월드 좌표 (역변환, 캘리브레이션 UI에서 사용)
   * @param {number} px
   * @param {number} py
   * @returns {{ worldX: number, worldY: number }}
   */
  unmap(px, py) {
    return {
      worldX: (px / this.screenWidth) * this.worldWidth,
      worldY: (py / this.screenHeight) * this.worldHeight,
    };
  }
}
