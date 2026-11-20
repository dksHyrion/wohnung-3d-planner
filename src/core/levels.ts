import type { BuildingLevel, FloorplanData } from './types';

export const DEFAULT_LEVEL_ID = 'level-0';
export const DEFAULT_CEILING_HEIGHT_CM = 250;
export const DEFAULT_SLAB_THICKNESS_CM = 20;

export function createDefaultLevel(): BuildingLevel {
  return {
    id: DEFAULT_LEVEL_ID,
    name: 'Erdgeschoss',
    index: 0,
    elevationCm: 0,
    ceilingHeightCm: DEFAULT_CEILING_HEIGHT_CM,
    slabThicknessCm: DEFAULT_SLAB_THICKNESS_CM,
  };
}

export function getEntityLevelId(entity: { levelId?: string }): string {
  return entity.levelId ?? DEFAULT_LEVEL_ID;
}

/**
 * Recomputes stacked floor elevations (FOK in cm) from index 0 upwards and downwards.
 * Level with index 0 (or lowest non-negative index) sits at elevationCm = 0.
 */
export function recomputeLevelElevations(
  levels: BuildingLevel[]
): BuildingLevel[] {
  if (levels.length === 0) return [createDefaultLevel()];
  const sorted = [...levels]
    .map((l) => ({ ...l }))
    .sort((a, b) => a.index - b.index);

  let anchorIdx = sorted.findIndex((l) => l.index === 0);
  if (anchorIdx < 0) anchorIdx = 0;

  sorted[anchorIdx].elevationCm = 0;

  for (let i = anchorIdx + 1; i < sorted.length; i++) {
    const below = sorted[i - 1];
    sorted[i].elevationCm =
      below.elevationCm + below.ceilingHeightCm + sorted[i].slabThicknessCm;
  }

  for (let i = anchorIdx - 1; i >= 0; i--) {
    const above = sorted[i + 1];
    sorted[i].elevationCm =
      above.elevationCm - (sorted[i].ceilingHeightCm + above.slabThicknessCm);
  }

  return sorted;
}

export function normalizeLevels(
  levels?: BuildingLevel[]
): BuildingLevel[] {
  if (!levels || levels.length === 0) {
    return [createDefaultLevel()];
  }
  const seen = new Set<string>();
  const clean: BuildingLevel[] = [];
  for (const l of levels) {
    if (!l || typeof l.id !== 'string' || seen.has(l.id)) continue;
    seen.add(l.id);
    clean.push({
      id: l.id,
      name: typeof l.name === 'string' && l.name.trim() ? l.name.trim() : l.id,
      index: Number.isFinite(l.index) ? Math.round(l.index) : clean.length,
      elevationCm: Number.isFinite(l.elevationCm) ? l.elevationCm : 0,
      ceilingHeightCm:
        Number.isFinite(l.ceilingHeightCm) && l.ceilingHeightCm >= 100
          ? l.ceilingHeightCm
          : DEFAULT_CEILING_HEIGHT_CM,
      slabThicknessCm:
        Number.isFinite(l.slabThicknessCm) && l.slabThicknessCm >= 5
          ? l.slabThicknessCm
          : DEFAULT_SLAB_THICKNESS_CM,
    });
  }
  if (clean.length === 0) return [createDefaultLevel()];
  return recomputeLevelElevations(clean);
}

/**
 * Extracts a single-level view of FloorplanData so single-level geometry,
 * collision, ergonomics, and export engines work seamlessly per floor.
 */
export function scopeFloorplanToLevel(
  data: FloorplanData,
  levelId: string = DEFAULT_LEVEL_ID
): FloorplanData {
  const corners = data.corners.filter((c) => getEntityLevelId(c) === levelId);
  const cornerIds = new Set(corners.map((c) => c.id));
  const walls = data.walls.filter(
    (w) =>
      getEntityLevelId(w) === levelId ||
      (w.levelId === undefined &&
        cornerIds.has(w.startCornerId) &&
        cornerIds.has(w.endCornerId))
  );
  const wallIds = new Set(walls.map((w) => w.id));
  const openings = data.openings.filter(
    (o) => wallIds.has(o.wallId) && (o.levelId === undefined || o.levelId === levelId)
  );
  const furniture = data.furniture.filter(
    (f) => getEntityLevelId(f) === levelId
  );
  const rugs = (data.rugs ?? []).filter((r) => getEntityLevelId(r) === levelId);
  const roomLabels = (data.roomLabels ?? []).filter(
    (rl) => getEntityLevelId(rl) === levelId
  );
  const roofSlopes = (data.roofSlopes ?? []).filter(
    (rs) => wallIds.has(rs.wallId) && (rs.levelId === undefined || rs.levelId === levelId)
  );
  const fixtures = (data.fixtures ?? []).filter(
    (fx) => wallIds.has(fx.wallId) && (fx.levelId === undefined || fx.levelId === levelId)
  );

  return {
    ...data,
    corners,
    walls,
    openings,
    furniture,
    rugs,
    roomLabels,
    roofSlopes,
    fixtures,
  };
}
