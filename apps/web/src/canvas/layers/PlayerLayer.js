/**
 * PlayerLayer.js
 * 캐릭터 마커 + 시간 기반 궤적(trail) 렌더링 레이어
 * @module canvas/layers/PlayerLayer
 */
import { BaseLayer } from './BaseLayer.js';
import tokens from '@tokens/tokens.json';

const MAX_TRAIL = 50;

// 색상 프리파싱 (매 프레임 string parsing 방지)
function parseHexToRgb(hex, defaultRgb) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return defaultRgb;
  const cleaned = hex.slice(1);
  if (cleaned.length !== 6) return defaultRgb;
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
}

const TRAIL_RGB = parseHexToRgb(tokens.color['trail-line'], { r: 78, g: 204, b: 163 });
const MARKER_RGB = parseHexToRgb(tokens.color['player-marker'], { r: 245, g: 208, b: 66 });

export class PlayerLayer extends BaseLayer {
  constructor() {
    super('player');
    /** @type {{ x: number, y: number, time: number }[]} 타임스탬프가 포함된 궤적 */
    this._trail = [];
    /** 궤적 표시 여부 */
    this.showTrail = true;
    /** 궤적 소멸 기간 (ms) */
    this.trailDurationMs = 1500;
  }

  get trail() { return this._trail; }

  /**
   * 센서 또는 렌더러에서 새 화면 좌표 수신
   * @param {number} px
   * @param {number} py
   * @param {number} [now=performance.now()]
   */
  onPosition(px, py, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    this._trail.push({ x: px, y: py, time: now });
    if (this._trail.length > MAX_TRAIL) {
      this._trail.shift();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ px: number, py: number, confidence: number } | null} playerScreen
   * @param {import('@core/MapManager').MapManager} [mapManager]
   * @param {number} [now=performance.now()]
   */
  render(ctx, playerScreen, mapManager, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (!this.visible || !playerScreen) return;

    ctx.save();
    ctx.globalAlpha = this.opacity;
    const { px, py, confidence = 1.0 } = playerScreen;

    // ── 1. 시간 기반 궤적(trail) 렌더링 ──────────────────────
    if (this.showTrail && this._trail.length > 1) {
      const cutoff = now - this.trailDurationMs;
      // 만료된 궤적 노드 제거
      while (this._trail.length > 0 && this._trail[0].time < cutoff) {
        this._trail.shift();
      }

      const trailWidth = tokens.size['trail-width'] || 2;
      ctx.lineWidth = trailWidth;

      for (let i = 1; i < this._trail.length; i++) {
        const p1 = this._trail[i - 1];
        const p2 = this._trail[i];
        const age = now - p2.time;
        const alpha = Math.max(0, 1 - age / this.trailDurationMs);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(${TRAIL_RGB.r}, ${TRAIL_RGB.g}, ${TRAIL_RGB.b}, ${(alpha * 0.7).toFixed(3)})`;
        ctx.stroke();
      }
    }

    // ── 2. 마커 렌더링 (펄스 효과) ──────────────────────────
    const markerAlpha = 0.4 + 0.6 * confidence;
    const baseRadius = tokens.size['marker-radius'] || 10;
    const pulse = 1 + 0.15 * Math.sin(now / 200);
    const radius = baseRadius * pulse;

    // 외곽 글로우
    const grd = ctx.createRadialGradient(px, py, 0, px, py, radius * 2.5);
    grd.addColorStop(0, `rgba(${MARKER_RGB.r}, ${MARKER_RGB.g}, ${MARKER_RGB.b}, ${(markerAlpha * 0.4).toFixed(3)})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(px, py, radius * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // 마커 원
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${MARKER_RGB.r}, ${MARKER_RGB.g}, ${MARKER_RGB.b}, ${markerAlpha.toFixed(3)})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${(markerAlpha * 0.8).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // confidence 표시
    if (confidence < 0.8) {
      ctx.fillStyle = `rgba(255, 255, 255, 0.7)`;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${(confidence * 100).toFixed(0)}%`, px, py - radius - 4);
    }

    ctx.restore();
  }

  /** 궤적 초기화 (지역/사냥터 전환 시) */
  clearTrail() {
    this._trail = [];
  }
}
