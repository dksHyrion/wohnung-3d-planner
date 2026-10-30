import { describe, expect, it } from 'vitest';
import { FURNITURE_CATALOG } from '../src/core/presets';
import { FurnitureItem } from '../src/core/types';
import { resolveFurnitureVisual } from '../src/core/furnitureVisual';
import { resolveFurnitureModelType } from '../src/components/viewer3d/furniture/ArchitecturalFurniture3D';

function item(partial: Partial<FurnitureItem>): FurnitureItem {
  return {
    id: 'sorrent-test',
    name: 'Schrank',
    category: 'storage',
    widthCm: 200,
    heightCm: 217,
    depthCm: 67,
    x: 0,
    z: 0,
    elevationCm: 0,
    rotationYDeg: 0,
    color: '#f3efe8',
    ...partial,
  };
}

describe('Musterring Sorrent 200', () => {
  it('liegt im Katalog als echtes Möbel mit den Inventarmaßen', () => {
    const sorrent = FURNITURE_CATALOG.find((entry) => entry.visual === 'musterring-sorrent');

    expect(sorrent).toBeDefined();
    expect(sorrent?.isRealFurniture).toBe(true);
    expect(sorrent?.brand).toBe('Musterring');
    expect(sorrent?.widthCm).toBe(200);
    expect(sorrent?.depthCm).toBe(67);
    expect(sorrent?.heightCm).toBe(217);
    expect(sorrent?.catalogWidthCm).toBe(200);
    expect(sorrent?.catalogDepthCm).toBe(67);
    expect(sorrent?.catalogHeightCm).toBe(217);
    expect(sorrent?.clearanceZoneCm).toBeUndefined();
  });

  it('wählt das Sorrent-Modell nur über das Feld visual', () => {
    expect(resolveFurnitureVisual(item({ visual: 'musterring-sorrent' }))).toBe(
      'musterring-sorrent'
    );
    expect(resolveFurnitureModelType(item({ visual: 'musterring-sorrent' }))).toBe(
      'musterring-sorrent'
    );

    const byName = item({
      name: 'Musterring Sorrent Schwebetürenschrank 200',
      brand: 'Musterring',
      modelName: 'Sorrent',
    });
    expect(resolveFurnitureVisual(byName)).not.toBe('musterring-sorrent');
    expect(resolveFurnitureModelType(byName)).not.toBe('musterring-sorrent');
  });
});
