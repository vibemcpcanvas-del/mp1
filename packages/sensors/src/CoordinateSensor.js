/**
 * CoordinateSensor.js
 * 추상 베이스 클래스 — 옵저버 패턴 구현
 * @module @sensors/CoordinateSensor
 */
export class CoordinateSensor {
  constructor() {
    if (new.target === CoordinateSensor) {
      throw new Error('CoordinateSensor는 추상 클래스입니다. 직접 인스턴스화할 수 없습니다.');
    }
    /** @type {Set<Function>} */
    this._listeners = new Set();
    /** @type {{ x: number, y: number, timestamp: number } | null} */
    this._lastPosition = null;
  }

  /**
   * 위치 업데이트 구독
   * @param {(position: { x: number, y: number, timestamp: number }) => void} callback
   */
  subscribe(callback) {
    this._listeners.add(callback);
    // 구독 시 마지막 위치 즉시 전달
    if (this._lastPosition !== null) {
      callback(this._lastPosition);
    }
  }

  /**
   * 위치 업데이트 구독 해제
   * @param {Function} callback
   */
  unsubscribe(callback) {
    this._listeners.delete(callback);
  }

  /**
   * 모든 구독자에게 위치 전파
   * @param {{ x: number, y: number, timestamp: number }} position
   */
  notifyListeners(position) {
    this._lastPosition = position;
    this._listeners.forEach(cb => cb(position));
  }

  /**
   * 센서 시작 — 서브클래스에서 반드시 오버라이드
   */
  start() {
    console.warn(`[CoordinateSensor] start()가 오버라이드되지 않았습니다. (${this.constructor.name})`);
  }

  /**
   * 센서 정지 — 서브클래스에서 반드시 오버라이드
   */
  stop() {
    console.warn(`[CoordinateSensor] stop()가 오버라이드되지 않았습니다. (${this.constructor.name})`);
  }
}
