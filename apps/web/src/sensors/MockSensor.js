/**
 * MockSensor.js
 * 실제 WebSocket 없이 가상의 포지션 데이터를 생성하는 센서.
 * 주기적으로 x/y 좌표를 방출하여 Renderer 테스트에 사용한다.
 *
 * @module MockSensor
 */
export class MockSensor {
  constructor({ interval = 100, pattern = 'walk' } = {}) {
    this._interval = interval;
    this._pattern = pattern;
    this._subscribers = [];
    this._timerId = null;
    this._tick = 0;
  }

  /** @param {(pos: {x:number, y:number}) => void} fn */
  subscribe(fn) {
    this._subscribers.push(fn);
    return () => {
      this._subscribers = this._subscribers.filter(s => s !== fn);
    };
  }

  start() {
    if (this._timerId) return;
    this._tick = 0;
    this._timerId = setInterval(() => this._emit(), this._interval);
  }

  stop() {
    if (this._timerId) {
      clearInterval(this._timerId);
      this._timerId = null;
    }
  }

  _emit() {
    this._tick++;
    const t = this._tick * (this._interval / 1000);
    let pos;

    switch (this._pattern) {
      case 'circle':
        pos = {
          x: 0.5 + 0.3 * Math.cos(t * 0.5),
          y: 0.5 + 0.3 * Math.sin(t * 0.5),
        };
        break;
      case 'figure8':
        pos = {
          x: 0.5 + 0.35 * Math.sin(t * 0.4),
          y: 0.5 + 0.2  * Math.sin(t * 0.8),
        };
        break;
      case 'walk':
      default: {
        // 좌우로 왜왜 걸어다니는 패턴
        const period = 8; // 초
        const phase = (t % period) / period; // 0~1
        pos = {
          x: phase < 0.5 ? 0.1 + phase * 1.6 : 0.9 - (phase - 0.5) * 1.6,
          y: 0.5 + 0.05 * Math.sin(t * 2),
        };
        break;
      }
    }

    this._subscribers.forEach(fn => fn(pos));
  }
}
