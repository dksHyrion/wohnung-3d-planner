import * as THREE from 'three';
import {
  Corner,
  Wall,
  WallOpening,
  FurnitureItem,
  CollisionIssue,
  EPSILON_CM,
  FlooringType,
  RoomPolygon,
  RoomLabel,
} from './types';
import { segmentInteriorIntersection2D } from './geometry2d';
import { getEntityLevelId } from './levels';

export type { FlooringType, RoomPolygon };

export interface WallGeometryInfo {
  lengthCm: number;
  tangent: { x: number; z: number };
  normal: { x: number; z: number };
  angleRad: number;
  centerX: number;
  centerZ: number;
}

export function getWallGeometry(start: Corner, end: Corner): WallGeometryInfo {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthCm = Math.hypot(dx, dz);

  if (lengthCm < 1e-6) {
    return {
      lengthCm: 0,
      tangent: { x: 1, z: 0 },
      normal: { x: 0, z: 1 },
      angleRad: 0,
      centerX: start.x,
      centerZ: start.z,
    };
  }

  const tx = dx / lengthCm;
  const tz = dz / lengthCm;
  // Right-hand inward normal for clockwise floorplan loops in XZ plane (X right, Z down)
  const nx = -tz;
  const nz = tx;

  return {
    lengthCm,
    tangent: { x: tx, z: tz },
    normal: { x: nx, z: nz },
    angleRad: Math.atan2(dz, dx),
    centerX: (start.x + end.x) / 2,
    centerZ: (start.z + end.z) / 2,
  };
}

export function setWallLengthCm(
  start: Corner,
  end: Corner,
  targetLengthCm: number
): { x: number; z: number } {
  const safeLength = Math.max(10, targetLengthCm);
  const geom = getWallGeometry(start, end);
  return {
    x: Number((start.x + geom.tangent.x * safeLength).toFixed(2)),
    z: Number((start.z + geom.tangent.z * safeLength).toFixed(2)),
  };
}

export function checkWallFitCm(
  start: Corner,
  end: Corner,
  wall: Wall,
  openings: WallOpening[],
  furniture: FurnitureItem,
  toleranceCm: number = EPSILON_CM
): {
  fitsOnWall: boolean;
  issues: CollisionIssue[];
  clearancesCm: { leftCm: number; rightCm: number };
  projectionCenterCm: number;
} {
  const geom = getWallGeometry(start, end);
  const issues: CollisionIssue[] = [];

  const relX = furniture.x - start.x;
  const relZ = furniture.z - start.z;

  // 1D dot-product projection along the wall tangent
  const projectionCenterCm = relX * geom.tangent.x + relZ * geom.tangent.z;
  const halfWidth = furniture.widthCm / 2;
  const minPosCm = projectionCenterCm - halfWidth;
  const maxPosCm = projectionCenterCm + halfWidth;

  const leftClearance = Number(minPosCm.toFixed(1));
  const rightClearance = Number((geom.lengthCm - maxPosCm).toFixed(1));

  if (furniture.widthCm > geom.lengthCm + toleranceCm) {
    const diff = Number((furniture.widthCm - geom.lengthCm).toFixed(1));
    issues.push({
      type: 'wall-exceeded',
      overflowCm: diff,
      targetId: wall.id,
      message: `Möbel (${furniture.widthCm} cm) ist ${diff} cm länger als die Wand (${Math.round(geom.lengthCm)} cm).`,
    });
  } else {
    if (minPosCm < -toleranceCm) {
      const overflow = Number((-minPosCm).toFixed(1));
      issues.push({
        type: 'corner-overflow',
        overflowCm: overflow,
        targetId: wall.startCornerId,
        message: `Ragt ${overflow} cm über die linke Wandecke hinaus.`,
      });
    }
    if (maxPosCm > geom.lengthCm + toleranceCm) {
      const overflow = Number((maxPosCm - geom.lengthCm).toFixed(1));
      issues.push({
        type: 'corner-overflow',
        overflowCm: overflow,
        targetId: wall.endCornerId,
        message: `Ragt ${overflow} cm über die rechte Wandecke hinaus.`,
      });
    }
  }

  // Check openings on this wall
  const furnitureTopCm = furniture.elevationCm + furniture.heightCm;
  for (const op of openings) {
    if (op.wallId !== wall.id) continue;
    const opStart = op.offsetFromStartCm;
    const opEnd = op.offsetFromStartCm + op.widthCm;
    const overlapsHorizontally =
      maxPosCm > opStart + toleranceCm && minPosCm < opEnd - toleranceCm;
    const overlapsVertically =
      furnitureTopCm > op.sillHeightCm + toleranceCm &&
      furniture.elevationCm < op.sillHeightCm + op.heightCm - toleranceCm;

    if (overlapsHorizontally && overlapsVertically) {
      const overlapCm = Number(
        (Math.min(maxPosCm, opEnd) - Math.max(minPosCm, opStart)).toFixed(1)
      );
      issues.push({
        type: 'opening-blocked',
        overflowCm: overlapCm,
        targetId: op.id,
        message:
          op.type === 'door'
            ? `Blockiert Türöffnung um ${overlapCm} cm.`
            : op.type === 'sliding-door'
            ? `Blockiert Schiebetür um ${overlapCm} cm.`
            : op.type === 'passage'
            ? `Blockiert Wanddurchbruch um ${overlapCm} cm.`
            : op.type === 'balcony-door'
            ? `Blockiert Balkontür um ${overlapCm} cm.`
            : `Verdeckt Fenster (Brüstung ${op.sillHeightCm} cm) um ${overlapCm} cm.`,
      });
    }
  }

  return {
    fitsOnWall: issues.length === 0,
    issues,
    clearancesCm: {
      leftCm: leftClearance,
      rightCm: rightClearance,
    },
    projectionCenterCm,
  };
}

