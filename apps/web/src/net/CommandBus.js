/**
 * CommandBus.js
 * WS → dumb_keymasher.py 단방향 명령 채널.
 * 연결 실패 시 send()는 console.warn만 출력하고 무시한다.
 */

export class CommandBus {
  /**
   * @param {object}  [opts]
   * @param {string}  [opts.url='ws://localhost:8765']
   * @param {number}  [opts.reconnectMs=3000]  재연결 시도 간격(ms)
   */
  constructor({ url = 'ws://localhost:8765', reconnectMs = 3000 } = {}) {
    this._url          = url;
    this._reconnectMs  = reconnectMs;
    this._ws           = null;
    this._connected    = false;
    this._statusCbs    = [];
    this._destroyed    = false;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** WebSocket 연결을 시도한다. 실패해도 예외를 던지지 않는다. */
  connect() {
    if (this._ws) return;          // 이미 연결 시도 중
    this._destroyed = false;
    this._tryConnect();
  }

  /** 연결을 해제하고 재연결을 중단한다. */
  disconnect() {
    this._destroyed = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.onclose = null;     // 재연결 루프 방지
      this._ws.close();
      this._ws = null;
    }
    this._setConnected(false);
  }

  /**
   * 명령을 전송한다. 미연결 상태이면 console.warn만 출력.
   * @param {{ type: 'KEY', key: string } | { type: 'PAUSE' } | { type: 'RESUME' }} cmd
   */
  send(cmd) {
    if (!this._connected || !this._ws) {
      console.warn('[CommandBus] send() ignored — not connected:', cmd);
      return;
    }
    try {
      this._ws.send(JSON.stringify(cmd));
    } catch (err) {
      console.warn('[CommandBus] send() failed:', err, cmd);
    }
  }

  /**
   * 연결 상태 변경 시 호출될 콜백을 등록한다.
   * @param {(status: 'connected'|'disconnected') => void} cb
   */
  onStatusChange(cb) {
    if (typeof cb === 'function') {
      this._statusCbs.push(cb);
    }
  }

  /** @returns {boolean} */
  get isConnected() {
    return this._connected;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  _tryConnect() {
    if (this._destroyed) return;

    try {
      const ws = new WebSocket(this._url);
      this._ws = ws;

      ws.onopen = () => {
        if (this._destroyed) { ws.close(); return; }
        this._setConnected(true);
      };

      ws.onclose = () => {
        this._ws = null;
        this._setConnected(false);
        if (!this._destroyed) {
          this._reconnectTimer = setTimeout(
            () => this._tryConnect(),
            this._reconnectMs
          );
        }
      };

      ws.onerror = (evt) => {
        // 에러 로그는 최소한으로; onclose가 곧 이어서 발생함
        console.warn('[CommandBus] WebSocket error:', evt.message ?? evt.type);
      };

    } catch (err) {
      // new WebSocket() 자체가 던지는 경우 (잘못된 URL 등)
      console.warn('[CommandBus] Failed to create WebSocket:', err);
      this._ws = null;
      if (!this._destroyed) {
        this._reconnectTimer = setTimeout(
          () => this._tryConnect(),
          this._reconnectMs
        );
      }
    }
  }

  /**
   * 내부 연결 상태를 갱신하고 콜백을 호출한다.
   * @param {boolean} connected
   */
  _setConnected(connected) {
    if (this._connected === connected) return;
    this._connected = connected;
    const status = connected ? 'connected' : 'disconnected';
    for (const cb of this._statusCbs) {
      try { cb(status); } catch (e) { console.error('[CommandBus] statusCb error:', e); }
    }
  }
}
