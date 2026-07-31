/**
 * PositionFilter.js
 * 지수 이동 평균(EMA) + 이상치 제거 필터
 * @module @sensors/PositionFilter
 */
export class PositionFilter {
  /**
   * @param {object} options
   * @param {number} [options.alpha=0.3] - EMA 계수 (0~1, 높을수록 최신값 반영 강도 증가)
   * @param {number|null} [options.outlierThreshold=null] - 이상치 판단 거리 (px 또는 normalized scale). 지정하지 않을 경우 좌표 스케일에 따라 자동 설정
   * @param {boolean} [options.enabled=true] - 필터 활성화 여부
   */
  constructor({ alpha = 0.3, outlierThreshold = null, enabled = true } = {}) {
    this.alpha = alpha;
    this.outlierThreshold = outlierThreshold;
    this._enabled = Boolean(enabled);
    /** @type {{ x: number, y: number } | null} */
    this._filtered = null;
    /** 연속 이상치 카운터 (순간이동 감지용) */
    this._consecutiveOutliers = 0;
  }

  get enabled() {
    return this._enabled;
  }

  set enabled(val) {
    const next = Boolean(val);
    if (this._enabled !== next) {
      this._enabled = next;
      this.reset();
    }
  }

  /**
   * 새 좌표를 필터에 통과시킨다
   * @param {{ x: number, y: number }} raw - 원시 좌표
   * @returns {{ x: number, y: number } | null} 필터링된 좌표, 폐기 시 null
   */
  process(raw) {
    if (!raw || typeof raw.x !== 'number' || typeof raw.y !== 'number' || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) {
      return null;
    }

    if (!this._enabled) {
      this.reset();
      return { ...raw, x: raw.x, y: raw.y };
    }

    if (this._filtered === null) {
      // 첫 번째 좌표는 그대로 수용
      this._filtered = { x: raw.x, y: raw.y };
      this._consecutiveOutliers = 0;
      return { ...raw, x: this._filtered.x, y: this._filtered.y };
    }

    // 좌표 스케일에 따른 임계값 결정 (미지정 시 0~1 규격 normalized 좌표는 0.25, 그 외 pixel 좌표는 300)
    let threshold = this.outlierThreshold;
    if (threshold === null || threshold === undefined) {
      const isNormalized = raw.x <= 1.0 && raw.y <= 1.0 && this._filtered.x <= 1.0 && this._filtered.y <= 1.0;
      threshold = isNormalized ? 0.25 : 300;
    }

    const dist = Math.hypot(raw.x - this._filtered.x, raw.y - this._filtered.y);

    if (dist > threshold) {
      this._consecutiveOutliers++;

      if (this._consecutiveOutliers >= 3) {
        // 3회 연속 초과 → 순간이동(맵 이동/텔레포트)으로 간주, 필터 리셋
        console.debug(`[PositionFilter] 순간이동 감지 (${this._consecutiveOutliers}회 연속), 필터 리셋`);
        this._filtered = { x: raw.x, y: raw.y };
        this._consecutiveOutliers = 0;
        return { ...raw, x: this._filtered.x, y: this._filtered.y };
      }

      // 3회 미만 → 폐기
      console.debug(`[PositionFilter] 이상치 폐기 (dist=${dist.toFixed(3)}, 연속=${this._consecutiveOutliers})`);
      return null;
    }

    // 정상 범위: EMA 적용
    this._consecutiveOutliers = 0;
    this._filtered = {
      x: this.alpha * raw.x + (1 - this.alpha) * this._filtered.x,
      y: this.alpha * raw.y + (1 - this.alpha) * this._filtered.y,
    };

    return { ...raw, x: this._filtered.x, y: this._filtered.y };
  }

  /**
   * 필터 상태 초기화
   */
  reset() {
    this._filtered = null;
    this._consecutiveOutliers = 0;
  }
}
