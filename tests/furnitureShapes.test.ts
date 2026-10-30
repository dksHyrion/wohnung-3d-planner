import { describe, it, expect } from 'vitest';
import { FurnitureItem } from '../src/core/types';
import {
  layoutFurnitureParts,
  localPartWorldCenter,
} from '../src/core/furnitureShapes';
import { computeFurnitureOBBs } from '../src/core/collisionEngine';

function item(partial: Partial<FurnitureItem> & Pick<FurnitureItem, 'visual'>): FurnitureItem {
  return {
    id: 'piece',
    name: 'Stück',
    category: 'living',
    widthCm: 100,
    heightCm: 80,
    depthCm: 80,
    x: 120,
    z: -40,
    elevationCm: 0,
    rotationYDeg: 30,
    color: '#cccccc',
    ...partial,
  };
}

describe('furnitureShapes', () => {
  it('legt jede Kollisionsmitte auf die gedrehte Formmitte', () => {
    const pieces = [
      item({
        visual: 'dining-table',
        name: 'Esstisch',
        widthCm: 160,
        heightCm: 75,
        depthCm: 90,
      }),
      item({
        visual: 'sectional-sofa',
        name: 'Ecksofa',
        category: 'living',
        widthCm: 240,
        heightCm: 78,
        depthCm: 160,
      }),
      item({
        visual: 'bed',
        name: 'Bett',
        category: 'bedroom',
        widthCm: 200,
        heightCm: 90,
        depthCm: 200,
        hasNightstands: true,
      }),
    ];

    for (const piece of pieces) {
      const parts = layoutFurnitureParts(piece);
      const obbs = computeFurnitureOBBs(piece, 0);
      expect(obbs).toHaveLength(parts.length);
      parts.forEach((part, index) => {
        const world = localPartWorldCenter(piece, part);
        expect(obbs[index].center.x).toBeCloseTo(world.x, 5);
        expect(obbs[index].center.y).toBeCloseTo(world.y, 5);
        expect(obbs[index].center.z).toBeCloseTo(world.z, 5);
      });
    }
  });
});
