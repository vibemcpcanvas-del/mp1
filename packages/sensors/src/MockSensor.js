/**
 * MockSensor.js
 * 테스트용 센서 — 랜덤 워크(random walk) 방식으로 가상 좌표 생성
 * @module @sensors/MockSensor
 */
import { CoordinateSensor } from './CoordinateSensor.js';

const WORLD_X_MAX = 2000;
const WORLD_Y_MAX = 1500;
const INTERVAL_MS = 200;
const STEP_RANGE = 30; // ±30 이내 이동

export class MockSensor extends CoordinateSensor {
  /**
   * @param {object} options
   * @param {number} [options.startX=1000] - 시작 X 좌표
   * @param {number} [options.startY=750] - 시작 Y 좌표
   * @param {number} [options.intervalMs=200] - 갱신 주기(ms)
   */
  constructor({ startX = 1000, startY = 750, intervalMs = INTERVAL_MS } = {}) {
    super();
    this._x = startX;
    this._y = startY;
    this._intervalMs = intervalMs;
    this._timer = null;
  }

  start() {
    if (this._timer !== null) return; // 이미 실행 중

    this._timer = setInterval(() => {
      // ±STEP_RANGE 이내 랜덤 워크
      this._x += (Math.random() * 2 - 1) * STEP_RANGE;
      this._y += (Math.random() * 2 - 1) * STEP_RANGE;

      // 경계 클램핑
      this._x = Math.max(0, Math.min(WORLD_X_MAX, this._x));
      this._y = Math.max(0, Math.min(WORLD_Y_MAX, this._y));

      this.notifyListeners({
        x: this._x,
        y: this._y,
        timestamp: Date.now(),
        confidence: 1.0, // Mock은 항상 신뢰도 100%
      });
    }, this._intervalMs);

    console.debug('[MockSensor] 시작됨');
  }

  stop() {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    console.debug('[MockSensor] 정지됨');
  }
}
