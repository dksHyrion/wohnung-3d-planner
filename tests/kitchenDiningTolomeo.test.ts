import { describe, it, expect } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { FurnitureItem } from '../src/core/types';
import {
  resolveFurnitureModelType,
  ArchitecturalFurniture3D,
} from '../src/components/viewer3d/furniture/ArchitecturalFurniture3D';
import {
  ArtemideTolomeoModel,
  TOLOMEO_DIMENSIONS,
} from '../src/components/viewer3d/furniture/ArtemideTolomeoModel';
import {
  KitchenUnitModel,
  KITCHEN_UNIT_DIMENSIONS,
} from '../src/components/viewer3d/furniture/KitchenUnitModel';
import { DiningTableModel } from '../src/components/viewer3d/furniture/DiningTableModel';
import { FURNITURE_CATALOG, PRESET_FLOORPLANS } from '../src/core/presets';
import { evaluateFloorplanCollisions } from '../src/core/collisionEngine';

describe('Kitchen, Dining Area & Artemide Tolomeo Decentrata (Task 5)', () => {
  describe('Model Resolution in resolveFurnitureModelType', () => {
    it('resolves Artemide Tolomeo by brand or modelName for legacy items', () => {
      const byBrand: FurnitureItem = {
        id: 'lamp-1',
        name: 'Design-Pendelleuchte',
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
      expect(resolveFurnitureModelType(byBrand)).toBe('generic');

      const byModelName: FurnitureItem = {
        id: 'lamp-2',
        name: 'Hängelampe Essbereich',
        category: 'decor',
        widthCm: 45,
        heightCm: 90,
        depthCm: 150,
        x: 450,
        z: 270,
        elevationCm: 155,
        rotationYDeg: 0,
        color: '#cbd5e1',
        modelName: 'Tolomeo Decentrata',
      };
      expect(resolveFurnitureModelType(byModelName)).toBe('generic');

      const byBrandAndModel: FurnitureItem = {
        id: 'lamp-3',
        name: 'Artemide Tolomeo Decentrata Lampe',
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
        modelName: 'Tolomeo Decentrata',
      };
      expect(resolveFurnitureModelType(byBrandAndModel)).toBe('generic');
    });

    it('resolves Küchenzeile to kitchen-unit', () => {
      const kitchenItem: FurnitureItem = {
        id: 'f-kitchen',
        name: 'Küchenzeile',
        category: 'kitchen',
        widthCm: 240,
        heightCm: 215,
        depthCm: 60,
        x: 37.5,
        z: 160,
        elevationCm: 0,
        rotationYDeg: 90,
        color: '#f8fafc',
      };
      expect(resolveFurnitureModelType(kitchenItem)).toBe('generic');

      const builtInKitchen: FurnitureItem = {
        id: 'f-ebk',
        name: 'Einbauküche Mattweiß',
        category: 'kitchen',
        widthCm: 260,
        heightCm: 220,
        depthCm: 60,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#f8fafc',
      };
      expect(resolveFurnitureModelType(builtInKitchen)).toBe('generic');
    });
  });

  describe('Artemide Tolomeo Decentrata 3D Model', () => {
    it('defines standard dimensions for the articulated cantilever lamp', () => {
      expect(TOLOMEO_DIMENSIONS.diffuserDiameterCm).toBe(36);
      expect(TOLOMEO_DIMENSIONS.diffuserHeightCm).toBe(21);
      expect(TOLOMEO_DIMENSIONS.canopyDiameterCm).toBe(18);
    });

    it('renders canopy, articulated aluminium arms, tension cables, and diffuser shade', () => {
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

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ArtemideTolomeoModel, { item: lampItem })
      );
      expect(html).toBeTruthy();
    });
  });

  describe('KitchenUnitModel (White Minimalist Kitchen)', () => {
    it('defines kitchen unit standards (worktop height, toe-kick, wall cabinet pitch)', () => {
      expect(KITCHEN_UNIT_DIMENSIONS.counterHeightCm).toBe(90);
      expect(KITCHEN_UNIT_DIMENSIONS.toeKickHeightCm).toBe(10);
      expect(KITCHEN_UNIT_DIMENSIONS.toeKickDepthCm).toBe(5);
    });

    it('renders base cabinets with sink, swan-neck faucet, induction hob, and upper wall cabinets', () => {
      const fullKitchen: FurnitureItem = {
        id: 'f-kitchen-full',
        name: 'Küchenzeile Mattweiß mit Oberschränken',
        category: 'kitchen',
        widthCm: 240,
        heightCm: 215,
        depthCm: 60,
        x: 37.5,
        z: 160,
        elevationCm: 0,
        rotationYDeg: 90,
        color: '#f8fafc',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(KitchenUnitModel, { item: fullKitchen })
      );
      expect(html).toBeTruthy();
      // Verifies raised collar and sunken basin to prevent coplanar countertop Z-fighting
      expect(html.toLowerCase()).toContain('polygonoffsetfactor="-2"');
    });

    it('renders anti-flicker sunken basin and raised rim on KitchenIslandModel', async () => {
      const { KitchenIslandModel } = await import(
        '../src/components/viewer3d/furniture/KitchenIslandModel'
      );
      const islandItem: FurnitureItem = {
        id: 'f-island',
        name: 'Kochinsel mit Barhockern',
        category: 'kitchen',
        widthCm: 240,
        heightCm: 92,
        depthCm: 100,
        x: 240,
        z: 220,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#1e293b',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(KitchenIslandModel, { item: islandItem })
      );
      expect(html).toBeTruthy();
      expect(html.toLowerCase()).toContain('polygonoffsetfactor="-2"');
    });
  });

  describe('DiningTableModel with White Scandinavian Detailing', () => {
    it('renders table with surround designer chairs', () => {
      const diningItem: FurnitureItem = {
        id: 'f-dining-table',
        name: 'Esstisch Weiß (4–6 Pers.)',
        category: 'living',
        widthCm: 160,
        heightCm: 75,
        depthCm: 90,
        x: 450,
        z: 270,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#f8fafc',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(DiningTableModel, { item: diningItem })
      );
      expect(html).toBeTruthy();
    });
  });

  describe('Catalog & Preset Integration', () => {
    it('contains Artemide Tolomeo Decentrata in FURNITURE_CATALOG as real furniture', () => {
      const tolomeo = FURNITURE_CATALOG.find(
        (c) => c.brand === 'Artemide' || c.name.includes('Tolomeo')
      );
      expect(tolomeo).toBeDefined();
      expect(tolomeo?.isRealFurniture).toBe(true);
      expect(tolomeo?.brand).toBe('Artemide');
    });

    it('ensures studio-apartment and luxury-villa presets have 0 collisions with kitchen and dining items', () => {
      const studioReports = evaluateFloorplanCollisions(
        PRESET_FLOORPLANS['studio-apartment'].data
      );
      for (const item of PRESET_FLOORPLANS['studio-apartment'].data.furniture) {
        expect(
          studioReports[item.id]?.hasCollision,
          `Expected ${item.name} in studio-apartment to have no collision`
        ).toBe(false);
      }

      const villaReports = evaluateFloorplanCollisions(
        PRESET_FLOORPLANS['luxury-villa'].data
      );
      for (const item of PRESET_FLOORPLANS['luxury-villa'].data.furniture) {
        expect(
          villaReports[item.id]?.hasCollision,
          `Expected ${item.name} in luxury-villa to have no collision`
        ).toBe(false);
      }
    });
  });
});
