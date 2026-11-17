import type { Corner, Wall, WallOpening } from './types';
import { getWallGeometry } from './wallMath';
import { openingLetsLightThrough } from './doorLeaf';

/** Wie weit der Lichtfleck vom Fenster in den Raum reicht. */
export const WINDOW_LIGHT_POOL_DEPTH_CM = 140;

/** Maximale Boden-Reichweite des projizierten Sonnenlicht-Trapezes. */
export const MAX_SUN_PROJECTION_DEPTH_CM = 360;

/**
 * Sichtbarkeit des Flecks. Bei Nacht (Intensität 0,5) bleibt er fast unsichtbar,
 * am Morgen (2,5) liegt er ruhig auf dem Boden, in der Goldenen Stunde ist er am deutlichsten.
 */
export function windowLightPoolOpacity(intensity: number): number {
  if (!Number.isFinite(intensity) || intensity <= 0) return 0;
  return Math.min(0.28, (intensity / 4) * 0.28);
}

export function windowLightPoolCenter(args: {
  offsetFromStartCm: number;
  widthCm: number;
  wallLengthCm: number;
  wallThicknessCm: number;
  inwardSign: 1 | -1;
  depthCm?: number;
}): { x: number; z: number; widthCm: number; depthCm: number } {
  const depthCm = args.depthCm ?? WINDOW_LIGHT_POOL_DEPTH_CM;
  const widthCm = Math.max(20, args.widthCm * 0.9);
  const x = args.offsetFromStartCm + args.widthCm / 2 - args.wallLengthCm / 2;
  const z = args.inwardSign * (args.wallThicknessCm / 2 + 4 + depthCm / 2);
  return { x, z, widthCm, depthCm };
}

/**
 * Drehung der Bodenebene. Die helle Texturkante ist die lokale +Y der Ebene.
 * Nach einer Drehung um X um −90° zeigt diese Kante nach −Z und die Normale nach oben.
 * Zeigt der Raum nach −Z, dreht eine weitere halbe Drehung um Z die Kante zur Wand.
 * Eine negative Skalierung würde die Fläche von oben unsichtbar machen.
 */
export function windowLightPoolRotation(inwardSign: 1 | -1): [number, number, number] {
  return inwardSign === 1 ? [-Math.PI / 2, 0, 0] : [-Math.PI / 2, 0, Math.PI];
}

export interface SunLightDirection {
  /** Normalized direction vector pointing FROM the sun INTO the room. */
  dirToRoom: { x: number; y: number; z: number };
  /** Effective sun position in world cm for directional light placement. */
  sunPosition: [number, number, number];
}

/**
 * Computes the sun position and unit ray direction into the room from either
 * dominant window orientation (`alignSunWithWindows`) or mood elevation/azimuth.
 */
export function computeEffectiveSunLight(args: {
  corners: Corner[];
  walls: Wall[];
  openings: WallOpening[];
  roomCenter: { cx: number; cz: number };
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  alignSunWithWindows: boolean;
  sunDistance?: number;
}): SunLightDirection {
  const sunDistance = args.sunDistance ?? 1800;
  const windowOpenings = args.openings.filter((o) => openingLetsLightThrough(o.type));

  if (args.alignSunWithWindows && windowOpenings.length > 0) {
    const cornerMap = new Map(args.corners.map((c) => [c.id, c]));
    const wallMap = new Map(args.walls.map((w) => [w.id, w]));
    let totalNx = 0;
    let totalNz = 0;

    for (const op of windowOpenings) {
      const wall = wallMap.get(op.wallId);
      if (!wall) continue;
      const start = cornerMap.get(wall.startCornerId);
      const end = cornerMap.get(wall.endCornerId);
      if (!start || !end) continue;
      const geom = getWallGeometry(start, end);
      const toCenterX = args.roomCenter.cx - geom.centerX;
      const toCenterZ = args.roomCenter.cz - geom.centerZ;
      const inwardSign =
        toCenterX * geom.normal.x + toCenterZ * geom.normal.z >= 0 ? 1 : -1;
      totalNx += geom.normal.x * inwardSign * op.widthCm;
      totalNz += geom.normal.z * inwardSign * op.widthCm;
    }

    const len = Math.hypot(totalNx, totalNz);
    if (len > 1e-4) {
      const domX = totalNx / len;
      const domZ = totalNz / len;
      const elevRad = (Math.max(10, args.sunElevationDeg) * Math.PI) / 180;
      const horiz = sunDistance * Math.cos(elevRad);
      const sunX = args.roomCenter.cx - domX * horiz;
      const sunY = Math.max(20, sunDistance * Math.sin(elevRad));
      const sunZ = args.roomCenter.cz - domZ * horiz;

      const dirLen = Math.hypot(domX * Math.cos(elevRad), Math.sin(elevRad), domZ * Math.cos(elevRad)) || 1;
      return {
        dirToRoom: {
          x: (domX * Math.cos(elevRad)) / dirLen,
          y: -Math.sin(elevRad) / dirLen,
          z: (domZ * Math.cos(elevRad)) / dirLen,
        },
        sunPosition: [sunX, sunY, sunZ],
      };
    }
  }

  const elevRad = (args.sunElevationDeg * Math.PI) / 180;
  const azimRad = (args.sunAzimuthDeg * Math.PI) / 180;
  const sunOffsetX = sunDistance * Math.cos(elevRad) * Math.sin(azimRad);
  const sunY = Math.max(20, sunDistance * Math.sin(elevRad));
  const sunOffsetZ = sunDistance * Math.cos(elevRad) * Math.cos(azimRad);

  const len = Math.hypot(sunOffsetX, sunY, sunOffsetZ) || 1;
  return {
    dirToRoom: {
      x: -sunOffsetX / len,
      y: -sunY / len,
      z: -sunOffsetZ / len,
    },
    sunPosition: [
      args.roomCenter.cx + sunOffsetX,
      sunY,
      args.roomCenter.cz + sunOffsetZ,
    ],
  };
}

