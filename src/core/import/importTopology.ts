import type { Corner, Wall } from '../types';
import { splitCrossingWalls } from '../wallMath';

export interface RawWallSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  thicknessCm?: number;
  heightCm?: number;
}

export interface BuildWallGraphOptions {
  weldToleranceCm?: number;
  minWallLengthCm?: number;
  defaultThicknessCm?: number;
  defaultHeightCm?: number;
  paddingCm?: number;
  preserveCoordinates?: boolean;
}

export function buildWallGraphFromSegments(
  segments: RawWallSegment[],
  options: BuildWallGraphOptions = {}
): { corners: Corner[]; walls: Wall[] } {
  const weldTol = options.weldToleranceCm ?? 5;
  const minLen = options.minWallLengthCm ?? 10;
  const defaultThickness = options.defaultThicknessCm ?? 15;
  const defaultHeight = options.defaultHeightCm ?? 250;
  const paddingCm = options.paddingCm ?? 50;

  const corners: Corner[] = [];
  let cornerSeq = 1;

  const findOrCreateCorner = (x: number, z: number): string => {
    let bestIdx = -1;
    let bestDist = weldTol;
    for (let i = 0; i < corners.length; i++) {
      const d = Math.hypot(corners[i].x - x, corners[i].z - z);
      if (d <= bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      return corners[bestIdx].id;
    }
    const id = `imp-c-${cornerSeq++}`;
    corners.push({
      id,
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
    });
    return id;
  };

  const walls: Wall[] = [];
  const edgeKeys = new Set<string>();
  let wallSeq = 1;

  for (const seg of segments) {
    if (
      !Number.isFinite(seg.x1) ||
      !Number.isFinite(seg.z1) ||
      !Number.isFinite(seg.x2) ||
      !Number.isFinite(seg.z2)
    ) {
      continue;
    }
    const len = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
    if (len < minLen) continue;

    const startId = findOrCreateCorner(seg.x1, seg.z1);
    const endId = findOrCreateCorner(seg.x2, seg.z2);
    if (startId === endId) continue;

    const cStart = corners.find((c) => c.id === startId)!;
    const cEnd = corners.find((c) => c.id === endId)!;
    if (Math.hypot(cEnd.x - cStart.x, cEnd.z - cStart.z) < minLen) continue;

    const pairKey = startId < endId ? `${startId}|${endId}` : `${endId}|${startId}`;
    if (edgeKeys.has(pairKey)) continue;
    edgeKeys.add(pairKey);

    walls.push({
      id: `imp-w-${wallSeq++}`,
      startCornerId: startId,
      endCornerId: endId,
      thicknessCm: Math.max(5, seg.thicknessCm ?? defaultThickness),
      heightCm: Math.max(50, seg.heightCm ?? defaultHeight),
    });
  }

  // Remove orphaned corners
  const usedCornerIds = new Set<string>();
  for (const w of walls) {
    usedCornerIds.add(w.startCornerId);
    usedCornerIds.add(w.endCornerId);
  }
  let cleanCorners = corners.filter((c) => usedCornerIds.has(c.id));

  if (!options.preserveCoordinates && cleanCorners.length > 0) {
    let minX = Infinity;
    let minZ = Infinity;
    for (const c of cleanCorners) {
      if (c.x < minX) minX = c.x;
      if (c.z < minZ) minZ = c.z;
    }
    const shiftX = paddingCm - minX;
    const shiftZ = paddingCm - minZ;
    cleanCorners = cleanCorners.map((c) => ({
      ...c,
      x: Number((c.x + shiftX).toFixed(2)),
      z: Number((c.z + shiftZ).toFixed(2)),
    }));
  }

  let accCorners = cleanCorners;
  let accWalls: Wall[] = [];
  let splitSeq = 1;
  const makeSplitId = (prefix: string) => `imp-${prefix}-x${splitSeq++}`;

  for (const w of walls) {
    const res = splitCrossingWalls(accCorners, accWalls, [], w, makeSplitId);
    accCorners = res.corners;
    accWalls = res.walls;
  }

  return {
    corners: accCorners,
    walls: accWalls,
  };
}
