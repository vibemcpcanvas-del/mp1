/**
 * RouteLayer.js
 * 웨이포인트 루트(경유지 화살표 + 번호 원) 렌더링 레이어
 * @module canvas/layers/RouteLayer
 */
import { BaseLayer } from './BaseLayer.js';

const ROUTE_COLOR       = 'rgba(66, 153, 225, 0.9)';   // 파란색 (활성 세그먼트)
const ROUTE_LOOP_COLOR  = 'rgba(66, 153, 225, 0.35)';  // 연한 파란색 (루프 복귀)
const DOT_COLOR         = '#4299e1';                    // 기본 웨이포인트 원
const DOT_ACTIVE_COLOR  = '#63b3ed';                    // 활성 웨이포인트 원
const DOT_SKILL_BORDER  = '#f6e05e';                    // 스킬 웨이포인트 테두리

const BASE_RADIUS       = 12;
const ACTIVE_RADIUS     = 16;
const ARROW_HEAD_LEN    = 10;
const ARROW_HEAD_ANGLE  = Math.PI / 6;

/**
 * 두 점 사이에 점선 화살표를 그린다.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 */
function drawDashedArrow(ctx, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;

  const angle = Math.atan2(dy, dx);

  // 선분 (원 테두리에서 원 테두리까지)
  const r1 = BASE_RADIUS + 2;  // 시작 원 여백
  const r2 = BASE_RADIUS + 2;  // 끝   원 여백
  const sx = x1 + Math.cos(angle) * r1;
  const sy = y1 + Math.sin(angle) * r1;
  const ex = x2 - Math.cos(angle) * r2;
  const ey = y2 - Math.sin(angle) * r2;

  if (Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2) < 2) return;

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // 화살촉
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(
    ex - ARROW_HEAD_LEN * Math.cos(angle - ARROW_HEAD_ANGLE),
    ey - ARROW_HEAD_LEN * Math.sin(angle - ARROW_HEAD_ANGLE),
  );
  ctx.moveTo(ex, ey);
  ctx.lineTo(
    ex - ARROW_HEAD_LEN * Math.cos(angle + ARROW_HEAD_ANGLE),
    ey - ARROW_HEAD_LEN * Math.sin(angle + ARROW_HEAD_ANGLE),
  );
  ctx.stroke();
}

export class RouteLayer extends BaseLayer {
  constructor() {
    super('route');

    /** @type {{ worldX: number, worldY: number, skillKey?: string, triggerRadius?: number }[]} */
    this._waypoints = [];
    /** @type {number} 현재 목표 웨이포인트 인덱스 */
    this._currentIndex = 0;
  }

  /**
   * @param {{ worldX: number, worldY: number, skillKey?: string, triggerRadius?: number }[]} waypoints
   */
  setWaypoints(waypoints) {
    this._waypoints = Array.isArray(waypoints) ? waypoints : [];
  }

  /** @param {number} idx */
  setCurrentIndex(idx) {
    this._currentIndex = typeof idx === 'number' ? idx : 0;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} screenPos  - Renderer가 넘겨주는 playerScreen (사용 안 함, 시그니처 통일)
   * @param {import('@core/MapManager').MapManager} mapManager
   * @param {number} now
   */
  render(ctx, screenPos, mapManager, now) {
    if (!this.visible) return;
    const mapper = mapManager ? mapManager.mapper : null;
    if (!mapper || this._waypoints.length === 0) return;

    // 모든 웨이포인트를 화면 좌표로 변환
    const pts = this._waypoints.map(wp => mapper.map(wp.worldX, wp.worldY));

    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.lineWidth = 2;

    // ── 1. 세그먼트 화살표 ────────────────────────────────────
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = ROUTE_COLOR;
      drawDashedArrow(ctx, pts[i].px, pts[i].py, pts[i + 1].px, pts[i + 1].py);
    }

    // ── 2. 루프 복귀 화살표 (마지막 → 첫 번째) ───────────────
    if (pts.length > 1) {
      const last = pts[pts.length - 1];
      const first = pts[0];
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = ROUTE_LOOP_COLOR;
      drawDashedArrow(ctx, last.px, last.py, first.px, first.py);
    }

    // ── 3. 웨이포인트 번호 원 ─────────────────────────────────
    ctx.setLineDash([]);
    for (let i = 0; i < pts.length; i++) {
      const { px, py } = pts[i];
      const wp = this._waypoints[i];
      const isActive = i === this._currentIndex;
      const hasSkill = Boolean(wp.skillKey);
      const r = isActive ? ACTIVE_RADIUS : BASE_RADIUS;

      // 활성 글로우
      if (isActive) {
        const grd = ctx.createRadialGradient(px, py, 0, px, py, r * 2);
        grd.addColorStop(0, 'rgba(99, 179, 237, 0.45)');
        grd.addColorStop(1, 'rgba(99, 179, 237, 0)');
        ctx.beginPath();
        ctx.arc(px, py, r * 2, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      // 원 채우기
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? DOT_ACTIVE_COLOR : DOT_COLOR;
      ctx.fill();

      // 테두리 (스킬 키 있으면 노란색, 없으면 흰색)
      ctx.lineWidth = hasSkill ? 2.5 : 1.5;
      ctx.strokeStyle = hasSkill ? DOT_SKILL_BORDER : 'rgba(255,255,255,0.85)';
      ctx.stroke();

      // 번호 텍스트
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${isActive ? 11 : 9}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), px, py);
    }

    ctx.restore();
  }
}
