/**
 * RouteManager.js
 * 웨이포인트 기반 순찰 루트 관리 — 저장/복원, 봇 tick 로직
 * @module @core/RouteManager
 */

const STORAGE_KEY_PREFIX = 'mp1_route_';

/**
 * 간단한 UUID v4 생성 (crypto.randomUUID 지원 여부에 따라 폴백)
 * @returns {string}
 */
function _uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 폴백: Math.random 기반 UUID-like 문자열
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * @typedef {object} Waypoint
 * @property {string}      id            - 고유 식별자 (UUID)
 * @property {number}      worldX        - 월드 X 좌표
 * @property {number}      worldY        - 월드 Y 좌표
 * @property {number}      order         - 삽입 순서 (0-based)
 * @property {string|null} skillKey      - 도착 시 발동할 스킬 키 (없으면 null)
 * @property {number}      triggerRadius - 도착 판정 반경 (기본 50)
 */

/**
 * @typedef {object} TickResult
 * @property {boolean}     triggered      - 현재 웨이포인트 도달 여부
 * @property {string|null} skillKey       - 도달한 웨이포인트의 skillKey (미도달 시 null)
 * @property {number}      waypointIndex  - 도달 처리된 웨이포인트의 인덱스 (-1: 미도달)
 */

export class RouteManager {
  constructor() {
    /** @type {Waypoint[]} */
    this._waypoints = [];
    /** @type {'loop'|'pingpong'} */
    this._mode = 'loop';
    /**
     * 핑퐁 모드에서 방향 추적 (1: 정방향, -1: 역방향)
     * @type {1|-1}
     */
    this._pingpongDir = 1;
    /** @type {number} */
    this._currentIndex = 0;
  }

  // ─── 웨이포인트 관리 ──────────────────────────────────────────

  /**
   * 웨이포인트 추가
   * @param {number} worldX
   * @param {number} worldY
   * @returns {Waypoint}
   */
  addWaypoint(worldX, worldY) {
    /** @type {Waypoint} */
    const wp = {
      id: _uuid(),
      worldX,
      worldY,
      order: this._waypoints.length,
      skillKey: null,
      triggerRadius: 50,
    };
    this._waypoints.push(wp);
    return wp;
  }

  /**
   * 웨이포인트 제거
   * @param {string} id
   */
  removeWaypoint(id) {
    const idx = this._waypoints.findIndex((wp) => wp.id === id);
    if (idx === -1) {
      console.warn(`[RouteManager] 웨이포인트를 찾을 수 없음: ${id}`);
      return;
    }
    this._waypoints.splice(idx, 1);
    // order 재정렬
    this._waypoints.forEach((wp, i) => { wp.order = i; });
    // 인덱스 범위 보정
    if (this._currentIndex >= this._waypoints.length) {
      this._currentIndex = Math.max(0, this._waypoints.length - 1);
    }
  }

  /**
   * 웨이포인트에 스킬 키 설정
   * @param {string}      id  - 웨이포인트 ID
   * @param {string|null} key - 스킬 키 (null 이면 해제)
   */
  setWaypointSkill(id, key) {
    const wp = this._waypoints.find((w) => w.id === id);
    if (!wp) {
      console.warn(`[RouteManager] 웨이포인트를 찾을 수 없음: ${id}`);
      return;
    }
    wp.skillKey = key ?? null;
  }

  /**
   * 전체 웨이포인트 목록 반환 (복사본)
   * @returns {Waypoint[]}
   */
  getWaypoints() {
    return [...this._waypoints];
  }

  /** 웨이포인트 전체 초기화 */
  clearWaypoints() {
    this._waypoints = [];
    this._currentIndex = 0;
    this._pingpongDir = 1;
  }

  /**
   * 순찰 모드 설정
   * @param {'loop'|'pingpong'} mode
   */
  setMode(mode) {
    if (mode !== 'loop' && mode !== 'pingpong') {
      console.warn(`[RouteManager] 알 수 없는 모드: "${mode}" — 'loop' 또는 'pingpong' 사용`);
      return;
    }
    this._mode = mode;
    this._pingpongDir = 1; // 방향 초기화
  }

