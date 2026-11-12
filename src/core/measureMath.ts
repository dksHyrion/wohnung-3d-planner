import {
  Corner,
  Wall,
  FurnitureItem,
  MeasureResult,
  FurnitureClearanceResult,
  Point2D,
  EPSILON_CM,
} from './types';
import { getWallGeometry } from './wallMath';
import { layoutFurnitureParts, LocalPart } from './furnitureShapes';

export type { Point2D };

export function formatMeasureDimension(cm: number): string {
  const rounded = Math.round(cm * 10) / 10;
  if (rounded >= 1000) {
    const meters = (rounded / 100).toFixed(2).replace('.', ',');
    return `${meters} m`;
  }
  return `${Math.round(rounded)} cm`;
}

export function computePointDistanceCm(
  p1: { x: number; z: number },
  p2: { x: number; z: number }
): MeasureResult {
  const dx = Math.abs(p2.x - p1.x);
  const dz = Math.abs(p2.z - p1.z);
  const distance = Math.hypot(p2.x - p1.x, p2.z - p1.z);
  return {
    start: { x: p1.x, z: p1.z },
    end: { x: p2.x, z: p2.z },
    distanceCm: Number(distance.toFixed(1)),
    dxCm: Number(dx.toFixed(1)),
    dzCm: Number(dz.toFixed(1)),
    formattedDistance: formatMeasureDimension(distance),
  };
}

export function pointToSegmentDistance(
  p: Point2D,
  a: Point2D,
  b: Point2D
): { distance: number; closestPointOnSegment: Point2D; t: number } {
  const abX = b.x - a.x;
  const abZ = b.z - a.z;
  const lenSq = abX * abX + abZ * abZ;

  if (lenSq === 0) {
    return {
      distance: Math.hypot(p.x - a.x, p.z - a.z),
      closestPointOnSegment: { ...a },
      t: 0,
    };
  }

  const apX = p.x - a.x;
  const apZ = p.z - a.z;
  let t = (apX * abX + apZ * abZ) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closest = {
    x: a.x + t * abX,
    z: a.z + t * abZ,
  };

  return {
    distance: Math.hypot(p.x - closest.x, p.z - closest.z),
    closestPointOnSegment: closest,
    t,
  };
}

export function checkSATOverlap(
  polyA: Point2D[],
  polyB: Point2D[],
  toleranceCm = EPSILON_CM
): boolean {
  const polys = [polyA, polyB];
  for (let i = 0; i < polys.length; i++) {
    const poly = polys[i];
    for (let j = 0; j < poly.length; j++) {
      const p1 = poly[j];
      const p2 = poly[(j + 1) % poly.length];
      const edgeX = p2.x - p1.x;
      const edgeZ = p2.z - p1.z;
      const len = Math.hypot(edgeX, edgeZ);
      if (len < 1e-9) continue;
      const normal = { x: -edgeZ / len, z: edgeX / len };

      let minA = Infinity;
      let maxA = -Infinity;
      for (const p of polyA) {
        const proj = p.x * normal.x + p.z * normal.z;
        if (proj < minA) minA = proj;
        if (proj > maxA) maxA = proj;
      }

      let minB = Infinity;
      let maxB = -Infinity;
      for (const p of polyB) {
        const proj = p.x * normal.x + p.z * normal.z;
        if (proj < minB) minB = proj;
        if (proj > maxB) maxB = proj;
      }

      const penetration = Math.min(maxA, maxB) - Math.max(minA, minB);
      if (penetration <= toleranceCm) {
        return false; // Separating axis found (gap or flush within tolerance)
      }
    }
  }
  return true; // Overlapping by more than toleranceCm on all axes
}

export function getPart2DCorners(item: FurnitureItem, part: LocalPart): Point2D[] {
  const halfW = part.widthCm / 2;
  const halfD = part.depthCm / 2;
  const rotRad = (item.rotationYDeg * Math.PI) / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);

  const localCorners: [number, number][] = [
    [part.cx - halfW, part.cz - halfD],
    [part.cx + halfW, part.cz - halfD],
    [part.cx + halfW, part.cz + halfD],
    [part.cx - halfW, part.cz + halfD],
  ];

  return localCorners.map(([lx, lz]) => ({
    x: item.x + lx * cos + lz * sin,
    z: item.z - lx * sin + lz * cos,
  }));
}

