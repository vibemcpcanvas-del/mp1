/**
 * CaptchaMonitor.js
 * YOLO 감지 결과에서 캡챠 클래스(class 2)를 탐지하고
 * CommandBus로 PAUSE 명령을 전송한 뒤 UI 경고 콜백을 실행한다.
 *
 * 3초 쿨다운으로 중복 알림을 방지한다.
 */

/** YOLO 클래스 인덱스 — 캡챠 */
const CAPTCHA_CLASS_ID = 2;

/** 별도 클래스 ID 없이 신뢰도만으로 판단할 때의 임계값 */
const HIGH_CONFIDENCE_THRESHOLD = 0.8;

/** 중복 알림 방지 쿨다운(ms) */
const COOLDOWN_MS = 3000;

export class CaptchaMonitor {
  /**
   * @param {object}   opts
   * @param {import('./CommandBus.js').CommandBus} opts.commandBus
   * @param {() => void} opts.onAlert   - UI 경고 배너를 표시할 콜백
   */
  constructor({ commandBus, onAlert }) {
    if (!commandBus) throw new Error('[CaptchaMonitor] commandBus is required');
    if (typeof onAlert !== 'function') throw new Error('[CaptchaMonitor] onAlert must be a function');

    this._commandBus   = commandBus;
    this._onAlert      = onAlert;
    this._inCooldown   = false;
    this._cooldownTimer = null;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * YOLO API 응답 전체를 검사한다.
   *
   * 응답 형식 (둘 중 하나를 허용):
   *   Array 형식: [ { class_id: number, confidence: number, ... }, ... ]
   *   Object 형식: { detections: [ { class_id, confidence, ... }, ... ] }
   *
   * 다음 조건을 만족하는 박스가 하나라도 있으면 경보를 발령한다:
   *   - class_id === 2 (캡챠)
   *   - confidence >= 0.8
   *
   * @param {object|Array} detectionData
   */
  check(detectionData) {
    if (!detectionData) return;

    const boxes = this._parseBoxes(detectionData);
    if (!boxes || boxes.length === 0) return;

    const triggered = boxes.some(
      (box) =>
        box.class_id === CAPTCHA_CLASS_ID ||
        (typeof box.name === 'string' && box.name.toLowerCase() === 'captcha') ||
        (typeof box.confidence === 'number' && box.confidence >= HIGH_CONFIDENCE_THRESHOLD)
    );

    if (triggered) {
      this._trigger();
    }
  }

  /**
   * 쿨다운을 즉시 초기화한다.
   * (다음 check() 호출 시 즉시 경보를 발령할 수 있다.)
   */
  reset() {
    if (this._cooldownTimer) {
      clearTimeout(this._cooldownTimer);
      this._cooldownTimer = null;
    }
    this._inCooldown = false;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * 다양한 YOLO API 응답 구조에서 박스 배열을 추출한다.
   * @param {object|Array} data
   * @returns {Array<{class_id: number, confidence: number}>}
   */
  _parseBoxes(data) {
    if (Array.isArray(data)) return data;
    if (data.detections && Array.isArray(data.detections)) return data.detections;
    if (data.predictions && Array.isArray(data.predictions)) return data.predictions;
    if (data.results    && Array.isArray(data.results))    return data.results;
    return [];
  }

  /** 경보 발령: PAUSE 전송 + UI 콜백 + 쿨다운 시작 */
  _trigger() {
    if (this._inCooldown) return;

    this._inCooldown = true;

    // 1) 키마셔 일시 정지
    this._commandBus.send({ type: 'PAUSE' });

    // 2) UI 경고 배너
    try {
      this._onAlert();
    } catch (e) {
      console.error('[CaptchaMonitor] onAlert error:', e);
    }

    // 3) 쿨다운 타이머
    this._cooldownTimer = setTimeout(() => {
      this._inCooldown    = false;
      this._cooldownTimer = null;
    }, COOLDOWN_MS);
  }
}
