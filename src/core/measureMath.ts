import { Corner, Wall, FurnitureItem, MeasureResult, FurnitureClearanceResult } from './types';
import { getWallGeometry } from './wallMath';
import { layoutFurnitureParts, LocalPart } from './furnitureShapes';

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

export interface Point2D {
  x: number;
  z: number;
}

export function getFurniture2DCorners(item: FurnitureItem): Point2D[] {
  const halfW = item.widthCm / 2;
  const halfD = item.depthCm / 2;
  const rotRad = (item.rotationYDeg * Math.PI) / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);

  // Local offsets for the 4 corners
  const localCorners: [number, number][] = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, halfD],
    [-halfW, halfD],
  ];

  return localCorners.map(([lx, lz]) => {
    // In Three.js makeRotationY:
    // x' = x*cos + z*sin
    // z' = -x*sin + z*cos
    const rx = lx * cos + lz * sin;
    const rz = -lx * sin + lz * cos;
    return {
      x: item.x + rx,
      z: item.z + rz,
    };
  });
}

function pointToSegmentDistance(
  p: Point2D,
  a: Point2D,
  b: Point2D
): { distance: number; closestPointOnSegment: Point2D } {
  const abX = b.x - a.x;
  const abZ = b.z - a.z;
  const lenSq = abX * abX + abZ * abZ;

  if (lenSq === 0) {
    return {
      distance: Math.hypot(p.x - a.x, p.z - a.z),
      closestPointOnSegment: { ...a },
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
  };
}

function checkSATOverlap(polyA: Point2D[], polyB: Point2D[]): boolean {
  const polys = [polyA, polyB];
  for (let i = 0; i < polys.length; i++) {
    const poly = polys[i];
    for (let j = 0; j < poly.length; j++) {
      const p1 = poly[j];
      const p2 = poly[(j + 1) % poly.length];
      const edgeX = p2.x - p1.x;
      const edgeZ = p2.z - p1.z;
      const normal = { x: -edgeZ, z: edgeX };

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

      if (maxA < minB || maxB < minA) {
        return false; // Separating axis found
      }
    }
  }
  return true; // Overlapping
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

export function computeFurnitureToWallDistanceCm(
  f: FurnitureItem,
  wall: Wall,
  corners: Corner[]
): number {
  const start = corners.find((c) => c.id === wall.startCornerId);
  const end = corners.find((c) => c.id === wall.endCornerId);
  if (!start || !end) return 0;

  const polys = getFurniturePartPolygons2D(f);
  let minCenterlineDist = Infinity;

  for (const fCorners of polys) {
    for (const pt of fCorners) {
      const res = pointToSegmentDistance(pt, start, end);
      if (res.distance < minCenterlineDist) {
        minCenterlineDist = res.distance;
      }
    }
  }

  const clearance = minCenterlineDist - wall.thicknessCm / 2;
  return Number(Math.max(0, clearance).toFixed(1));
}
