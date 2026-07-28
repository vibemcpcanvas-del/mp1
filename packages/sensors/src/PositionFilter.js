/**
 * PositionFilter.js
 * 지수 이동 평균(EMA) + 이상치 제거 필터
 * @module @sensors/PositionFilter
 */
export class PositionFilter {
  /**
   * @param {object} options
   * @param {number} [options.alpha=0.3] - EMA 계수 (0~1, 높을수록 최신값 반영 강도 증가)
   * @param {number} [options.outlierThreshold=300] - 이상치 판단 거리(px)
   */
  constructor({ alpha = 0.3, outlierThreshold = 300 } = {}) {
    this.alpha = alpha;
    this.outlierThreshold = outlierThreshold;
    /** @type {{ x: number, y: number } | null} */
    this._filtered = null;
    /** 연속 이상치 카운터 (순간이동 감지용) */
    this._consecutiveOutliers = 0;
  }

  /**
   * 새 좌표를 필터에 통과시킨다
   * @param {{ x: number, y: number }} raw - 원시 좌표
   * @returns {{ x: number, y: number } | null} 필터링된 좌표, 폐기 시 null
   */
  process(raw) {
    if (this._filtered === null) {
      // 첫 번째 좌표는 그대로 수용
      this._filtered = { x: raw.x, y: raw.y };
      this._consecutiveOutliers = 0;
      return { ...this._filtered };
    }

    const dist = Math.hypot(raw.x - this._filtered.x, raw.y - this._filtered.y);

    if (dist > this.outlierThreshold) {
      this._consecutiveOutliers++;

      if (this._consecutiveOutliers >= 3) {
        // 3회 연속 초과 → 순간이동(맵 이동/텔레포트)으로 간주, 필터 리셋
        console.debug(`[PositionFilter] 순간이동 감지 (${this._consecutiveOutliers}회 연속), 필터 리셋`);
        this._filtered = { x: raw.x, y: raw.y };
        this._consecutiveOutliers = 0;
        return { ...this._filtered };
      }

      // 3회 미만 → 폐기
      console.debug(`[PositionFilter] 이상치 폐기 (dist=${dist.toFixed(1)}, 연속=${this._consecutiveOutliers})`);
      return null;
    }

    // 정상 범위: EMA 적용
    this._consecutiveOutliers = 0;
    this._filtered = {
      x: this.alpha * raw.x + (1 - this.alpha) * this._filtered.x,
      y: this.alpha * raw.y + (1 - this.alpha) * this._filtered.y,
    };

    return { ...this._filtered };
  }

  /**
   * 필터 상태 초기화
   */
  reset() {
    this._filtered = null;
    this._consecutiveOutliers = 0;
  }
}
