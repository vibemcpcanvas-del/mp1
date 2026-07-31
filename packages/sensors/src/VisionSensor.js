/**
 * VisionSensor.js
 * 화면 캡처 + YOLO 추론 기반 실시간 좌표 센서
 *
 * blue.html의 로직을 CoordinateSensor 서브클래스로 이식.
 * - getDisplayMedia 로 화면 캡처
 * - setInterval 1000ms 마다 YOLO 추론 실행
 * - class 0 검출 결과 bbox 중심을 정규화하여 notifyListeners 호출
 *
 * @module @sensors/VisionSensor
 */
import { CoordinateSensor } from './CoordinateSensor.js';

/** bbox 색상 매핑 (class index → CSS color) */
const CLASS_COLORS = {
  0: '#3b82f6', // blue  — 플레이어
  1: '#ef4444', // red   — 몬스터 등 기타
};

/** 추론 주기 (ms) */
const INFER_INTERVAL_MS = 1000;

export class VisionSensor extends CoordinateSensor {
  /**
   * @param {object} opts
   * @param {string}      opts.modelUrl        - YOLO 추론 엔드포인트 URL
   * @param {string}      opts.apiKey          - Bearer 토큰
   * @param {number}     [opts.conf=0.45]      - confidence 임계값
   * @param {number}     [opts.iou=0.45]       - IoU 임계값
   * @param {HTMLVideoElement}  opts.videoEl         - 스트림 연결 대상 <video>
   * @param {HTMLCanvasElement} opts.overlayCanvasEl - bbox 오버레이 <canvas>
   */
  constructor({
    modelUrl,
    apiKey,
    conf = 0.45,
    iou = 0.45,
    videoEl,
    overlayCanvasEl,
  }) {
    super();

    if (!modelUrl) throw new Error('[VisionSensor] modelUrl은 필수입니다.');
    if (!videoEl) throw new Error('[VisionSensor] videoEl은 필수입니다.');
    if (!overlayCanvasEl) throw new Error('[VisionSensor] overlayCanvasEl은 필수입니다.');

    this._modelUrl = modelUrl;
    this._apiKey = apiKey ?? '';
    this._conf = conf;
    this._iou = iou;

    /** @type {HTMLVideoElement} */
    this._videoEl = videoEl;
    /** @type {HTMLCanvasElement} */
    this._overlayCanvas = overlayCanvasEl;

    /** @type {MediaStream | null} */
    this._stream = null;
    /** @type {number | null} */
    this._timer = null;

    /**
     * 검출 결과 원시 콜백 (CaptchaMonitor 등 위임용)
     * @type {((data: object) => void) | null}
     */
    this.onDetection = null;

    /** 추론 중 중복 실행 방지 플래그 */
    this._inferring = false;
  }

  // ─────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────

