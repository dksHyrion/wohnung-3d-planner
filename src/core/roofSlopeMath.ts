import {
  Corner,
  EPSILON_CM,
  Point2D,
  RoofSlope,
  RoomPolygon,
  Wall,
} from './types';
import { getWallGeometry, isPointInRoom, pointInPolygon } from './wallMath';

export interface RoofSlopePlane {
  slopeId: string;
  wallId: string;
  anchorX: number;
  anchorZ: number;
  tangentX: number;
  tangentZ: number;
  wallLengthCm: number;
  wallThicknessCm: number;
  inwardNormalX: number;
  inwardNormalZ: number;
  kneeWallHeightCm: number;
  pitchDeg: number;
  tanPitch: number;
  side: 'pos' | 'neg';
}

export interface RoomWoFlVBreakdown {
  netAreaSqM: number;
  woflvAreaSqM: number;
  areaFullSqM: number;
  areaHalfSqM: number;
  areaZeroSqM: number;
  hasRoofSlopes: boolean;
}

export interface RoofSlopeContours {
  slopeId: string;
  line100: [Point2D, Point2D] | null;
  line200: [Point2D, Point2D] | null;
}

export interface RoofSlopeQuad3D {
  slopeId: string;
  corners: [
    { x: number; y: number; z: number },
    { x: number; y: number; z: number },
    { x: number; y: number; z: number },
    { x: number; y: number; z: number },
  ];
}

export function resolveRoofSlopePlanes(
  corners: Corner[],
  walls: Wall[],
  roofSlopes: RoofSlope[] | undefined,
  rooms?: RoomPolygon[]
): RoofSlopePlane[] {
  if (!roofSlopes || roofSlopes.length === 0) return [];
  const cornerMap = new Map(corners.map((c) => [c.id, c]));
  const wallMap = new Map(walls.map((w) => [w.id, w]));
  const planes: RoofSlopePlane[] = [];

  for (const slope of roofSlopes) {
    const wall = wallMap.get(slope.wallId);
    if (!wall) continue;
    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) continue;

    const geom = getWallGeometry(start, end);
    if (geom.lengthCm < 1) continue;

    let side: 'pos' | 'neg' = slope.side ?? 'pos';
    if (!slope.side && rooms && rooms.length > 0) {
      const probeDist = wall.thicknessCm / 2 + 25;
      const posIn = rooms.some((r) =>
        isPointInRoom(
          geom.centerX + geom.normal.x * probeDist,
          geom.centerZ + geom.normal.z * probeDist,
          r
        )
      );
      const negIn = rooms.some((r) =>
        isPointInRoom(
          geom.centerX - geom.normal.x * probeDist,
          geom.centerZ - geom.normal.z * probeDist,
          r
        )
      );
      if (negIn && !posIn) {
        side = 'neg';
      }
    }

    const sign = side === 'neg' ? -1 : 1;
    const nx = geom.normal.x * sign;
    const nz = geom.normal.z * sign;
    const clampedPitch = Math.max(5, Math.min(75, slope.pitchDeg));
    const clampedKnee = Math.max(0, Math.min(250, slope.kneeWallHeightCm));

    planes.push({
      slopeId: slope.id,
      wallId: wall.id,
      anchorX: geom.centerX + nx * (wall.thicknessCm / 2),
      anchorZ: geom.centerZ + nz * (wall.thicknessCm / 2),
      tangentX: geom.tangent.x,
      tangentZ: geom.tangent.z,
      wallLengthCm: geom.lengthCm,
      wallThicknessCm: wall.thicknessCm,
      inwardNormalX: nx,
      inwardNormalZ: nz,
      kneeWallHeightCm: clampedKnee,
      pitchDeg: clampedPitch,
      tanPitch: Math.tan((clampedPitch * Math.PI) / 180),
      side,
    });
  }

  return planes;
}

export function ceilingHeightAtPointFromPlane(
  x: number,
  z: number,
  plane: RoofSlopePlane
): number | null {
  const dx = x - plane.anchorX;
  const dz = z - plane.anchorZ;
  const along = dx * plane.tangentX + dz * plane.tangentZ;
  if (Math.abs(along) > plane.wallLengthCm / 2 + EPSILON_CM) {
    return null;
  }
  const distInward = dx * plane.inwardNormalX + dz * plane.inwardNormalZ;
  if (distInward < -plane.wallThicknessCm - EPSILON_CM) {
    return null;
  }
  return plane.kneeWallHeightCm + Math.max(0, distInward) * plane.tanPitch;
}

export function getEffectiveCeilingHeightAt(
  x: number,
  z: number,
  planes: RoofSlopePlane[],
  maxCeilingCm: number = 250
): { ceilingYCm: number; limitingSlopeId: string | null } {
  let ceilingYCm = maxCeilingCm;
  let limitingSlopeId: string | null = null;

  for (const plane of planes) {
    const h = ceilingHeightAtPointFromPlane(x, z, plane);
    if (h !== null && h < ceilingYCm) {
      ceilingYCm = h;
      limitingSlopeId = plane.slopeId;
    }
  }

  return { ceilingYCm, limitingSlopeId };
}

