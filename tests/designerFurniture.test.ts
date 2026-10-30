import { describe, it, expect, afterAll } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { FurnitureItem } from '../src/core/types';
import {
  resolveFurnitureModelType,
  ArchitecturalFurniture3D,
} from '../src/components/viewer3d/furniture/ArchitecturalFurniture3D';
import {
  BoConceptOsakaModel,
  OSAKA_DIMENSIONS,
} from '../src/components/viewer3d/furniture/BoConceptOsakaModel';
import {
  Vitsoe606Model,
  VITSOE_606_DIMENSIONS,
} from '../src/components/viewer3d/furniture/Vitsoe606Model';
import {
  FURNITURE_CATALOG,
  PRESET_FLOORPLANS,
} from '../src/core/presets';
import { evaluateFloorplanCollisions } from '../src/core/collisionEngine';

describe('Designer Furniture: BoConcept Osaka & Vitsœ 606 (Task 4)', () => {
  describe('Model Resolution in resolveFurnitureModelType', () => {
    it('resolves BoConcept Osaka sofa by brand or modelName for legacy items', () => {
      const byBrand: FurnitureItem = {
        id: 'f1',
        name: 'Designersofa',
        category: 'living',
        widthCm: 170,
        heightCm: 77,
        depthCm: 87.5,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#78716c',
        brand: 'BoConcept',
      };
      expect(resolveFurnitureModelType(byBrand)).toBe('generic');

      const byModelName: FurnitureItem = {
        id: 'f2',
        name: 'Sofa 2-Sitzer',
        category: 'living',
        widthCm: 170,
        heightCm: 77,
        depthCm: 87.5,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#78716c',
        modelName: 'Osaka Couch (170cm)',
      };
      expect(resolveFurnitureModelType(byModelName)).toBe('generic');

      const byBrandAndModel: FurnitureItem = {
        id: 'f3',
        name: 'BoConcept Osaka Couch',
        category: 'living',
        widthCm: 170,
        heightCm: 77,
        depthCm: 87.5,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#78716c',
        brand: 'BoConcept',
        modelName: 'Osaka Couch',
      };
      expect(resolveFurnitureModelType(byBrandAndModel)).toBe('generic');
    });

    it('resolves Vitsœ 606 Shelving System by brand or modelName for legacy items', () => {
      const byBrandVitsoeUnicode: FurnitureItem = {
        id: 'f4',
        name: 'Regalsystem',
        category: 'storage',
        widthCm: 91.2,
        heightCm: 170,
        depthCm: 22,
        x: 0,
        z: 0,
        elevationCm: 35,
        rotationYDeg: 0,
        color: '#f4f3ef',
        brand: 'Vitsœ',
      };
      expect(resolveFurnitureModelType(byBrandVitsoeUnicode)).toBe('generic');

      const byBrandVitsoeAscii: FurnitureItem = {
        id: 'f5',
        name: 'Regal Wandmontage',
        category: 'storage',
        widthCm: 91.2,
        heightCm: 170,
        depthCm: 22,
        x: 0,
        z: 0,
        elevationCm: 35,
        rotationYDeg: 0,
        color: '#f4f3ef',
        brand: 'Vitsoe',
      };
      expect(resolveFurnitureModelType(byBrandVitsoeAscii)).toBe('generic');

      const byNameVitsoe: FurnitureItem = {
        id: 'f6',
        name: 'Vitsoe Wandregal',
        category: 'storage',
        widthCm: 91.2,
        heightCm: 170,
        depthCm: 22,
        x: 0,
        z: 0,
        elevationCm: 35,
        rotationYDeg: 0,
        color: '#f4f3ef',
        brand: 'Vitsoe',
      };
      expect(resolveFurnitureModelType(byNameVitsoe)).toBe('generic');

      const byName606: FurnitureItem = {
        id: 'f7',
        name: '606 Universal Shelving System',
        category: 'storage',
        widthCm: 91.2,
        heightCm: 170,
        depthCm: 22,
        x: 0,
        z: 0,
        elevationCm: 35,
        rotationYDeg: 0,
        color: '#f4f3ef',
        modelName: '606 Universal Shelving System',
      };
      expect(resolveFurnitureModelType(byName606)).toBe('generic');
    });

    it('ensures explicit visual: "sofa" is not overridden by BoConcept Osaka or Artemide Tolomeo names/brands', () => {
      const sofaOsaka: FurnitureItem = {
        id: 'f-sofa-osaka',
        name: 'BoConcept Osaka Couch',
        category: 'living',
        widthCm: 170,
        heightCm: 77,
        depthCm: 87.5,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#78716c',
        visual: 'sofa',
        brand: 'BoConcept',
        modelName: 'Osaka Couch (170cm)',
      };
      expect(resolveFurnitureModelType(sofaOsaka)).toBe('sofa');

      const sofaTolomeo: FurnitureItem = {
        id: 'f-sofa-tolomeo',
        name: 'Artemide Tolomeo Floor Sofa',
        category: 'living',
        widthCm: 200,
        heightCm: 80,
        depthCm: 90,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#78716c',
        visual: 'sofa',
        brand: 'Artemide',
        modelName: 'Tolomeo Lamp Base',
      };
      expect(resolveFurnitureModelType(sofaTolomeo)).toBe('sofa');
    });

    it('preserves generic sofa and generic storage resolution for non-designer items', () => {
      const standardSofa: FurnitureItem = {
        id: 'f8',
        name: '3-Sitzer Sofa',
        category: 'living',
        widthCm: 220,
        heightCm: 85,
        depthCm: 95,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#4f46e5',
      };
      expect(resolveFurnitureModelType(standardSofa)).toBe('generic');

      const standardPax: FurnitureItem = {
        id: 'f9',
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
      expect(resolveFurnitureModelType(standardPax)).toBe('generic');
    });
  });

  describe('BoConcept Osaka Model Dimensions & Structure', () => {
    it('defines the closed sleeper dimensions, not the deleted 2-seater', () => {
      expect(OSAKA_DIMENSIONS.defaultWidthCm).toBe(190);
      expect(OSAKA_DIMENSIONS.defaultHeightCm).toBe(90);
      expect(OSAKA_DIMENSIONS.defaultDepthCm).toBe(95);
      expect(OSAKA_DIMENSIONS.legHeightCm).toBe(15);
      expect(OSAKA_DIMENSIONS.seatHeightCm).toBe(45);
      expect(OSAKA_DIMENSIONS.armrestHeightCm).toBe(65);
      expect(OSAKA_DIMENSIONS.armThicknessCm).toBe(12);
      expect(OSAKA_DIMENSIONS.seatCushionWidthCm).toBeCloseTo(83, 1);
    });

    it('renders BoConceptOsakaModel to static markup without error', () => {
      const item: FurnitureItem = {
        id: 'f-osaka-test',
        name: 'BoConcept Osaka Couch (2-Sitzer)',
        category: 'living',
        widthCm: 170,
        heightCm: 77,
        depthCm: 87.5,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#78716c',
        isRealFurniture: true,
        brand: 'BoConcept',
        modelName: 'Osaka Couch (170cm)',
      };

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(BoConceptOsakaModel, { item })
      );
      expect(markup).toBeDefined();
      expect(markup.length).toBeGreaterThan(0);
    });

    it('renders unfolded sleeper bed group when pose === "open"', () => {
      const openItem: FurnitureItem = {
        id: 'f-osaka-open',
        name: 'BoConcept Osaka Schlafcouch',
        category: 'living',
        widthCm: 190,
        heightCm: 90,
        depthCm: 200,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#78716c',
        pose: 'open',
        visual: 'boconcept-osaka',
      };

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(BoConceptOsakaModel, { item: openItem })
      );
      expect(markup).toContain('name="osaka-unfolded-bed"');
    });

    it('renders via ArchitecturalFurniture3D dispatcher', () => {
      const item: FurnitureItem = {
        id: 'f-osaka-disp',
        name: 'BoConcept Osaka',
        category: 'living',
        widthCm: 170,
        heightCm: 77,
        depthCm: 87.5,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#78716c',
        isRealFurniture: true,
        brand: 'BoConcept',
      };

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ArchitecturalFurniture3D, { item })
      );
      expect(markup).toBeDefined();
    });
  });

  describe('Vitsœ 606 Universal Shelving System Dimensions & Structure', () => {
    it('defines the exact physical dimensions and 5 shelves with 32cm pitch', () => {
      expect(VITSOE_606_DIMENSIONS.defaultWidthCm).toBe(91.2);
      expect(VITSOE_606_DIMENSIONS.defaultHeightCm).toBe(170);
      expect(VITSOE_606_DIMENSIONS.defaultDepthCm).toBe(22);
      expect(VITSOE_606_DIMENSIONS.shelfCount).toBe(5);
      expect(VITSOE_606_DIMENSIONS.shelfPitchCm).toBe(32);
      expect(VITSOE_606_DIMENSIONS.eTrackWidthCm).toBe(3.5);
      expect(VITSOE_606_DIMENSIONS.eTrackDepthCm).toBe(1.8);
      expect(VITSOE_606_DIMENSIONS.eTrackHeightCm).toBe(170);
    });

    it('renders Vitsoe606Model with curated staging objects to static markup without error', () => {
      const item: FurnitureItem = {
        id: 'f-vitsoe-test',
        name: 'Vitsœ 606 Regalsystem (5 Tablare)',
        category: 'storage',
        widthCm: 91.2,
        heightCm: 170,
        depthCm: 22,
        x: 0,
        z: 0,
        elevationCm: 35,
        rotationYDeg: 0,
        color: '#f4f3ef',
        isRealFurniture: true,
        brand: 'Vitsœ',
        modelName: '606 Universal Shelving System',
      };

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(Vitsoe606Model, { item })
      );
      expect(markup).toBeDefined();
      expect(markup.length).toBeGreaterThan(0);
    });

    it('renders via ArchitecturalFurniture3D dispatcher', () => {
      const item: FurnitureItem = {
        id: 'f-vitsoe-disp',
        name: 'Vitsœ 606 Universal Shelving System',
        category: 'storage',
        widthCm: 91.2,
        heightCm: 170,
        depthCm: 22,
        x: 0,
        z: 0,
        elevationCm: 35,
        rotationYDeg: 0,
        color: '#f4f3ef',
        isRealFurniture: true,
        brand: 'Vitsœ',
      };

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ArchitecturalFurniture3D, { item })
      );
      expect(markup).toBeDefined();
    });
  });

  describe('Furniture Catalog & Preset Floorplan Integration', () => {
    it('contains BoConcept Osaka and Vitsœ 606 in FURNITURE_CATALOG with isRealFurniture = true', () => {
      expect(
        FURNITURE_CATALOG.some((entry) => entry.modelName === 'Osaka Couch (170cm)')
      ).toBe(false);
      const osaka = FURNITURE_CATALOG.find((entry) => entry.modelName === 'Osaka Schlafcouch');
      expect(osaka).toBeDefined();
      expect(osaka?.isRealFurniture).toBe(true);
      expect(osaka?.widthCm).toBe(190);
      expect(osaka?.heightCm).toBe(90);
      expect(osaka?.depthCm).toBe(95);

      const vitsoe = FURNITURE_CATALOG.find(
        (c) => c.brand === 'Vitsœ' || c.name.includes('606')
      );
      expect(vitsoe).toBeDefined();
      expect(vitsoe?.isRealFurniture).toBe(true);
      expect(vitsoe?.widthCm).toBe(91.2);
      expect(vitsoe?.heightCm).toBe(170);
      expect(vitsoe?.depthCm).toBe(22);
      expect(vitsoe?.elevationCm).toBe(35);
      expect(vitsoe?.modelName).toBe('606 Universal Shelving System');
    });

    it('PRESET_FLOORPLANS luxury-villa keeps the Vitsœ and drops the 2-seater Osaka', () => {
      const villa = PRESET_FLOORPLANS['luxury-villa'];
      const furniture = villa.data.furniture;

      expect(furniture.some((item) => item.modelName === 'Osaka Couch (170cm)')).toBe(false);
      expect(furniture.some((item) => item.id === 'f-villa-osaka')).toBe(false);
      expect(
        PRESET_FLOORPLANS['studio-apartment'].data.furniture.some(
          (item) => item.modelName === 'Osaka Couch (170cm)'
        )
      ).toBe(false);

      const vitsoe = furniture.find(
        (f) => f.brand === 'Vitsœ' || f.name.includes('606')
      );
      expect(vitsoe, 'Expected Vitsœ 606 shelf in luxury-villa floorplan').toBeDefined();
      expect(vitsoe?.isRealFurniture).toBe(true);
      expect(vitsoe?.widthCm).toBe(91.2);
      expect(vitsoe?.heightCm).toBe(170);
      expect(vitsoe?.depthCm).toBe(22);

      // Verify that the luxury villa floorplan has 0 collisions with the new items included
      const reports = evaluateFloorplanCollisions(villa.data);
      for (const item of furniture) {
        const report = reports[item.id];
        expect(report).toBeDefined();
        expect(
          report.hasCollision,
          `Item ${item.name} (${item.id}) collides: ${JSON.stringify(report.issues)}`
        ).toBe(false);
      }
    });
  });

  describe('Cinematic Lighting Reactive Lamp Blooms & Muted Tones (Task 5)', () => {
    it('updates Tolomeo and Kitchen LED emissive intensity based on evening mood', async () => {
      const { interpolateMood } = await import('../src/core/lighting/moodPresets');

      // Daytime at 12:00
      const dayMood = interpolateMood(12.0);
      expect(dayMood.lampsActive).toBe(false);
      expect(dayMood.lampEmissiveIntensity).toBe(0);

      // Dusk at 20:30
      const duskMood = interpolateMood(20.5);
      expect(duskMood.lampsActive).toBe(true);
      expect(duskMood.lampEmissiveIntensity).toBeGreaterThan(2.0);
    });

    it('renders Artemide Tolomeo with reactive emissive shade and point light', async () => {
      const { useFloorplanStore } = await import('../src/store/useFloorplanStore');
      const { ArtemideTolomeoModel } = await import(
        '../src/components/viewer3d/furniture/ArtemideTolomeoModel'
      );

      const lampItem: FurnitureItem = {
        id: 'tolomeo-lamp',
        name: 'Artemide Tolomeo Decentrata',
        category: 'decor',
        widthCm: 45,
        heightCm: 90,
        depthCm: 150,
        x: 450,
        z: 270,
        elevationCm: 155,
        rotationYDeg: 0,
        color: '#cbd5e1',
        brand: 'Artemide',
        modelName: 'Tolomeo Sospensione Decentrata',
        isRealFurniture: true,
      };

      // Set to evening (blue hour)
      useFloorplanStore.getState().setTimeOfDay(20.5);
      const eveningMarkup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ArtemideTolomeoModel, { item: lampItem })
      );
      expect(eveningMarkup).toContain('intensity="1.6"');
      expect(eveningMarkup).toContain('emissive=');
      expect(eveningMarkup).not.toContain('emissiveIntensity="0"');
      expect(eveningMarkup).not.toContain('shadow-mapSize-width="512"');

      // Set to daytime
      useFloorplanStore.getState().setTimeOfDay(12.0);
      const dayMarkup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ArtemideTolomeoModel, { item: { ...lampItem, id: 'tolomeo-day' } })
      );
      expect(dayMarkup).toContain('intensity="0.05"');
      expect(dayMarkup).toContain('emissiveIntensity="0"');
      expect(dayMarkup).not.toContain('shadow-mapSize-width="512"');
    });

    it('renders KitchenUnitModel with reactive LED under-cabinet strip and task light', async () => {
      const { useFloorplanStore } = await import('../src/store/useFloorplanStore');
      const { KitchenUnitModel } = await import(
        '../src/components/viewer3d/furniture/KitchenUnitModel'
      );

      const kitchenItem: FurnitureItem = {
        id: 'kitchen-unit',
        name: 'Küchenzeile Mattweiß',
        category: 'kitchen',
        widthCm: 240,
        heightCm: 215,
        depthCm: 60,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#f8fafc',
      };

      // Set to evening (night)
      useFloorplanStore.getState().setTimeOfDay(22.0);
      const eveningMarkup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(KitchenUnitModel, { item: kitchenItem })
      );
      expect(eveningMarkup).toContain('intensity="1.2"');
      expect(eveningMarkup).toContain('emissive=');
      expect(eveningMarkup).not.toContain('emissiveIntensity="0"');

      // Set to daytime (noon)
      useFloorplanStore.getState().setTimeOfDay(12.5);
      const dayMarkup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(KitchenUnitModel, { item: { ...kitchenItem, id: 'kitchen-day' } })
      );
      expect(dayMarkup).toContain('intensity="0"');
      expect(dayMarkup).toContain('emissiveIntensity="0"');
    });

    it('exports muted architectural category default colors without harsh saturated tones', async () => {
      const { CATEGORY_DEFAULT_COLORS } = await import(
        '../src/components/viewer3d/furniture/ArchitecturalFurniture3D'
      );

      expect(CATEGORY_DEFAULT_COLORS).toBeDefined();
      const mutedColors = Object.values(CATEGORY_DEFAULT_COLORS);
      const saturatedColors = ['#3b82f6', '#8b5cf6', '#10b981', '#0d9488', '#7c3aed', '#0284c7', '#15803d'];
      for (const sat of saturatedColors) {
        expect(mutedColors).not.toContain(sat);
      }
      expect(CATEGORY_DEFAULT_COLORS.living).toBe('#64748b');
      expect(CATEGORY_DEFAULT_COLORS.bedroom).toBe('#78716c');
      expect(CATEGORY_DEFAULT_COLORS.storage).toBe('#94a3b8');
      expect(CATEGORY_DEFAULT_COLORS.decor).toBe('#a8a29e');
    });

    afterAll(async () => {
      const { useFloorplanStore } = await import('../src/store/useFloorplanStore');
      useFloorplanStore.getState().setTimeOfDay(18.0);
    });
  });
});
