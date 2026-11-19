import type {
  FloorplanData,
  FurnitureItem,
  Point2D,
  RoomPolygon,
} from './types';
import type { PassageClearanceReport, PassageSeverity } from './ergonomicsEngine';
import { evaluatePassageClearances } from './ergonomicsEngine';
import { computeWallPlanPolygons } from './export/wallExportPolygons';
import { openingIsWalkthrough } from './doorLeaf';
import { applyRoomLabels, computeFloorPolygons, getWallGeometry, isPointInRoom } from './wallMath';
import { diningTableLayout, layoutFurnitureParts, localPartWorldCenter } from './furnitureShapes';
import { resolveFurnitureVisual } from './furnitureVisual';
import { OSAKA_POSES } from './knownFurniture';
import { evaluateFloorplanCollisions } from './collisionEngine';
import {
  DEFAULT_LEVEL_ID,
  normalizeLevels,
  scopeFloorplanToLevel,
} from './levels';
import { computeStairGeometry } from './stairsMath';

export type DeliveryStatus = 'fits' | 'tilted-fit' | 'blocked';
export type ScorecardGrade = 'A' | 'B' | 'C' | 'D';

export interface FurnitureDeliveryCheck {
  furnitureId: string;
  furnitureName: string;
  status: DeliveryStatus;
  minDoorWidthCm: number | null;
  bottleneckCm: number | null;
}

export interface ChairPullbackIssue {
  furnitureId: string;
  furnitureName: string;
  availableCm: number;
  recommendedCm: number;
  severity: PassageSeverity;
}

export interface FoldOpenDiffItem {
  furnitureId: string;
  furnitureName: string;
  currentPose: 'closed' | 'open';
  simulatedPose: 'open' | 'closed';
  introducesCollisions: boolean;
  newIssueMessages: string[];
}

export interface RoomScorecard {
  roomId: string;
  roomName: string;
  netAreaSqM: number;
  occupiedPercent: number;
  freeFloorPercent: number;
  reachableFromEntrance: boolean;
  hasTurningCircle150: boolean;
  maxTurningDiameterCm: number;
  turningCircleCenter: Point2D | null;
  minClearanceCm: number | null;
  criticalCount: number;
  warningCount: number;
  score: number;
  grade: ScorecardGrade;
}

export interface ErgonomicsScorecardReport {
  overallScore: number;
  overallGrade: ScorecardGrade;
  rooms: RoomScorecard[];
  unreachableFurnitureIds: string[];
  deliveryChecks: FurnitureDeliveryCheck[];
  chairPullbackIssues: ChairPullbackIssue[];
  foldOpenDiffs: FoldOpenDiffItem[];
  hasEntranceSeed: boolean;
}

export const TURNING_CIRCLE_DIAMETER_CM = 150;
export const CHAIR_PULLBACK_RECOMMENDED_CM = 80;
export const CHAIR_PULLBACK_CRITICAL_CM = 55;
/** Minimum center-to-obstacle-surface half-width for a 60 cm DIN 18040 person corridor (with 5 cm raster slack). */
const MIN_WALK_HALF_WIDTH_CM = 27.5;

interface WalkabilityGrid {
  minX: number;
  minZ: number;
  cellSizeCm: number;
  cols: number;
  rows: number;
  blocked: Uint8Array;
  /** Exact Euclidean distance from cell center to nearest blocked cell center (cm). */
  edtCm: Float32Array;
}

function isFloorFurniture(f: FurnitureItem): boolean {
  const visual = resolveFurnitureVisual(f);
  if (f.attachedToId) return false;
  if (f.elevationCm >= 100) return false;
  return visual !== 'wall-picture' && visual !== 'picture-rail';
}

function pointInQuad(px: number, pz: number, quad: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
    const xi = quad[i].x;
    const zi = quad[i].z;
    const xj = quad[j].x;
    const zj = quad[j].z;
    const intersects =
      zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi + 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function rotatePointXZ(
  cx: number,
  cz: number,
  rotDeg: number,
  lx: number,
  lz: number
): Point2D {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cx + lx * cos + lz * sin,
    z: cz - lx * sin + lz * cos,
  };
}

function rasterizePolygon(
  poly: Point2D[],
  minX: number,
  minZ: number,
  cellSizeCm: number,
  cols: number,
  rows: number,
  blocked: Uint8Array
): void {
  if (poly.length < 3) return;
  let pMinX = Infinity;
  let pMaxX = -Infinity;
  let pMinZ = Infinity;
  let pMaxZ = -Infinity;
  for (const pt of poly) {
    if (pt.x < pMinX) pMinX = pt.x;
    if (pt.x > pMaxX) pMaxX = pt.x;
    if (pt.z < pMinZ) pMinZ = pt.z;
    if (pt.z > pMaxZ) pMaxZ = pt.z;
  }

  const c0 = Math.max(0, Math.floor((pMinX - minX) / cellSizeCm));
  const c1 = Math.min(cols - 1, Math.floor((pMaxX - minX) / cellSizeCm));
  const r0 = Math.max(0, Math.floor((pMinZ - minZ) / cellSizeCm));
  const r1 = Math.min(rows - 1, Math.floor((pMaxZ - minZ) / cellSizeCm));

  for (let r = r0; r <= r1; r++) {
    const cz = minZ + (r + 0.5) * cellSizeCm;
    const rowOff = r * cols;
    for (let c = c0; c <= c1; c++) {
      const cx = minX + (c + 0.5) * cellSizeCm;
      if (pointInQuad(cx, cz, poly)) {
        blocked[rowOff + c] = 1;
      }
    }
  }
}