function makeContourSegmentAtHeight(
  plane: RoofSlopePlane,
  targetHeightCm: number,
  maxDistInwardCm: number = 600
): [Point2D, Point2D] | null {
  if (targetHeightCm <= plane.kneeWallHeightCm || plane.tanPitch <= 1e-6) {
    return null;
  }
  const distInward = (targetHeightCm - plane.kneeWallHeightCm) / plane.tanPitch;
  if (distInward < 0 || distInward > maxDistInwardCm) {
    return null;
  }
  const cx = plane.anchorX + plane.inwardNormalX * distInward;
  const cz = plane.anchorZ + plane.inwardNormalZ * distInward;
  const halfLen = plane.wallLengthCm / 2;
  return [
    {
      x: cx - plane.tangentX * halfLen,
      z: cz - plane.tangentZ * halfLen,
    },
    {
      x: cx + plane.tangentX * halfLen,
      z: cz + plane.tangentZ * halfLen,
    },
  ];
}

export function computeRoofSlopeContourLines(plane: RoofSlopePlane): RoofSlopeContours {
  return {
    slopeId: plane.slopeId,
    line100: makeContourSegmentAtHeight(plane, 100),
    line200: makeContourSegmentAtHeight(plane, 200),
  };
}

export function computeRoofSlopeQuad3D(
  plane: RoofSlopePlane,
  maxCeilingCm: number = 250
): RoofSlopeQuad3D {
  const riseTopCm = Math.max(plane.kneeWallHeightCm + 10, maxCeilingCm);
  const runCm = Math.max(
    20,
    Math.min(600, (riseTopCm - plane.kneeWallHeightCm) / Math.max(1e-4, plane.tanPitch))
  );
  const actualTopY = plane.kneeWallHeightCm + runCm * plane.tanPitch;
  const halfLen = plane.wallLengthCm / 2;

  const sx = plane.anchorX - plane.tangentX * halfLen;
  const sz = plane.anchorZ - plane.tangentZ * halfLen;
  const ex = plane.anchorX + plane.tangentX * halfLen;
  const ez = plane.anchorZ + plane.tangentZ * halfLen;

  return {
    slopeId: plane.slopeId,
    corners: [
      { x: sx, y: plane.kneeWallHeightCm, z: sz },
      { x: ex, y: plane.kneeWallHeightCm, z: ez },
      {
        x: ex + plane.inwardNormalX * runCm,
        y: actualTopY,
        z: ez + plane.inwardNormalZ * runCm,
      },
      {
        x: sx + plane.inwardNormalX * runCm,
        y: actualTopY,
        z: sz + plane.inwardNormalZ * runCm,
      },
    ],
  };
}

/**
 * Computes residential living area per German WoFlV § 4:
 * - >= 200 cm clear height: 100%
 * - >= 100 cm and < 200 cm clear height: 50%
 * - < 100 cm clear height: 0%
 */
export function computeRoomWoFlVBreakdown(
  room: RoomPolygon,
  planes: RoofSlopePlane[],
  maxCeilingCm: number = 250
): RoomWoFlVBreakdown {
  const netAreaSqM = Number(room.netAreaSqM.toFixed(2));
  if (planes.length === 0 || netAreaSqM <= 0) {
    return {
      netAreaSqM,
      woflvAreaSqM: netAreaSqM,
      areaFullSqM: netAreaSqM,
      areaHalfSqM: 0,
      areaZeroSqM: 0,
      hasRoofSlopes: false,
    };
  }

  const polyPts =
    room.netCorners && room.netCorners.length >= 3 ? room.netCorners : room.corners;
  const polyHoles =
    room.netCorners && room.netCorners.length >= 3 ? room.netHoles : room.holes;

  const isInNetRoom = (px: number, pz: number): boolean => {
    if (!pointInPolygon(px, pz, polyPts)) return false;
    if (polyHoles && polyHoles.some((h) => pointInPolygon(px, pz, h))) return false;
    return true;
  };

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const pt of polyPts) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.z < minZ) minZ = pt.z;
    if (pt.z > maxZ) maxZ = pt.z;
  }

  const span = Math.max(maxX - minX, maxZ - minZ);
  const stepCm = Math.max(1.5, Math.min(2.0, span / 200));

  let totalSamples = 0;
  let fullSamples = 0;
  let halfSamples = 0;
  let zeroSamples = 0;
  let touchedSlope = false;

  for (let z = minZ + stepCm / 2; z < maxZ; z += stepCm) {
    for (let x = minX + stepCm / 2; x < maxX; x += stepCm) {
      if (!isInNetRoom(x, z)) continue;
      totalSamples++;
      const { ceilingYCm, limitingSlopeId } = getEffectiveCeilingHeightAt(
        x,
        z,
        planes,
        maxCeilingCm
      );
      if (limitingSlopeId && ceilingYCm < 200) {
        touchedSlope = true;
      }
      if (ceilingYCm >= 200) {
        fullSamples++;
      } else if (ceilingYCm >= 100) {
        halfSamples++;
      } else {
        zeroSamples++;
      }
    }
  }

  if (totalSamples === 0 || !touchedSlope) {
    return {
      netAreaSqM,
      woflvAreaSqM: netAreaSqM,
      areaFullSqM: netAreaSqM,
      areaHalfSqM: 0,
      areaZeroSqM: 0,
      hasRoofSlopes: false,
    };
  }

  const areaFullSqM = Number(((netAreaSqM * fullSamples) / totalSamples).toFixed(2));
  const areaHalfSqM = Number(((netAreaSqM * halfSamples) / totalSamples).toFixed(2));
  const areaZeroSqM = Number(((netAreaSqM * zeroSamples) / totalSamples).toFixed(2));
  const woflvAreaSqM = Number((areaFullSqM + 0.5 * areaHalfSqM).toFixed(2));

  return {
    netAreaSqM,
    woflvAreaSqM,
    areaFullSqM,
    areaHalfSqM,
    areaZeroSqM,
    hasRoofSlopes: true,
  };
}
