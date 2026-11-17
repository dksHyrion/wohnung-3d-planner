import * as THREE from 'three';
import type { Corner, Wall } from './types';
import { getWallGeometry } from './wallMath';

export interface WallMiterExtents {
  /** Extension (+) or recess (-) in cm on the +normal face at the wall's start corner. */
  startPosExt: number;
  /** Extension (+) or recess (-) in cm on the -normal face at the wall's start corner. */
  startNegExt: number;
  /** Extension (+) or recess (-) in cm on the +normal face at the wall's end corner. */
  endPosExt: number;
  /** Extension (+) or recess (-) in cm on the -normal face at the wall's end corner. */
  endNegExt: number;
}

const ZERO_MITER: WallMiterExtents = {
  startPosExt: 0,
  startNegExt: 0,
  endPosExt: 0,
  endNegExt: 0,
};

interface IncidentWall {
  wallId: string;
  uAwayX: number;
  uAwayZ: number;
  thicknessCm: number;
}

function computeCornerSideMiter(
  wallId: string,
  uAwayX: number,
  uAwayZ: number,
  nSideX: number,
  nSideZ: number,
  wallThicknessCm: number,
  incident: IncidentWall[]
): number {
  const others = incident.filter((item) => item.wallId !== wallId);
  if (others.length === 0) return 0;

  // Sweep angle from uAway toward nSide in (0, 2*PI]
  let best: IncidentWall | null = null;
  let bestTheta = Infinity;

  for (const adj of others) {
    const dotA = uAwayX * adj.uAwayX + uAwayZ * adj.uAwayZ;
    const dotN = nSideX * adj.uAwayX + nSideZ * adj.uAwayZ;
    let theta = Math.atan2(dotN, dotA);
    if (theta <= 1e-6) theta += Math.PI * 2;
    if (theta < bestTheta) {
      bestTheta = theta;
      best = adj;
    }
  }

  if (!best) return 0;

  // Orientation sign (+1 or -1) of rotation from uAway to nSide in 2D
  const orientSign = uAwayX * nSideZ - uAwayZ * nSideX >= 0 ? 1 : -1;

  // Neighbor face bordering the swept ribbon is u_adj rotated by -orientSign * 90 deg
  const nAdjX = orientSign > 0 ? best.uAwayZ : -best.uAwayZ;
  const nAdjZ = orientSign > 0 ? -best.uAwayX : best.uAwayX;

  // Intersect:
  //   (T_wall/2)*nSide - k*uAway = (T_adj/2)*nAdj + m*uAdj
  const negUx = -uAwayX;
  const negUz = -uAwayZ;
  const denom = negUx * best.uAwayZ - negUz * best.uAwayX;
  if (Math.abs(denom) < 1e-4) {
    // Collinear continuation (0° or 180°): no miter extension
    return 0;
  }

  const rhsX = (best.thicknessCm / 2) * nAdjX - (wallThicknessCm / 2) * nSideX;
  const rhsZ = (best.thicknessCm / 2) * nAdjZ - (wallThicknessCm / 2) * nSideZ;
  const k = (rhsX * best.uAwayZ - rhsZ * best.uAwayX) / denom;

  const maxMiter = Math.max(wallThicknessCm, best.thicknessCm) * 2.5;
  if (!Number.isFinite(k)) return 0;
  return Number(Math.max(-maxMiter, Math.min(maxMiter, k)).toFixed(3));
}

/**
 * Computes exact corner miter extensions/recesses for every wall so adjacent
 * walls, wall caps, and skirting boards meet seamlessly along the corner bisector.
 */
