import {
  Corner,
  Wall,
  FlooringType,
  RoomPolygon,
  RoomLabel,
} from './types';
import { pointInPolygonXZ } from './geometry2d';

/**
 * Extracts closed interior room polygons from the planar wall graph using half-edge face traversal.
 */
export function computeFloorPolygons(
  corners: Corner[],
  walls: Wall[],
  customFloorings?: (FlooringType | undefined)[]
): RoomPolygon[] {
  const cornerMap = new Map(corners.map((c) => [c.id, c]));

  // Iteratively prune degree < 2 vertices so dangling walls don't break face cycles
  let activeWalls = walls.filter((w) => {
    const a = cornerMap.get(w.startCornerId);
    const b = cornerMap.get(w.endCornerId);
    if (!a || !b) return false;
    return Math.hypot(b.x - a.x, b.z - a.z) >= 1;
  });

  let changed = true;
  while (changed) {
    changed = false;
    const degree = new Map<string, number>();
    for (const w of activeWalls) {
      degree.set(w.startCornerId, (degree.get(w.startCornerId) ?? 0) + 1);
      degree.set(w.endCornerId, (degree.get(w.endCornerId) ?? 0) + 1);
    }
    const nextWalls = activeWalls.filter(
      (w) =>
        (degree.get(w.startCornerId) ?? 0) >= 2 &&
        (degree.get(w.endCornerId) ?? 0) >= 2
    );
    if (nextWalls.length !== activeWalls.length) {
      activeWalls = nextWalls;
      changed = true;
    }
  }

  if (activeWalls.length < 3) return [];

  const wallKey = (a: string, b: string) => (a < b ? `${a}--${b}` : `${b}--${a}`);
  const wallByEndpoints = new Map<string, Wall>();
  for (const w of activeWalls) {
    wallByEndpoints.set(wallKey(w.startCornerId, w.endCornerId), w);
  }

  const adj = new Map<string, string[]>();
  for (const w of activeWalls) {
    if (!adj.has(w.startCornerId)) adj.set(w.startCornerId, []);
    if (!adj.has(w.endCornerId)) adj.set(w.endCornerId, []);
    if (!adj.get(w.startCornerId)!.includes(w.endCornerId)) {
      adj.get(w.startCornerId)!.push(w.endCornerId);
    }
    if (!adj.get(w.endCornerId)!.includes(w.startCornerId)) {
      adj.get(w.endCornerId)!.push(w.startCornerId);
    }
  }

  const visitedHalfEdges = new Set<string>();
  const edgeKey = (u: string, v: string) => `${u}->${v}`;

  interface RoomCandidate {
    corners: Corner[];
    signedArea2: number;
    centroidX: number;
    centroidZ: number;
    netCorners: { x: number; z: number }[];
    netAreaSqCm: number;
    minX: number;
    minZ: number;
    holes: Corner[][];
    netHoles: { x: number; z: number }[][];
    holeGrossAreaSqCm: number;
    holeNetAreaSqCm: number;
  }

  interface HoleCandidate {
    corners: Corner[];
    cornerIdSet: Set<string>;
    absSignedArea2: number;
    netCorners: { x: number; z: number }[];
    netAreaSqCm: number;
  }

  const roomCandidates: RoomCandidate[] = [];
  const holeCandidates: HoleCandidate[] = [];

  for (const [uInit, neighbors] of adj.entries()) {
    for (const vInit of neighbors) {
      const startKey = edgeKey(uInit, vInit);
      if (visitedHalfEdges.has(startKey)) continue;

      const cycleIds: string[] = [];
      let currU = uInit;
      let currV = vInit;
      let valid = true;

      while (true) {
        const key = edgeKey(currU, currV);
        if (visitedHalfEdges.has(key)) {
          valid = currU === uInit && currV === vInit;
          break;
        }
        visitedHalfEdges.add(key);
        cycleIds.push(currU);

        if (cycleIds.length > corners.length * 2 + 4) {
          valid = false;
          break;
        }

        const cU = cornerMap.get(currU)!;
        const cV = cornerMap.get(currV)!;
        const revAngle = Math.atan2(cU.z - cV.z, cU.x - cV.x);

        const nextCandidates = adj.get(currV) ?? [];
        let bestW = currU;
        let bestDelta = Infinity;

        for (const wId of nextCandidates) {
          if (wId === currU && nextCandidates.length > 1) continue;
          const cW = cornerMap.get(wId)!;
          const outAngle = Math.atan2(cW.z - cV.z, cW.x - cV.x);
          let delta = (revAngle - outAngle) % (Math.PI * 2);
          if (delta <= 1e-9) delta += Math.PI * 2;
          if (delta < bestDelta) {
            bestDelta = delta;
            bestW = wId;
          }
        }

        currU = currV;
        currV = bestW;
      }

      if (!valid || cycleIds.length < 3) continue;

      // Signed shoelace area in XZ plane (X right, Z down -> clockwise interior has area > 0)
      let signedArea2 = 0;
      let cx = 0;
      let cz = 0;
      const cycleCorners = cycleIds.map((id) => cornerMap.get(id)!);

      for (let i = 0; i < cycleCorners.length; i++) {
        const p1 = cycleCorners[i];
        const p2 = cycleCorners[(i + 1) % cycleCorners.length];
        const cross = p1.x * p2.z - p2.x * p1.z;
        signedArea2 += cross;
        cx += (p1.x + p2.x) * cross;
        cz += (p1.z + p2.z) * cross;
      }

      if (signedArea2 > 100) {
        const centroidX = Number((cx / (3 * signedArea2)).toFixed(1));
        const centroidZ = Number((cz / (3 * signedArea2)).toFixed(1));
        const { netCorners, netSignedArea2 } = computeOffsetLoop(
          cycleCorners,
          wallByEndpoints,
          wallKey
        );
        const netAreaSqCm = Math.max(0, netSignedArea2 / 2);
        let minX = Infinity;
        let minZ = Infinity;
        for (const c of cycleCorners) {
          if (c.x < minX) minX = c.x;
          if (c.z < minZ) minZ = c.z;
        }

        roomCandidates.push({
          corners: cycleCorners,
          signedArea2,
          centroidX,
          centroidZ,
          netCorners,
          netAreaSqCm,
          minX,
          minZ,
          holes: [],
          netHoles: [],
          holeGrossAreaSqCm: 0,
          holeNetAreaSqCm: 0,
        });
      } else if (signedArea2 < -100) {
        const { netCorners, netSignedArea2 } = computeOffsetLoop(
          cycleCorners,
          wallByEndpoints,
          wallKey
        );
        holeCandidates.push({
          corners: cycleCorners,
          cornerIdSet: new Set(cycleIds),
          absSignedArea2: Math.abs(signedArea2),
          netCorners,
          netAreaSqCm: Math.max(0, Math.abs(netSignedArea2) / 2),
        });
      }
    }
  }

  // Attach interior island/shaft outer loops as holes to their smallest enclosing room
  for (const hole of holeCandidates) {
    let bestEnclosing: RoomCandidate | null = null;
    for (const room of roomCandidates) {
      if (room.signedArea2 <= hole.absSignedArea2 + 1) continue;
      const roomCornerIds = new Set(room.corners.map((c) => c.id));
      const testCorner =
        hole.corners.find((c) => !roomCornerIds.has(c.id)) ??
        {
          x: (hole.corners[0].x + hole.corners[1].x) / 2,
          z: (hole.corners[0].z + hole.corners[1].z) / 2,
        };
      if (hole.cornerIdSet.size === roomCornerIds.size && [...hole.cornerIdSet].every((id) => roomCornerIds.has(id))) {
        continue;
      }
      if (!pointInPolygon(testCorner.x, testCorner.z, room.corners)) continue;
      if (!bestEnclosing || room.signedArea2 < bestEnclosing.signedArea2) {
        bestEnclosing = room;
      }
    }
    if (bestEnclosing) {
      bestEnclosing.holes.push(hole.corners);
      bestEnclosing.netHoles.push(hole.netCorners);
      bestEnclosing.holeGrossAreaSqCm += hole.absSignedArea2 / 2;
      bestEnclosing.holeNetAreaSqCm += hole.netAreaSqCm;
    }
  }

  // Deterministic geometric ordering independent of wall/corner array order
  roomCandidates.sort(
    (a, b) =>
      a.minX - b.minX ||
      a.minZ - b.minZ ||
      a.centroidX - b.centroidX ||
      a.centroidZ - b.centroidZ
  );

  return roomCandidates.map((cand, idx) => {
    const grossAreaSqCm = Math.max(0, cand.signedArea2 / 2 - cand.holeGrossAreaSqCm);
    const netAreaSqCm = Math.max(0, cand.netAreaSqCm - cand.holeNetAreaSqCm);
    const areaSqM = Number((grossAreaSqCm / 10000).toFixed(2));
    const netAreaSqM = Number((netAreaSqCm / 10000).toFixed(2));

    const defaultFlooring: FlooringType =
      idx === 0 ? 'microcement' : idx === 1 ? 'parquet' : 'tile';
    const flooringType = customFloorings?.[idx] ?? defaultFlooring;

    return {
      id: `room-${idx + 1}`,
      corners: cand.corners,
      areaSqM,
      centroid: { x: cand.centroidX, z: cand.centroidZ },
      netCorners: cand.netCorners,
      netAreaSqM,
      ...(cand.holes.length > 0 ? { holes: cand.holes, netHoles: cand.netHoles } : {}),
      flooringType,
    };
  });
}

