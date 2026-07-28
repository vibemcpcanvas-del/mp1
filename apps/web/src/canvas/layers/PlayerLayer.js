/**
 * PlayerLayer.js
 * 캐릭터 마커 + 이동 궤적(trail) 렌더링 레이어
 * @module canvas/layers/PlayerLayer
 */
import tokens from '@tokens/tokens.json';

const MAX_TRAIL = 50;

export class PlayerLayer {
  constructor() {
    /** @type {{ x: number, y: number }[]} 최근 50개 화면 좌표 궤적 */
    this._trail = [];
    /** 궤적 표시 여부 */
    this.showTrail = true;
  }

  /**
   * Renderer가 호출하는 렌더 메서드
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ px: number, py: number, confidence: number } | null} playerScreen - 화면 좌표
   */
  render(ctx, playerScreen) {
    if (!playerScreen) return;

    const { px, py, confidence = 1.0 } = playerScreen;

    // 궤적 업데이트
    this._trail.push({ x: px, y: py });
    if (this._trail.length > MAX_TRAIL) {
      this._trail.shift();
    }

    // ── 궤적(trail) 렌더링 ──────────────────────
    if (this.showTrail && this._trail.length > 1) {
      const trailColor = tokens.color['trail-line'];
      for (let i = 1; i < this._trail.length; i++) {
        const alpha = i / this._trail.length; // 오래될수록 투명
        ctx.beginPath();
        ctx.moveTo(this._trail[i - 1].x, this._trail[i - 1].y);
        ctx.lineTo(this._trail[i].x, this._trail[i].y);
        ctx.strokeStyle = `rgba(${hexToRgb(trailColor)}, ${alpha * 0.7})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // ── 마커 렌더링 ──────────────────────────────
    const markerAlpha = 0.4 + 0.6 * confidence; // confidence 낮으면 반투명
    const markerColor = tokens.color['player-marker'];
    const radius = 8;

    // 외곽 글로우
    const grd = ctx.createRadialGradient(px, py, 0, px, py, radius * 2.5);
    grd.addColorStop(0, `rgba(${hexToRgb(markerColor)}, ${markerAlpha * 0.4})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(px, py, radius * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // 마커 원
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${hexToRgb(markerColor)}, ${markerAlpha})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${markerAlpha * 0.8})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // confidence 수치 표시 (낮을 때만)
    if (confidence < 0.8) {
      ctx.fillStyle = `rgba(255,255,255,0.7)`;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${(confidence * 100).toFixed(0)}%`, px, py - radius - 4);
    }
  }

  /** 궤적 초기화 (지역 전환 시) */
  clearTrail() {
    this._trail = [];
  }
}

// ── 헬퍼 ────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
