import { layoutFurnitureParts } from './furnitureShapes';
import type { FurnitureItem } from './types';

export interface MarqueeBoundsCm {
  startX: number;
  startZ: number;
  currentX: number;
  currentZ: number;
}

export function computeGroupCentroidXZ(
  items: Pick<FurnitureItem, 'x' | 'z'>[]
): { x: number; z: number } {
  if (items.length === 0) return { x: 0, z: 0 };
  let sumX = 0;
  let sumZ = 0;
  for (const item of items) {
    sumX += item.x;
    sumZ += item.z;
  }
  return {
    x: Number((sumX / items.length).toFixed(2)),
    z: Number((sumZ / items.length).toFixed(2)),
  };
}

/**
 * Rotates a point (x, z) around (pivotX, pivotZ) using the global Three.js +Y convention.
 */
export function rotatePointAroundPivotXZ(
  x: number,
  z: number,
  pivotX: number,
  pivotZ: number,
  deltaDeg: number
): { x: number; z: number } {
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const relX = x - pivotX;
  const relZ = z - pivotZ;
  return {
    x: Number((pivotX + relX * cos + relZ * sin).toFixed(2)),
    z: Number((pivotZ - relX * sin + relZ * cos).toFixed(2)),
  };
}

export function getCompoundFurnitureBoundsXZ(item: FurnitureItem): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const parts = layoutFurnitureParts(item);
  const rad = (item.rotationYDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const part of parts) {
    const worldCx = item.x + part.cx * cos + part.cz * sin;
    const worldCz = item.z - part.cx * sin + part.cz * cos;
    const halfX = (part.widthCm * absCos + part.depthCm * absSin) / 2;
    const halfZ = (part.widthCm * absSin + part.depthCm * absCos) / 2;
    if (worldCx - halfX < minX) minX = worldCx - halfX;
    if (worldCx + halfX > maxX) maxX = worldCx + halfX;
    if (worldCz - halfZ < minZ) minZ = worldCz - halfZ;
    if (worldCz + halfZ > maxZ) maxZ = worldCz + halfZ;
  }

  return { minX, maxX, minZ, maxZ };
}

export function selectFurnitureIdsInMarquee(
  furniture: FurnitureItem[],
  marquee: MarqueeBoundsCm
): string[] {
  const minX = Math.min(marquee.startX, marquee.currentX);
  const maxX = Math.max(marquee.startX, marquee.currentX);
  const minZ = Math.min(marquee.startZ, marquee.currentZ);
  const maxZ = Math.max(marquee.startZ, marquee.currentZ);

  const selected: string[] = [];
  for (const item of furniture) {
    const b = getCompoundFurnitureBoundsXZ(item);
    const intersects =
      b.maxX >= minX && b.minX <= maxX && b.maxZ >= minZ && b.minZ <= maxZ;
    if (intersects) {
      selected.push(item.id);
    }
  }
  return selected;
}
