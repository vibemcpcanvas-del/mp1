/**
 * BaseLayer.js
 * 캔버스 오버레이 레이어 인터페이스 기본 클래스
 * @module canvas/layers/BaseLayer
 */
export class BaseLayer {
  /**
   * @param {string} id - 레이어 식별자 ('map' | 'hitbox' | 'player' 등)
   */
  constructor(id) {
    this.id = id;
    this.visible = true;
    this.opacity = 1.0;
  }

  /**
   * 매 프레임 렌더 루프 호출 메서드
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} state
   * @param {import('@core/MapManager').MapManager} mapManager
   */
  render(ctx, state, mapManager) {}

  /**
   * 캔버스 뷰포트 크기 변경 훅
   * @param {number} width
   * @param {number} height
   * @param {number} dpr
   */
  onResize(width, height, dpr) {}

  /**
   * 해제 훅
   */
  destroy() {}
}