export function getFurniturePartPolygons2D(item: FurnitureItem): Point2D[][] {
  return layoutFurnitureParts(item).map((part) => getPart2DCorners(item, part));
}

export function computeFurnitureClearanceCm(
  f1: FurnitureItem,
  f2: FurnitureItem
): FurnitureClearanceResult {
  const polys1 = getFurniturePartPolygons2D(f1);
  const polys2 = getFurniturePartPolygons2D(f2);

  for (const poly1 of polys1) {
    for (const poly2 of polys2) {
      if (checkSATOverlap(poly1, poly2)) {
        return {
          clearanceCm: 0,
          isOverlapping: true,
          closestPoint1: { x: f1.x, z: f1.z },
          closestPoint2: { x: f2.x, z: f2.z },
        };
      }
    }
  }

  let minDistance = Infinity;
  let bestP1: Point2D = polys1[0][0];
  let bestP2: Point2D = polys2[0][0];

  for (const poly1 of polys1) {
    for (const poly2 of polys2) {
      // 1. Distance from vertices of poly1 to edges of poly2
      for (const v1 of poly1) {
        for (let j = 0; j < poly2.length; j++) {
          const eStart = poly2[j];
          const eEnd = poly2[(j + 1) % poly2.length];
          const res = pointToSegmentDistance(v1, eStart, eEnd);
          if (res.distance < minDistance) {
            minDistance = res.distance;
            bestP1 = v1;
            bestP2 = res.closestPointOnSegment;
          }
        }
      }

      // 2. Distance from vertices of poly2 to edges of poly1
      for (const v2 of poly2) {
        for (let j = 0; j < poly1.length; j++) {
          const eStart = poly1[j];
          const eEnd = poly1[(j + 1) % poly1.length];
          const res = pointToSegmentDistance(v2, eStart, eEnd);
          if (res.distance < minDistance) {
            minDistance = res.distance;
            bestP1 = res.closestPointOnSegment;
            bestP2 = v2;
          }
        }
      }
    }
  }

  return {
    clearanceCm: Number(minDistance.toFixed(1)),
    isOverlapping: false,
    closestPoint1: { x: Number(bestP1.x.toFixed(1)), z: Number(bestP1.z.toFixed(1)) },
    closestPoint2: { x: Number(bestP2.x.toFixed(1)), z: Number(bestP2.z.toFixed(1)) },
  };
}

function ccw(p1: Point2D, p2: Point2D, p3: Point2D): number {
  return (p2.x - p1.x) * (p3.z - p1.z) - (p2.z - p1.z) * (p3.x - p1.x);
}

export function segmentsIntersect2D(
  a1: Point2D,
  a2: Point2D,
  b1: Point2D,
  b2: Point2D
): boolean {
  const d1 = ccw(a1, a2, b1);
  const d2 = ccw(a1, a2, b2);
  const d3 = ccw(b1, b2, a1);
  const d4 = ccw(b1, b2, a2);

  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

export function isPointInsideConvexPolygon(pt: Point2D, poly: Point2D[]): boolean {
  if (poly.length < 3) return false;
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    const c = ccw(p1, p2, pt);
    if (Math.abs(c) < 1e-7) continue;
    if (sign === 0) {
      sign = c > 0 ? 1 : -1;
    } else if ((c > 0 ? 1 : -1) !== sign) {
      return false;
    }
  }
  return true;
}

export interface WallClearanceResult {
  clearanceCm: number;
  isCrossing: boolean;
  closestPointOnFurniture: Point2D;
  closestPointOnWall: Point2D;
}