/**
 * Exact 2D Euclidean Distance Transform (Felzenszwalb & Huttenlocher 1D parabolic envelope).
 * Computes center-to-nearest-blocked-center distance in cm in O(cols * rows).
 */
function computeExactEDT(
  blocked: Uint8Array,
  cols: number,
  rows: number,
  cellSizeCm: number
): Float32Array {
  const INF = 1e12;
  const g = new Float32Array(cols * rows);

  // Pass 1: Vertical distance squared in cell units
  for (let c = 0; c < cols; c++) {
    let lastBlocked = -1e6;
    for (let r = 0; r < rows; r++) {
      const idx = r * cols + c;
      if (blocked[idx]) {
        lastBlocked = r;
        g[idx] = 0;
      } else {
        const d = r - lastBlocked;
        g[idx] = lastBlocked < 0 ? INF : d * d;
      }
    }
    lastBlocked = 1e6;
    for (let r = rows - 1; r >= 0; r--) {
      const idx = r * cols + c;
      if (blocked[idx]) {
        lastBlocked = r;
      } else if (lastBlocked < rows) {
        const d = lastBlocked - r;
        const sq = d * d;
        if (sq < g[idx]) g[idx] = sq;
      }
    }
  }

  // Pass 2: Horizontal 1D lower envelope
  const edt = new Float32Array(cols * rows);
  const v = new Int32Array(cols);
  const z = new Float32Array(cols + 1);

  for (let r = 0; r < rows; r++) {
    const rowOff = r * cols;
    let k = -1;

    for (let q = 0; q < cols; q++) {
      const gq = g[rowOff + q];
      if (gq >= INF) continue;
      if (k < 0) {
        k = 0;
        v[0] = q;
        z[0] = -INF;
        z[1] = INF;
        continue;
      }
      let s = 0;
      while (k >= 0) {
        const vk = v[k];
        const gvk = g[rowOff + vk];
        s = (gq + q * q - (gvk + vk * vk)) / (2 * (q - vk));
        if (s > z[k]) break;
        k--;
      }
      if (k < 0) {
        k = 0;
        v[0] = q;
        z[0] = -INF;
        z[1] = INF;
      } else {
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
      }
    }

    if (k < 0) {
      for (let q = 0; q < cols; q++) {
        edt[rowOff + q] = INF;
      }
      continue;
    }

    let j = 0;
    for (let q = 0; q < cols; q++) {
      while (z[j + 1] < q) j++;
      const vk = v[j];
      const d = q - vk;
      const distSq = d * d + g[rowOff + vk];
      edt[rowOff + q] =
        distSq >= INF * 0.5 ? INF : Math.sqrt(distSq) * cellSizeCm;
    }
  }

  return edt;
}

function surfaceDistanceCm(grid: WalkabilityGrid, col: number, row: number): number {
  if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return 0;
  const idx = row * grid.cols + col;
  if (grid.blocked[idx]) return 0;
  return Math.max(0, grid.edtCm[idx] - grid.cellSizeCm * 0.5);
}

function sampleSurfaceDistWorld(grid: WalkabilityGrid, x: number, z: number): number {
  const c = Math.floor((x - grid.minX) / grid.cellSizeCm);
  const r = Math.floor((z - grid.minZ) / grid.cellSizeCm);
  return surfaceDistanceCm(grid, c, r);
}

