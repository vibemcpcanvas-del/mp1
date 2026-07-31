/**
 * SkillLayer.js
 * 스킬 트리거 반경 원 + 키 라벨 렌더링 레이어
 * @module canvas/layers/SkillLayer
 */
import { BaseLayer } from './BaseLayer.js';

/** 트리거 원 선 색상 (반투명 노란색) */
const COLOR_TRIGGER_STROKE = 'rgba(245, 158, 11, 0.65)';
/** 트리거 원 채우기 색상 (매우 연한 노란색) */
const COLOR_TRIGGER_FILL   = 'rgba(245, 158, 11, 0.08)';
/** 키 라벨 텍스트 색상 */
const COLOR_LABEL          = '#fbbf24';
/** 기본 트리거 반경 (월드 단위) — triggerRadius 미지정 시 사용 */
const DEFAULT_TRIGGER_WORLD_RADIUS = 80;

export class SkillLayer extends BaseLayer {
  constructor() {
    super('skill');

    /** @type {{ worldX: number, worldY: number, skillKey?: string, triggerRadius?: number }[]} */
    this._waypoints = [];
  }

  /**
   * 웨이포인트 목록 설정 (skillKey 포함 항목만 렌더링)
   * @param {{ worldX: number, worldY: number, skillKey?: string, triggerRadius?: number }[]} waypoints
   */
  setWaypoints(waypoints) {
    this._waypoints = Array.isArray(waypoints) ? waypoints : [];
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object|null} screenPos  - Renderer 공통 시그니처 (미사용)
   * @param {import('@core/MapManager').MapManager} mapManager
   * @param {number} now
   */
  render(ctx, screenPos, mapManager, now) {
    if (!this.visible) return;
    const mapper = mapManager ? mapManager.mapper : null;
    if (!mapper) return;

    // skillKey 있는 웨이포인트만 필터링
    const skillWps = this._waypoints.filter(wp => Boolean(wp.skillKey));
    if (skillWps.length === 0) return;

    // 월드 → 화면 픽셀 스케일 비율 계산
    // mapper 에서 worldWidth / screenWidth 정보를 가져올 수 없을 경우 fallback
    const worldToPixelScale = _resolveWorldToPixelScale(mapManager);

    ctx.save();
    ctx.globalAlpha = this.opacity;

    for (const wp of skillWps) {
      const { px, py } = mapper.map(wp.worldX, wp.worldY);
      const worldRadius = wp.triggerRadius ?? DEFAULT_TRIGGER_WORLD_RADIUS;
      const screenRadius = worldRadius * worldToPixelScale;

      // ── 반투명 채우기 원 ───────────────────────────────────
      ctx.beginPath();
      ctx.arc(px, py, screenRadius, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_TRIGGER_FILL;
      ctx.fill();

      // ── 노란색 점선 테두리 원 ──────────────────────────────
      ctx.beginPath();
      ctx.arc(px, py, screenRadius, 0, Math.PI * 2);
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = COLOR_TRIGGER_STROKE;
      ctx.stroke();
      ctx.setLineDash([]);

      // ── 키 라벨 텍스트 (원 상단) ───────────────────────────
      const label = String(wp.skillKey).toUpperCase();
      ctx.fillStyle = COLOR_LABEL;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, px, py - screenRadius - 3);
    }

    ctx.restore();
  }
}

// ─── 내부 헬퍼 ──────────────────────────────────────────────────

/**
 * mapper.worldWidth / mapper.screenWidth (확인된 public 프로퍼티) 를 사용해
 * 월드 1단위 → 화면 px 변환 비율을 반환한다.
 * @param {import('@core/MapManager').MapManager} mapManager
 * @returns {number} screenPx / worldUnit 비율 (fallback: 1.0)
 */
function _resolveWorldToPixelScale(mapManager) {
  if (!mapManager) return 1.0;

  // 1순위: mapper.worldWidth / mapper.screenWidth (CoordinateMapper public 프로퍼티)
  const mapper = mapManager.mapper;
  if (mapper &&
      typeof mapper.worldWidth === 'number'  && mapper.worldWidth  > 0 &&
      typeof mapper.screenWidth === 'number' && mapper.screenWidth > 0) {
    return mapper.screenWidth / mapper.worldWidth;
  }

  // fallback: currentHuntingGround worldBounds + screenSize
  const hg     = mapManager.currentHuntingGround;
  const screen = mapManager.screenSize;
  if (hg && hg.worldBounds && screen && screen.width > 0) {
    const ww = (hg.worldBounds.maxX ?? hg.worldBounds.width) - (hg.worldBounds.minX ?? 0);
    if (ww > 0) return screen.width / ww;
  }

  return 1.0;
}