export function computeWallMiterMap(
  corners: Corner[],
  walls: Wall[]
): Map<string, WallMiterExtents> {
  const cornerMap = new Map(corners.map((c) => [c.id, c]));
  const incidentByCorner = new Map<string, IncidentWall[]>();
  const wallGeoms = new Map<string, ReturnType<typeof getWallGeometry>>();

  for (const wall of walls) {
    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) continue;
    const geom = getWallGeometry(start, end);
    if (geom.lengthCm < 1) continue;
    wallGeoms.set(wall.id, geom);

    if (!incidentByCorner.has(wall.startCornerId)) {
      incidentByCorner.set(wall.startCornerId, []);
    }
    if (!incidentByCorner.has(wall.endCornerId)) {
      incidentByCorner.set(wall.endCornerId, []);
    }

    incidentByCorner.get(wall.startCornerId)!.push({
      wallId: wall.id,
      uAwayX: geom.tangent.x,
      uAwayZ: geom.tangent.z,
      thicknessCm: wall.thicknessCm,
    });
    incidentByCorner.get(wall.endCornerId)!.push({
      wallId: wall.id,
      uAwayX: -geom.tangent.x,
      uAwayZ: -geom.tangent.z,
      thicknessCm: wall.thicknessCm,
    });
  }

  const result = new Map<string, WallMiterExtents>();
  for (const wall of walls) {
    const geom = wallGeoms.get(wall.id);
    if (!geom) {
      result.set(wall.id, ZERO_MITER);
      continue;
    }

    const startInc = incidentByCorner.get(wall.startCornerId) ?? [];
    const endInc = incidentByCorner.get(wall.endCornerId) ?? [];

    const startPosExt = computeCornerSideMiter(
      wall.id,
      geom.tangent.x,
      geom.tangent.z,
      geom.normal.x,
      geom.normal.z,
      wall.thicknessCm,
      startInc
    );
    const startNegExt = computeCornerSideMiter(
      wall.id,
      geom.tangent.x,
      geom.tangent.z,
      -geom.normal.x,
      -geom.normal.z,
      wall.thicknessCm,
      startInc
    );
    const endPosExt = computeCornerSideMiter(
      wall.id,
      -geom.tangent.x,
      -geom.tangent.z,
      geom.normal.x,
      geom.normal.z,
      wall.thicknessCm,
      endInc
    );
    const endNegExt = computeCornerSideMiter(
      wall.id,
      -geom.tangent.x,
      -geom.tangent.z,
      -geom.normal.x,
      -geom.normal.z,
      wall.thicknessCm,
      endInc
    );

    result.set(wall.id, {
      startPosExt,
      startNegExt,
      endPosExt,
      endNegExt,
    });
  }

  return result;
}

/**
 * Builds a mitered rectangular prism geometry centered at y=0, z=0 in wall-local coordinates.
 * The +Z face spans [xStartPos, xEndPos] and the -Z face spans [xStartNeg, xEndNeg].
 */
export function createMiteredPrismGeometry(
  xStartPos: number,
  xStartNeg: number,
  xEndPos: number,
  xEndNeg: number,
  thicknessZ: number,
  heightY: number
): THREE.BufferGeometry {
  const hz = thicknessZ / 2;
  const hy = heightY / 2;

  const bsp: [number, number, number] = [xStartPos, -hy, hz];
  const bep: [number, number, number] = [xEndPos, -hy, hz];
  const ben: [number, number, number] = [xEndNeg, -hy, -hz];
  const bsn: [number, number, number] = [xStartNeg, -hy, -hz];

  const tsp: [number, number, number] = [xStartPos, hy, hz];
  const tep: [number, number, number] = [xEndPos, hy, hz];
  const ten: [number, number, number] = [xEndNeg, hy, -hz];
  const tsn: [number, number, number] = [xStartNeg, hy, -hz];

  const positions = new Float32Array([
    // +Z front
    ...bsp, ...bep, ...tep,
    ...bsp, ...tep, ...tsp,
    // -Z back
    ...ben, ...bsn, ...tsn,
    ...ben, ...tsn, ...ten,
    // +Y top
    ...tsp, ...tep, ...ten,
    ...tsp, ...ten, ...tsn,
    // -Y bottom
    ...bsn, ...ben, ...bep,
    ...bsn, ...bep, ...bsp,
    // Start cap (-X)
    ...bsn, ...bsp, ...tsp,
    ...bsn, ...tsp, ...tsn,
    // End cap (+X)
    ...bep, ...ben, ...ten,
    ...bep, ...ten, ...tep,
  ]);

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}
