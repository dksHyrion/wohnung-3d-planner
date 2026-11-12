import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import {
  Corner,
  Wall,
  WallOpening,
  FurnitureItem,
  FloorplanData,
  FurnitureCollisionReport,
  EPSILON_CM,
} from './types';
import { getWallGeometry, checkWallFitCm } from './wallMath';
import { openingHasSwingArc } from './doorLeaf';
import { layoutFurnitureParts } from './furnitureShapes';

export function computeFurnitureClearanceOBB(
  item: FurnitureItem,
  shrinkCm: number = EPSILON_CM
): OBB | null {
  if (!item.clearanceZoneCm || item.clearanceZoneCm <= 0) {
    return null;
  }

  const rotRad = THREE.MathUtils.degToRad(item.rotationYDeg);
  const rotMatrix = new THREE.Matrix4().makeRotationY(rotRad);
  const basis = new THREE.Matrix3().setFromMatrix4(rotMatrix);

  const localZ = item.depthCm / 2 + item.clearanceZoneCm / 2;
  const localOffset = new THREE.Vector3(0, 0, localZ).applyMatrix4(rotMatrix);

  const center = new THREE.Vector3(
    item.x + localOffset.x,
    item.elevationCm + item.heightCm / 2,
    item.z + localOffset.z
  );

  const halfW = Math.max(0.5, item.widthCm / 2 - shrinkCm);
  const halfH = Math.max(0.5, item.heightCm / 2 - shrinkCm);
  const halfD = Math.max(0.5, item.clearanceZoneCm / 2 - shrinkCm);
  const halfSize = new THREE.Vector3(halfW, halfH, halfD);

  return new OBB(center, halfSize, basis);
}

export function computeFurnitureOBBs(
  item: FurnitureItem,
  shrinkCm: number = EPSILON_CM
): OBB[] {
  const rotRad = THREE.MathUtils.degToRad(item.rotationYDeg);
  const rotMatrix = new THREE.Matrix4().makeRotationY(rotRad);
  const basis = new THREE.Matrix3().setFromMatrix4(rotMatrix);

  return layoutFurnitureParts(item).map((part) => {
    const local = new THREE.Vector3(part.cx, 0, part.cz).applyMatrix4(rotMatrix);
    const center = new THREE.Vector3(
      item.x + local.x,
      item.elevationCm + item.heightCm / 2 + part.cy,
      item.z + local.z
    );
    const halfSize = new THREE.Vector3(
      Math.max(0.5, part.widthCm / 2 - shrinkCm),
      Math.max(0.5, part.heightCm / 2 - shrinkCm),
      Math.max(0.5, part.depthCm / 2 - shrinkCm)
    );
    return new OBB(center, halfSize, basis);
  });
}

export function computeWallOBB(
  start: Corner,
  end: Corner,
  wall: Wall,
  shrinkCm: number = EPSILON_CM
): OBB {
  const geom = getWallGeometry(start, end);
  const halfLength = Math.max(0.5, geom.lengthCm / 2 - shrinkCm);
  const halfHeight = Math.max(0.5, wall.heightCm / 2 - shrinkCm);
  const halfThickness = Math.max(0.5, wall.thicknessCm / 2 - shrinkCm);

  const center = new THREE.Vector3(
    geom.centerX,
    wall.heightCm / 2,
    geom.centerZ
  );
  const halfSize = new THREE.Vector3(halfLength, halfHeight, halfThickness);
  const rotMatrix = new THREE.Matrix4().makeRotationY(-geom.angleRad);
  const basis = new THREE.Matrix3().setFromMatrix4(rotMatrix);

  return new OBB(center, halfSize, basis);
}