function buildWalkabilityGrid(
  data: FloorplanData,
  includeFurniture: boolean,
  minCellSizeCm: number
): WalkabilityGrid {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const c of data.corners) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.z < minZ) minZ = c.z;
    if (c.z > maxZ) maxZ = c.z;
  }
  for (const f of data.furniture) {
    const pad = Math.max(f.widthCm, f.depthCm);
    if (f.x - pad < minX) minX = f.x - pad;
    if (f.x + pad > maxX) maxX = f.x + pad;
    if (f.z - pad < minZ) minZ = f.z - pad;
    if (f.z + pad > maxZ) maxZ = f.z + pad;
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    maxX = 400;
    minZ = 0;
    maxZ = 400;
  }

  const margin = 40;
  minX -= margin;
  minZ -= margin;
  maxX += margin;
  maxZ += margin;

  const spanX = Math.max(80, maxX - minX);
  const spanZ = Math.max(80, maxZ - minZ);
  const cellSizeCm = Math.max(minCellSizeCm, Math.ceil(Math.max(spanX, spanZ) / 260));
  const cols = Math.max(4, Math.ceil(spanX / cellSizeCm));
  const rows = Math.max(4, Math.ceil(spanZ / cellSizeCm));
  const blocked = new Uint8Array(cols * rows);

  // Only walkthrough openings create gaps in the 2D floor wall raster (windows stay solid)
  const walkthroughOpenings = data.openings.filter((op) => openingIsWalkthrough(op.type));
  const wallPolys = computeWallPlanPolygons(data.corners, data.walls, walkthroughOpenings);
  for (const wp of wallPolys) {
    rasterizePolygon(wp.polygon, minX, minZ, cellSizeCm, cols, rows, blocked);
  }

  if (includeFurniture) {
    for (const f of data.furniture) {
      if (!isFloorFurniture(f)) continue;
      for (const part of layoutFurnitureParts(f)) {
        const hw = part.widthCm / 2;
        const hd = part.depthCm / 2;
        const quad = [
          rotatePointXZ(f.x, f.z, f.rotationYDeg, part.cx - hw, part.cz - hd),
          rotatePointXZ(f.x, f.z, f.rotationYDeg, part.cx + hw, part.cz - hd),
          rotatePointXZ(f.x, f.z, f.rotationYDeg, part.cx + hw, part.cz + hd),
          rotatePointXZ(f.x, f.z, f.rotationYDeg, part.cx - hw, part.cz + hd),
        ];
        rasterizePolygon(quad, minX, minZ, cellSizeCm, cols, rows, blocked);
      }
    }
  }

  const edtCm = computeExactEDT(blocked, cols, rows, cellSizeCm);
  return { minX, minZ, cellSizeCm, cols, rows, blocked, edtCm };
}

function findSeedPointsForWalkthroughs(
  data: FloorplanData,
  rooms: RoomPolygon[]
): { seeds: Point2D[]; hasEntranceSeed: boolean } {
  const cornerMap = new Map(data.corners.map((c) => [c.id, c]));
  const wallMap = new Map(data.walls.map((w) => [w.id, w]));

  const exteriorDoorSeeds: Point2D[] = [];
  const allWalkthroughSeeds: Point2D[] = [];

  for (const op of data.openings) {
    if (!openingIsWalkthrough(op.type)) continue;
    const wall = wallMap.get(op.wallId);
    if (!wall) continue;
    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) continue;

    const geom = getWallGeometry(start, end);
    const centerAlong = op.offsetFromStartCm + op.widthCm / 2;
    const cx = start.x + geom.tangent.x * centerAlong;
    const cz = start.z + geom.tangent.z * centerAlong;
    const probeOffset = wall.thicknessCm / 2 + 25;

    const posProbe = { x: cx + geom.normal.x * probeOffset, z: cz + geom.normal.z * probeOffset };
    const negProbe = { x: cx - geom.normal.x * probeOffset, z: cz - geom.normal.z * probeOffset };
    const posInRoom = rooms.some((r) => isPointInRoom(posProbe.x, posProbe.z, r));
    const negInRoom = rooms.some((r) => isPointInRoom(negProbe.x, negProbe.z, r));

    if (posInRoom !== negInRoom) {
      const insidePt = posInRoom ? posProbe : negProbe;
      if (op.type !== 'balcony-door') {
        exteriorDoorSeeds.push(insidePt);
      }
      allWalkthroughSeeds.push(insidePt);
    } else if (posInRoom || negInRoom) {
      allWalkthroughSeeds.push(posInRoom ? posProbe : negProbe);
    } else {
      allWalkthroughSeeds.push({ x: cx, z: cz });
    }
  }

  if (exteriorDoorSeeds.length > 0) {
    return { seeds: exteriorDoorSeeds, hasEntranceSeed: true };
  }
  if (allWalkthroughSeeds.length > 0) {
    return { seeds: allWalkthroughSeeds, hasEntranceSeed: true };
  }
  return { seeds: [], hasEntranceSeed: false };
}

function floodWalkableCells(
  grid: WalkabilityGrid,
  seeds: Point2D[],
  minSurfaceHalfWidthCm: number
): Uint8Array {
  const visited = new Uint8Array(grid.cols * grid.rows);
  const queue = new Int32Array(grid.cols * grid.rows);
  let head = 0;
  let tail = 0;

  const tryPush = (c: number, r: number) => {
    if (c < 0 || c >= grid.cols || r < 0 || r >= grid.rows) return;
    const idx = r * grid.cols + c;
    if (visited[idx] || grid.blocked[idx]) return;
    if (surfaceDistanceCm(grid, c, r) < minSurfaceHalfWidthCm) return;
    visited[idx] = 1;
    queue[tail++] = idx;
  };

  for (const seed of seeds) {
    const sc = Math.floor((seed.x - grid.minX) / grid.cellSizeCm);
    const sr = Math.floor((seed.z - grid.minZ) / grid.cellSizeCm);
    // Search small 30 cm neighborhood around exact doorway probe to land cleanly on open floor
    for (let dr = -4; dr <= 4; dr++) {
      for (let dc = -4; dc <= 4; dc++) {
        tryPush(sc + dc, sr + dr);
      }
    }
  }

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (head < tail) {
    const idx = queue[head++];
    const r = Math.floor(idx / grid.cols);
    const c = idx - r * grid.cols;
    for (const [dc, dr] of dirs) {
      tryPush(c + dc, r + dr);
    }
  }

  return visited;
}

