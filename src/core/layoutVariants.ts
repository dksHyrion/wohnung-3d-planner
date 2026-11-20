import type { AreaRug, FloorplanData, FurnitureItem, LayoutVariant } from './types';
import { evaluateFloorplanCollisions } from './collisionEngine';
import { evaluatePassageClearances } from './ergonomicsEngine';
import { evaluateErgonomicsScorecard, type ScorecardGrade } from './ergonomicsScorecard';
import { layoutFurnitureParts } from './furnitureShapes';
import { normalizeLevels, scopeFloorplanToLevel } from './levels';
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
  const levels = normalizeLevels(plan.levels);

  let criticalPassages = 0;
  let warningPassages = 0;
  let minClearanceCm: number | null = null;
  let totalNetSqM = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let primaryGrade: ScorecardGrade = 'A';

  for (const lvl of levels) {
    const scoped = levels.length > 1 ? scopeFloorplanToLevel(plan, lvl.id) : plan;
    const lvlPassages = evaluatePassageClearances(
      scoped.furniture,
      scoped.walls,
      scoped.corners
    );
    criticalPassages += lvlPassages.criticalCount;
    warningPassages += lvlPassages.warningCount;
    if (lvlPassages.minClearanceCm !== null) {
      minClearanceCm =
        minClearanceCm === null
          ? lvlPassages.minClearanceCm
          : Math.min(minClearanceCm, lvlPassages.minClearanceCm);
    }

    const lvlRooms = applyRoomLabels(
      computeFloorPolygons(scoped.corners, scoped.walls),
      scoped.roomLabels
    );
    totalNetSqM += lvlRooms.reduce((sum, r) => sum + r.netAreaSqM, 0);

    if (scoped.walls.length > 0 || levels.length === 1) {
      const lvlScorecard = evaluateErgonomicsScorecard(plan, lvlPassages, {
        levelId: lvl.id,
      });
      scoreSum += lvlScorecard.overallScore;
      scoreCount++;
      if (scoreCount === 1) {
        primaryGrade = lvlScorecard.overallGrade;
      }
    }
  }

  const overallScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 100;
  const overallGrade: ScorecardGrade =
    scoreCount <= 1
      ? primaryGrade
      : overallScore >= 88
        ? 'A'
        : overallScore >= 72
          ? 'B'
          : overallScore >= 55
            ? 'C'
            : 'D';

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
    criticalPassages,
    warningPassages,
    minClearanceCm,
    occupiedSqM,
    freeFloorPercent,
    overallScore,
    overallGrade,
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

export interface MovedVariantItem<T> {
  ghost: T;
  active: T;
  distanceCm: number;
  deltaRotDeg: number;
}

export interface VariantDiffResult {
  ghostOnlyFurniture: FurnitureItem[];
  activeOnlyFurniture: FurnitureItem[];
  movedFurniture: MovedVariantItem<FurnitureItem>[];
  unchangedCount: number;
  ghostOnlyRugs: AreaRug[];
  activeOnlyRugs: AreaRug[];
  movedRugs: MovedVariantItem<AreaRug>[];
}

function normalizeRotDeltaDeg(aDeg: number, bDeg: number): number {
  let diff = ((aDeg - bDeg) % 360 + 540) % 360 - 180;
  if (Math.abs(diff) < 0.01) diff = 0;
  return diff;
}

/**
 * Computes structural differences between the currently active layout and a ghost variant
 * (items present only in ghost/active, and items moved > 0.5 cm or rotated > 0.5 deg).
 */
export function computeVariantDiff(
  active: { furniture: FurnitureItem[]; rugs: AreaRug[] },
  ghost: { furniture: FurnitureItem[]; rugs: AreaRug[] }
): VariantDiffResult {
  const activeFMap = new Map(active.furniture.map((f) => [f.id, f]));
  const ghostFMap = new Map(ghost.furniture.map((f) => [f.id, f]));

  const ghostOnlyFurniture: FurnitureItem[] = [];
  const activeOnlyFurniture: FurnitureItem[] = [];
  const movedFurniture: MovedVariantItem<FurnitureItem>[] = [];
  let unchangedCount = 0;

  for (const g of ghost.furniture) {
    const a = activeFMap.get(g.id);
    if (!a) {
      ghostOnlyFurniture.push(g);
      continue;
    }
    const distanceCm = Math.hypot(a.x - g.x, a.z - g.z);
    const deltaRotDeg = normalizeRotDeltaDeg(a.rotationYDeg, g.rotationYDeg);
    const movedZ = Math.abs(a.elevationCm - g.elevationCm);
    if (distanceCm > 0.5 || Math.abs(deltaRotDeg) > 0.5 || movedZ > 0.5) {
      movedFurniture.push({
        ghost: g,
        active: a,
        distanceCm: Math.round(distanceCm * 10) / 10,
        deltaRotDeg,
      });
    } else {
      unchangedCount++;
    }
  }

  for (const a of active.furniture) {
    if (!ghostFMap.has(a.id)) {
      activeOnlyFurniture.push(a);
    }
  }

  const activeRMap = new Map(active.rugs.map((r) => [r.id, r]));
  const ghostRMap = new Map(ghost.rugs.map((r) => [r.id, r]));

  const ghostOnlyRugs: AreaRug[] = [];
  const activeOnlyRugs: AreaRug[] = [];
  const movedRugs: MovedVariantItem<AreaRug>[] = [];

  for (const g of ghost.rugs) {
    const a = activeRMap.get(g.id);
    if (!a) {
      ghostOnlyRugs.push(g);
      continue;
    }
    const distanceCm = Math.hypot(a.x - g.x, a.z - g.z);
    const deltaRotDeg = normalizeRotDeltaDeg(a.rotationYDeg ?? 0, g.rotationYDeg ?? 0);
    if (distanceCm > 0.5 || Math.abs(deltaRotDeg) > 0.5) {
      movedRugs.push({
        ghost: g,
        active: a,
        distanceCm: Math.round(distanceCm * 10) / 10,
        deltaRotDeg,
      });
    }
  }

  for (const a of active.rugs) {
    if (!ghostRMap.has(a.id)) {
      activeOnlyRugs.push(a);
    }
  }

  return {
    ghostOnlyFurniture,
    activeOnlyFurniture,
    movedFurniture,
    unchangedCount,
    ghostOnlyRugs,
    activeOnlyRugs,
    movedRugs,
  };
}