export function computeDoorSwingOBB(
  start: Corner,
  end: Corner,
  wall: Wall,
  opening: WallOpening
): OBB | null {
  if (!openingHasSwingArc(opening.type)) return null;
  const geom = getWallGeometry(start, end);
  if (geom.lengthCm < 1) return null;

  const swingSign =
    opening.swingDirection === 'out-left' || opening.swingDirection === 'out-right'
      ? -1
      : 1;

  const centerAlong = opening.offsetFromStartCm + opening.widthCm / 2;
  const normalOffset =
    swingSign * (wall.thicknessCm / 2 + opening.widthCm / 2);

  const centerX =
    start.x + geom.tangent.x * centerAlong + geom.normal.x * normalOffset;
  const centerZ =
    start.z + geom.tangent.z * centerAlong + geom.normal.z * normalOffset;

  const center = new THREE.Vector3(
    centerX,
    opening.sillHeightCm + opening.heightCm / 2,
    centerZ
  );
  const halfSize = new THREE.Vector3(
    Math.max(1, opening.widthCm / 2 - EPSILON_CM),
    Math.max(1, opening.heightCm / 2 - EPSILON_CM),
    Math.max(1, opening.widthCm / 2 - EPSILON_CM)
  );
  const rotMatrix = new THREE.Matrix4().makeRotationY(-geom.angleRad);
  const basis = new THREE.Matrix3().setFromMatrix4(rotMatrix);

  return new OBB(center, halfSize, basis);
}

export interface DoorSwingSector {
  hinge: { x: number; z: number };
  radiusCm: number;
  uClosed: { x: number; z: number }; // unit vector along closed door
  uOpen: { x: number; z: number };   // unit vector along fully open door (normal * swingSign)
  minY: number;
  maxY: number;
  openingId: string;
  widthCm: number;
}

function ccw(
  a: { x: number; z: number },
  b: { x: number; z: number },
  c: { x: number; z: number }
): number {
  return (c.z - a.z) * (b.x - a.x) - (b.z - a.z) * (c.x - a.x);
}

function onSegment(
  p: { x: number; z: number },
  a: { x: number; z: number },
  b: { x: number; z: number }
): boolean {
  return (
    p.x >= Math.min(a.x, b.x) - 1e-4 &&
    p.x <= Math.max(a.x, b.x) + 1e-4 &&
    p.z >= Math.min(a.z, b.z) - 1e-4 &&
    p.z <= Math.max(a.z, b.z) + 1e-4
  );
}

export function segmentsIntersect2D(
  p1: { x: number; z: number },
  p2: { x: number; z: number },
  q1: { x: number; z: number },
  q2: { x: number; z: number }
): boolean {
  const d1 = ccw(q1, q2, p1);
  const d2 = ccw(q1, q2, p2);
  const d3 = ccw(p1, p2, q1);
  const d4 = ccw(p1, p2, q2);

  if (
    ((d1 > 1e-5 && d2 < -1e-5) || (d1 < -1e-5 && d2 > 1e-5)) &&
    ((d3 > 1e-5 && d4 < -1e-5) || (d3 < -1e-5 && d4 > 1e-5))
  ) {
    return true;
  }

  if (Math.abs(d1) <= 1e-5 && onSegment(p1, q1, q2)) return true;
  if (Math.abs(d2) <= 1e-5 && onSegment(p2, q1, q2)) return true;
  if (Math.abs(d3) <= 1e-5 && onSegment(q1, p1, p2)) return true;
  if (Math.abs(d4) <= 1e-5 && onSegment(q2, p1, p2)) return true;

  return false;
}

export function computeDoorSwingSector(
  start: Corner,
  end: Corner,
  wall: Wall,
  opening: WallOpening
): DoorSwingSector | null {
  if (!openingHasSwingArc(opening.type)) return null;
  const geom = getWallGeometry(start, end);
  if (geom.lengthCm < 1 || opening.widthCm < 1) return null;

  const swingSign =
    opening.swingDirection === 'out-left' || opening.swingDirection === 'out-right'
      ? -1
      : 1;

  const hingeOnRight =
    opening.swingDirection === 'in-right' || opening.swingDirection === 'out-right';

  const hingeOffset = hingeOnRight
    ? opening.offsetFromStartCm + opening.widthCm
    : opening.offsetFromStartCm;

  const cleanZero = (n: number) => (n === 0 ? 0 : n);

  const hx = cleanZero(
    start.x +
      geom.tangent.x * hingeOffset +
      geom.normal.x * ((swingSign * wall.thicknessCm) / 2)
  );
  const hz = cleanZero(
    start.z +
      geom.tangent.z * hingeOffset +
      geom.normal.z * ((swingSign * wall.thicknessCm) / 2)
  );

  const uClosed = hingeOnRight
    ? { x: cleanZero(-geom.tangent.x), z: cleanZero(-geom.tangent.z) }
    : { x: cleanZero(geom.tangent.x), z: cleanZero(geom.tangent.z) };

  const uOpen = {
    x: cleanZero(geom.normal.x * swingSign),
    z: cleanZero(geom.normal.z * swingSign),
  };

  return {
    hinge: { x: hx, z: hz },
    radiusCm: opening.widthCm,
    uClosed,
    uOpen,
    minY: opening.sillHeightCm,
    maxY: opening.sillHeightCm + opening.heightCm,
    openingId: opening.id,
    widthCm: opening.widthCm,
  };
}

