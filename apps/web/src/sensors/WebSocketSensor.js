/**
 * WebSocketSensor.js
 * 로컀 WebSocket 서버(예: Python 주인 미니맵) 에서 실시간 포지션을 수신하는 센서.
 *
 * 메시지 형식 (JSON):
 *   { "x": 0.45, "y": 0.62 }   // 0~1 정규화된 좌표
 *
 * @module WebSocketSensor
 */
export class WebSocketSensor {
  /**
   * @param {object} opts
   * @param {string} opts.url             WebSocket 엔드포인트 (default: ws://localhost:8765)
   * @param {number} opts.reconnectDelay  재연결 대기 ms (default: 3000)
   * @param {number} opts.maxRetries      최대 재연결 횟수 (default: 10)
   */
  constructor({
    url = 'ws://localhost:8765',
    reconnectDelay = 3000,
    maxRetries = 10,
  } = {}) {
    this._url = url;
    this._reconnectDelay = reconnectDelay;
    this._maxRetries = maxRetries;

    this._ws = null;
    this._subscribers = [];
    this._statusListeners = [];
    this._retryCount = 0;
    this._retryTimer = null;
    this._stopped = false;
  }

  // ─── 퍼블릭 API ───────────────────────────────────────────────

  /** 포지션 구독 */
  subscribe(fn) {
    this._subscribers.push(fn);
    return () => {
      this._subscribers = this._subscribers.filter(s => s !== fn);
    };
  }

  /**
   * 상태 변경 콜백 등록
   * @param {(status: 'connecting'|'connected'|'reconnecting'|'disconnected') => void} fn
   */
  onStatusChange(fn) {
    this._statusListeners.push(fn);
  }

  start() {
    this._stopped = false;
    this._retryCount = 0;
    this._connect();
  }

  stop() {
    this._stopped = true;
    clearTimeout(this._retryTimer);
    if (this._ws) {
      this._ws.onclose = null; // 재연결 방지
      this._ws.close();
      this._ws = null;
    }
    this._emit_status('disconnected');
  }

  // ─── 내부 ────────────────────────────────────────────────────────

  _connect() {
    if (this._stopped) return;

    const isRetry = this._retryCount > 0;
    this._emit_status(isRetry ? 'reconnecting' : 'connecting');
    console.debug(`[WebSocketSensor] ${isRetry ? '재연결' : '연결'} 시도 (${this._url}) #${this._retryCount}`);

    try {
      this._ws = new WebSocket(this._url);
    } catch (e) {
      console.warn('[WebSocketSensor] WebSocket 생성 실패:', e);
      this._scheduleRetry();
      return;
    }

    this._ws.onopen = () => {
      if (this._stopped) return;
      this._retryCount = 0;
      this._emit_status('connected');
      console.debug('[WebSocketSensor] 연결 성공');
    };

    this._ws.onmessage = (event) => {
      if (this._stopped) return;
      try {
        const data = JSON.parse(event.data);
        if (typeof data.x === 'number' && typeof data.y === 'number') {
          const pos = {
            x: Math.max(0, Math.min(1, data.x)),
            y: Math.max(0, Math.min(1, data.y)),
          };
          this._subscribers.forEach(fn => fn(pos));
        } else {
          console.warn('[WebSocketSensor] 알 수 없는 메시지 형식:', data);
        }
      } catch (e) {
        console.warn('[WebSocketSensor] JSON 파싱 오류:', e);
      }
    };

    this._ws.onerror = (e) => {
      console.warn('[WebSocketSensor] 오류:', e);
    };

    this._ws.onclose = (e) => {
      if (this._stopped) return;
      console.debug('[WebSocketSensor] 연결 종료 (code:', e.code, ')');
      this._scheduleRetry();
    };
  }

  _scheduleRetry() {
    if (this._stopped) return;
    if (this._retryCount >= this._maxRetries) {
      console.warn('[WebSocketSensor] 최대 재연결 횟수 초과. 중지.');
      this._emit_status('disconnected');
      return;
    }
    this._retryCount++;
    this._emit_status('reconnecting');
    this._retryTimer = setTimeout(() => this._connect(), this._reconnectDelay);
  }

  _emit_status(status) {
    this._statusListeners.forEach(fn => fn(status));
  }
}
