import {
  AlignmentGuide,
  AlignmentGuideKind,
  Corner,
  FurnitureItem,
  Wall,
} from './types';
import { getWallGeometry } from './wallMath';

export const DEFAULT_FURNITURE_SNAP_THRESHOLD_CM = 8;

export interface FurnitureWorldBoundsXZ {
  minX: number;
  centerX: number;
  maxX: number;
  minZ: number;
  centerZ: number;
  maxZ: number;
  halfSpanX: number;
  halfSpanZ: number;
}

export function getFurnitureWorldBoundsXZ(
  item: FurnitureItem
): FurnitureWorldBoundsXZ {
  const rad = (item.rotationYDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const halfSpanX = (item.widthCm * cos + item.depthCm * sin) / 2;
  const halfSpanZ = (item.widthCm * sin + item.depthCm * cos) / 2;

  return {
    minX: Number((item.x - halfSpanX).toFixed(2)),
    centerX: item.x,
    maxX: Number((item.x + halfSpanX).toFixed(2)),
    minZ: Number((item.z - halfSpanZ).toFixed(2)),
    centerZ: item.z,
    maxZ: Number((item.z + halfSpanZ).toFixed(2)),
    halfSpanX,
    halfSpanZ,
  };
}

export interface FurnitureAlignmentResult {
  x: number;
  z: number;
  guides: AlignmentGuide[];
}

export function computeFurnitureAlignment(
  candidate: FurnitureItem,
  allFurniture: FurnitureItem[],
  corners: Corner[],
  walls: Wall[],
  thresholdCm: number = DEFAULT_FURNITURE_SNAP_THRESHOLD_CM
): FurnitureAlignmentResult {
  const others = allFurniture.filter(
    (f) =>
      f.id !== candidate.id &&
      f.attachedToId !== candidate.id &&
      candidate.attachedToId !== f.id
  );

  if (others.length === 0 || thresholdCm <= 0) {
    return { x: candidate.x, z: candidate.z, guides: [] };
  }

  // Case 1: Candidate is snapped to a wall -> snap along the wall tangent
  if (candidate.snappedWallId) {
    const wall = walls.find((w) => w.id === candidate.snappedWallId);
    const cornerMap = new Map(corners.map((c) => [c.id, c]));
    const start = wall ? cornerMap.get(wall.startCornerId) : undefined;
    const end = wall ? cornerMap.get(wall.endCornerId) : undefined;

    if (wall && start && end) {
      const geom = getWallGeometry(start, end);
      if (geom.lengthCm >= 10) {
        const candAlong =
          (candidate.x - start.x) * geom.tangent.x +
          (candidate.z - start.z) * geom.tangent.z;
        const candHalfW = candidate.widthCm / 2;

        let bestMatch: {
          targetAlong: number;
          diff: number;
          kind: AlignmentGuideKind;
          label: string;
          other: FurnitureItem;
        } | null = null;

        for (const other of others) {
          if (other.snappedWallId !== candidate.snappedWallId) continue;

          const otherAlong =
            (other.x - start.x) * geom.tangent.x +
            (other.z - start.z) * geom.tangent.z;
          const otherHalfW = other.widthCm / 2;
          const otherMin = otherAlong - otherHalfW;
          const otherMax = otherAlong + otherHalfW;

          const candidatesAlong: Array<{
            targetAlong: number;
            kind: AlignmentGuideKind;
            label: string;
          }> = [
            {
              targetAlong: otherMax + candHalfW,
              kind: 'flush',
              label: 'Bündig (0 cm)',
            },
            {
              targetAlong: otherMin - candHalfW,
              kind: 'flush',
              label: 'Bündig (0 cm)',
            },
            {
              targetAlong: otherAlong,
              kind: 'center',
              label: 'Mitte',
            },
          ];

          for (const c of candidatesAlong) {
            if (
              candidate.widthCm <= geom.lengthCm &&
              (c.targetAlong < candHalfW - 0.1 ||
                c.targetAlong > geom.lengthCm - candHalfW + 0.1)
            ) {
              continue;
            }
            const diff = Math.abs(candAlong - c.targetAlong);
            if (
              diff <= thresholdCm &&
              (!bestMatch ||
                diff < bestMatch.diff - 0.01 ||
                (Math.abs(diff - bestMatch.diff) <= 0.01 &&
                  c.kind === 'flush'))
            ) {
              bestMatch = {
                targetAlong: c.targetAlong,
                diff,
                kind: c.kind,
                label: c.label,
                other,
              };
            }
          }
        }

        if (bestMatch) {
          const deltaAlong = bestMatch.targetAlong - candAlong;
          const snappedX = Number(
            (candidate.x + geom.tangent.x * deltaAlong).toFixed(2)
          );
          const snappedZ = Number(
            (candidate.z + geom.tangent.z * deltaAlong).toFixed(2)
          );

          return {
            x: snappedX,
            z: snappedZ,
            guides: [
              {
                id: `guide-wall-${candidate.id}-${bestMatch.other.id}`,
                axis: 'wall',
                kind: bestMatch.kind,
                start: { x: snappedX, z: snappedZ },
                end: { x: bestMatch.other.x, z: bestMatch.other.z },
                targetFurnitureId: bestMatch.other.id,
                label: bestMatch.label,
              },
            ],
          };
        }
      }
    }
  }

  // Case 2: Free-standing furniture in room -> snap X and Z axes independently
  const candBounds = getFurnitureWorldBoundsXZ(candidate);

  let bestX: {
    targetCenterX: number;
    lineX: number;
    diff: number;
    kind: AlignmentGuideKind;
    label: string;
    other: FurnitureItem;
  } | null = null;

  let bestZ: {
    targetCenterZ: number;
    lineZ: number;
    diff: number;
    kind: AlignmentGuideKind;
    label: string;
    other: FurnitureItem;
  } | null = null;

  for (const other of others) {
    const otherBounds = getFurnitureWorldBoundsXZ(other);

    // X-axis alignment candidates
    const xChecks: Array<{
      targetCenterX: number;
      lineX: number;
      kind: AlignmentGuideKind;
      label: string;
    }> = [
      {
        targetCenterX: otherBounds.centerX,
        lineX: otherBounds.centerX,
        kind: 'center',
        label: 'Mitte',
      },
      {
        targetCenterX: otherBounds.minX + candBounds.halfSpanX,
        lineX: otherBounds.minX,
        kind: 'edge',
        label: 'Flucht',
      },
      {
        targetCenterX: otherBounds.maxX - candBounds.halfSpanX,
        lineX: otherBounds.maxX,
        kind: 'edge',
        label: 'Flucht',
      },
    ];

    const zProximity =
      candBounds.maxZ >= otherBounds.minZ - 60 &&
      candBounds.minZ <= otherBounds.maxZ + 60;
    if (zProximity) {
      xChecks.push(
        {
          targetCenterX: otherBounds.maxX + candBounds.halfSpanX,
          lineX: otherBounds.maxX,
          kind: 'flush',
          label: 'Bündig (0 cm)',
        },
        {
          targetCenterX: otherBounds.minX - candBounds.halfSpanX,
          lineX: otherBounds.minX,
          kind: 'flush',
          label: 'Bündig (0 cm)',
        }
      );
    }

    for (const xc of xChecks) {
      const diff = Math.abs(candidate.x - xc.targetCenterX);
      if (diff <= thresholdCm && (!bestX || diff < bestX.diff)) {
        bestX = {
          targetCenterX: xc.targetCenterX,
          lineX: xc.lineX,
          diff,
          kind: xc.kind,
          label: xc.label,
          other,
        };
      }
    }

    // Z-axis alignment candidates
    const zChecks: Array<{
      targetCenterZ: number;
      lineZ: number;
      kind: AlignmentGuideKind;
      label: string;
    }> = [
      {
        targetCenterZ: otherBounds.centerZ,
        lineZ: otherBounds.centerZ,
        kind: 'center',
        label: 'Mitte',
      },
      {
        targetCenterZ: otherBounds.minZ + candBounds.halfSpanZ,
        lineZ: otherBounds.minZ,
        kind: 'edge',
        label: 'Flucht',
      },
      {
        targetCenterZ: otherBounds.maxZ - candBounds.halfSpanZ,
        lineZ: otherBounds.maxZ,
        kind: 'edge',
        label: 'Flucht',
      },
    ];

    const xProximity =
      candBounds.maxX >= otherBounds.minX - 60 &&
      candBounds.minX <= otherBounds.maxX + 60;
    if (xProximity) {
      zChecks.push(
        {
          targetCenterZ: otherBounds.maxZ + candBounds.halfSpanZ,
          lineZ: otherBounds.maxZ,
          kind: 'flush',
          label: 'Bündig (0 cm)',
        },
        {
          targetCenterZ: otherBounds.minZ - candBounds.halfSpanZ,
          lineZ: otherBounds.minZ,
          kind: 'flush',
          label: 'Bündig (0 cm)',
        }
      );
    }

    for (const zc of zChecks) {
      const diff = Math.abs(candidate.z - zc.targetCenterZ);
      if (diff <= thresholdCm && (!bestZ || diff < bestZ.diff)) {
        bestZ = {
          targetCenterZ: zc.targetCenterZ,
          lineZ: zc.lineZ,
          diff,
          kind: zc.kind,
          label: zc.label,
          other,
        };
      }
    }
  }

  const finalX = bestX
    ? Number(bestX.targetCenterX.toFixed(2))
    : candidate.x;
  const finalZ = bestZ
    ? Number(bestZ.targetCenterZ.toFixed(2))
    : candidate.z;

  const guides: AlignmentGuide[] = [];
  if (bestX) {
    guides.push({
      id: `guide-x-${candidate.id}-${bestX.other.id}`,
      axis: 'x',
      kind: bestX.kind,
      start: { x: bestX.lineX, z: finalZ },
      end: { x: bestX.lineX, z: bestX.other.z },
      targetFurnitureId: bestX.other.id,
      label: bestX.label,
    });
  }
  if (bestZ) {
    guides.push({
      id: `guide-z-${candidate.id}-${bestZ.other.id}`,
      axis: 'z',
      kind: bestZ.kind,
      start: { x: finalX, z: bestZ.lineZ },
      end: { x: bestZ.other.x, z: bestZ.lineZ },
      targetFurnitureId: bestZ.other.id,
      label: bestZ.label,
    });
  }

  return { x: finalX, z: finalZ, guides };
}
