/**
 * Calibration.js
 * 2점 보정 방식 — 비전 픽셀좌표 → 월드좌표 변환 보정
 * localStorage에 지역별로 저장/복원
 * @module @core/Calibration
 */

const STORAGE_KEY_PREFIX = 'mp1_calibration_';

export class Calibration {
  /**
   * @param {string} regionName - 지역명 (localStorage 키로 사용)
   */
  constructor(regionName) {
    this.regionName = regionName;
    /** @type {{ visionX: number, visionY: number, worldX: number, worldY: number }[]} */
    this._points = [];
    /** @type {{ scaleX: number, scaleY: number, offsetX: number, offsetY: number } | null} */
    this._transform = null;

    this._load();
  }

  /**
   * 보정 기준점 추가 (2개 지정 시 자동 계산)
   * @param {number} visionX - 비전 픽셀 X
   * @param {number} visionY - 비전 픽셀 Y
   * @param {number} worldX  - 시뮬레이터 월드 X
   * @param {number} worldY  - 시뮬레이터 월드 Y
   */
  addPoint(visionX, visionY, worldX, worldY) {
    if (this._points.length >= 2) {
      this._points = []; // 초기화 후 첫 번째 점 재설정
    }
    this._points.push({ visionX, visionY, worldX, worldY });

    if (this._points.length === 2) {
      this._calculate();
      this._save();
    }
  }

  /**
   * 보정 적용 — 비전 픽셀좌표 → 월드좌표
   * @param {number} visionX
   * @param {number} visionY
   * @returns {{ worldX: number, worldY: number } | null} 보정값 없으면 null
   */
  apply(visionX, visionY) {
    if (!this._transform) return null;
    return {
      worldX: visionX * this._transform.scaleX + this._transform.offsetX,
      worldY: visionY * this._transform.scaleY + this._transform.offsetY,
    };
  }

  /** 보정 상태 확인 */
  get isCalibrated() {
    return this._transform !== null;
  }

  /** 현재 기준점 목록 */
  get points() {
    return [...this._points];
  }

  /** 보정 초기화 */
  reset() {
    this._points = [];
    this._transform = null;
    try {
      localStorage.removeItem(STORAGE_KEY_PREFIX + this.regionName);
    } catch (e) {
      console.warn('[Calibration] localStorage 접근 실패:', e);
    }
  }

  // ─── 내부 ──────────────────────────────────────────────────

  _calculate() {
    const [p1, p2] = this._points;
    const dVisionX = p2.visionX - p1.visionX;
    const dVisionY = p2.visionY - p1.visionY;

    // 스케일 계산 (0 나눔 방지)
    const scaleX = dVisionX !== 0 ? (p2.worldX - p1.worldX) / dVisionX : 1;
    const scaleY = dVisionY !== 0 ? (p2.worldY - p1.worldY) / dVisionY : 1;

    // 오프셋 계산
    const offsetX = p1.worldX - p1.visionX * scaleX;
    const offsetY = p1.worldY - p1.visionY * scaleY;

    this._transform = { scaleX, scaleY, offsetX, offsetY };
    console.debug('[Calibration] 보정 완료:', this._transform);
  }

  _save() {
    try {
      const data = { points: this._points, transform: this._transform };
      localStorage.setItem(STORAGE_KEY_PREFIX + this.regionName, JSON.stringify(data));
    } catch (e) {
      console.warn('[Calibration] localStorage 저장 실패:', e);
    }
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + this.regionName);
      if (!raw) return;
      const data = JSON.parse(raw);
      this._points = data.points || [];
      this._transform = data.transform || null;
      console.debug(`[Calibration] "${this.regionName}" 보정값 복원됨`);
    } catch (e) {
      console.warn('[Calibration] localStorage 복원 실패:', e);
    }
  }
}
