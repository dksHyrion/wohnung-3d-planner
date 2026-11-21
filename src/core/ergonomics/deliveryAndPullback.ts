import type {
  FloorplanData,
  FurnitureItem,
  Point2D,
} from '../types';
import type { PassageSeverity } from '../ergonomicsEngine';
import { openingIsWalkthrough } from '../doorLeaf';
import { diningTableLayout, layoutFurnitureParts, localPartWorldCenter } from '../furnitureShapes';
import { resolveFurnitureVisual } from '../furnitureVisual';
import { OSAKA_POSES } from '../knownFurniture';
import { evaluateFloorplanCollisions } from '../collisionEngine';
import {
  CHAIR_PULLBACK_CRITICAL_CM,
  CHAIR_PULLBACK_RECOMMENDED_CM,
  type ChairPullbackIssue,
  type FoldOpenDiffItem,
  type FurnitureDeliveryCheck,
} from './scorecardTypes';
import {
  type WalkabilityGrid,
  buildWalkabilityGrid,
  isFloorFurniture,
  sampleSurfaceDistWorld,
} from './walkabilityGrid';

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

export function evaluateDeliveryRoutes(
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

export function evaluateChairPullbackIssues(
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

export function evaluateFoldOpenDiff(data: FloorplanData): FoldOpenDiffItem[] {
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

