import type { Point2D } from './types';

function ccw(a: Point2D, b: Point2D, c: Point2D): number {
  return (c.z - a.z) * (b.x - a.x) - (b.z - a.z) * (c.x - a.x);
}

function onSegment(p: Point2D, a: Point2D, b: Point2D): boolean {
  return (
    p.x >= Math.min(a.x, b.x) - 1e-4 &&
    p.x <= Math.max(a.x, b.x) + 1e-4 &&
    p.z >= Math.min(a.z, b.z) - 1e-4 &&
    p.z <= Math.max(a.z, b.z) + 1e-4
  );
}

/**
 * Canonical 2D segment intersection test (inclusive of collinear touching and endpoint contact).
 */
export function segmentsIntersect2D(
  p1: Point2D,
  p2: Point2D,
  q1: Point2D,
  q2: Point2D
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

/**
 * Computes the strict interior intersection point between segments p1->p2 and q1->q2.
 * Returns null if segments are parallel/collinear or intersect only near endpoints.
 */
export function segmentInteriorIntersection2D(
  p1: Point2D,
  p2: Point2D,
  q1: Point2D,
  q2: Point2D,
  minEndpointClearanceCm = 5
): { x: number; z: number; t: number; u: number } | null {
  const dx1 = p2.x - p1.x;
  const dz1 = p2.z - p1.z;
  const dx2 = q2.x - q1.x;
  const dz2 = q2.z - q1.z;

  const len1 = Math.hypot(dx1, dz1);
  const len2 = Math.hypot(dx2, dz2);
  if (len1 < minEndpointClearanceCm * 2 || len2 < minEndpointClearanceCm * 2) {
    return null;
  }

  const denom = dx1 * dz2 - dz1 * dx2;
  if (Math.abs(denom) < 1e-6) return null;

  const qpx = q1.x - p1.x;
  const qpz = q1.z - p1.z;

  const t = (qpx * dz2 - qpz * dx2) / denom;
  const u = (qpx * dz1 - qpz * dx1) / denom;

  const tMargin = minEndpointClearanceCm / len1;
  const uMargin = minEndpointClearanceCm / len2;

  if (t <= tMargin || t >= 1 - tMargin || u <= uMargin || u >= 1 - uMargin) {
    return null;
  }

  return {
    x: Number((p1.x + t * dx1).toFixed(2)),
    z: Number((p1.z + t * dz1).toFixed(2)),
    t,
    u,
  };
}

/**
 * Ray-casting point-in-polygon test in the XZ floor plane.
 */
export function pointInPolygonXZ(
  px: number,
  pz: number,
  polygon: readonly Point2D[]
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;
    const intersect =
      zi > pz !== zj > pz &&
      px < ((xj - xi) * (pz - zi)) / (zj - zi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Rotates a local XZ offset `(lx, lz)` around `(cx, cz)` using Three.js `+Y` rotation convention.
 */
export function rotatePointXZ(
  cx: number,
  cz: number,
  rotationYDeg: number,
  lx: number,
  lz: number
): Point2D {
  const rad = (rotationYDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cx + lx * cos + lz * sin,
    z: cz - lx * sin + lz * cos,
  };
}
