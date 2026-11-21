import * as THREE from 'three';
import {
  Corner,
  Wall,
  WallOpening,
  FurnitureItem,
  CollisionIssue,
  EPSILON_CM,
} from './types';

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