export function computeFurnitureToWallClearance(
  f: FurnitureItem,
  wall: Wall,
  corners: Corner[] | Map<string, Corner>
): WallClearanceResult {
  const start = Array.isArray(corners)
    ? corners.find((c) => c.id === wall.startCornerId)
    : corners.get(wall.startCornerId);
  const end = Array.isArray(corners)
    ? corners.find((c) => c.id === wall.endCornerId)
    : corners.get(wall.endCornerId);

  if (!start || !end) {
    return {
      clearanceCm: 0,
      isCrossing: false,
      closestPointOnFurniture: { x: f.x, z: f.z },
      closestPointOnWall: { x: 0, z: 0 },
    };
  }

  const startPt: Point2D = { x: start.x, z: start.z };
  const endPt: Point2D = { x: end.x, z: end.z };
  const halfThickness = (wall.thicknessCm || 15) / 2;

  const polys = getFurniturePartPolygons2D(f);

  let minCenterlineDist = Infinity;
  let bestFurniturePt: Point2D = { x: f.x, z: f.z };
  let bestCenterlinePt: Point2D = startPt;
  let isCrossing = false;

  for (const poly of polys) {
    // 1. Check if wall centerline intersects any polygon edge
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      if (segmentsIntersect2D(startPt, endPt, p1, p2)) {
        isCrossing = true;
        minCenterlineDist = 0;
        bestFurniturePt = { x: (p1.x + p2.x) / 2, z: (p1.z + p2.z) / 2 };
        bestCenterlinePt = bestFurniturePt;
        break;
      }
    }
    if (isCrossing) break;

    // 2. Check if either wall endpoint is inside the polygon
    if (isPointInsideConvexPolygon(startPt, poly) || isPointInsideConvexPolygon(endPt, poly)) {
      isCrossing = true;
      minCenterlineDist = 0;
      bestFurniturePt = isPointInsideConvexPolygon(startPt, poly) ? startPt : endPt;
      bestCenterlinePt = bestFurniturePt;
      break;
    }

    // 3. Distance from polygon vertices to wall segment
    for (const pt of poly) {
      const res = pointToSegmentDistance(pt, startPt, endPt);
      if (res.distance < minCenterlineDist) {
        minCenterlineDist = res.distance;
        bestFurniturePt = pt;
        bestCenterlinePt = res.closestPointOnSegment;
      }
    }

    // 4. Distance from wall endpoints to polygon edges
    for (const wallPt of [startPt, endPt]) {
      for (let i = 0; i < poly.length; i++) {
        const p1 = poly[i];
        const p2 = poly[(i + 1) % poly.length];
        const res = pointToSegmentDistance(wallPt, p1, p2);
        if (res.distance < minCenterlineDist) {
          minCenterlineDist = res.distance;
          bestFurniturePt = res.closestPointOnSegment;
          bestCenterlinePt = wallPt;
        }
      }
    }
  }

  if (isCrossing) {
    return {
      clearanceCm: 0,
      isCrossing: true,
      closestPointOnFurniture: bestFurniturePt,
      closestPointOnWall: bestCenterlinePt,
    };
  }

  const rawClearance = minCenterlineDist - halfThickness;
  const clearanceCm = Number(Math.max(0, rawClearance).toFixed(1));

  // Closest point on wall surface
  const dx = bestFurniturePt.x - bestCenterlinePt.x;
  const dz = bestFurniturePt.z - bestCenterlinePt.z;
  const dLen = Math.hypot(dx, dz);
  let wallSurfacePt: Point2D = bestCenterlinePt;
  if (dLen > 1e-4) {
    const shift = Math.min(halfThickness, dLen);
    wallSurfacePt = {
      x: Number((bestCenterlinePt.x + (dx / dLen) * shift).toFixed(1)),
      z: Number((bestCenterlinePt.z + (dz / dLen) * shift).toFixed(1)),
    };
  }

  return {
    clearanceCm,
    isCrossing: false,
    closestPointOnFurniture: {
      x: Number(bestFurniturePt.x.toFixed(1)),
      z: Number(bestFurniturePt.z.toFixed(1)),
    },
    closestPointOnWall: wallSurfacePt,
  };
}

export function computeFurnitureToWallDistanceCm(
  f: FurnitureItem,
  wall: Wall,
  corners: Corner[] | Map<string, Corner>
): number {
  return computeFurnitureToWallClearance(f, wall, corners).clearanceCm;
}