function computeOffsetLoop(
  cycleCorners: Corner[],
  wallByEndpoints: Map<string, Wall>,
  wallKey: (a: string, b: string) => string
): { netCorners: { x: number; z: number }[]; netSignedArea2: number } {
  interface EdgeLine {
    nx: number;
    nz: number;
    c: number;
    d: number;
  }
  const edgeLines: EdgeLine[] = [];
  const nCorners = cycleCorners.length;

  for (let i = 0; i < nCorners; i++) {
    const p1 = cycleCorners[i];
    const p2 = cycleCorners[(i + 1) % nCorners];
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const len = Math.hypot(dx, dz);
    const wall = wallByEndpoints.get(wallKey(p1.id, p2.id));
    const thickness = wall ? wall.thicknessCm : 15;
    const d = thickness / 2;

    if (len < 1e-4) {
      edgeLines.push({ nx: 0, nz: 0, c: 0, d });
      continue;
    }

    // In XZ (X right, Z down): points inward for CW rooms and outward for CCW holes
    const nx = -dz / len;
    const nz = dx / len;
    const c = nx * p1.x + nz * p1.z + d;
    edgeLines.push({ nx, nz, c, d });
  }

  const netCorners: { x: number; z: number }[] = [];
  for (let i = 0; i < nCorners; i++) {
    const prevEdge = edgeLines[(i - 1 + nCorners) % nCorners];
    const currEdge = edgeLines[i];
    const pCurr = cycleCorners[i];

    const det = prevEdge.nx * currEdge.nz - prevEdge.nz * currEdge.nx;
    let netX = pCurr.x;
    let netZ = pCurr.z;

    if (Math.abs(det) < 1e-5) {
      const avgD = (prevEdge.d + currEdge.d) / 2;
      const avgNx = (prevEdge.nx + currEdge.nx) / 2;
      const avgNz = (prevEdge.nz + currEdge.nz) / 2;
      netX = pCurr.x + avgD * avgNx;
      netZ = pCurr.z + avgD * avgNz;
    } else {
      const ix = (prevEdge.c * currEdge.nz - currEdge.c * prevEdge.nz) / det;
      const iz = (prevEdge.nx * currEdge.c - currEdge.nx * prevEdge.c) / det;
      const dist = Math.hypot(ix - pCurr.x, iz - pCurr.z);
      const maxMiter = Math.max(prevEdge.d, currEdge.d) * 5;
      if (dist > maxMiter) {
        const avgD = (prevEdge.d + currEdge.d) / 2;
        const avgNx = (prevEdge.nx + currEdge.nx) / 2;
        const avgNz = (prevEdge.nz + currEdge.nz) / 2;
        netX = pCurr.x + avgD * avgNx;
        netZ = pCurr.z + avgD * avgNz;
      } else {
        netX = ix;
        netZ = iz;
      }
    }

    netCorners.push({
      x: Number(netX.toFixed(2)),
      z: Number(netZ.toFixed(2)),
    });
  }

  let netSignedArea2 = 0;
  for (let i = 0; i < netCorners.length; i++) {
    const p1 = netCorners[i];
    const p2 = netCorners[(i + 1) % netCorners.length];
    netSignedArea2 += p1.x * p2.z - p2.x * p1.z;
  }

  return { netCorners, netSignedArea2 };
}