export function obbIntersectsDoorSector(
  obb: OBB,
  sector: DoorSwingSector
): boolean {
  // Vertical overlap check
  const obbMinY = obb.center.y - obb.halfSize.y;
  const obbMaxY = obb.center.y + obb.halfSize.y;
  if (obbMaxY <= sector.minY + 1e-4 || obbMinY >= sector.maxY - 1e-4) {
    return false;
  }

  // 2D horizontal projection: 4 corners in XZ plane
  const elements = obb.rotation.elements;
  const axisX = {
    x: elements[0] * obb.halfSize.x,
    z: elements[2] * obb.halfSize.x,
  };
  const axisZ = {
    x: elements[6] * obb.halfSize.z,
    z: elements[8] * obb.halfSize.z,
  };
  const cx = obb.center.x;
  const cz = obb.center.z;

  const corners = [
    { x: cx + axisX.x + axisZ.x, z: cz + axisX.z + axisZ.z },
    { x: cx - axisX.x + axisZ.x, z: cz - axisX.z + axisZ.z },
    { x: cx - axisX.x - axisZ.x, z: cz - axisX.z - axisZ.z },
    { x: cx + axisX.x - axisZ.x, z: cz + axisX.z - axisZ.z },
  ];

  const tol = 1e-4;
  const R2 = sector.radiusCm * sector.radiusCm;

  // 1. Any of the rectangle's 4 vertices lies inside the sector
  for (const pt of corners) {
    const vx = pt.x - sector.hinge.x;
    const vz = pt.z - sector.hinge.z;
    const a = vx * sector.uClosed.x + vz * sector.uClosed.z;
    const b = vx * sector.uOpen.x + vz * sector.uOpen.z;
    if (a >= -tol && b >= -tol && a * a + b * b <= R2 + tol) {
      return true;
    }
  }

  // 2. The hinge (hx, hz) is inside the rectangle
  const hdx = sector.hinge.x - cx;
  const hdz = sector.hinge.z - cz;
  const uX_len = Math.hypot(elements[0], elements[2]);
  const uZ_len = Math.hypot(elements[6], elements[8]);
  const localX = (hdx * elements[0] + hdz * elements[2]) / (uX_len || 1);
  const localZ = (hdx * elements[6] + hdz * elements[8]) / (uZ_len || 1);
  if (
    Math.abs(localX) <= obb.halfSize.x + tol &&
    Math.abs(localZ) <= obb.halfSize.z + tol
  ) {
    return true;
  }

  // 3. Any of the rectangle's 4 boundary edges intersects the straight closed segment H -> H + R * uClosed
  const closedEnd = {
    x: sector.hinge.x + sector.radiusCm * sector.uClosed.x,
    z: sector.hinge.z + sector.radiusCm * sector.uClosed.z,
  };
  for (let i = 0; i < 4; i++) {
    const c1 = corners[i];
    const c2 = corners[(i + 1) % 4];
    if (segmentsIntersect2D(c1, c2, sector.hinge, closedEnd)) {
      return true;
    }
  }

  // 4. Any of the rectangle's 4 boundary edges intersects the straight open segment H -> H + R * uOpen
  const openEnd = {
    x: sector.hinge.x + sector.radiusCm * sector.uOpen.x,
    z: sector.hinge.z + sector.radiusCm * sector.uOpen.z,
  };
  for (let i = 0; i < 4; i++) {
    const c1 = corners[i];
    const c2 = corners[(i + 1) % 4];
    if (segmentsIntersect2D(c1, c2, sector.hinge, openEnd)) {
      return true;
    }
  }

  // 5. Any of the rectangle's 4 boundary edges intersects the circular arc
  for (let i = 0; i < 4; i++) {
    const c1 = corners[i];
    const c2 = corners[(i + 1) % 4];

    const dx = c2.x - c1.x;
    const dz = c2.z - c1.z;
    const fx = c1.x - sector.hinge.x;
    const fz = c1.z - sector.hinge.z;

    const alpha = dx * dx + dz * dz;
    if (alpha < 1e-9) continue;

    const beta = 2 * (fx * dx + fz * dz);
    const gamma = fx * fx + fz * fz - R2;
    const discr = beta * beta - 4 * alpha * gamma;

    if (discr >= 0) {
      const sqrtDiscr = Math.sqrt(discr);
      const roots = [
        (-beta - sqrtDiscr) / (2 * alpha),
        (-beta + sqrtDiscr) / (2 * alpha),
      ];
      for (const t of roots) {
        if (t >= -tol && t <= 1 + tol) {
          const ix = c1.x + t * dx;
          const iz = c1.z + t * dz;
          const vx = ix - sector.hinge.x;
          const vz = iz - sector.hinge.z;
          const a = vx * sector.uClosed.x + vz * sector.uClosed.z;
          const b = vx * sector.uOpen.x + vz * sector.uOpen.z;
          if (a >= -tol && b >= -tol) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

export function evaluateFloorplanCollisions(
  data: FloorplanData
): Record<string, FurnitureCollisionReport> {
  const cornerMap = new Map(data.corners.map((c) => [c.id, c]));
  const wallMap = new Map(data.walls.map((w) => [w.id, w]));

  const furnitureOBBs = new Map<string, OBB[]>();
  for (const item of data.furniture) {
    furnitureOBBs.set(item.id, computeFurnitureOBBs(item, EPSILON_CM));
  }

  const wallEntries: Array<{ wall: Wall; start: Corner; end: Corner; obb: OBB }> = [];
  for (const wall of data.walls) {
    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) continue;
    const geom = getWallGeometry(start, end);
    if (geom.lengthCm < 1) continue;
    wallEntries.push({
      wall,
      start,
      end,
      obb: computeWallOBB(start, end, wall, EPSILON_CM),
    });
  }

  const doorSwingEntries: Array<{
    opening: WallOpening;
    sector: DoorSwingSector;
  }> = [];
  for (const op of data.openings) {
    if (!openingHasSwingArc(op.type)) continue;
    const wall = wallMap.get(op.wallId);
    if (!wall) continue;
    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) continue;
    const sector = computeDoorSwingSector(start, end, wall, op);
    if (sector) doorSwingEntries.push({ opening: op, sector });
  }

  const reports: Record<string, FurnitureCollisionReport> = {};

  for (const item of data.furniture) {
    const itemOBBs = furnitureOBBs.get(item.id)!;
    const report: FurnitureCollisionReport = {
      furnitureId: item.id,
      hasCollision: false,
      issues: [],
      clearancesCm: { leftCm: null, rightCm: null },
    };

    // 1. If snapped to a wall, run 1D dot-product wall fit check
    if (item.snappedWallId) {
      const snappedWall = wallMap.get(item.snappedWallId);
      if (snappedWall) {
        const start = cornerMap.get(snappedWall.startCornerId);
        const end = cornerMap.get(snappedWall.endCornerId);
        if (start && end) {
          const fit = checkWallFitCm(
            start,
            end,
            snappedWall,
            data.openings,
            item,
            EPSILON_CM
          );
          report.issues.push(...fit.issues);
          report.clearancesCm = fit.clearancesCm;
        }
      }
    }

    // 2. Check 3D OBB intersections against all walls
    for (const entry of wallEntries) {
      if (itemOBBs.some((obb) => obb.intersectsOBB(entry.obb))) {
        // Avoid duplicate message if already reported via snappedWallId
        const alreadyReported = report.issues.some(
          (i) => i.targetId === entry.wall.id
        );
        if (!alreadyReported) {
          report.issues.push({
            type: 'wall-intersection',
            targetId: entry.wall.id,
            message: `Schneidet Wand (${entry.wall.id}).`,
          });
        }
      }
    }

    // 3. Check intersections against exact 90° circular door swing sectors
    for (const swing of doorSwingEntries) {
      if (itemOBBs.some((obb) => obbIntersectsDoorSector(obb, swing.sector))) {
        const alreadyBlocked = report.issues.some(
          (i) => i.type === 'opening-blocked' && i.targetId === swing.opening.id
        );
        if (!alreadyBlocked) {
          report.issues.push({
            type: 'opening-blocked',
            targetId: swing.opening.id,
            message: `Steht im Schwenkbereich der Tür (${swing.opening.widthCm} cm).`,
          });
        }
      }
    }

    // 4. Check clearance zone intersections
    const clearanceOBB = computeFurnitureClearanceOBB(item, EPSILON_CM);
    if (clearanceOBB) {
      // 4a. Check intersection against all OTHER furniture items' OBBs
      for (const other of data.furniture) {
        if (other.id === item.id) continue;
        const otherOBBs = furnitureOBBs.get(other.id);
        if (!otherOBBs) continue;
        if (otherOBBs.some((obb) => clearanceOBB.intersectsOBB(obb))) {
          const alreadyReported = report.issues.some(
            (i) => i.type === 'clearance-blocked' && i.targetId === other.id
          );
          if (!alreadyReported) {
            report.issues.push({
              type: 'clearance-blocked',
              targetId: other.id,
              message: `Auszugszone vor "${item.name}" (${item.clearanceZoneCm} cm) blockiert durch "${other.name}".`,
            });
            report.hasCollision = true;
          }
        }
      }

      // 4b. Check intersection against door swing sectors
      for (const swing of doorSwingEntries) {
        if (obbIntersectsDoorSector(clearanceOBB, swing.sector)) {
          const alreadyReported = report.issues.some(
            (i) => i.type === 'clearance-blocked' && i.targetId === swing.opening.id
          );
          if (!alreadyReported) {
            report.issues.push({
              type: 'clearance-blocked',
              targetId: swing.opening.id,
              message: `Auszugszone vor "${item.name}" (${item.clearanceZoneCm} cm) blockiert durch Türschwenkbereich.`,
            });
            report.hasCollision = true;
          }
        }
      }

      // 4c. Check intersection against walls
      for (const entry of wallEntries) {
        if (clearanceOBB.intersectsOBB(entry.obb)) {
          const alreadyReported = report.issues.some(
            (i) => i.type === 'clearance-blocked' && i.targetId === entry.wall.id
          );
          if (!alreadyReported) {
            report.issues.push({
              type: 'clearance-blocked',
              targetId: entry.wall.id,
              message: `Auszugszone vor "${item.name}" (${item.clearanceZoneCm} cm) ragt in Wand hinein.`,
            });
            report.hasCollision = true;
          }
        }
      }
    }

    reports[item.id] = report;
  }

  // 4. Pairwise 3D OBB intersections between furniture items (tests each pair once)
  const nFurniture = data.furniture.length;
  for (let i = 0; i < nFurniture; i++) {
    const itemA = data.furniture[i];
    const obbsA = furnitureOBBs.get(itemA.id)!;
    for (let j = i + 1; j < nFurniture; j++) {
      const itemB = data.furniture[j];
      const obbsB = furnitureOBBs.get(itemB.id)!;
      const intersects = obbsA.some((obbA) =>
        obbsB.some((obbB) => obbA.intersectsOBB(obbB))
      );
      if (intersects) {
        reports[itemA.id].issues.push({
          type: 'furniture-intersection',
          targetId: itemB.id,
          message: `Kollidiert mit Möbelstück „${itemB.name}“.`,
        });
        reports[itemB.id].issues.push({
          type: 'furniture-intersection',
          targetId: itemA.id,
          message: `Kollidiert mit Möbelstück „${itemA.name}“.`,
        });
      }
    }
  }

  for (const rep of Object.values(reports)) {
    rep.hasCollision = rep.issues.length > 0;
  }

  return reports;
}
