/**
 * WebSocketSensor.js
 * 비전 프로그램 연동 센서 — WebSocket 수신 + 자동 재연결 + PositionFilter 통합
 * @module @sensors/WebSocketSensor
 */
import { CoordinateSensor } from './CoordinateSensor.js';
import { PositionFilter } from './PositionFilter.js';

const DEFAULT_URL = 'ws://localhost:8765';
const RECONNECT_INTERVAL_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const MIN_CONFIDENCE = 0.5;

export class WebSocketSensor extends CoordinateSensor {
  /**
   * @param {object} options
   * @param {string} [options.url='ws://localhost:8765'] - WebSocket URL
   * @param {string|null} [options.currentRegion=null] - 현재 지역명
   * @param {PositionFilter} [options.filter] - 커스텀 필터 (미제공 시 기본값 사용)
   */
  constructor({ url = DEFAULT_URL, currentRegion = null, filter } = {}) {
    super();
    this._url = url;
    this._currentRegion = currentRegion;
    this._filter = filter || new PositionFilter();
    this._ws = null;
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._running = false;

    /** @type {Set<Function>} 지역 변경 콜백 */
    this._regionCallbacks = new Set();

    // 연결 상태: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
    this._status = 'disconnected';
    /** @type {Set<Function>} 상태 변경 콜백 */
    this._statusCallbacks = new Set();
  }

  // ─── 공개 API ──────────────────────────────────────────────

  start() {
    this._running = true;
    this._reconnectAttempts = 0;
    this._connect();
  }

  stop() {
    this._running = false;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._setStatus('disconnected');
  }

  /**
   * 지역 변경 이벤트 구독
   * @param {(region: string) => void} callback
   */
  onRegionChange(callback) {
    this._regionCallbacks.add(callback);
  }

  offRegionChange(callback) {
    this._regionCallbacks.delete(callback);
  }

  /**
   * 연결 상태 변경 이벤트 구독
   * @param {(status: string) => void} callback
   */
  onStatusChange(callback) {
    this._statusCallbacks.add(callback);
  }

  offStatusChange(callback) {
    this._statusCallbacks.delete(callback);
  }

  get status() { return this._status; }

  // ─── 내부 메서드 ──────────────────────────────────────────

  _setStatus(status) {
    if (this._status !== status) {
      this._status = status;
      this._statusCallbacks.forEach(cb => cb(status));
    }
  }

  _connect() {
    if (!this._running) return;
    this._setStatus(this._reconnectAttempts === 0 ? 'connecting' : 'reconnecting');

    try {
      this._ws = new WebSocket(this._url);
    } catch (e) {
      console.error('[WebSocketSensor] WebSocket 생성 실패:', e);
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      console.debug('[WebSocketSensor] 연결됨:', this._url);
      this._reconnectAttempts = 0;
      this._setStatus('connected');
    };

    this._ws.onmessage = (event) => {
      this._handleMessage(event.data);
    };

    this._ws.onerror = (err) => {
      console.warn('[WebSocketSensor] 오류:', err);
    };

    this._ws.onclose = () => {
      if (!this._running) return;
      console.warn('[WebSocketSensor] 연결 끊김');
      this._scheduleReconnect();
    };
  }

  _handleMessage(raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.warn('[WebSocketSensor] JSON 파싱 실패:', raw);
      return;
    }

    // confidence 낮으면 폐기
    if (typeof data.confidence === 'number' && data.confidence < MIN_CONFIDENCE) {
      console.debug(`[WebSocketSensor] 낮은 신뢰도 데이터 폐기 (confidence=${data.confidence})`);
      return;
    }

    // 지역 변경 감지
    if (data.region && data.region !== this._currentRegion) {
      const prev = this._currentRegion;
      this._currentRegion = data.region;
      this._filter.reset(); // 지역 전환 시 필터 리셋
      console.debug(`[WebSocketSensor] 지역 변경: ${prev} → ${data.region}`);
      this._regionCallbacks.forEach(cb => cb(data.region));
    }

    // PositionFilter 통과
    const raw_pos = { x: Number(data.x), y: Number(data.y) };
    const filtered = this._filter.process(raw_pos);
    if (filtered === null) return; // 이상치 폐기

    this.notifyListeners({
      x: filtered.x,
      y: filtered.y,
      timestamp: Date.now(),
      confidence: data.confidence ?? 1.0,
    });
  }

  _scheduleReconnect() {
    this._setStatus('reconnecting');
    this._ws = null;

    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[WebSocketSensor] 최대 재연결 횟수(${MAX_RECONNECT_ATTEMPTS}회) 초과. 재연결 중단.`);
      this._setStatus('disconnected');
      return;
    }

    this._reconnectAttempts++;
    console.debug(`[WebSocketSensor] ${RECONNECT_INTERVAL_MS / 1000}초 후 재연결 (${this._reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connect();
    }, RECONNECT_INTERVAL_MS);
  }
}