function findRoomReachabilityAndTurning(
  grid: WalkabilityGrid,
  visited: Uint8Array,
  rooms: RoomPolygon[],
  hasEntranceSeed: boolean
): Array<{
  reachable: boolean;
  maxSurfaceDistCm: number;
  bestCenter: Point2D | null;
}> {
  const results = rooms.map(() => ({
    reachable: !hasEntranceSeed,
    maxSurfaceDistCm: 0,
    bestCenter: null as Point2D | null,
  }));

  for (let ri = 0; ri < rooms.length; ri++) {
    const room = rooms[ri];
    let rMinX = Infinity;
    let rMaxX = -Infinity;
    let rMinZ = Infinity;
    let rMaxZ = -Infinity;
    for (const pt of room.corners) {
      if (pt.x < rMinX) rMinX = pt.x;
      if (pt.x > rMaxX) rMaxX = pt.x;
      if (pt.z < rMinZ) rMinZ = pt.z;
      if (pt.z > rMaxZ) rMaxZ = pt.z;
    }

    const c0 = Math.max(0, Math.floor((rMinX - grid.minX) / grid.cellSizeCm));
    const c1 = Math.min(grid.cols - 1, Math.floor((rMaxX - grid.minX) / cellSizeSafe(grid)));
    const r0 = Math.max(0, Math.floor((rMinZ - grid.minZ) / grid.cellSizeCm));
    const r1 = Math.min(grid.rows - 1, Math.floor((rMaxZ - grid.minZ) / grid.cellSizeCm));

    for (let r = r0; r <= r1; r++) {
      const wz = grid.minZ + (r + 0.5) * grid.cellSizeCm;
      const rowOff = r * grid.cols;
      for (let c = c0; c <= c1; c++) {
        const idx = rowOff + c;
        if (grid.blocked[idx]) continue;
        const wx = grid.minX + (c + 0.5) * grid.cellSizeCm;
        if (!isPointInRoom(wx, wz, room)) continue;

        if (visited[idx]) {
          results[ri].reachable = true;
        }
        const sd = surfaceDistanceCm(grid, c, r);
        if (sd > results[ri].maxSurfaceDistCm) {
          results[ri].maxSurfaceDistCm = sd;
          results[ri].bestCenter = { x: Math.round(wx), z: Math.round(wz) };
        }
      }
    }
  }

  return results;
}

function cellSizeSafe(grid: WalkabilityGrid): number {
  return grid.cellSizeCm > 0 ? grid.cellSizeCm : 5;
}

function findUnreachableFurniture(
  data: FloorplanData,
  grid: WalkabilityGrid,
  visited: Uint8Array,
  rooms: RoomPolygon[],
  hasEntranceSeed: boolean
): string[] {
  if (!hasEntranceSeed) return [];
  const unreachable: string[] = [];

  for (const f of data.furniture) {
    if (!isFloorFurniture(f)) continue;
    const fRoom = rooms.find((r) => isPointInRoom(f.x, f.z, r)) ?? null;
    const reachMarginCm = 35;
    let foundVisited = false;

    for (const part of layoutFurnitureParts(f)) {
      const hw = part.widthCm / 2 + reachMarginCm;
      const hd = part.depthCm / 2 + reachMarginCm;
      const rad = (f.rotationYDeg * Math.PI) / 180;
      const absCos = Math.abs(Math.cos(rad));
      const absSin = Math.abs(Math.sin(rad));
      const worldCenter = localPartWorldCenter(f, part);
      const extX = hw * absCos + hd * absSin;
      const extZ = hw * absSin + hd * absCos;

      const c0 = Math.max(0, Math.floor((worldCenter.x - extX - grid.minX) / grid.cellSizeCm));
      const c1 = Math.min(
        grid.cols - 1,
        Math.floor((worldCenter.x + extX - grid.minX) / grid.cellSizeCm)
      );
      const r0 = Math.max(0, Math.floor((worldCenter.z - extZ - grid.minZ) / grid.cellSizeCm));
      const r1 = Math.min(
        grid.rows - 1,
        Math.floor((worldCenter.z + extZ - grid.minZ) / grid.cellSizeCm)
      );

      for (let r = r0; r <= r1 && !foundVisited; r++) {
        const rowOff = r * grid.cols;
        const wz = grid.minZ + (r + 0.5) * grid.cellSizeCm;
        for (let c = c0; c <= c1; c++) {
          if (!visited[rowOff + c]) continue;
          if (fRoom) {
            const wx = grid.minX + (c + 0.5) * grid.cellSizeCm;
            if (!isPointInRoom(wx, wz, fRoom)) continue;
          }
          foundVisited = true;
          break;
        }
      }
      if (foundVisited) break;
    }

    if (!foundVisited) {
      unreachable.push(f.id);
    }
  }

  return unreachable;
}

/**
 * Checks whether a rigid carried capsule (L x W) can navigate from entrance seeds
 * to the furniture target around L-bends and through doorway gaps using 8 orientations.
 */