export function pointInPolygon(
  x: number,
  z: number,
  corners: { x: number; z: number }[]
): boolean {
  return pointInPolygonXZ(x, z, corners);
}

/** Checks whether (x, z) lies inside a room polygon and outside any interior holes. */
export function isPointInRoom(x: number, z: number, room: RoomPolygon): boolean {
  if (!pointInPolygon(x, z, room.corners)) return false;
  if (room.holes && room.holes.some((hole) => pointInPolygon(x, z, hole))) {
    return false;
  }
  return true;
}

/** Writes a label onto the room that contains its point. Unmatched labels are ignored. */
export function applyRoomLabels(
  rooms: RoomPolygon[],
  labels: RoomLabel[] | undefined
): RoomPolygon[] {
  if (!labels || labels.length === 0) return rooms;
  return rooms.map((room) => {
    const label = labels.find((entry) => isPointInRoom(entry.x, entry.z, room));
    if (!label) return room;
    return {
      ...room,
      name: label.name,
      ...(label.flooringType ? { flooringType: label.flooringType } : {}),
    };
  });
}

/**
 * Returns the set of wall IDs that are shared interior partition walls between two rooms.
 * Accepts optional precomputedRooms to avoid redundant execution of computeFloorPolygons.
 */
export function getInteriorWallIds(
  corners: Corner[],
  walls: Wall[],
  precomputedRooms?: RoomPolygon[]
): Set<string> {
  const rooms = precomputedRooms ?? computeFloorPolygons(corners, walls);
  const directedRoomEdges = new Set<string>();

  for (const room of rooms) {
    for (let i = 0; i < room.corners.length; i++) {
      const a = room.corners[i].id;
      const b = room.corners[(i + 1) % room.corners.length].id;
      directedRoomEdges.add(`${a}->${b}`);
    }
  }

  const interiorIds = new Set<string>();
  for (const w of walls) {
    const forward = directedRoomEdges.has(`${w.startCornerId}->${w.endCornerId}`);
    const backward = directedRoomEdges.has(`${w.endCornerId}->${w.startCornerId}`);
    if (forward && backward) {
      interiorIds.add(w.id);
    }
  }
  return interiorIds;
}

