import type {
  FloorplanData,
  FurnitureItem,
  Point2D,
  RoomPolygon,
} from '../types';
import { computeWallPlanPolygons } from '../export/wallExportPolygons';
import { openingIsWalkthrough } from '../doorLeaf';
import { getWallGeometry, isPointInRoom } from '../wallMath';
import { layoutFurnitureParts, localPartWorldCenter } from '../furnitureShapes';
import { resolveFurnitureVisual } from '../furnitureVisual';
import { normalizeLevels } from '../levels';
import { computeStairGeometry } from '../stairsMath';

export interface WalkabilityGrid {
  minX: number;
  minZ: number;
  cellSizeCm: number;
  cols: number;
  rows: number;
  blocked: Uint8Array;
  /** Exact Euclidean distance from cell center to nearest blocked cell center (cm). */
  edtCm: Float32Array;
}

export function isFloorFurniture(f: FurnitureItem): boolean {
  const visual = resolveFurnitureVisual(f);
  if (f.attachedToId) return false;
  if (f.elevationCm >= 100) return false;
  return visual !== 'wall-picture' && visual !== 'picture-rail';
}

export function pointInQuad(px: number, pz: number, quad: Point2D[]): boolean {
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

export function rotatePointXZ(
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

export function surfaceDistanceCm(grid: WalkabilityGrid, col: number, row: number): number {
  if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return 0;
  const idx = row * grid.cols + col;
  if (grid.blocked[idx]) return 0;
  return Math.max(0, grid.edtCm[idx] - grid.cellSizeCm * 0.5);
}

export function sampleSurfaceDistWorld(grid: WalkabilityGrid, x: number, z: number): number {
  const c = Math.floor((x - grid.minX) / grid.cellSizeCm);
  const r = Math.floor((z - grid.minZ) / grid.cellSizeCm);
  return surfaceDistanceCm(grid, c, r);
}

export function buildWalkabilityGrid(
  data: FloorplanData,
  includeFurniture: boolean,
  minCellSizeCm: number,
  blockedStairPolygons: Point2D[][] = []
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

  for (const stairPoly of blockedStairPolygons) {
    rasterizePolygon(stairPoly, minX, minZ, cellSizeCm, cols, rows, blocked);
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

export function findSeedPointsForWalkthroughs(
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

export function floodWalkableCells(
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

export function findRoomReachabilityAndTurning(
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

export function cellSizeSafe(grid: WalkabilityGrid): number {
  return grid.cellSizeCm > 0 ? grid.cellSizeCm : 5;
}

export function findUnreachableFurniture(
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


export function isPointNearVisitedWalkCell(
  grid: WalkabilityGrid,
  visited: Uint8Array,
  pt: Point2D
): boolean {
  const sc = Math.floor((pt.x - grid.minX) / grid.cellSizeCm);
  const sr = Math.floor((pt.z - grid.minZ) / grid.cellSizeCm);
  for (let dr = -4; dr <= 4; dr++) {
    for (let dc = -4; dc <= 4; dc++) {
      const c = sc + dc;
      const r = sr + dr;
      if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
      if (visited[r * grid.cols + c] === 1) return true;
    }
  }
  return false;
}

export function collectBlockedStairPolygonsForLevel(
  stairs: FloorplanData['stairs'],
  levelMap: Map<string, ReturnType<typeof normalizeLevels>[number]>,
  levelId: string
): Point2D[][] {
  const polys: Point2D[][] = [];
  for (const st of stairs ?? []) {
    if (st.fromLevelId !== levelId && st.toLevelId !== levelId) continue;
    const geom = computeStairGeometry(
      st,
      levelMap.get(st.fromLevelId),
      levelMap.get(st.toLevelId)
    );
    if (st.fromLevelId === levelId) {
      polys.push(geom.footprintPolygonXZ);
    }
    if (st.toLevelId === levelId) {
      polys.push(geom.openingPolygonXZ);
    }
  }
  return polys;
}