function canDeliverCapsule(
  wallGrid: WalkabilityGrid,
  seeds: Point2D[],
  targetX: number,
  targetZ: number,
  lengthCm: number,
  widthCm: number
): boolean {
  const halfW = widthCm / 2;
  // Tolerance of half a raster cell (~5 cm on 10 cm grid) for doorway thresholds
  const requiredSurface = Math.max(2, halfW - wallGrid.cellSizeCm * 0.5);
  const spineHalf = Math.max(0, (lengthCm - widthCm) / 2);
  const numAngles = 8;
  const cols = wallGrid.cols;
  const rows = wallGrid.rows;
  const planeSize = cols * rows;
  const visited = new Uint8Array(planeSize * numAngles);
  const queue = new Int32Array(planeSize * numAngles);
  let head = 0;
  let tail = 0;

  const angleCos = new Float32Array(numAngles);
  const angleSin = new Float32Array(numAngles);
  for (let a = 0; a < numAngles; a++) {
    const rad = (a * Math.PI) / numAngles;
    angleCos[a] = Math.cos(rad);
    angleSin[a] = Math.sin(rad);
  }

  const fitsAt = (wx: number, wz: number, a: number): boolean => {
    if (spineHalf < 2) {
      return sampleSurfaceDistWorld(wallGrid, wx, wz) >= requiredSurface;
    }
    const dx = angleCos[a];
    const dz = angleSin[a];
    const steps = spineHalf > 60 ? 2 : 1;
    if (sampleSurfaceDistWorld(wallGrid, wx, wz) < requiredSurface) return false;
    for (let s = 1; s <= steps; s++) {
      const dist = (spineHalf * s) / steps;
      if (
        sampleSurfaceDistWorld(wallGrid, wx + dx * dist, wz + dz * dist) < requiredSurface ||
        sampleSurfaceDistWorld(wallGrid, wx - dx * dist, wz - dz * dist) < requiredSurface
      ) {
        return false;
      }
    }
    return true;
  };

  const tryPush = (c: number, r: number, a: number) => {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    const stateIdx = a * planeSize + r * cols + c;
    if (visited[stateIdx]) return;
    const wx = wallGrid.minX + (c + 0.5) * wallGrid.cellSizeCm;
    const wz = wallGrid.minZ + (r + 0.5) * wallGrid.cellSizeCm;
    if (!fitsAt(wx, wz, a)) return;
    visited[stateIdx] = 1;
    queue[tail++] = stateIdx;
  };

  for (const seed of seeds) {
    const sc = Math.floor((seed.x - wallGrid.minX) / wallGrid.cellSizeCm);
    const sr = Math.floor((seed.z - wallGrid.minZ) / wallGrid.cellSizeCm);
    for (let dr = -3; dr <= 3; dr++) {
      for (let dc = -3; dc <= 3; dc++) {
        for (let a = 0; a < numAngles; a++) {
          tryPush(sc + dc, sr + dr, a);
        }
      }
    }
  }

  const reachRadiusSq = Math.max(45, lengthCm * 0.45) ** 2;
  const moveDirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (head < tail) {
    const stateIdx = queue[head++];
    const a = Math.floor(stateIdx / planeSize);
    const rem = stateIdx - a * planeSize;
    const r = Math.floor(rem / cols);
    const c = rem - r * cols;

    const wx = wallGrid.minX + (c + 0.5) * wallGrid.cellSizeCm;
    const wz = wallGrid.minZ + (r + 0.5) * wallGrid.cellSizeCm;
    const distSq = (wx - targetX) ** 2 + (wz - targetZ) ** 2;
    if (distSq <= reachRadiusSq) {
      return true;
    }

    for (const [dc, dr] of moveDirs) {
      tryPush(c + dc, r + dr, a);
    }
    // Rotate +/- 22.5 deg in place
    tryPush(c, r, (a + 1) % numAngles);
    tryPush(c, r, (a + numAngles - 1) % numAngles);
  }

  return false;
}

function evaluateDeliveryRoutes(
  data: FloorplanData,
  seeds: Point2D[],
  hasEntranceSeed: boolean
): FurnitureDeliveryCheck[] {
  if (!hasEntranceSeed || seeds.length === 0) return [];

  const walkthroughDoors = data.openings.filter((op) => openingIsWalkthrough(op.type));
  const minDoorWidthCm =
    walkthroughDoors.length > 0
      ? Math.min(...walkthroughDoors.map((op) => op.widthCm))
      : null;

  const wallGrid = buildWalkabilityGrid(data, false, 10);
  const checks: FurnitureDeliveryCheck[] = [];

  for (const f of data.furniture) {
    if (!isFloorFurniture(f)) continue;
    const maxDim = Math.max(f.widthCm, f.depthCm);
    const minDim = Math.min(f.widthCm, f.depthCm);
    if (maxDim < 90) continue;

    const fitsFlat = canDeliverCapsule(wallGrid, seeds, f.x, f.z, maxDim, minDim);
    if (fitsFlat) {
      checks.push({
        furnitureId: f.id,
        furnitureName: f.name,
        status: 'fits',
        minDoorWidthCm,
        bottleneckCm: null,
      });
      continue;
    }

    const tiltedWidth = Math.min(minDim, Math.max(25, f.heightCm || minDim));
    const fitsTilted =
      tiltedWidth < minDim &&
      canDeliverCapsule(wallGrid, seeds, f.x, f.z, maxDim, tiltedWidth);

    if (fitsTilted) {
      checks.push({
        furnitureId: f.id,
        furnitureName: f.name,
        status: 'tilted-fit',
        minDoorWidthCm,
        bottleneckCm: Math.round(minDim),
      });
    } else {
      checks.push({
        furnitureId: f.id,
        furnitureName: f.name,
        status: 'blocked',
        minDoorWidthCm,
        bottleneckCm: Math.round(tiltedWidth),
      });
    }
  }

  return checks;
}