export function findWallSnap(
  furniture: FurnitureItem,
  corners: Corner[],
  walls: Wall[],
  snapThresholdCm: number = 20
): {
  snappedWallId: string;
  x: number;
  z: number;
  rotationYDeg: number;
} | null {
  const cornerMap = new Map(corners.map((c) => [c.id, c]));
  let bestCandidate: {
    snappedWallId: string;
    x: number;
    z: number;
    rotationYDeg: number;
    dist: number;
  } | null = null;

  for (const wall of walls) {
    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) continue;

    const geom = getWallGeometry(start, end);
    if (geom.lengthCm < 10) continue;

    const relX = furniture.x - start.x;
    const relZ = furniture.z - start.z;
    const alongWall = relX * geom.tangent.x + relZ * geom.tangent.z;

    if (alongWall < -furniture.widthCm / 2 || alongWall > geom.lengthCm + furniture.widthCm / 2) {
      continue;
    }

    const signedPerpDist = relX * geom.normal.x + relZ * geom.normal.z;
    const side = signedPerpDist >= 0 ? 1 : -1;
    const targetCenterOffset = wall.thicknessCm / 2 + furniture.depthCm / 2;
    const distFromTargetFace = Math.abs(Math.abs(signedPerpDist) - targetCenterOffset);

    if (distFromTargetFace <= snapThresholdCm) {
      const clampedAlong =
        furniture.widthCm <= geom.lengthCm
          ? THREE.MathUtils.clamp(
              alongWall,
              furniture.widthCm / 2,
              geom.lengthCm - furniture.widthCm / 2
            )
          : alongWall;

      const snappedX =
        start.x +
        geom.tangent.x * clampedAlong +
        geom.normal.x * side * targetCenterOffset;
      const snappedZ =
        start.z +
        geom.tangent.z * clampedAlong +
        geom.normal.z * side * targetCenterOffset;

      const wallDeg = THREE.MathUtils.radToDeg(-geom.angleRad);
      const rotationYDeg = side >= 0 ? wallDeg : wallDeg + 180;

      if (!bestCandidate || distFromTargetFace < bestCandidate.dist) {
        bestCandidate = {
          snappedWallId: wall.id,
          x: Number(snappedX.toFixed(2)),
          z: Number(snappedZ.toFixed(2)),
          rotationYDeg: Number((((rotationYDeg % 360) + 360) % 360).toFixed(1)),
          dist: distFromTargetFace,
        };
      }
    }
  }

  if (!bestCandidate) return null;
  return {
    snappedWallId: bestCandidate.snappedWallId,
    x: bestCandidate.x,
    z: bestCandidate.z,
    rotationYDeg: bestCandidate.rotationYDeg,
  };
}

