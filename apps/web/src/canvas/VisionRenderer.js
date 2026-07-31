/**
 * VisionRenderer.js
 * 상단 '비전 캔버스' 전용 렌더러
 * 센서의 원본 좌표(가상 해상도 기준)를 점과 궤적으로 표시합니다.
 */
export class VisionRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.trail = [];
    this._latestPos = null;
    this._rafId = null;
    this._video = document.getElementById('game-screen-video');
    this.isFrozen = false;
  }

  start() {
    if (!this._rafId) this._rafId = requestAnimationFrame(() => this.render());
  }

  stop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * 센서에서 원본 데이터 수신
   * @param {{x: number, y: number}} pos 
   */
  onPosition(pos) {
    this._latestPos = pos;
    this.trail.push({ ...pos, alpha: 1.0 });
    if (this.trail.length > 50) this.trail.shift();
  }

  render() {
    this._rafId = requestAnimationFrame(() => this.render());
    
    // 비디오 해상도에 맞춰 캔버스 스케일 동기화 (기본값: 1366x768)
    let vw = 1366, vh = 768;
    if (this._video && this._video.videoWidth) {
      vw = this._video.videoWidth;
      vh = this._video.videoHeight;
    }
    
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.floor(vw * dpr);
    const targetH = Math.floor(vh * dpr);
    
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    
    this.ctx.clearRect(0, 0, vw, vh);

    // Draw trail
    this.trail.forEach((p) => {
      if (!this.isFrozen) {
        p.alpha -= 0.02;
      }
      if (p.alpha <= 0) return;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(49, 130, 246, ${p.alpha * 0.5})`;
      this.ctx.fill();
    });
    if (!this.isFrozen) {
      this.trail = this.trail.filter(p => p.alpha > 0);
    }

    // Draw current pos
    if (this._latestPos) {
      this.ctx.beginPath();
      this.ctx.arc(this._latestPos.x, this._latestPos.y, 8, 0, Math.PI * 2);
      this.ctx.fillStyle = '#d4ff00';
      this.ctx.shadowColor = '#d4ff00';
      this.ctx.shadowBlur = 10;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }
  }
}
