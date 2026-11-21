import {
  Corner,
  Wall,
  WallOpening,
} from './types';
import { segmentInteriorIntersection2D } from './geometry2d';
import { getEntityLevelId } from './levels';

function reassignOpeningsOnSplit(
  openings: WallOpening[],
  originalWallId: string,
  wall1Id: string,
  wall2Id: string,
  splitDistCm: number
): WallOpening[] {
  return openings.map((op) => {
    if (op.wallId !== originalWallId) return op;

    const opStart = op.offsetFromStartCm;
    const opEnd = op.offsetFromStartCm + op.widthCm;

    if (opEnd <= splitDistCm) {
      return { ...op, wallId: wall1Id };
    } else if (opStart >= splitDistCm) {
      return {
        ...op,
        wallId: wall2Id,
        offsetFromStartCm: Number((opStart - splitDistCm).toFixed(2)),
      };
    } else {
      // Straddles junction: place on whichever side has the center
      if (opStart + op.widthCm / 2 < splitDistCm) {
        return { ...op, wallId: wall1Id };
      } else {
        return {
          ...op,
          wallId: wall2Id,
          offsetFromStartCm: 0,
        };
      }
    }
  });
}

/**
 * Splits existing walls at a corner that lands mid-span (T-junction),
 * moving wall openings to the appropriate half of the split wall.
 * Never mutates input corners, walls, or openings.
 */
