import { Corner, Wall } from './types';

export const DIMENSION_LINE_COLOR = '#94a3b8';
export const DIMENSION_LINE_THICKNESS_CM = 0.5;
export const DIMENSION_ELEVATION_Y_CM = 0.5;
export const DIMENSION_TICK_LENGTH_CM = 16;
export const DIMENSION_TICK_THICKNESS_CM = 0.8;

export function formatDimension(cm: number, unit: 'cm' | 'm' = 'cm'): string {
  const roundedCm = Math.round(cm);
  if (unit === 'm') {
    const meters = (roundedCm / 100).toFixed(2).replace('.', ',');
    return `${meters} m`;
  }
  const str = roundedCm.toString();
  if (str.length > 3) {
    const formatted = str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${formatted} cm`;
  }
  return `${str} cm`;
}

export interface DimensionSegment {
  id: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
  lengthCm: number;
  textPosition: { x: number; z: number };
  textRotation: number;
  formattedLength: string;
  isVertical?: boolean;
}

export interface DimensionTick {
  id: string;
  position: { x: number; z: number };
  rotationY: number;
  lengthCm: number;
}

export interface DimensionExtensionLine {
  id: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
  isVertical?: boolean;
}

export interface DimensionSideChain {
  side: 'top' | 'bottom' | 'left' | 'right';
  segments: DimensionSegment[];
  ticks: DimensionTick[];
  extensionLines: DimensionExtensionLine[];
}

export interface ExteriorDimensionChains {
  chains: DimensionSideChain[];
  overallBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    widthCm: number;
    depthCm: number;
  };
}

export interface ComputeDimensionOptions {
  offsetCm?: number;
  unit?: 'cm' | 'm';
}

function dedupeCoords(coords: number[], min: number, max: number): number[] {
  const raw = Array.from(new Set(coords)).sort((a, b) => a - b);
  const result: number[] = [];
  for (const v of raw) {
    if (v < min - 2 || v > max + 2) continue;
    if (result.length === 0 || v - result[result.length - 1] >= 15) {
      result.push(v);
    }
  }
  if (result.length === 0 || result[0] > min + 2) {
    result.unshift(min);
  } else {
    result[0] = min;
  }
  if (result[result.length - 1] < max - 2) {
    result.push(max);
  } else {
    result[result.length - 1] = max;
  }
  return result;
}

interface SideConfig {
  side: 'top' | 'bottom' | 'left' | 'right';
  isAlongX: boolean;
  boundaryCoord: number;
  directionSign: number; // -1 for top/left, +1 for bottom/right
  startMin: number;
  endMax: number;
  totalSpan: number;
  candidateCoords: number[];
  offset: number;
  unit: 'cm' | 'm';
  textRotation: number;
}

function buildSideDimensionChain(cfg: SideConfig): DimensionSideChain {
  const {
    side,
    isAlongX,
    boundaryCoord,
    directionSign,
    startMin,
    endMax,
    totalSpan,
    candidateCoords,
    offset,
    unit,
    textRotation,
  } = cfg;

  const coords = dedupeCoords(
    [startMin, endMax, ...candidateCoords],
    startMin,
    endMax
  );

  const segments: DimensionSegment[] = [];
  const ticks: DimensionTick[] = [];
  const extensionLines: DimensionExtensionLine[] = [];

  const makePoint = (coordAlong: number, coordPerp: number) =>
    isAlongX
      ? { x: coordAlong, z: coordPerp }
      : { x: coordPerp, z: coordAlong };

  if (coords.length > 2) {
    // Multi-segment inner chain (sub-spans)
    const dim1 = boundaryCoord + directionSign * (offset * 0.85);

    for (let i = 0; i < coords.length - 1; i++) {
      const c1 = coords[i];
      const c2 = coords[i + 1];
      const len = c2 - c1;
      const mid = (c1 + c2) / 2;
      const textPerp = dim1 + directionSign * 16;

      segments.push({
        id: `${side}-sub-${i}`,
        start: makePoint(c1, dim1),
        end: makePoint(c2, dim1),
        lengthCm: len,
        textPosition: makePoint(mid, textPerp),
        textRotation,
        formattedLength: formatDimension(len, unit),
        isVertical: !isAlongX,
      });

      ticks.push({
        id: `tick-${side}-${c1}`,
        position: makePoint(c1, dim1),
        rotationY: Math.PI / 4,
        lengthCm: DIMENSION_TICK_LENGTH_CM,
      });

      extensionLines.push({
        id: `ext-${side}-${c1}`,
        start: makePoint(c1, boundaryCoord),
        end: makePoint(c1, dim1 + directionSign * 8),
        isVertical: isAlongX,
      });
    }

    const lastCoord = coords[coords.length - 1];
    ticks.push({
      id: `tick-${side}-${lastCoord}`,
      position: makePoint(lastCoord, dim1),
      rotationY: Math.PI / 4,
      lengthCm: DIMENSION_TICK_LENGTH_CM,
    });
    extensionLines.push({
      id: `ext-${side}-${lastCoord}`,
      start: makePoint(lastCoord, boundaryCoord),
      end: makePoint(lastCoord, dim1 + directionSign * 8),
      isVertical: isAlongX,
    });

    // Outer overall chain
    const dim2 = boundaryCoord + directionSign * (offset * 1.5);
    const midOverall = (startMin + endMax) / 2;
    const textPerpOverall = dim2 + directionSign * 16;

    segments.push({
      id: `${side}-overall`,
      start: makePoint(startMin, dim2),
      end: makePoint(endMax, dim2),
      lengthCm: totalSpan,
      textPosition: makePoint(midOverall, textPerpOverall),
      textRotation,
      formattedLength: formatDimension(totalSpan, unit),
      isVertical: !isAlongX,
    });

    ticks.push(
      {
        id: `tick-${side}-overall-start`,
        position: makePoint(startMin, dim2),
        rotationY: Math.PI / 4,
        lengthCm: DIMENSION_TICK_LENGTH_CM,
      },
      {
        id: `tick-${side}-overall-end`,
        position: makePoint(endMax, dim2),
        rotationY: Math.PI / 4,
        lengthCm: DIMENSION_TICK_LENGTH_CM,
      }
    );

    extensionLines.push(
      {
        id: `ext-${side}-overall-start`,
        start: makePoint(startMin, dim1),
        end: makePoint(startMin, dim2 + directionSign * 8),
        isVertical: isAlongX,
      },
      {
        id: `ext-${side}-overall-end`,
        start: makePoint(endMax, dim1),
        end: makePoint(endMax, dim2 + directionSign * 8),
        isVertical: isAlongX,
      }
    );
  } else {
    // Single overall chain
    const dim = boundaryCoord + directionSign * offset;
    const mid = (startMin + endMax) / 2;
    const textPerp = dim + directionSign * 16;

    segments.push({
      id: `${side}-single`,
      start: makePoint(startMin, dim),
      end: makePoint(endMax, dim),
      lengthCm: totalSpan,
      textPosition: makePoint(mid, textPerp),
      textRotation,
      formattedLength: formatDimension(totalSpan, unit),
      isVertical: !isAlongX,
    });

    ticks.push(
      {
        id: `tick-${side}-start`,
        position: makePoint(startMin, dim),
        rotationY: Math.PI / 4,
        lengthCm: DIMENSION_TICK_LENGTH_CM,
      },
      {
        id: `tick-${side}-end`,
        position: makePoint(endMax, dim),
        rotationY: Math.PI / 4,
        lengthCm: DIMENSION_TICK_LENGTH_CM,
      }
    );

    extensionLines.push(
      {
        id: `ext-${side}-start`,
        start: makePoint(startMin, boundaryCoord),
        end: makePoint(startMin, dim + directionSign * 8),
        isVertical: isAlongX,
      },
      {
        id: `ext-${side}-end`,
        start: makePoint(endMax, boundaryCoord),
        end: makePoint(endMax, dim + directionSign * 8),
        isVertical: isAlongX,
      }
    );
  }

  return {
    side,
    segments,
    ticks,
    extensionLines,
  };
}

/**
 * Computes the 4 exterior perimeter dimension chains (top, bottom, left, right)
 * based on convex room boundary and exterior corner coordinates.
 *
 * @param corners Array of floorplan corner points
 * @param _walls Preserved for backwards compatibility with existing callers and tests
 * @param roomBounds Bounding box and centroid of the floorplan
 * @param options Dimension styling options (offset, units, precision)
 */
export function computeExteriorDimensionChains(
  corners: Corner[],
  _walls?: Wall[],
  roomBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    cx: number;
    cz: number;
  } = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, cx: 0, cz: 0 },
  options?: ComputeDimensionOptions
): ExteriorDimensionChains {
  const widthCm = roomBounds.maxX - roomBounds.minX;
  const depthCm = roomBounds.maxZ - roomBounds.minZ;

  const defaultResult: ExteriorDimensionChains = {
    chains: [],
    overallBounds: {
      minX: roomBounds.minX,
      maxX: roomBounds.maxX,
      minZ: roomBounds.minZ,
      maxZ: roomBounds.maxZ,
      widthCm,
      depthCm,
    },
  };

  if (corners.length < 2 || widthCm <= 0 || depthCm <= 0) {
    return defaultResult;
  }

  const offset = options?.offsetCm ?? 60;
  const unit = options?.unit ?? 'cm';
  const { minX, maxX, minZ, maxZ } = roomBounds;

  const topCorners = corners
    .filter((c) => Math.abs(c.z - minZ) < 5)
    .map((c) => Math.round(c.x));
  const bottomCorners = corners
    .filter((c) => Math.abs(c.z - maxZ) < 5)
    .map((c) => Math.round(c.x));
  const leftCorners = corners
    .filter((c) => Math.abs(c.x - minX) < 5)
    .map((c) => Math.round(c.z));
  const rightCorners = corners
    .filter((c) => Math.abs(c.x - maxX) < 5)
    .map((c) => Math.round(c.z));

  const topChain = buildSideDimensionChain({
    side: 'top',
    isAlongX: true,
    boundaryCoord: minZ,
    directionSign: -1,
    startMin: minX,
    endMax: maxX,
    totalSpan: widthCm,
    candidateCoords: topCorners,
    offset,
    unit,
    textRotation: 0,
  });

  const bottomChain = buildSideDimensionChain({
    side: 'bottom',
    isAlongX: true,
    boundaryCoord: maxZ,
    directionSign: 1,
    startMin: minX,
    endMax: maxX,
    totalSpan: widthCm,
    candidateCoords: bottomCorners,
    offset,
    unit,
    textRotation: 0,
  });

  const leftChain = buildSideDimensionChain({
    side: 'left',
    isAlongX: false,
    boundaryCoord: minX,
    directionSign: -1,
    startMin: minZ,
    endMax: maxZ,
    totalSpan: depthCm,
    candidateCoords: leftCorners,
    offset,
    unit,
    textRotation: Math.PI / 2,
  });

  const rightChain = buildSideDimensionChain({
    side: 'right',
    isAlongX: false,
    boundaryCoord: maxX,
    directionSign: 1,
    startMin: minZ,
    endMax: maxZ,
    totalSpan: depthCm,
    candidateCoords: rightCorners,
    offset,
    unit,
    textRotation: -Math.PI / 2,
  });

  return {
    chains: [topChain, bottomChain, leftChain, rightChain],
    overallBounds: {
      minX,
      maxX,
      minZ,
      maxZ,
      widthCm,
      depthCm,
    },
  };
}
