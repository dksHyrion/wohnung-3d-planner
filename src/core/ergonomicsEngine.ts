import { FurnitureItem, Wall, Corner, EPSILON_CM } from './types';
import {
  computeFurnitureClearanceCm,
  computeFurnitureToWallClearance,
  segmentsIntersect2D,
  Point2D,
} from './measureMath';

export type PassageSeverity = 'critical' | 'warning' | 'optimal';

export const PASSAGE_SEVERITY_COLORS: Record<PassageSeverity, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  optimal: '#10b981',
};

export function formatPassageBadgeLabel(severity: PassageSeverity, clearanceCm: number): string {
  const rounded = Math.round(clearanceCm);
  switch (severity) {
    case 'critical':
      return `⚠️ ${rounded} cm`;
    case 'warning':
      return `⚡ ${rounded} cm`;
    case 'optimal':
      return `✓ ${rounded} cm`;
  }
}

export function getPassageBadgeTextColor(severity: PassageSeverity): string {
  return severity === 'warning' ? '#0f172a' : '#ffffff';
}

export interface PassageClearance {
  id: string;
  entity1Id: string;
  entity1Type: 'furniture' | 'wall';
  entity1Name: string;
  entity2Id: string;
  entity2Type: 'furniture' | 'wall';
  entity2Name: string;
  clearanceCm: number;
  severity: PassageSeverity;
  point1: { x: number; z: number };
  point2: { x: number; z: number };
}

export interface PassageClearanceReport {
  passages: PassageClearance[];
  criticalCount: number;
  warningCount: number;
  optimalCount: number;
  minClearanceCm: number | null;
}

export interface EvaluatePassageClearancesOptions {
  furniture: FurnitureItem[];
  walls?: Wall[];
  corners?: Corner[];
  maxDistanceCm?: number;
}

export const DEFAULT_MAX_PASSAGE_DISTANCE_CM = 120;
export const PASSAGE_CRITICAL_THRESHOLD_CM = 60;
export const PASSAGE_OPTIMAL_THRESHOLD_CM = 90;
export const WALL_FLUSHED_THRESHOLD_CM = 5;
export const DEAD_END_PROBE_DIST_CM = 35;

interface WallSegmentData {
  id: string;
  p1: Point2D;
  p2: Point2D;
}

function segmentCrossesWall(
  a: Point2D,
  b: Point2D,
  wallSegments: WallSegmentData[],
  ignoreWallId?: string
): boolean {
  for (const w of wallSegments) {
    if (ignoreWallId && w.id === ignoreWallId) continue;
    if (segmentsIntersect2D(a, b, w.p1, w.p2)) {
      return true;
    }
  }
  return false;
}

function isDeadEndGap(
  p1: Point2D,
  p2: Point2D,
  clearanceCm: number,
  wallSegments: WallSegmentData[],
  ignoreWallId?: string
): boolean {
  if (clearanceCm >= PASSAGE_CRITICAL_THRESHOLD_CM) {
    return false;
  }
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const len = Math.hypot(dx, dz);
  if (len < EPSILON_CM) return false;

  const midX = (p1.x + p2.x) / 2;
  const midZ = (p1.z + p2.z) / 2;
  const M: Point2D = { x: midX, z: midZ };

  // Walking direction perpendicular to gap
  const ux = -dz / len;
  const uz = dx / len;

  const fwd: Point2D = { x: midX + ux * DEAD_END_PROBE_DIST_CM, z: midZ + uz * DEAD_END_PROBE_DIST_CM };
  const bwd: Point2D = { x: midX - ux * DEAD_END_PROBE_DIST_CM, z: midZ - uz * DEAD_END_PROBE_DIST_CM };

  return (
    segmentCrossesWall(M, fwd, wallSegments, ignoreWallId) ||
    segmentCrossesWall(M, bwd, wallSegments, ignoreWallId)
  );
}

/**
 * Validates a furniture item defensibly ensuring numerical coordinates and dimensions are finite and valid.
 */