export function splitWallsAtCorner(
  corners: Corner[],
  walls: Wall[],
  openings: WallOpening[],
  corner: Corner,
  generateId?: (prefix: string) => string
): { corners: Corner[]; walls: Wall[]; openings: WallOpening[]; didSplit: boolean } {
  let currentCorners = corners.map((c) => ({ ...c }));
  let currentCorner = { ...corner };
  const cornerMap = new Map(currentCorners.map((c) => [c.id, c]));
  let currentWalls = [...walls];
  let currentOpenings = [...openings];
  let didSplit = false;
  const makeWallId = () =>
    generateId
      ? generateId('w')
      : `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const cornerLevelId = getEntityLevelId(currentCorner);
  for (let i = 0; i < currentWalls.length; i++) {
    const wall = currentWalls[i];
    if (getEntityLevelId(wall) !== cornerLevelId) {
      continue;
    }
    if (wall.startCornerId === currentCorner.id || wall.endCornerId === currentCorner.id) {
      continue;
    }

    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) continue;

    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const len = Math.hypot(dx, dz);
    if (len < 10) continue;

    const ux = dx / len;
    const uz = dz / len;
    const vx = currentCorner.x - start.x;
    const vz = currentCorner.z - start.z;

    const t = vx * ux + vz * uz;
    const distPerp = Math.abs(vx * -uz + vz * ux);

    // If corner is within 2 cm of wall centerline and strictly mid-span (>= 5 cm from endpoints)
    if (distPerp <= 2.0 && t >= 5 && t <= len - 5) {
      didSplit = true;
      currentCorner = {
        ...currentCorner,
        x: Number((start.x + t * ux).toFixed(2)),
        z: Number((start.z + t * uz).toFixed(2)),
      };
      currentCorners = currentCorners.map((c) =>
        c.id === currentCorner.id ? currentCorner : c
      );
      cornerMap.set(currentCorner.id, currentCorner);

      const wall1Id = wall.id;
      const wall2Id = makeWallId();

      const wall1: Wall = {
        ...wall,
        id: wall1Id,
        startCornerId: wall.startCornerId,
        endCornerId: currentCorner.id,
      };

      const wall2: Wall = {
        ...wall,
        id: wall2Id,
        startCornerId: currentCorner.id,
        endCornerId: wall.endCornerId,
      };

      currentWalls.splice(i, 1, wall1, wall2);
      currentOpenings = reassignOpeningsOnSplit(
        currentOpenings,
        wall.id,
        wall1Id,
        wall2Id,
        t
      );

      i++;
    }
  }

  return {
    corners: currentCorners,
    walls: currentWalls,
    openings: currentOpenings,
    didSplit,
  };
}

/**
 * Splits any existing walls crossed strictly mid-span by a newly added wall (X-junction),
 * and splits the new wall into connected segments at each intersection point.
 */
export function splitCrossingWalls(
  corners: Corner[],
  walls: Wall[],
  openings: WallOpening[],
  newWall: Wall,
  generateId: (prefix: string) => string
): {
  corners: Corner[];
  walls: Wall[];
  openings: WallOpening[];
  createdWallIds: string[];
} {
  let currentCorners = [...corners];
  let currentWalls = [...walls];
  let currentOpenings = [...openings];

  const startCorner = currentCorners.find((c) => c.id === newWall.startCornerId);
  const endCorner = currentCorners.find((c) => c.id === newWall.endCornerId);
  if (!startCorner || !endCorner) {
    return {
      corners: currentCorners,
      walls: [...currentWalls, newWall],
      openings: currentOpenings,
      createdWallIds: [newWall.id],
    };
  }

  interface CrossingHit {
    wallId: string;
    tNew: number;
    distAlongExistingCm: number;
    x: number;
    z: number;
  }

  const newWallLevelId = getEntityLevelId(newWall);
  const hits: CrossingHit[] = [];
  const cornerMap = new Map(currentCorners.map((c) => [c.id, c]));

  for (const w of currentWalls) {
    if (getEntityLevelId(w) !== newWallLevelId) {
      continue;
    }
    if (
      w.startCornerId === newWall.startCornerId ||
      w.startCornerId === newWall.endCornerId ||
      w.endCornerId === newWall.startCornerId ||
      w.endCornerId === newWall.endCornerId
    ) {
      continue;
    }
    const wStart = cornerMap.get(w.startCornerId);
    const wEnd = cornerMap.get(w.endCornerId);
    if (!wStart || !wEnd) continue;

    const hit = segmentInteriorIntersection2D(startCorner, endCorner, wStart, wEnd, 5);
    if (!hit) continue;

    const existingLen = Math.hypot(wEnd.x - wStart.x, wEnd.z - wStart.z);
    hits.push({
      wallId: w.id,
      tNew: hit.t,
      distAlongExistingCm: hit.u * existingLen,
      x: hit.x,
      z: hit.z,
    });
  }

  if (hits.length === 0) {
    return {
      corners: currentCorners,
      walls: [...currentWalls, newWall],
      openings: currentOpenings,
      createdWallIds: [newWall.id],
    };
  }

  hits.sort((a, b) => a.tNew - b.tNew);

  const chainCornerIds: string[] = [newWall.startCornerId];

  for (const hit of hits) {
    const existingCorner = currentCorners.find(
      (c) =>
        getEntityLevelId(c) === newWallLevelId &&
        Math.hypot(c.x - hit.x, c.z - hit.z) < 0.5
    );
    const junctionCorner: Corner = existingCorner ?? {
      id: generateId('c'),
      x: hit.x,
      z: hit.z,
      ...(newWall.levelId ? { levelId: newWall.levelId } : {}),
    };
    if (!existingCorner) {
      currentCorners.push(junctionCorner);
    }

    if (chainCornerIds[chainCornerIds.length - 1] !== junctionCorner.id) {
      chainCornerIds.push(junctionCorner.id);
    }

    const wallIdx = currentWalls.findIndex((w) => w.id === hit.wallId);
    if (wallIdx >= 0) {
      const targetWall = currentWalls[wallIdx];
      if (
        targetWall.startCornerId !== junctionCorner.id &&
        targetWall.endCornerId !== junctionCorner.id
      ) {
        const wall1Id = targetWall.id;
        const wall2Id = generateId('w');
        const wall1: Wall = {
          ...targetWall,
          id: wall1Id,
          endCornerId: junctionCorner.id,
        };
        const wall2: Wall = {
          ...targetWall,
          id: wall2Id,
          startCornerId: junctionCorner.id,
        };
        currentWalls.splice(wallIdx, 1, wall1, wall2);
        currentOpenings = reassignOpeningsOnSplit(
          currentOpenings,
          targetWall.id,
          wall1Id,
          wall2Id,
          hit.distAlongExistingCm
        );
      }
    }
  }

  if (chainCornerIds[chainCornerIds.length - 1] !== newWall.endCornerId) {
    chainCornerIds.push(newWall.endCornerId);
  }

  const createdWallIds: string[] = [];
  for (let i = 0; i < chainCornerIds.length - 1; i++) {
    const segId = i === 0 ? newWall.id : generateId('w');
    createdWallIds.push(segId);
    currentWalls.push({
      ...newWall,
      id: segId,
      startCornerId: chainCornerIds[i],
      endCornerId: chainCornerIds[i + 1],
    });
  }

  return {
    corners: currentCorners,
    walls: currentWalls,
    openings: currentOpenings,
    createdWallIds,
  };
}

