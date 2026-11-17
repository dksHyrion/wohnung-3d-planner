import type { AreaRug, FloorplanData, FurnitureItem, LayoutVariant } from './types';
import { evaluateFloorplanCollisions } from './collisionEngine';
import { evaluatePassageClearances } from './ergonomicsEngine';
import { evaluateErgonomicsScorecard, type ScorecardGrade } from './ergonomicsScorecard';
import { layoutFurnitureParts } from './furnitureShapes';
import { applyRoomLabels, computeFloorPolygons } from './wallMath';

export interface VariantMetrics {
  variantId: string;
  name: string;
  itemCount: number;
  collisionCount: number;
  criticalPassages: number;
  warningPassages: number;
  minClearanceCm: number | null;
  occupiedSqM: number;
  freeFloorPercent: number;
  overallScore: number;
  overallGrade: ScorecardGrade;
}

export interface VariantComparisonReport {
  metrics: VariantMetrics[];
  recommendedVariantId: string | null;
}

export function cloneVariantPayload(payload: {
  furniture: FurnitureItem[];
  rugs: AreaRug[];
}): { furniture: FurnitureItem[]; rugs: AreaRug[] } {
  return {
    furniture: payload.furniture.map((f) => ({ ...f })),
    rugs: payload.rugs.map((r) => ({ ...r })),
  };
}

export function computeVariantMetrics(
  baseArchitecture: Omit<FloorplanData, 'furniture' | 'rugs'>,
  variant: LayoutVariant
): VariantMetrics {
  const plan: FloorplanData = {
    ...baseArchitecture,
    furniture: variant.furniture,
    rugs: variant.rugs,
  };

  const collisions = evaluateFloorplanCollisions(plan);
  const collisionCount = Object.values(collisions).filter((r) => r.hasCollision).length;
  const passageReport = evaluatePassageClearances(
    plan.furniture,
    plan.walls,
    plan.corners
  );
  const scorecard = evaluateErgonomicsScorecard(plan, passageReport);

  const rooms = applyRoomLabels(
    computeFloorPolygons(plan.corners, plan.walls),
    plan.roomLabels
  );
  const totalNetSqM = rooms.reduce((sum, r) => sum + r.netAreaSqM, 0);

  let footprintCm2 = 0;
  for (const f of plan.furniture) {
    if (f.attachedToId || f.elevationCm >= 100) continue;
    for (const part of layoutFurnitureParts(f)) {
      footprintCm2 += part.widthCm * part.depthCm;
    }
  }
  const occupiedSqM = Math.round((footprintCm2 / 10000) * 100) / 100;
  const occupiedPct = totalNetSqM > 0 ? Math.min(100, (occupiedSqM / totalNetSqM) * 100) : 0;
  const freeFloorPercent = Math.round(Math.max(0, 100 - occupiedPct) * 10) / 10;

  return {
    variantId: variant.id,
    name: variant.name,
    itemCount: variant.furniture.length,
    collisionCount,
    criticalPassages: passageReport.criticalCount,
    warningPassages: passageReport.warningCount,
    minClearanceCm: passageReport.minClearanceCm,
    occupiedSqM,
    freeFloorPercent,
    overallScore: scorecard.overallScore,
    overallGrade: scorecard.overallGrade,
  };
}

export function compareLayoutVariants(
  baseArchitecture: Omit<FloorplanData, 'furniture' | 'rugs'>,
  variants: LayoutVariant[]
): VariantComparisonReport {
  if (variants.length === 0) {
    return { metrics: [], recommendedVariantId: null };
  }

  const metrics = variants.map((v) => computeVariantMetrics(baseArchitecture, v));
  const sorted = [...metrics].sort(
    (a, b) =>
      b.overallScore - a.overallScore ||
      a.collisionCount - b.collisionCount ||
      a.criticalPassages - b.criticalPassages ||
      b.freeFloorPercent - a.freeFloorPercent
  );

  return {
    metrics,
    recommendedVariantId: sorted[0]?.variantId ?? null,
  };
}