  // ─── 저장 / 복원 ─────────────────────────────────────────────

  /**
   * 현재 루트를 localStorage에 저장
   * @param {string} regionId
   */
  save(regionId) {
    try {
      /** @type {import('./RouteManager.js').RouteConfig} */
      const config = {
        regionId,
        waypoints: this._waypoints,
        mode: this._mode,
      };
      localStorage.setItem(STORAGE_KEY_PREFIX + regionId, JSON.stringify(config));
      console.debug(`[RouteManager] 루트 저장 완료: "${regionId}" (${this._waypoints.length}개)`);
    } catch (e) {
      console.warn('[RouteManager] localStorage 저장 실패:', e);
    }
  }

  /**
   * localStorage에서 루트 복원
   * @param {string} regionId
   * @returns {boolean} 복원 성공 여부
   */
  load(regionId) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + regionId);
      if (!raw) return false;
      const config = JSON.parse(raw);
      if (!config || !Array.isArray(config.waypoints)) return false;

      this._waypoints = config.waypoints;
      this._mode = config.mode === 'pingpong' ? 'pingpong' : 'loop';
      this._currentIndex = 0;
      this._pingpongDir = 1;
      console.debug(`[RouteManager] 루트 복원 완료: "${regionId}" (${this._waypoints.length}개)`);
      return true;
    } catch (e) {
      console.warn('[RouteManager] localStorage 복원 실패:', e);
      return false;
    }
  }

  // ─── 봇 순찰 로직 ────────────────────────────────────────────

  /**
   * 매 프레임/틱마다 호출 — 현재 위치로 웨이포인트 도달 판정
   * @param {number} worldX - 현재 플레이어 월드 X
   * @param {number} worldY - 현재 플레이어 월드 Y
   * @returns {TickResult}
   */
  tick(worldX, worldY) {
    const notTriggered = { triggered: false, skillKey: null, waypointIndex: -1 };

    if (this._waypoints.length === 0) return notTriggered;

    const wp = this._waypoints[this._currentIndex];
    if (!wp) return notTriggered;

    const dist = this._distance(worldX, worldY, wp.worldX, wp.worldY);
    if (dist > wp.triggerRadius) return notTriggered;

    // 도달 — 결과 캡처 후 인덱스 전진
    const triggeredIndex = this._currentIndex;
    const triggeredSkill = wp.skillKey ?? null;

    this._advance();

    return {
      triggered: true,
      skillKey: triggeredSkill,
      waypointIndex: triggeredIndex,
    };
  }

  /**
   * 현재 목표 웨이포인트 반환
   * @returns {Waypoint|null}
   */
  getCurrentWaypoint() {
    if (this._waypoints.length === 0) return null;
    return this._waypoints[this._currentIndex] ?? null;
  }

  /** 순찰 인덱스를 처음으로 리셋 */
  reset() {
    this._currentIndex = 0;
    this._pingpongDir = 1;
  }

  // ─── 내부 유틸 ───────────────────────────────────────────────

  /**
   * 다음 웨이포인트로 인덱스 전진 (mode에 따라 loop / pingpong)
   * @private
   */
  _advance() {
    const len = this._waypoints.length;
    if (len <= 1) {
      this._currentIndex = 0;
      return;
    }

    if (this._mode === 'loop') {
      this._currentIndex = (this._currentIndex + 1) % len;
    } else {
      // pingpong
      const next = this._currentIndex + this._pingpongDir;
      if (next >= len) {
        // 끝에 도달 → 방향 반전, 한 칸 뒤로
        this._pingpongDir = -1;
        this._currentIndex = len - 2;
      } else if (next < 0) {
        // 시작에 도달 → 방향 반전, 한 칸 앞으로
        this._pingpongDir = 1;
        this._currentIndex = 1;
      } else {
        this._currentIndex = next;
      }
    }
  }

  /**
   * 두 점 간의 유클리드 거리
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @returns {number}
   * @private
   */
  _distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
