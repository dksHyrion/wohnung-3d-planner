import type { WallOpening } from './types';

export interface WallSubSegment {
  key: string;
  centerAlongCm: number;
  widthCm: number;
  centerYCm: number;
  heightCm: number;
}

/**
 * Splits a wall of `wallLengthCm` x `wallHeightCm` into exact rectangular box segments
 * around any doors, windows, or passages on the wall.
 */
export function computeWallSubSegments(
  wallLengthCm: number,
  wallHeightCm: number,
  openings: WallOpening[]
): WallSubSegment[] {
  if (openings.length === 0) {
    return [
      {
        key: 'full',
        centerAlongCm: wallLengthCm / 2,
        widthCm: wallLengthCm,
        centerYCm: wallHeightCm / 2,
        heightCm: wallHeightCm,
      },
    ];
  }

  const sorted = [...openings]
    .map((op) => ({
      ...op,
      start: Math.max(0, Math.min(wallLengthCm, op.offsetFromStartCm)),
      end: Math.max(
        0,
        Math.min(wallLengthCm, op.offsetFromStartCm + op.widthCm)
      ),
    }))
    .filter((op) => op.end - op.start > 1)
    .sort((a, b) => a.start - b.start);

  const segments: WallSubSegment[] = [];
  let cursor = 0;

  for (const op of sorted) {
    if (op.start > cursor + 0.5) {
      const segW = op.start - cursor;
      segments.push({
        key: `left-${op.id}`,
        centerAlongCm: cursor + segW / 2,
        widthCm: segW,
        centerYCm: wallHeightCm / 2,
        heightCm: wallHeightCm,
      });
    }

    const opW = op.end - op.start;
    const opCenterAlong = op.start + opW / 2;

    // Sill below opening (e.g. window sill)
    if (op.sillHeightCm > 0.5) {
      const sillH = Math.min(wallHeightCm, op.sillHeightCm);
      segments.push({
        key: `sill-${op.id}`,
        centerAlongCm: opCenterAlong,
        widthCm: opW,
        centerYCm: sillH / 2,
        heightCm: sillH,
      });
    }

    // Lintel above opening
    const opTop = op.sillHeightCm + op.heightCm;
    if (opTop < wallHeightCm - 0.5) {
      const lintelH = wallHeightCm - opTop;
      segments.push({
        key: `lintel-${op.id}`,
        centerAlongCm: opCenterAlong,
        widthCm: opW,
        centerYCm: opTop + lintelH / 2,
        heightCm: lintelH,
      });
    }

    cursor = Math.max(cursor, op.end);
  }

  if (cursor < wallLengthCm - 0.5) {
    const rightW = wallLengthCm - cursor;
    segments.push({
      key: 'right-end',
      centerAlongCm: cursor + rightW / 2,
      widthCm: rightW,
      centerYCm: wallHeightCm / 2,
      heightCm: wallHeightCm,
    });
  }

  return segments;
}