function isValidFurnitureItem(item: unknown): item is FurnitureItem {
  if (!item || typeof item !== 'object') return false;
  const f = item as Partial<FurnitureItem>;
  return (
    typeof f.id === 'string' &&
    f.id.length > 0 &&
    typeof f.name === 'string' &&
    Number.isFinite(f.x) &&
    Number.isFinite(f.z) &&
    Number.isFinite(f.widthCm) &&
    (f.widthCm as number) > 0 &&
    Number.isFinite(f.depthCm) &&
    (f.depthCm as number) > 0
  );
}

/**
 * Validates a wall ensuring finite and valid thickness.
 */
function isValidWall(wall: unknown): wall is Wall {
  if (!wall || typeof wall !== 'object') return false;
  const w = wall as Partial<Wall>;
  return (
    typeof w.id === 'string' &&
    w.id.length > 0 &&
    typeof w.startCornerId === 'string' &&
    typeof w.endCornerId === 'string' &&
    Number.isFinite(w.thicknessCm) &&
    (w.thicknessCm as number) > 0
  );
}

/**
 * Validates a corner ensuring finite coordinates.
 */
function isValidCorner(corner: unknown): corner is Corner {
  if (!corner || typeof corner !== 'object') return false;
  const c = corner as Partial<Corner>;
  return (
    typeof c.id === 'string' &&
    c.id.length > 0 &&
    Number.isFinite(c.x) &&
    Number.isFinite(c.z)
  );
}

/**
 * Checks if two furniture items are vertically separated (e.g. monitor sitting on a desk).
 * If item A elevation is at or above item B's top surface, or vice versa, they do not collide
 * or form a horizontal walkway bottleneck.
 */
export function isVerticallySeparated(f1: FurnitureItem, f2: FurnitureItem): boolean {
  const elev1 = Number.isFinite(f1.elevationCm) ? f1.elevationCm : 0;
  const h1 = Number.isFinite(f1.heightCm) ? f1.heightCm : 0;
  const elev2 = Number.isFinite(f2.elevationCm) ? f2.elevationCm : 0;
  const h2 = Number.isFinite(f2.heightCm) ? f2.heightCm : 0;

  if (h1 <= 0 || h2 <= 0) return false;

  const top1 = elev1 + h1;
  const top2 = elev2 + h2;

  return elev1 >= top2 - 1e-4 || elev2 >= top1 - 1e-4;
}

/**
 * Classifies passage clearance into DIN 18040 severity categories:
 * - < 60 cm: 'critical' (narrower than DIN minimum movement space)
 * - 60 <= clearance < 90 cm: 'warning' (narrow secondary passage)
 * - 90 <= clearance <= maxDistanceCm: 'optimal' (standard accessible walkway >= 90 cm)
 * - > maxDistanceCm: null (open space, not a bottleneck)
 */
export function classifyPassageSeverity(
  clearanceCm: number,
  maxDistanceCm: number = DEFAULT_MAX_PASSAGE_DISTANCE_CM
): PassageSeverity | null {
  if (clearanceCm < PASSAGE_CRITICAL_THRESHOLD_CM) {
    return 'critical';
  }
  if (clearanceCm < PASSAGE_OPTIMAL_THRESHOLD_CM) {
    return 'warning';
  }
  if (clearanceCm <= maxDistanceCm) {
    return 'optimal';
  }
  return null;
}

/**
 * Evaluates passage clearances between furniture-to-furniture and furniture-to-wall
 * according to DIN 18040 and Neufert architectural standards.
 */
