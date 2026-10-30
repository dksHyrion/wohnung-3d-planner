import { describe, it, expect } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { PRESET_FLOORPLANS, FURNITURE_CATALOG } from '../src/core/presets';
import { evaluateFloorplanCollisions } from '../src/core/collisionEngine';
import { computeFloorPolygons } from '../src/core/wallMath';
import { FurnitureItem } from '../src/core/types';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { resolveFurnitureModelType } from '../src/components/viewer3d/furniture/ArchitecturalFurniture3D';
import { ArchitecturalFurniture3D } from '../src/components/viewer3d/furniture/ArchitecturalFurniture3D';
import { SofaModel } from '../src/components/viewer3d/furniture/SofaModel';
import { BedModel } from '../src/components/viewer3d/furniture/BedModel';
import { DiningTableModel } from '../src/components/viewer3d/furniture/DiningTableModel';
import { KitchenIslandModel } from '../src/components/viewer3d/furniture/KitchenIslandModel';
import { PlantModel } from '../src/components/viewer3d/furniture/PlantModel';
import { BathtubModel } from '../src/components/viewer3d/furniture/BathtubModel';

describe('Architectural Furniture Models & Dispatcher (Phase 3)', () => {
  it('correctly resolves model type for each furniture category and name', () => {
    const sofaItem: FurnitureItem = {
      id: 'f-sofa',
      name: 'Designer 3-Sitzer Sofa Lounge',
      category: 'living',
      widthCm: 240,
      heightCm: 85,
      depthCm: 95,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#4f46e5',
    };
    expect(resolveFurnitureModelType(sofaItem)).toBe('generic');

    const bedItem: FurnitureItem = {
      id: 'f-bed',
      name: 'Doppelbett (180×200)',
      category: 'bedroom',
      widthCm: 180,
      heightCm: 90,
      depthCm: 200,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#0d9488',
    };
    expect(resolveFurnitureModelType(bedItem)).toBe('generic');

    const tableItem: FurnitureItem = {
      id: 'f-table',
      name: 'Massivholz Esstisch (6 Pers.)',
      category: 'living',
      widthCm: 180,
      heightCm: 75,
      depthCm: 90,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#d97706',
      visual: 'dining-table',
    };
    expect(resolveFurnitureModelType(tableItem)).toBe('dining-table');

    const islandItem: FurnitureItem = {
      id: 'f-island',
      name: 'Kochinsel mit Barhockern',
      category: 'kitchen',
      widthCm: 240,
      heightCm: 92,
      depthCm: 100,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#334155',
    };
    expect(resolveFurnitureModelType(islandItem)).toBe('generic');

    const plantItem: FurnitureItem = {
      id: 'f-plant',
      name: 'Zimmerpflanze Monstera Deliciosa',
      category: 'decor',
      widthCm: 60,
      heightCm: 100,
      depthCm: 60,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#15803d',
    };
    expect(resolveFurnitureModelType(plantItem)).toBe('generic');

    const tubItem: FurnitureItem = {
      id: 'f-tub',
      name: 'Freistehende Designer-Badewanne',
      category: 'bathroom',
      widthCm: 170,
      heightCm: 65,
      depthCm: 85,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#f8fafc',
    };
    expect(resolveFurnitureModelType(tubItem)).toBe('generic');

    const wardrobeItem: FurnitureItem = {
      id: 'f-wardrobe',
      name: 'Kleiderschrank PAX',
      category: 'storage',
      widthCm: 200,
      heightCm: 236,
      depthCm: 60,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#0284c7',
    };
    expect(resolveFurnitureModelType(wardrobeItem)).toBe('generic');

    // Coffee table & side tables must NOT resolve to sofa or dining table
    const coffeeTableItem: FurnitureItem = {
      id: 'f-coffee',
      name: 'Marmor Couchtisch',
      category: 'living',
      widthCm: 120,
      heightCm: 42,
      depthCm: 70,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#f8fafc',
    };
    expect(resolveFurnitureModelType(coffeeTableItem)).toBe('generic');

    const coffeeTableEn: FurnitureItem = {
      id: 'f-coffee-en',
      name: 'Walnut Coffee Table',
      category: 'living',
      widthCm: 110,
      heightCm: 40,
      depthCm: 60,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#d4a373',
    };
    expect(resolveFurnitureModelType(coffeeTableEn)).toBe('generic');

    // Wardrobe in bedroom category must NOT resolve to bed
    const bedroomWardrobe: FurnitureItem = {
      id: 'f-bed-wardrobe',
      name: 'Schlafzimmerschrank PAX',
      category: 'bedroom',
      widthCm: 200,
      heightCm: 236,
      depthCm: 60,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#0284c7',
    };
    expect(resolveFurnitureModelType(bedroomWardrobe)).toBe('generic');

    // Vanity in bathroom category must NOT resolve to bathtub
    const bathroomVanity: FurnitureItem = {
      id: 'f-vanity',
      name: 'Waschtisch mit Doppelbecken',
      category: 'bathroom',
      widthCm: 140,
      heightCm: 85,
      depthCm: 50,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#f8fafc',
    };
    expect(resolveFurnitureModelType(bathroomVanity)).toBe('generic');
  });

  it('correctly resolves every furniture item in the luxury-villa preset', () => {
    const villa = PRESET_FLOORPLANS['luxury-villa'];
    const itemMap = new Map(villa.data.furniture.map((f) => [f.id, f]));

    expect(resolveFurnitureModelType(itemMap.get('f-villa-sofa')!)).toBe('sofa');
    expect(resolveFurnitureModelType(itemMap.get('f-villa-coffee-table')!)).toBe('generic');
    expect(resolveFurnitureModelType(itemMap.get('f-villa-dining-table')!)).toBe('dining-table');
    expect(resolveFurnitureModelType(itemMap.get('f-villa-kitchen-island')!)).toBe('kitchen-island');
    expect(resolveFurnitureModelType(itemMap.get('f-villa-bed')!)).toBe('bed');
    expect(resolveFurnitureModelType(itemMap.get('f-villa-wardrobe')!)).toBe(
      'musterring-sorrent'
    );
    expect(resolveFurnitureModelType(itemMap.get('f-villa-bathtub')!)).toBe('bathtub');
    expect(resolveFurnitureModelType(itemMap.get('f-villa-plant-living')!)).toBe('plant');
    expect(resolveFurnitureModelType(itemMap.get('f-villa-plant-bath')!)).toBe('plant');
    expect(resolveFurnitureModelType(itemMap.get('f-villa-desk')!)).toBe('generic');
  });

  it('renders all detailed architectural models to static markup without errors', () => {
    const dummyItem: FurnitureItem = {
      id: 'f-test',
      name: 'Test Furniture',
      category: 'living',
      widthCm: 200,
      heightCm: 80,
      depthCm: 100,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#4f46e5',
    };

    expect(() =>
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(SofaModel, { item: dummyItem })
      )
    ).not.toThrow();

    expect(() =>
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(BedModel, { item: dummyItem })
      )
    ).not.toThrow();

    expect(() =>
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(DiningTableModel, { item: dummyItem })
      )
    ).not.toThrow();

    expect(() =>
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(KitchenIslandModel, { item: dummyItem })
      )
    ).not.toThrow();

    expect(() =>
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(PlantModel, { item: dummyItem })
      )
    ).not.toThrow();

    expect(() =>
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(BathtubModel, { item: dummyItem })
      )
    ).not.toThrow();

    expect(() =>
      ReactDOMServer.renderToStaticMarkup(
        React.createElement(ArchitecturalFurniture3D, { item: dummyItem })
      )
    ).not.toThrow();
  });

  it('resolves detailed architectural sub-types for wardrobes, desks, coffee tables, sideboards and vanities', async () => {
    const { resolveGenericFurnitureSubType } = await import(
      '../src/components/viewer3d/furniture/ArchitecturalFurniture3D'
    ) as any;
    expect(typeof resolveGenericFurnitureSubType).toBe('function');

    const villa = PRESET_FLOORPLANS['luxury-villa'];
    const itemMap = new Map(villa.data.furniture.map((f) => [f.id, f]));

    expect(
      resolveGenericFurnitureSubType({
        ...itemMap.get('f-villa-wardrobe')!,
        visual: 'wardrobe',
      })
    ).toBe('wardrobe');
    expect(resolveGenericFurnitureSubType(itemMap.get('f-villa-desk')!)).toBe('desk');
    expect(resolveGenericFurnitureSubType(itemMap.get('f-villa-coffee-table')!)).toBe('coffee-table');

    const sideboardItem: FurnitureItem = {
      id: 'f-sideboard',
      name: 'Sideboard / Kommode',
      category: 'storage',
      widthCm: 150,
      heightCm: 80,
      depthCm: 45,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#c7b299',
    };
    expect(resolveGenericFurnitureSubType(sideboardItem)).toBe('box');

    const vanityItem: FurnitureItem = {
      id: 'f-vanity-sub',
      name: 'Waschtisch mit Doppelbecken',
      category: 'bathroom',
      widthCm: 140,
      heightCm: 85,
      depthCm: 50,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#f8fafc',
    };
    expect(resolveGenericFurnitureSubType(vanityItem)).toBe('box');
  });

  it('renders detailed WardrobeModel, DeskModel and CoffeeTableModel via ArchitecturalFurniture3D and uses curated natural preset colors', async () => {
    useFloorplanStore.setState({ showDecor: true });
    const villa = PRESET_FLOORPLANS['luxury-villa'];
    const itemMap = new Map(villa.data.furniture.map((f) => [f.id, f]));

    const wardrobeMarkup = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ArchitecturalFurniture3D, {
        item: {
          ...itemMap.get('f-villa-wardrobe')!,
          visual: 'wardrobe',
        },
      })
    );
    expect(wardrobeMarkup).toContain('name="wardrobe-door"');
    expect(wardrobeMarkup).toContain('name="wardrobe-handle"');
    const sorrentMarkup = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ArchitecturalFurniture3D, {
        item: itemMap.get('f-villa-wardrobe')!,
      })
    );
    expect(sorrentMarkup).toContain('name="sorrent-mirror"');

    const deskMarkup = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ArchitecturalFurniture3D, {
        item: itemMap.get('f-villa-desk')!,
      })
    );
    expect(deskMarkup).toContain('name="desk-monitor"');
    expect(deskMarkup).toContain('name="desk-office-chair"');

    const coffeeMarkup = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ArchitecturalFurniture3D, {
        item: itemMap.get('f-villa-coffee-table')!,
      })
    );
    expect(coffeeMarkup).toContain('name="coffee-table-top"');
    expect(coffeeMarkup).toContain('name="coffee-table-decor"');

    // Verify harsh neon CAD colors are replaced in presets and catalog
    const harshNeonColors = ['#0284c7', '#7c3aed', '#0d9488', '#4f46e5', '#ea580c'];
    for (const catItem of FURNITURE_CATALOG) {
      expect(harshNeonColors).not.toContain(catItem.color);
    }
    for (const preset of Object.values(PRESET_FLOORPLANS)) {
      for (const fItem of preset.data.furniture) {
        expect(harshNeonColors).not.toContain(fItem.color);
      }
    }
  });
});