  /**
   * 화면 캡처 시작 → 스트림 연결 → 추론 인터벌 시작
   * @returns {Promise<void>}
   */
  async start() {
    if (this._stream) {
      console.warn('[VisionSensor] 이미 실행 중입니다.');
      return;
    }

    try {
      this._stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });
    } catch (err) {
      console.error('[VisionSensor] getDisplayMedia 실패:', err);
      throw err;
    }

    // <video> 에 스트림 연결
    this._videoEl.srcObject = this._stream;
    await this._videoEl.play().catch(() => {
      // autoplay 정책으로 play()가 실패해도 스트림 자체는 살아있음
    });

    // 스트림이 외부에서 종료될 때 자동 정리
    this._stream.getVideoTracks()[0]?.addEventListener('ended', () => this.stop());

    // 추론 인터벌 시작
    this._timer = setInterval(() => this._captureAndInfer(), INFER_INTERVAL_MS);
    console.debug('[VisionSensor] 시작됨');
  }

  /**
   * 스트림 정지 + 인터벌 해제
   */
  stop() {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }

    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }

    this._videoEl.srcObject = null;
    console.debug('[VisionSensor] 정지됨');
  }

  // ─────────────────────────────────────────────
  // Private — Capture & Infer
  // ─────────────────────────────────────────────

  /**
   * 현재 video 프레임을 캡처하여 YOLO 추론 실행
   * 이전 추론이 완료되기 전에 중복 호출되면 건너뜀
   * @private
   */
  async _captureAndInfer() {
    if (this._inferring) return;
    if (!this._stream) return;

    const video = this._videoEl;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    this._inferring = true;
    try {
      // 임시 캔버스에 현재 프레임 복사
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = video.videoWidth || 640;
      tmpCanvas.height = video.videoHeight || 360;
      const tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.drawImage(video, 0, 0, tmpCanvas.width, tmpCanvas.height);

      // Blob 변환 후 추론
      const blob = await new Promise(resolve =>
        tmpCanvas.toBlob(resolve, 'image/jpeg', 0.85)
      );
      if (blob) await this._runYolo(blob);
    } catch (err) {
      console.error('[VisionSensor] 캡처/추론 오류:', err);
    } finally {
      this._inferring = false;
    }
  }

  /**
   * YOLO HTTP 추론 요청
   * @private
   * @param {Blob} blob - 캡처된 프레임 이미지
   */
  async _runYolo(blob) {
    const form = new FormData();
    form.append('file', blob, 'frame.jpg');
    form.append('conf', String(this._conf));
    form.append('iou', String(this._iou));
    form.append('imgsz', '640');

    let response;
    try {
      response = await fetch(this._modelUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this._apiKey}` },
        body: form,
      });
    } catch (err) {
      console.error('[VisionSensor] fetch 오류:', err);
      return;
    }

    if (!response.ok) {
      console.error(`[VisionSensor] 서버 오류 ${response.status}`);
      return;
    }

    /** @type {{ images: Array<{ results: Array<{ box:{x1:number,y1:number,x2:number,y2:number}, class:number, confidence:number, name:string }> }> }} */
    const data = await response.json();

    // 오버레이 bbox 그리기
    const ctx = this._overlayCanvas.getContext('2d');
    this._drawBoxes(data, ctx);

    // 플레이어 위치 emit
    this._emitPlayerPosition(data);

    // 외부 콜백 (CaptchaMonitor 등)
    this.onDetection?.(data);
  }

  // ─────────────────────────────────────────────
  // Private — Rendering
  // ─────────────────────────────────────────────

  /**
   * overlayCanvas에 검출 박스 렌더링
   * @private
   * @param {object} data - YOLO 응답 JSON
   * @param {CanvasRenderingContext2D} ctx
   */
  _drawBoxes(data, ctx) {
    const canvas = this._overlayCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const results = data?.images?.[0]?.results ?? [];
    if (results.length === 0) return;

    // overlayCanvas 크기와 실제 화면 크기 비율로 스케일 조정
    const video = this._videoEl;
    const scaleX = canvas.width / (video.videoWidth || canvas.width);
    const scaleY = canvas.height / (video.videoHeight || canvas.height);

    results.forEach(({ box, class: cls, confidence, name }) => {
      const { x1, y1, x2, y2 } = box;
      const color = CLASS_COLORS[cls] ?? '#ffffff';

      const rx = x1 * scaleX;
      const ry = y1 * scaleY;
      const rw = (x2 - x1) * scaleX;
      const rh = (y2 - y1) * scaleY;

      // 박스
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);

      // 레이블 배경
      const label = `${name ?? cls} ${(confidence * 100).toFixed(0)}%`;
      ctx.font = '12px monospace';
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(rx, ry - 16, textW + 6, 16);

      // 레이블 텍스트
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, rx + 3, ry - 3);
    });
  }

  // ─────────────────────────────────────────────
  // Private — Position Emit
  // ─────────────────────────────────────────────

  /**
   * class 0 결과 중 confidence ≥ this._conf 인 것을 찾아
   * bbox 중심을 [0, 1] 범위로 정규화한 뒤 notifyListeners 호출
   * @private
   * @param {object} data - YOLO 응답 JSON
   */
  _emitPlayerPosition(data) {
    const results = data?.images?.[0]?.results ?? [];

    // class 0 중 conf 이상인 것 중 confidence 가장 높은 것 선택
    const candidate = results
      .filter(r => r.class === 0 && r.confidence >= this._conf)
      .sort((a, b) => b.confidence - a.confidence)[0];

    if (!candidate) return;

    const { x1, y1, x2, y2 } = candidate.box;

    // 중심점 계산 (추론 입력 크기 기준 정규화)
    const video = this._videoEl;
    const frameW = video.videoWidth || 640;
    const frameH = video.videoHeight || 360;

    const cx = ((x1 + x2) / 2) / frameW; // [0, 1]
    const cy = ((y1 + y2) / 2) / frameH; // [0, 1]

    this.notifyListeners({
      x: cx,
      y: cy,
      timestamp: Date.now(),
      confidence: candidate.confidence,
      source: 'vision',
      meta: {
        raw: { x1, y1, x2, y2 },
        frameW,
        frameH,
        name: candidate.name ?? String(candidate.class),
      },
    });
  }
}
