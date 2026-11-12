import { describe, it, expect } from 'vitest';
import type { FurnitureItem } from '../src/core/types';
import {
  isOsakaOpen,
  layoutFurnitureParts,
  osakaSofaBedLayout,
  OSAKA_BACK_THICKNESS_CM,
  OSAKA_CLOSED_DEPTH_CM,
} from '../src/core/furnitureShapes';

const osaka = (patch: Partial<FurnitureItem> = {}): FurnitureItem => ({
  id: 'f-osaka',
  name: 'Osaka',
  category: 'living',
  widthCm: 190,
  heightCm: 90,
  depthCm: 95,
  x: 0,
  z: 0,
  elevationCm: 0,
  rotationYDeg: 0,
  color: '#78716c',
  visual: 'boconcept-osaka',
  ...patch,
});

describe('Osaka sofa bed shared layout', () => {
  it('is open by pose or by legacy depth above 140 cm', () => {
    expect(isOsakaOpen(osaka())).toBe(false);
    expect(isOsakaOpen(osaka({ pose: 'open' }))).toBe(true);
    expect(isOsakaOpen(osaka({ depthCm: 210 }))).toBe(true);
  });

  it('collision parts are the layout body and mattress when open', () => {
    const item = osaka({ pose: 'open', depthCm: 210 });
    const { body, mattress } = osakaSofaBedLayout(item);
    expect(body.depthCm).toBe(OSAKA_CLOSED_DEPTH_CM);
    expect(mattress.cz - mattress.depthCm / 2).toBeCloseTo(-item.depthCm / 2 + OSAKA_BACK_THICKNESS_CM);
    expect(layoutFurnitureParts(item)).toEqual([body, mattress]);
  });

  it('closed Osaka is a single body part', () => {
    expect(layoutFurnitureParts(osaka()).map((p) => p.id)).toEqual(['body']);
  });
});