describe('Luxury Villa Preset Validation (Phase 3)', () => {
  const villa = PRESET_FLOORPLANS['luxury-villa'];

  it('exports luxury-villa preset with complete metadata and rooms', () => {
    expect(villa).toBeDefined();
    expect(villa.label).toContain('Villa');
    expect(villa.description).toBeDefined();
    expect(villa.data.corners.length).toBeGreaterThanOrEqual(8);
    expect(villa.data.walls.length).toBeGreaterThanOrEqual(8);
    expect(villa.data.openings.length).toBeGreaterThanOrEqual(4);
    expect(villa.data.furniture.length).toBeGreaterThanOrEqual(6);
    expect(villa.data.rugs?.length).toBeGreaterThanOrEqual(3);
  });

  it('extracts valid closed room polygons with positive areas', () => {
    const polygons = computeFloorPolygons(villa.data.corners, villa.data.walls);
    expect(polygons.length).toBeGreaterThanOrEqual(4);

    for (const poly of polygons) {
      expect(poly.areaSqM).toBeGreaterThan(5);
      expect(poly.netAreaSqM).toBeGreaterThan(4);
      expect(poly.corners.length).toBeGreaterThanOrEqual(3);
      expect(poly.flooringType).toBeDefined();
    }

    const flooringTypes = polygons.map((p) => p.flooringType);
    expect(flooringTypes).toContain('microcement');
    expect(flooringTypes).toContain('parquet');
    expect(flooringTypes).toContain('tile');
  });

  it('contains essential luxury furniture models and rugs', () => {
    const furnitureNames = villa.data.furniture.map((f) => f.name.toLowerCase());
    const furnitureCategories = villa.data.furniture.map((f) => f.category);

    // Sofa
    expect(furnitureNames.some((n) => n.includes('sofa') || n.includes('lounge'))).toBe(true);
    // Dining table
    expect(furnitureNames.some((n) => n.includes('esstisch') || n.includes('dining'))).toBe(true);
    // Kitchen island
    expect(furnitureNames.some((n) => n.includes('insel') || n.includes('island'))).toBe(true);
    // Bed
    expect(furnitureNames.some((n) => n.includes('bett') || n.includes('bed'))).toBe(true);
    // Bathtub
    expect(
      furnitureNames.some((n) => n.includes('badewanne') || n.includes('bathtub')) ||
        furnitureCategories.includes('bathroom')
    ).toBe(true);
    // Plant
    expect(
      furnitureNames.some((n) => n.includes('pflanze') || n.includes('monstera')) ||
        furnitureCategories.includes('decor')
    ).toBe(true);

    // Rugs: sofa, dining, bed
    const rugNames = (villa.data.rugs ?? []).map((r) => (r.name ?? '').toLowerCase());
    expect(rugNames.some((n) => n.includes('wohn') || n.includes('sofa'))).toBe(true);
    expect(rugNames.some((n) => n.includes('ess') || n.includes('dining'))).toBe(true);
    expect(rugNames.some((n) => n.includes('schlaf') || n.includes('bed'))).toBe(true);
  });

  it('evaluates initial luxury-villa floorplan with ZERO furniture collisions', () => {
    const reports = evaluateFloorplanCollisions(villa.data);

    for (const item of villa.data.furniture) {
      const report = reports[item.id];
      expect(report, `Missing collision report for ${item.name} (${item.id})`).toBeDefined();
      if (report.hasCollision) {
        console.error(`Collision detected for ${item.name} (${item.id}):`, report.issues);
      }
      expect(
        report.hasCollision,
        `Expected ${item.name} (${item.id}) to have no collision, but got issues: ${JSON.stringify(report.issues)}`
      ).toBe(false);
      expect(report.issues.length).toBe(0);
    }
  });
});