function isPointInsideItemOBB(px: number, pz: number, item: FurnitureItem): boolean {
  const rad = (item.rotationYDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  for (const part of layoutFurnitureParts(item)) {
    const wc = localPartWorldCenter(item, part);
    const dx = px - wc.x;
    const dz = pz - wc.z;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (Math.abs(lx) <= part.widthCm / 2 && Math.abs(lz) <= part.depthCm / 2) {
      return true;
    }
  }
  return false;
}

function measureRayClearance(
  wallGrid: WalkabilityGrid,
  otherItems: FurnitureItem[],
  startX: number,
  startZ: number,
  dirX: number,
  dirZ: number,
  maxDistCm: number
): number {
  const stepCm = 5;
  for (let d = stepCm; d <= maxDistCm; d += stepCm) {
    const px = startX + dirX * d;
    const pz = startZ + dirZ * d;
    const c = Math.floor((px - wallGrid.minX) / wallGrid.cellSizeCm);
    const r = Math.floor((pz - wallGrid.minZ) / wallGrid.cellSizeCm);
    if (c < 0 || c >= wallGrid.cols || r < 0 || r >= wallGrid.rows) {
      return d - stepCm;
    }
    if (wallGrid.blocked[r * wallGrid.cols + c]) {
      return d - stepCm;
    }
    for (const other of otherItems) {
      if (isPointInsideItemOBB(px, pz, other)) {
        return d - stepCm;
      }
    }
  }
  return maxDistCm;
}

function evaluateChairPullbackIssues(
  data: FloorplanData,
  wallGrid: WalkabilityGrid
): ChairPullbackIssue[] {
  const issues: ChairPullbackIssue[] = [];

  for (const f of data.furniture) {
    const visual = resolveFurnitureVisual(f);
    if (visual !== 'dining-table' && visual !== 'desk' && visual !== 'inwerk-masterlift') {
      continue;
    }

    const others = data.furniture.filter((other) => other.id !== f.id && isFloorFurniture(other));
    const rad = (f.rotationYDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Probing directions in item's local frame (from edge center outward)
    const probes: Array<{ originLx: number; originLz: number; dirLx: number; dirLz: number }> = [];
    if (visual === 'dining-table') {
      const layout = diningTableLayout(f);
      for (const ch of layout.chairs) {
        if (Math.abs(ch.cx) > f.widthCm / 2) {
          const sx = ch.cx > 0 ? 1 : -1;
          probes.push({ originLx: ch.cx + sx * (ch.widthCm / 2), originLz: ch.cz, dirLx: sx, dirLz: 0 });
        } else {
          const sz = ch.cz > 0 ? 1 : -1;
          probes.push({ originLx: ch.cx, originLz: ch.cz + sz * (ch.depthCm / 2), dirLx: 0, dirLz: sz });
        }
      }
    } else {
      // Desk seat is on the front (+Z) side of the desk
      probes.push({ originLx: 0, originLz: f.depthCm / 2, dirLx: 0, dirLz: 1 });
    }

    let minClearCm = Infinity;
    for (const p of probes) {
      const wx = f.x + p.originLx * cos + p.originLz * sin;
      const wz = f.z - p.originLx * sin + p.originLz * cos;
      const dx = p.dirLx * cos + p.dirLz * sin;
      const dz = -p.dirLx * sin + p.dirLz * cos;
      const clear = measureRayClearance(wallGrid, others, wx, wz, dx, dz, CHAIR_PULLBACK_RECOMMENDED_CM + 10);
      if (clear < minClearCm) minClearCm = clear;
    }

    if (minClearCm < CHAIR_PULLBACK_RECOMMENDED_CM) {
      const severity: PassageSeverity =
        minClearCm < CHAIR_PULLBACK_CRITICAL_CM ? 'critical' : 'warning';
      issues.push({
        furnitureId: f.id,
        furnitureName: f.name,
        availableCm: Math.round(minClearCm),
        recommendedCm: CHAIR_PULLBACK_RECOMMENDED_CM,
        severity,
      });
    }
  }

  return issues;
}

function evaluateFoldOpenDiff(data: FloorplanData): FoldOpenDiffItem[] {
  const diffs: FoldOpenDiffItem[] = [];
  const candidates = data.furniture.filter(
    (f) => resolveFurnitureVisual(f) === 'boconcept-osaka' || f.pose !== undefined
  );
  if (candidates.length === 0) return diffs;

  const baseCollisions = evaluateFloorplanCollisions(data);

  for (const item of candidates) {
    const visual = resolveFurnitureVisual(item);
    const currentPose: 'closed' | 'open' = item.pose === 'open' || item.depthCm > 140 ? 'open' : 'closed';
    const simulatedPose: 'open' | 'closed' = currentPose === 'open' ? 'closed' : 'open';

    let nextItem: FurnitureItem = { ...item, pose: simulatedPose };
    if (visual === 'boconcept-osaka') {
      const spec = OSAKA_POSES[simulatedPose];
      const deltaDepth = spec.depthCm - item.depthCm;
      const rad = (item.rotationYDeg * Math.PI) / 180;
      // Anchor backrest edge and project mattress forward (+local Z -> (sin(rad), cos(rad)))
      nextItem = {
        ...nextItem,
        widthCm: spec.widthCm,
        heightCm: spec.heightCm,
        depthCm: spec.depthCm,
        x: item.x + Math.sin(rad) * (deltaDepth / 2),
        z: item.z + Math.cos(rad) * (deltaDepth / 2),
      };
    }

    const simulatedData: FloorplanData = {
      ...data,
      furniture: data.furniture.map((f) => (f.id === item.id ? nextItem : f)),
    };
    const simCollisions = evaluateFloorplanCollisions(simulatedData);

    const baseMessages = new Set(
      Object.values(baseCollisions).flatMap((rep) =>
        rep.issues.map((iss) => `${rep.furnitureId}:${iss.type}:${iss.targetId ?? ''}`)
      )
    );

    const newIssueMessages: string[] = [];
    for (const rep of Object.values(simCollisions)) {
      for (const iss of rep.issues) {
        const key = `${rep.furnitureId}:${iss.type}:${iss.targetId ?? ''}`;
        if (!baseMessages.has(key)) {
          newIssueMessages.push(iss.message);
        }
      }
    }

    diffs.push({
      furnitureId: item.id,
      furnitureName: item.name,
      currentPose,
      simulatedPose,
      introducesCollisions: newIssueMessages.length > 0,
      newIssueMessages,
    });
  }

  return diffs;
}

function gradeFromScore(score: number): ScorecardGrade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

export function evaluateErgonomicsScorecard(
  data: FloorplanData,
  precomputedPassageReport?: PassageClearanceReport | null,
  options?: { levelId?: string }
): ErgonomicsScorecardReport {
  const levels = normalizeLevels(data.levels);
  const targetLevelId =
    options?.levelId ??
    levels.find((l) => l.index === 0)?.id ??
    levels[0]?.id ??
    DEFAULT_LEVEL_ID;
  const scoped =
    options?.levelId || levels.length > 1
      ? scopeFloorplanToLevel(data, targetLevelId)
      : data;

  const rooms = applyRoomLabels(
    computeFloorPolygons(scoped.corners, scoped.walls),
    scoped.roomLabels
  );
  const passageReport =
    !options?.levelId && levels.length <= 1 && precomputedPassageReport
      ? precomputedPassageReport
      : evaluatePassageClearances(scoped.furniture, scoped.walls, scoped.corners);

  const walkGrid = buildWalkabilityGrid(scoped, true, 5);
  const wallGrid = buildWalkabilityGrid(scoped, false, 10);
  const seedInfo = findSeedPointsForWalkthroughs(scoped, rooms);
  let { seeds, hasEntranceSeed } = seedInfo;

  // Cross-floor stair reachability: if targetLevelId connects via stairs to a level that has an entrance seed,
  // inject the stair landing point(s) on targetLevelId as reachable entry seeds.
  const stairs = data.stairs ?? [];
  if (stairs.length > 0) {
    const levelMap = new Map(levels.map((l) => [l.id, l]));
    const seedLevelIds = new Set<string>();
    for (const lvl of levels) {
      const lvlScoped = scopeFloorplanToLevel(data, lvl.id);
      const lvlRooms = applyRoomLabels(
        computeFloorPolygons(lvlScoped.corners, lvlScoped.walls),
        lvlScoped.roomLabels
      );
      if (findSeedPointsForWalkthroughs(lvlScoped, lvlRooms).hasEntranceSeed) {
        seedLevelIds.add(lvl.id);
      }
    }
    // BFS over stair connections to mark reachable levels
    let changed = true;
    while (changed) {
      changed = false;
      for (const st of stairs) {
        if (seedLevelIds.has(st.fromLevelId) && !seedLevelIds.has(st.toLevelId)) {
          seedLevelIds.add(st.toLevelId);
          changed = true;
        }
        if (seedLevelIds.has(st.toLevelId) && !seedLevelIds.has(st.fromLevelId)) {
          seedLevelIds.add(st.fromLevelId);
          changed = true;
        }
      }
    }
    if (seedLevelIds.has(targetLevelId)) {
      for (const st of stairs) {
        if (st.toLevelId !== targetLevelId && st.fromLevelId !== targetLevelId) continue;
        const geom = computeStairGeometry(
          st,
          levelMap.get(st.fromLevelId),
          levelMap.get(st.toLevelId)
        );
        const pt = st.toLevelId === targetLevelId ? geom.exitPointXZ : geom.entryPointXZ;
        seeds = [...seeds, pt];
        hasEntranceSeed = true;
      }
    }
  }

  const visitedWalk = hasEntranceSeed
    ? floodWalkableCells(walkGrid, seeds, MIN_WALK_HALF_WIDTH_CM)
    : new Uint8Array(walkGrid.cols * walkGrid.rows);

  const roomSpatial = findRoomReachabilityAndTurning(walkGrid, visitedWalk, rooms, hasEntranceSeed);
  const unreachableFurnitureIds = findUnreachableFurniture(
    scoped,
    walkGrid,
    visitedWalk,
    rooms,
    hasEntranceSeed
  );
  const deliveryChecks = evaluateDeliveryRoutes(scoped, seeds, hasEntranceSeed);
  const chairPullbackIssues = evaluateChairPullbackIssues(scoped, wallGrid);
  const foldOpenDiffs = evaluateFoldOpenDiff(scoped);

  // Map each furniture item to its room index
  const furnitureRoomIdx = new Map<string, number>();
  const footprintPerRoomCm2 = new Array<number>(rooms.length).fill(0);
  for (const f of scoped.furniture) {
    if (!isFloorFurniture(f)) continue;
    const ri = rooms.findIndex((r) => isPointInRoom(f.x, f.z, r));
    if (ri >= 0) {
      furnitureRoomIdx.set(f.id, ri);
      for (const part of layoutFurnitureParts(f)) {
        footprintPerRoomCm2[ri] += part.widthCm * part.depthCm;
      }
    }
  }

  const roomScorecards: RoomScorecard[] = rooms.map((room, ri) => {
    const roomName = room.name?.trim() || `Raum ${ri + 1}`;
    const occupiedSqM = footprintPerRoomCm2[ri] / 10000;
    const occupiedPercent =
      room.netAreaSqM > 0 ? Math.min(100, Math.round((occupiedSqM / room.netAreaSqM) * 1000) / 10) : 0;
    const freeFloorPercent = Math.max(0, Math.round((100 - occupiedPercent) * 10) / 10);

    const roomPassages = passageReport.passages.filter((p) => {
      const r1 = p.entity1Type === 'furniture' ? furnitureRoomIdx.get(p.entity1Id) : undefined;
      const r2 = p.entity2Type === 'furniture' ? furnitureRoomIdx.get(p.entity2Id) : undefined;
      return r1 === ri || r2 === ri || isPointInRoom((p.point1.x + p.point2.x) / 2, (p.point1.z + p.point2.z) / 2, room);
    });

    let criticalCount = 0;
    let warningCount = 0;
    let minClearanceCm: number | null = null;
    for (const p of roomPassages) {
      if (p.severity === 'critical') criticalCount++;
      else if (p.severity === 'warning') warningCount++;
      if (minClearanceCm === null || p.clearanceCm < minClearanceCm) {
        minClearanceCm = p.clearanceCm;
      }
    }

    const spatial = roomSpatial[ri];
    const maxTurningDiameterCm = Math.round(spatial.maxSurfaceDistCm * 2);
    const hasTurningCircle150 = spatial.maxSurfaceDistCm >= TURNING_CIRCLE_DIAMETER_CM / 2;

    let score = 100;
    if (!spatial.reachable) score -= 35;
    score -= Math.min(45, criticalCount * 15);
    score -= Math.min(15, warningCount * 5);
    if (!hasTurningCircle150) score -= 15;
    if (freeFloorPercent < 35) score -= 10;
    score = Math.max(0, Math.min(100, score));

    return {
      roomId: room.id,
      roomName,
      netAreaSqM: Number(room.netAreaSqM.toFixed(2)),
      occupiedPercent,
      freeFloorPercent,
      reachableFromEntrance: spatial.reachable,
      hasTurningCircle150,
      maxTurningDiameterCm,
      turningCircleCenter: spatial.bestCenter,
      minClearanceCm,
      criticalCount,
      warningCount,
      score,
      grade: gradeFromScore(score),
    };
  });

  const totalArea = roomScorecards.reduce((s, r) => s + Math.max(1, r.netAreaSqM), 0);
  let baseScore =
    roomScorecards.length > 0
      ? roomScorecards.reduce((s, r) => s + r.score * Math.max(1, r.netAreaSqM), 0) / totalArea
      : 100 - Math.min(45, passageReport.criticalCount * 15) - Math.min(15, passageReport.warningCount * 5);

  baseScore -= Math.min(20, unreachableFurnitureIds.length * 10);
  baseScore -= Math.min(15, deliveryChecks.filter((d) => d.status === 'blocked').length * 10);
  baseScore -= Math.min(15, chairPullbackIssues.filter((c) => c.severity === 'critical').length * 8);
  baseScore -= Math.min(10, foldOpenDiffs.filter((d) => d.introducesCollisions).length * 5);

  const overallScore = Math.max(0, Math.min(100, Math.round(baseScore)));

  return {
    overallScore,
    overallGrade: gradeFromScore(overallScore),
    rooms: roomScorecards,
    unreachableFurnitureIds,
    deliveryChecks,
    chairPullbackIssues,
    foldOpenDiffs,
    hasEntranceSeed,
  };
}