export interface WindowSunPolygon {
  nearLeft: { x: number; z: number };
  nearRight: { x: number; z: number };
  farRight: { x: number; z: number };
  farLeft: { x: number; z: number };
}

/**
 * Projects a wall window aperture onto the floor (y=0) in wall-local coordinates
 * along the sun ray vector `sunDirToRoom`. Returns `null` when the window faces
 * away from the sun or sun elevation is below horizon.
 */
export function computeWindowSunPolygon(args: {
  offsetFromStartCm: number;
  widthCm: number;
  sillHeightCm: number;
  heightCm: number;
  wallLengthCm: number;
  wallThicknessCm: number;
  inwardSign: 1 | -1;
  wallAngleRad: number;
  sunDirToRoom: { x: number; y: number; z: number };
}): WindowSunPolygon | null {
  const { sunDirToRoom, inwardSign, wallAngleRad } = args;
  if (sunDirToRoom.y >= -0.05) return null;

  // Transform world horizontal sun ray into wall-local (tangent, normal) coordinates
  const tx = Math.cos(wallAngleRad);
  const tz = Math.sin(wallAngleRad);
  const nx = -tz;
  const nz = tx;

  const dxLocal = sunDirToRoom.x * tx + sunDirToRoom.z * tz;
  const dzLocal = sunDirToRoom.x * nx + sunDirToRoom.z * nz;

  const inwardDot = dzLocal * inwardSign;
  if (inwardDot <= 0.08) return null;

  const xLeft = args.offsetFromStartCm - args.wallLengthCm / 2 + args.widthCm * 0.05;
  const xRight = args.offsetFromStartCm - args.wallLengthCm / 2 + args.widthCm * 0.95;
  const zWall = inwardSign * (args.wallThicknessCm / 2 + 2);

  const yBottom = Math.max(0, args.sillHeightCm);
  const yTop = Math.max(yBottom + 20, args.sillHeightCm + args.heightCm);

  const horizSpeed = Math.hypot(dxLocal, dzLocal);
  const maxT = horizSpeed > 1e-4 ? MAX_SUN_PROJECTION_DEPTH_CM / horizSpeed : 0;

  const tBottom = Math.min(maxT * 0.4, yBottom / -sunDirToRoom.y);
  const tTop = Math.min(maxT, Math.max(tBottom + 35 / Math.max(0.1, horizSpeed), yTop / -sunDirToRoom.y));

  return {
    nearLeft: {
      x: xLeft + dxLocal * tBottom,
      z: zWall + dzLocal * tBottom,
    },
    nearRight: {
      x: xRight + dxLocal * tBottom,
      z: zWall + dzLocal * tBottom,
    },
    farRight: {
      x: xRight + dxLocal * tTop,
      z: zWall + dzLocal * tTop,
    },
    farLeft: {
      x: xLeft + dxLocal * tTop,
      z: zWall + dzLocal * tTop,
    },
  };
}
