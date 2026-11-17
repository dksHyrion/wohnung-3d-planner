import type { Corner, Point2D, Wall, WallOpening } from '../types';
import { getWallGeometry } from '../wallMath';
import { computeWallMiterMap } from '../wallMiter';

export interface WallPlanPolygon {
  wallId: string;
  polygon: [Point2D, Point2D, Point2D, Point2D];
}

/**
 * Computes mitered 2D wall polygons split cleanly around all openings on each wall.
 * Shared by scaled SVG export and CAD DXF export so walls have sharp corners and
 * hollow opening apertures without white knockout strokes.
 */
export function computeWallPlanPolygons(
  corners: Corner[],
  walls: Wall[],
  openings: WallOpening[]
): WallPlanPolygon[] {
  const cornerMap = new Map(corners.map((c) => [c.id, c]));
  const miterMap = computeWallMiterMap(corners, walls);

  const openingsByWall = new Map<string, Array<{ start: number; end: number }>>();
  for (const op of openings) {
    const list = openingsByWall.get(op.wallId) ?? [];
    list.push({
      start: op.offsetFromStartCm,
      end: op.offsetFromStartCm + op.widthCm,
    });
    openingsByWall.set(op.wallId, list);
  }

  const result: WallPlanPolygon[] = [];

  for (const wall of walls) {
    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) continue;

    const geom = getWallGeometry(start, end);
    if (geom.lengthCm < 1) continue;

    const miter = miterMap.get(wall.id);
    const halfT = wall.thicknessCm / 2;

    const rawOps = (openingsByWall.get(wall.id) ?? [])
      .map((op) => ({
        start: Math.max(0, Math.min(geom.lengthCm, op.start)),
        end: Math.max(0, Math.min(geom.lengthCm, op.end)),
      }))
      .filter((op) => op.end - op.start > 0.5)
      .sort((a, b) => a.start - b.start);

    const spans: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (const op of rawOps) {
      if (op.start > cursor + 0.5) {
        spans.push({ start: cursor, end: op.start });
      }
      cursor = Math.max(cursor, op.end);
    }
    if (cursor < geom.lengthCm - 0.5) {
      spans.push({ start: cursor, end: geom.lengthCm });
    }

    for (const span of spans) {
      const touchesStart = span.start < 0.5;
      const touchesEnd = span.end > geom.lengthCm - 0.5;

      const sPos = span.start - (touchesStart && miter ? miter.startPosExt : 0);
      const sNeg = span.start - (touchesStart && miter ? miter.startNegExt : 0);
      const ePos = span.end + (touchesEnd && miter ? miter.endPosExt : 0);
      const eNeg = span.end + (touchesEnd && miter ? miter.endNegExt : 0);

      const pt = (along: number, normalSign: 1 | -1): Point2D => ({
        x: start.x + geom.tangent.x * along + geom.normal.x * normalSign * halfT,
        z: start.z + geom.tangent.z * along + geom.normal.z * normalSign * halfT,
      });

      result.push({
        wallId: wall.id,
        polygon: [
          pt(sPos, 1),
          pt(ePos, 1),
          pt(eNeg, -1),
          pt(sNeg, -1),
        ],
      });
    }
  }

  return result;
}