export function evaluatePassageClearances(
  options: EvaluatePassageClearancesOptions
): PassageClearanceReport;
export function evaluatePassageClearances(
  furniture: FurnitureItem[],
  walls?: Wall[],
  corners?: Corner[],
  maxDistanceCm?: number
): PassageClearanceReport;
export function evaluatePassageClearances(
  furnitureOrOptions: FurnitureItem[] | EvaluatePassageClearancesOptions,
  wallsArg?: Wall[],
  cornersArg?: Corner[],
  maxDistanceCmArg?: number
): PassageClearanceReport {
  let rawFurniture: FurnitureItem[];
  let rawWalls: Wall[];
  let rawCorners: Corner[];
  let effectiveMaxDistanceCm: number;

  if (Array.isArray(furnitureOrOptions)) {
    rawFurniture = furnitureOrOptions;
    rawWalls = Array.isArray(wallsArg) ? wallsArg : [];
    rawCorners = Array.isArray(cornersArg) ? cornersArg : [];
    effectiveMaxDistanceCm =
      typeof maxDistanceCmArg === 'number' && Number.isFinite(maxDistanceCmArg) && maxDistanceCmArg > 0
        ? maxDistanceCmArg
        : DEFAULT_MAX_PASSAGE_DISTANCE_CM;
  } else if (furnitureOrOptions && typeof furnitureOrOptions === 'object') {
    rawFurniture = Array.isArray(furnitureOrOptions.furniture) ? furnitureOrOptions.furniture : [];
    rawWalls = Array.isArray(furnitureOrOptions.walls) ? furnitureOrOptions.walls : [];
    rawCorners = Array.isArray(furnitureOrOptions.corners) ? furnitureOrOptions.corners : [];
    effectiveMaxDistanceCm =
      typeof furnitureOrOptions.maxDistanceCm === 'number' &&
      Number.isFinite(furnitureOrOptions.maxDistanceCm) &&
      furnitureOrOptions.maxDistanceCm > 0
        ? furnitureOrOptions.maxDistanceCm
        : DEFAULT_MAX_PASSAGE_DISTANCE_CM;
  } else {
    return {
      passages: [],
      criticalCount: 0,
      warningCount: 0,
      optimalCount: 0,
      minClearanceCm: null,
    };
  }

  // Filter valid entities defensibly
  const furniture = rawFurniture.filter(isValidFurnitureItem);
  const walls = rawWalls.filter(isValidWall);
  const corners = rawCorners.filter(isValidCorner);

  const cornerMap = new Map<string, Corner>();
  for (const c of corners) {
    cornerMap.set(c.id, c);
  }

  const wallSegments: WallSegmentData[] = [];
  for (const w of walls) {
    const c1 = cornerMap.get(w.startCornerId);
    const c2 = cornerMap.get(w.endCornerId);
    if (c1 && c2) {
      wallSegments.push({
        id: w.id,
        p1: { x: c1.x, z: c1.z },
        p2: { x: c2.x, z: c2.z },
      });
    }
  }

  const passages: PassageClearance[] = [];

  // 1. Furniture-to-furniture clearance evaluation
  const nFurniture = furniture.length;
  for (let i = 0; i < nFurniture; i++) {
    const f1 = furniture[i];
    for (let j = i + 1; j < nFurniture; j++) {
      const f2 = furniture[j];

      // Attached accessories (e.g. monitor on desk) do not form floor passages
      if (f1.attachedToId || f2.attachedToId) {
        continue;
      }

      // Vertical stacking (e.g. monitor on desk) is ignored
      if (isVerticallySeparated(f1, f2)) {
        continue;
      }

      const clearanceResult = computeFurnitureClearanceCm(f1, f2);
      if (!clearanceResult.isOverlapping && clearanceResult.clearanceCm <= EPSILON_CM) {
        // Flush furniture placed edge-to-edge does not form a passage bottleneck
        continue;
      }

      const clearanceCm = clearanceResult.isOverlapping
        ? 0
        : Number(clearanceResult.clearanceCm.toFixed(1));

      // Side-by-side furniture snapped to the exact same wall with gap < 60 cm is not a walkway into the wall
      if (
        f1.snappedWallId &&
        f1.snappedWallId === f2.snappedWallId &&
        clearanceCm < PASSAGE_CRITICAL_THRESHOLD_CM
      ) {
        continue;
      }

      const severity = classifyPassageSeverity(clearanceCm, effectiveMaxDistanceCm);
      if (!severity) {
        continue;
      }

      const pt1: Point2D = {
        x: Number(clearanceResult.closestPoint1.x.toFixed(1)),
        z: Number(clearanceResult.closestPoint1.z.toFixed(1)),
      };
      const pt2: Point2D = {
        x: Number(clearanceResult.closestPoint2.x.toFixed(1)),
        z: Number(clearanceResult.closestPoint2.z.toFixed(1)),
      };

      // Check if line of sight crosses any interior wall partition
      if (segmentCrossesWall(pt1, pt2, wallSegments)) {
        continue;
      }

      // Check if narrow gap dead-ends into a wall (e.g. shower & toilet against wall)
      if (isDeadEndGap(pt1, pt2, clearanceCm, wallSegments)) {
        continue;
      }

      passages.push({
        id: `${f1.id}-${f2.id}`,
        entity1Id: f1.id,
        entity1Type: 'furniture',
        entity1Name: f1.name,
        entity2Id: f2.id,
        entity2Type: 'furniture',
        entity2Name: f2.name,
        clearanceCm,
        severity,
        point1: pt1,
        point2: pt2,
      });
    }
  }

  // 2. Furniture-to-wall clearance evaluation
  for (const item of furniture) {
    // Attached accessories (e.g. monitor on desk) do not form floor passages
    if (item.attachedToId) {
      continue;
    }

    // Decor items (plants, wall pictures) placed by a wall don't need a passage behind them
    if (item.category === 'decor' || item.visual === 'plant' || item.visual === 'wall-picture') {
      continue;
    }

    for (const wall of walls) {
      // Snapped to this wall -> flushed against wall, not a passage bottleneck
      if (item.snappedWallId === wall.id) {
        continue;
      }

      const wallRes = computeFurnitureToWallClearance(item, wall, cornerMap);
      const clearanceCm = wallRes.clearanceCm;

      // Flushed against wall (clearance <= 5 cm) -> ignore unless crossing
      if (!wallRes.isCrossing && clearanceCm <= WALL_FLUSHED_THRESHOLD_CM) {
        continue;
      }

      const severity = classifyPassageSeverity(clearanceCm, effectiveMaxDistanceCm);
      if (!severity) {
        continue;
      }

      const pt1 = wallRes.closestPointOnFurniture;
      const pt2 = wallRes.closestPointOnWall;

      // Check if line of sight crosses an intervening wall partition
      if (segmentCrossesWall(pt1, pt2, wallSegments, wall.id)) {
        continue;
      }

      // Check if narrow gap dead-ends into a perpendicular corner wall
      if (!wallRes.isCrossing && isDeadEndGap(pt1, pt2, clearanceCm, wallSegments, wall.id)) {
        continue;
      }

      const wallName = (wall as { name?: string }).name ?? `Wand (${wall.id})`;

      passages.push({
        id: `${item.id}-${wall.id}`,
        entity1Id: item.id,
        entity1Type: 'furniture',
        entity1Name: item.name,
        entity2Id: wall.id,
        entity2Type: 'wall',
        entity2Name: wallName,
        clearanceCm,
        severity,
        point1: pt1,
        point2: pt2,
      });
    }
  }

  // Sort passages array ascending by clearanceCm with tie-breaking by id
  passages.sort((a, b) => a.clearanceCm - b.clearanceCm || a.id.localeCompare(b.id));

  let criticalCount = 0;
  let warningCount = 0;
  let optimalCount = 0;

  for (const p of passages) {
    if (p.severity === 'critical') {
      criticalCount++;
    } else if (p.severity === 'warning') {
      warningCount++;
    } else if (p.severity === 'optimal') {
      optimalCount++;
    }
  }

  const minClearanceCm = passages.length > 0 ? passages[0].clearanceCm : null;

  return {
    passages,
    criticalCount,
    warningCount,
    optimalCount,
    minClearanceCm,
  };
}