export function shouldCutawayWall(
  start: Corner,
  end: Corner,
  cameraPos: { x: number; y: number; z: number },
  roomCenter: { x: number; z: number }
): boolean {
  const geom = getWallGeometry(start, end);
  if (geom.lengthCm < 1) return false;

  // Vector from wall center to room center defines inward direction
  const toCenterX = roomCenter.x - geom.centerX;
  const toCenterZ = roomCenter.z - geom.centerZ;
  const inwardSign =
    toCenterX * geom.normal.x + toCenterZ * geom.normal.z >= 0 ? 1 : -1;
  const inwardNormalX = geom.normal.x * inwardSign;
  const inwardNormalZ = geom.normal.z * inwardSign;

  // Vector from wall center to camera in XZ plane
  const toCamX = cameraPos.x - geom.centerX;
  const toCamZ = cameraPos.z - geom.centerZ;
  const toCamLen = Math.hypot(toCamX, toCamZ);
  if (toCamLen < 1e-3) return false;

  // If the wall lies between the camera and the room center, its inward normal points away from camera (dot < -0.15)
  const dot = (inwardNormalX * toCamX + inwardNormalZ * toCamZ) / toCamLen;
  return dot < -0.15;
}

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
  let inside = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const xi = corners[i].x;
    const zi = corners[i].z;
    const xj = corners[j].x;
    const zj = corners[j].z;
    const crosses = zi > z !== zj > z;
    if (!crosses) continue;
    const xAtZ = ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (x < xAtZ) inside = !inside;
  }
  return inside;
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

/**
 * Computes a 2D SVG viewBox (in cm) that encloses all corners plus a margin.
 * Used for the initial view and the "fit/reset view" button so that newly
 * added rooms are never cropped.
 */
export function computeFitViewBox(
  corners: Corner[],
  marginCm = 100
): { x: number; y: number; w: number; h: number } {
  if (corners.length === 0) {
    return { x: -marginCm, y: -marginCm, w: 800 + 2 * marginCm, h: 600 + 2 * marginCm };
  }
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.x);
    minZ = Math.min(minZ, c.z);
    maxX = Math.max(maxX, c.x);
    maxZ = Math.max(maxZ, c.z);
  }
  return {
    x: minX - marginCm,
    y: minZ - marginCm,
    w: maxX - minX + 2 * marginCm,
    h: maxZ - minZ + 2 * marginCm,
  };
}

export function snapAngleToOrthogonal(
  startX: number,
  startZ: number,
  currentX: number,
  currentZ: number,
  thresholdDeg = 6.0
): {
  x: number;
  z: number;
  isSnapped: boolean;
  snappedAngleDeg: 0 | 90 | 180 | 270 | null;
  snappedAxis: 'x' | 'z' | null;
} {
  const dx = currentX - startX;
  const dz = currentZ - startZ;
  const dist = Math.hypot(dx, dz);
  if (dist < 1) {
    return {
      x: currentX,
      z: currentZ,
      isSnapped: false,
      snappedAngleDeg: null,
      snappedAxis: null,
    };
  }

  // Angle in degrees from positive X axis [0, 360)
  let angleDeg = (Math.atan2(dz, dx) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  // Targets: 0/360 (East/Right), 90 (South/Down), 180 (West/Left), 270 (North/Up)
  const diff0 = Math.min(Math.abs(angleDeg - 0), Math.abs(angleDeg - 360));
  if (diff0 <= thresholdDeg) {
    return {
      x: currentX,
      z: startZ,
      isSnapped: true,
      snappedAngleDeg: 0,
      snappedAxis: 'x',
    };
  }

  if (Math.abs(angleDeg - 90) <= thresholdDeg) {
    return {
      x: startX,
      z: currentZ,
      isSnapped: true,
      snappedAngleDeg: 90,
      snappedAxis: 'z',
    };
  }

  if (Math.abs(angleDeg - 180) <= thresholdDeg) {
    return {
      x: currentX,
      z: startZ,
      isSnapped: true,
      snappedAngleDeg: 180,
      snappedAxis: 'x',
    };
  }

  if (Math.abs(angleDeg - 270) <= thresholdDeg) {
    return {
      x: startX,
      z: currentZ,
      isSnapped: true,
      snappedAngleDeg: 270,
      snappedAxis: 'z',
    };
  }

  return {
    x: currentX,
    z: currentZ,
    isSnapped: false,
    snappedAngleDeg: null,
    snappedAxis: null,
  };
}

export function snapValueToGrid(val: number, gridSizeCm: number): number {
  if (!Number.isFinite(val) || gridSizeCm <= 0) return val;
  return Math.round(val / gridSizeCm) * gridSizeCm;
}

