import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  FurnitureVisualType,
  CollisionIssueType,
  FurnitureItem,
  FloorplanData,
} from '../src/core/types';
import { FURNITURE_CATALOG, PRESET_FLOORPLANS } from '../src/core/presets';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { resolveFurnitureVisual } from '../src/core/furnitureVisual';
import {
  resolveFurnitureModelType,
  ArchitecturalFurniture3D,
} from '../src/components/viewer3d/furniture/ArchitecturalFurniture3D';
import {
  GenericArchitecturalModel,
  resolveGenericArchitecturalSubType,
} from '../src/components/viewer3d/furniture/GenericArchitecturalModel';
import {
  computeFurnitureOBBs,
  computeFurnitureClearanceOBB,
  evaluateFloorplanCollisions,
} from '../src/core/collisionEngine';
import { SofaModel } from '../src/components/viewer3d/furniture/SofaModel';
import { BedModel } from '../src/components/viewer3d/furniture/BedModel';
import { FurnitureMesh3D } from '../src/components/viewer3d/FurnitureMesh3D';
import { FloorplanCanvas2D } from '../src/components/editor2d/FloorplanCanvas2D';
import { InspectorSidebar } from '../src/components/sidebar/InspectorSidebar';

const VALID_VISUAL_TYPES: FurnitureVisualType[] = [
  'sofa',
  'sectional-sofa',
  'dining-table',
  'bed',
  'wardrobe',
  'desk',
  'coffee-table',
  'bookcase',
  'sideboard',
  'vanity',
  'kitchen-unit',
  'kitchen-island',
  'bathtub',
  'shower',
  'toilet',
  'washing-machine',
  'plant',
  'wall-picture',
  'picture-rail',
  'boconcept-osaka',
  'vitsoe-606',
  'artemide-tolomeo',
  'musterring-sorrent',
  'inwerk-masterlift',
  'steelcase-gesture',
  'desk-monitor',
  'regalraum-lium',
  'neona-viva',
  'generic-seating',
  'generic-table',
  'generic-storage',
  'generic-bed',
  'box',
];

describe('Sprint 2 Data Model & Types', () => {
  describe('CollisionIssueType', () => {
    it('supports clearance-blocked issue type', () => {
      const issueType: CollisionIssueType = 'clearance-blocked';
      expect(issueType).toBe('clearance-blocked');
    });
  });

  describe('FURNITURE_CATALOG items', () => {
    it('ensures every catalog item has a valid visual type and matching catalog dimensions', () => {
      expect(FURNITURE_CATALOG.length).toBeGreaterThan(0);

      for (const item of FURNITURE_CATALOG) {
        expect(item.visual, `visual for ${item.name}`).toBeDefined();
        expect(
          VALID_VISUAL_TYPES,
          `visual for ${item.name} (${item.visual}) must be in VALID_VISUAL_TYPES`
        ).toContain(item.visual);

        expect(item.catalogWidthCm, `catalogWidthCm for ${item.name}`).toBe(item.widthCm);
        expect(item.catalogHeightCm, `catalogHeightCm for ${item.name}`).toBe(item.heightCm);
        expect(item.catalogDepthCm, `catalogDepthCm for ${item.name}`).toBe(item.depthCm);
      }
    });

    it('sets clearanceZoneCm: 50 for Kleiderschrank PAX, Küchenzeile, Kochinsel', () => {
      const pax = FURNITURE_CATALOG.find((item) => item.name.includes('PAX'));
      expect(pax).toBeDefined();
      expect(pax?.clearanceZoneCm).toBe(50);

      const kitchen = FURNITURE_CATALOG.find((item) => item.name === 'Küchenzeile');
      expect(kitchen).toBeDefined();
      expect(kitchen?.clearanceZoneCm).toBe(50);

      const island = FURNITURE_CATALOG.find((item) => item.name.includes('Kochinsel'));
      expect(island).toBeDefined();
      expect(island?.clearanceZoneCm).toBe(50);
    });

    it('sets hasNightstands: true for Doppelbett (180×200)', () => {
      const bed = FURNITURE_CATALOG.find((item) => item.name.includes('Doppelbett'));
      expect(bed).toBeDefined();
      expect(bed?.hasNightstands).toBe(true);
    });

    it('hält Wandbild und Galerieschiene als Platzhalter, nicht als Bestand', () => {
      const picture = FURNITURE_CATALOG.find((item) => item.visual === 'wall-picture');
      expect(picture?.name).toBe('Wandbild');
      expect(picture?.isRealFurniture).toBe(false);
      expect(picture?.widthCm).toBe(90);
      expect(picture?.heightCm).toBe(70);
      expect(picture?.depthCm).toBe(4);
      expect(picture?.elevationCm).toBe(115);

      const rail = FURNITURE_CATALOG.find((item) => item.visual === 'picture-rail');
      expect(rail?.name).toBe('Galerieschiene');
      expect(rail?.isRealFurniture).toBe(false);
      expect(rail?.elevationCm).toBe(230);

      expect(
        resolveFurnitureModelType({
          ...picture!,
          id: 'pic',
          x: 0,
          z: 0,
          rotationYDeg: 0,
        })
      ).toBe('wall-picture');
      expect(
        resolveFurnitureModelType({
          ...rail!,
          id: 'rail',
          x: 0,
          z: 0,
          rotationYDeg: 0,
        })
      ).toBe('picture-rail');
    });

    it('sets visual: sideboard for Sideboard / Kommode', () => {
      const sideboard = FURNITURE_CATALOG.find((item) => item.name.includes('Sideboard'));
      expect(sideboard).toBeDefined();
      expect(sideboard?.visual).toBe('sideboard');
    });
  });

  describe('PRESET_FLOORPLANS migration', () => {
    it('ensures every furniture item in preset floorplans has a valid visual set', () => {
      for (const [key, preset] of Object.entries(PRESET_FLOORPLANS)) {
        for (const item of preset.data.furniture) {
          expect(
            item.visual,
            `Furniture ${item.id} (${item.name}) in preset "${key}" must have a valid visual`
          ).toBeDefined();
          expect(
            VALID_VISUAL_TYPES,
            `visual "${item.visual}" in preset "${key}" must be valid`
          ).toContain(item.visual);
        }
      }
    });
  });

  describe('useFloorplanStore integration', () => {
    beforeEach(() => {
      useFloorplanStore.getState().loadPreset('empty-room');
    });

    it('preserves visual, catalog dimensions, clearanceZoneCm, and hasNightstands in addFurniture', () => {
      const id = useFloorplanStore.getState().addFurniture({
        name: 'Test Kleiderschrank',
        category: 'storage',
        widthCm: 200,
        heightCm: 236,
        depthCm: 60,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#f4f1ea',
        x: 100,
        z: 100,
        visual: 'wardrobe',
        catalogWidthCm: 200,
        catalogHeightCm: 236,
        catalogDepthCm: 60,
        clearanceZoneCm: 50,
        hasNightstands: false,
      });

      const added = useFloorplanStore.getState().furniture.find((f) => f.id === id);
      expect(added).toBeDefined();
      expect(added?.visual).toBe('wardrobe');
      expect(added?.catalogWidthCm).toBe(200);
      expect(added?.catalogHeightCm).toBe(236);
      expect(added?.catalogDepthCm).toBe(60);
      expect(added?.clearanceZoneCm).toBe(50);
      expect(added?.hasNightstands).toBe(false);
    });

    it('resets modified furniture dimensions to catalog dimensions using resetFurnitureToCatalogDimensions', () => {
      const id = useFloorplanStore.getState().addFurniture({
        name: 'Customized Bed',
        category: 'bedroom',
        widthCm: 180,
        heightCm: 90,
        depthCm: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#a8a29e',
        x: 200,
        z: 200,
        visual: 'bed',
        catalogWidthCm: 180,
        catalogHeightCm: 90,
        catalogDepthCm: 200,
        hasNightstands: true,
      });

      // Modify the furniture dimensions
      useFloorplanStore.getState().updateFurniture(id, {
        widthCm: 220,
        heightCm: 110,
        depthCm: 240,
      });

      let updated = useFloorplanStore.getState().furniture.find((f) => f.id === id);
      expect(updated?.widthCm).toBe(220);
      expect(updated?.heightCm).toBe(110);
      expect(updated?.depthCm).toBe(240);

      // Reset to catalog dimensions
      useFloorplanStore.getState().resetFurnitureToCatalogDimensions(id);

      updated = useFloorplanStore.getState().furniture.find((f) => f.id === id);
      expect(updated?.widthCm).toBe(180);
      expect(updated?.heightCm).toBe(90);
      expect(updated?.depthCm).toBe(200);
    });

    it('handles resetFurnitureToCatalogDimensions safely when no catalog dimensions or item does not exist', () => {
      const id = useFloorplanStore.getState().addFurniture({
        name: 'Item without catalog dims',
        category: 'custom',
        widthCm: 100,
        heightCm: 100,
        depthCm: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
        x: 50,
        z: 50,
      });

      // Modify dimensions
      useFloorplanStore.getState().updateFurniture(id, { widthCm: 120 });
      // Calling reset should be a no-op
      expect(() => {
        useFloorplanStore.getState().resetFurnitureToCatalogDimensions(id);
      }).not.toThrow();

      let item = useFloorplanStore.getState().furniture.find((f) => f.id === id);
      expect(item?.widthCm).toBe(120);

      // Non-existent ID
      expect(() => {
        useFloorplanStore.getState().resetFurnitureToCatalogDimensions('non-existent-id');
      }).not.toThrow();
    });

    it('preserves visual and catalog fields across exportJson and importJson round-trip', () => {
      useFloorplanStore.getState().addFurniture({
        name: 'Full Metadata Furniture',
        category: 'storage',
        widthCm: 150,
        heightCm: 80,
        depthCm: 45,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#c7b299',
        x: 100,
        z: 100,
        visual: 'sideboard',
        catalogWidthCm: 150,
        catalogHeightCm: 80,
        catalogDepthCm: 45,
        clearanceZoneCm: 40,
        hasNightstands: false,
      });

      const jsonStr = useFloorplanStore.getState().exportJson();
      const success = useFloorplanStore.getState().importJson(jsonStr);
      expect(success).toBe(true);

      const imported = useFloorplanStore
        .getState()
        .furniture.find((f) => f.name === 'Full Metadata Furniture');
      expect(imported).toBeDefined();
      expect(imported?.visual).toBe('sideboard');
      expect(imported?.catalogWidthCm).toBe(150);
      expect(imported?.catalogHeightCm).toBe(80);
      expect(imported?.catalogDepthCm).toBe(45);
      expect(imported?.clearanceZoneCm).toBe(40);
      expect(imported?.hasNightstands).toBe(false);
    });

    it('sanitizes invalid or negative catalog dimensions and visual when importing JSON', () => {
      const invalidJson = JSON.stringify({
        corners: [
          { id: 'c1', x: 0, z: 0 },
          { id: 'c2', x: 100, z: 0 },
          { id: 'c3', x: 100, z: 100 },
        ],
        walls: [
          { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
        ],
        openings: [],
        furniture: [
          {
            id: 'f-invalid',
            name: 'Sanitized Item',
            widthCm: 100,
            heightCm: 100,
            depthCm: 100,
            x: 50,
            z: 50,
            visual: 12345, // invalid type
            catalogWidthCm: -50,
            catalogHeightCm: 0,
            catalogDepthCm: NaN,
            clearanceZoneCm: -10,
          },
        ],
      });

      const success = useFloorplanStore.getState().importJson(invalidJson);
      expect(success).toBe(true);

      const imported = useFloorplanStore.getState().furniture.find((f) => f.id === 'f-invalid');
      expect(imported).toBeDefined();
      expect(imported?.visual).toBeUndefined();
      expect(imported?.catalogWidthCm).toBeUndefined();
      expect(imported?.catalogHeightCm).toBeUndefined();
      expect(imported?.catalogDepthCm).toBeUndefined();
      expect(imported?.clearanceZoneCm).toBeUndefined();
    });
  });

  describe('Core-Visual-Resolver & Namensentkopplung (resolveFurnitureVisual)', () => {
    it('does NOT resolve to boconcept-osaka for name "Osaka" with no visual and no brand', () => {
      const item: FurnitureItem = {
        id: 'f-osaka-unbranded',
        name: 'Osaka',
        category: 'living',
        widthCm: 170,
        heightCm: 77,
        depthCm: 87.5,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#78716c',
      };

      const visual = resolveFurnitureVisual(item);
      expect(visual).not.toBe('boconcept-osaka');
      expect(visual).toBe('box');

      const modelType = resolveFurnitureModelType(item);
      expect(modelType).not.toBe('boconcept-osaka');
      expect(modelType).toBe('generic');
    });

    it('remains sofa when visual is "sofa" even if name is changed to "Osaka"', () => {
      const item: FurnitureItem = {
        id: 'f-sofa-osaka-name',
        name: 'BoConcept Osaka Couch Extra',
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

      expect(resolveFurnitureVisual(item)).toBe('sofa');
      expect(resolveFurnitureModelType(item)).toBe('sofa');
    });

    it('evaluates dining table identically in ArchitecturalFurniture3D and collisionEngine without disparity when visual is "dining-table"', () => {
      const diningTable: FurnitureItem = {
        id: 'f-dining-table',
        name: 'Unusual Table Name',
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

      // Architectural model type must resolve to dining-table
      expect(resolveFurnitureVisual(diningTable)).toBe('dining-table');
      expect(resolveFurnitureModelType(diningTable)).toBe('dining-table');

      // Collision engine must compute table + chair OBBs (not single box OBB)
      const obbs = computeFurnitureOBBs(diningTable);
      // A 180cm table with chairs computes 1 tabletop + 6 chairs = 7 OBBs
      expect(obbs).toHaveLength(7);
    });

    it('evaluates isSectional === false in SofaModel when visual is "sofa" even if name is "Ecksofa"', () => {
      const ecksofaName: FurnitureItem = {
        id: 'sofa-eck-named',
        name: 'Großes Ecksofa mit Chaise L-Form',
        category: 'living',
        widthCm: 240,
        heightCm: 78,
        depthCm: 160,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#e7e5e4',
        visual: 'sofa',
      };

      // Model resolution and collision engine evaluate it strictly as linear sofa
      expect(resolveFurnitureVisual(ecksofaName)).toBe('sofa');
      expect(resolveFurnitureModelType(ecksofaName)).toBe('sofa');
      expect(computeFurnitureOBBs(ecksofaName)).toHaveLength(1);

      // Rendering SofaModel strictly renders linear cushions without chaise lounge
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(SofaModel, { item: ecksofaName })
      );
      expect(html).toBeTruthy();
      expect(html).toContain('name="sofa-seat-cushion"');
      expect(html).not.toContain('name="sofa-chaise-cushion"');
    });

    it('returns "box" for explicit visual === "box" and as fallback for unknown/custom categories', () => {
      // 1. Explicit visual: 'box'
      const explicitBox: FurnitureItem = {
        id: 'box-1',
        name: 'Custom Box',
        category: 'living',
        widthCm: 100,
        heightCm: 100,
        depthCm: 100,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#fff',
        visual: 'box',
      };
      expect(resolveFurnitureVisual(explicitBox)).toBe('box');
      expect(resolveFurnitureModelType(explicitBox)).toBe('generic');

      // 2. Custom category without visual fallback
      const customItem: FurnitureItem = {
        id: 'custom-1',
        name: 'Custom Uncategorized Piece',
        category: 'custom',
        widthCm: 100,
        heightCm: 100,
        depthCm: 100,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#fff',
      };
      expect(resolveFurnitureVisual(customItem)).toBe('box');
      expect(resolveFurnitureModelType(customItem)).toBe('generic');

      // 3. Unrecognized category without visual fallback
      const unknownCatItem: FurnitureItem = {
        id: 'custom-2',
        name: 'Unrecognized Category Piece',
        category: 'unrecognized' as any,
        widthCm: 80,
        heightCm: 80,
        depthCm: 80,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#fff',
      };
      expect(resolveFurnitureVisual(unknownCatItem)).toBe('box');
      expect(resolveFurnitureModelType(unknownCatItem)).toBe('generic');
    });
  });

  describe('Generic Architectural Models (Entscheidung 6.1)', () => {
    it('resolves generic subtype correctly from visual, category, or explicit subType', () => {
      const itemTable: FurnitureItem = {
        id: 'table-1',
        name: 'Tisch',
        category: 'living',
        widthCm: 140,
        heightCm: 75,
        depthCm: 80,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#c0c0c0',
        visual: 'generic-table',
      };
      expect(resolveGenericArchitecturalSubType(itemTable)).toBe('table');
      expect(resolveGenericArchitecturalSubType(itemTable, 'storage')).toBe('storage');

      const itemSeating: FurnitureItem = {
        id: 'seat-1',
        name: 'Sitz',
        category: 'living',
        widthCm: 80,
        heightCm: 85,
        depthCm: 85,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#d0d0d0',
        visual: 'generic-seating',
      };
      expect(resolveGenericArchitecturalSubType(itemSeating)).toBe('seating');

      const itemStorage: FurnitureItem = {
        id: 'stor-1',
        name: 'Regal',
        category: 'storage',
        widthCm: 90,
        heightCm: 180,
        depthCm: 40,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#e0e0e0',
        visual: 'generic-storage',
      };
      expect(resolveGenericArchitecturalSubType(itemStorage)).toBe('storage');

      const itemBed: FurnitureItem = {
        id: 'bed-1',
        name: 'Bett',
        category: 'bedroom',
        widthCm: 160,
        heightCm: 60,
        depthCm: 200,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#f0f0f0',
        visual: 'generic-bed',
      };
      expect(resolveGenericArchitecturalSubType(itemBed)).toBe('bed');

      const itemBox: FurnitureItem = {
        id: 'box-1',
        name: 'Kiste',
        category: 'custom',
        widthCm: 50,
        heightCm: 50,
        depthCm: 50,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
        visual: 'box',
      };
      expect(resolveGenericArchitecturalSubType(itemBox)).toBe('box');

      // Fallback by category
      const catBedItem: FurnitureItem = {
        ...itemBed,
        visual: undefined,
      };
      expect(resolveGenericArchitecturalSubType(catBedItem)).toBe('bed');
    });

    it('renders generic table with tabletop and 4 legs', () => {
      const tableItem: FurnitureItem = {
        id: 'tbl-generic',
        name: 'Generischer Tisch',
        category: 'living',
        widthCm: 160,
        heightCm: 76,
        depthCm: 90,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#e2d8ce',
        visual: 'generic-table',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(GenericArchitecturalModel, { item: tableItem })
      );

      expect(html).toBeTruthy();
      expect(html).toContain('name="generic-tabletop"');
      // Count leg occurrences (must have 4 corner legs)
      const legMatches = html.match(/name="generic-table-leg"/g);
      expect(legMatches).not.toBeNull();
      expect(legMatches?.length).toBe(4);
      // Zero fruit / unwanted decoration
      expect(html).not.toContain('fruit-bowl');
      expect(html).not.toContain('apple');
    });

    it('renders generic seating with plinth, seat cushion, backrest, and 2 armrests', () => {
      const seatingItem: FurnitureItem = {
        id: 'seat-generic',
        name: 'Generischer Sessel',
        category: 'living',
        widthCm: 95,
        heightCm: 82,
        depthCm: 85,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#cbd5e1',
        visual: 'generic-seating',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(GenericArchitecturalModel, { item: seatingItem })
      );

      expect(html).toBeTruthy();
      expect(html).toContain('name="generic-seating-plinth"');
      expect(html).toContain('name="generic-seating-base"');
      expect(html).toContain('name="generic-seating-seat"');
      expect(html).toContain('name="generic-seating-backrest"');
      expect(html).toContain('name="generic-seating-armrest-left"');
      expect(html).toContain('name="generic-seating-armrest-right"');
    });

    it('renders generic storage with plinth, carcass body, and shelf dividers', () => {
      const storageItem: FurnitureItem = {
        id: 'stor-generic',
        name: 'Generischer Schrank',
        category: 'storage',
        widthCm: 100,
        heightCm: 200,
        depthCm: 45,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#94a3b8',
        visual: 'generic-storage',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(GenericArchitecturalModel, { item: storageItem })
      );

      expect(html).toBeTruthy();
      expect(html).toContain('name="generic-storage-plinth"');
      expect(html).toContain('name="generic-storage-body"');
      const dividerMatches = html.match(/name="generic-storage-divider"/g);
      expect(dividerMatches).not.toBeNull();
      expect(dividerMatches!.length).toBeGreaterThanOrEqual(1);
    });

    it('renders generic bed with frame, 4 corner leg blocks, and inset mattress', () => {
      const bedItem: FurnitureItem = {
        id: 'bed-generic',
        name: 'Generisches Bett',
        category: 'bedroom',
        widthCm: 180,
        heightCm: 55,
        depthCm: 200,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
        visual: 'generic-bed',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(GenericArchitecturalModel, { item: bedItem })
      );

      expect(html).toBeTruthy();
      expect(html).toContain('name="generic-bed-frame"');
      expect(html).toContain('name="generic-bed-mattress"');
      const legMatches = html.match(/name="generic-bed-leg"/g);
      expect(legMatches).not.toBeNull();
      expect(legMatches?.length).toBe(4);
    });

    it('renders generic box with recessed plinth and main block', () => {
      const boxItem: FurnitureItem = {
        id: 'box-generic',
        name: 'Architektonischer Block',
        category: 'custom',
        widthCm: 60,
        heightCm: 45,
        depthCm: 60,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#e2e8f0',
        visual: 'box',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(GenericArchitecturalModel, { item: boxItem })
      );

      expect(html).toBeTruthy();
      expect(html).toContain('name="generic-box-plinth"');
      expect(html).toContain('name="generic-box-main"');
    });

    it('renders custom pieces without detailed designer model via GenericArchitecturalModel in ArchitecturalFurniture3D', () => {
      const customPiece: FurnitureItem = {
        id: 'custom-sculpture-block',
        name: 'Podest / Block',
        category: 'custom',
        widthCm: 70,
        heightCm: 90,
        depthCm: 50,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#e2e8f0',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ArchitecturalFurniture3D, { item: customPiece })
      );

      expect(html).toBeTruthy();
      // Instead of an old plain box, it renders via GenericArchitecturalModel (containing architectural plinth & main block)
      expect(html).toContain('name="generic-architectural-model"');
      expect(html).toContain('name="generic-box-plinth"');
      expect(html).toContain('name="generic-box-main"');
    });

    it('renders generic-table visual pieces via GenericArchitecturalModel in ArchitecturalFurniture3D', () => {
      const tablePiece: FurnitureItem = {
        id: 'custom-table-piece',
        name: 'Individueller Konferenztisch',
        category: 'office',
        widthCm: 220,
        heightCm: 74,
        depthCm: 110,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#334155',
        visual: 'generic-table',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ArchitecturalFurniture3D, { item: tablePiece })
      );

      expect(html).toBeTruthy();
      expect(html).toContain('name="generic-architectural-model"');
      expect(html).toContain('name="generic-tabletop"');
      const legs = html.match(/name="generic-table-leg"/g);
      expect(legs?.length).toBe(4);
    });
  });

  describe('InspectorSidebar Visual, Catalog Deviation, and Custom Controls', () => {
    beforeEach(() => {
      useFloorplanStore.getState().loadPreset('empty-room');
    });

    it('renders deviation warning and reset button when dimensions deviate from catalog', () => {
      const deviatingItem: FurnitureItem = {
        id: 'f-deviating',
        name: 'Modifiziertes Sofa',
        category: 'living',
        widthCm: 220, // deviated from 200
        heightCm: 80,
        depthCm: 90,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#6366f1',
        catalogWidthCm: 200,
        catalogHeightCm: 80,
        catalogDepthCm: 90,
        visual: 'sofa',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: deviatingItem })
      );

      expect(html).toContain('Maße weichen vom Katalog ab');
      expect(html).toContain('200 × 80 × 90 cm');
      expect(html).toContain('Auf Katalogmaße zurücksetzen');
    });

    it('does not render deviation warning when dimensions match catalog dimensions', () => {
      const matchingItem: FurnitureItem = {
        id: 'f-matching',
        name: 'Original Sofa',
        category: 'living',
        widthCm: 200,
        heightCm: 80,
        depthCm: 90,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#6366f1',
        catalogWidthCm: 200,
        catalogHeightCm: 80,
        catalogDepthCm: 90,
        visual: 'sofa',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: matchingItem })
      );

      expect(html).not.toContain('Maße weichen vom Katalog ab');
      expect(html).not.toContain('Auf Katalogmaße zurücksetzen');
    });

    it('renders 3D-Modell-Darstellung dropdown with options and current value', () => {
      const item: FurnitureItem = {
        id: 'f-dining',
        name: 'Esstisch',
        category: 'living',
        widthCm: 160,
        heightCm: 75,
        depthCm: 90,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#d97706',
        visual: 'dining-table',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: item })
      );

      expect(html).toContain('3D-Modell-Darstellung');
      expect(html).toContain('Auto (Katalog / Kategorie)');
      expect(html).toContain('value="dining-table"');
      expect(html).toContain('value="sofa"');
      expect(html).toContain('value="generic-table"');
      expect(html).toContain('value="box"');
    });

    it('ignores micro-deviations under 0.05cm tolerance', () => {
      const microDeviatedItem: FurnitureItem = {
        id: 'f-micro',
        name: 'Micro-deviated Table',
        category: 'living',
        widthCm: 200.02, // 0.02cm difference
        heightCm: 80,
        depthCm: 90,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#6366f1',
        catalogWidthCm: 200,
        catalogHeightCm: 80,
        catalogDepthCm: 90,
        visual: 'generic-table',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: microDeviatedItem })
      );

      expect(html).not.toContain('Maße weichen vom Katalog ab');
    });

    it('renders controls according to effectiveVisual when visual is undefined (Auto)', () => {
      // Bed item without explicit visual -> category: bedroom resolves to bed
      const autoBedItem: FurnitureItem = {
        id: 'f-auto-bed',
        name: 'Schlafzimmerbett',
        category: 'bedroom',
        widthCm: 180,
        heightCm: 90,
        depthCm: 200,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
        hasNightstands: true,
      };

      const htmlBed = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: autoBedItem })
      );
      expect(htmlBed).not.toContain('Schwebende Nachttische anzeigen');

      // Ohne visual bleibt es eine Kiste, auch wenn der Name nach einem Schrank klingt.
      const autoWardrobeItem: FurnitureItem = {
        id: 'f-auto-wardrobe',
        name: 'Kleiderschrank PAX 200cm',
        category: 'storage',
        widthCm: 200,
        heightCm: 236,
        depthCm: 60,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
      };

      const htmlWardrobe = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: autoWardrobeItem })
      );
      expect(htmlWardrobe).not.toContain('Auszugszone / Türfreiraum (cm)');
      expect(htmlWardrobe).not.toContain('Auszugszone vor Front prüfen');
    });

    it('resets furniture to catalog dimensions via store and removes deviation banner', () => {
      const id = useFloorplanStore.getState().addFurniture({
        name: 'Deviated Wardrobe',
        category: 'storage',
        widthCm: 250, // modified
        heightCm: 236,
        depthCm: 60,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#f4f1ea',
        x: 100,
        z: 100,
        catalogWidthCm: 200,
        catalogHeightCm: 236,
        catalogDepthCm: 60,
        visual: 'wardrobe',
      });
      useFloorplanStore.getState().selectEntity(id, 'furniture');

      // Before reset: deviation banner is rendered
      let html = ReactDOMServer.renderToStaticMarkup(React.createElement(InspectorSidebar));
      expect(html).toContain('Maße weichen vom Katalog ab');
      expect(html).toContain('Auf Katalogmaße zurücksetzen');

      // Execute reset
      useFloorplanStore.getState().resetFurnitureToCatalogDimensions(id);

      // Verify store state
      const itemAfter = useFloorplanStore.getState().furniture.find((f) => f.id === id);
      expect(itemAfter?.widthCm).toBe(200);

      // After reset: deviation banner should be gone
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(InspectorSidebar));
      expect(html).not.toContain('Maße weichen vom Katalog ab');
      expect(html).not.toContain('Auf Katalogmaße zurücksetzen');
    });

    it('renders bed nightstand checkbox for bed visual types and wide bedroom items', () => {
      const bedItem: FurnitureItem = {
        id: 'f-bed',
        name: 'Doppelbett',
        category: 'bedroom',
        widthCm: 180,
        heightCm: 90,
        depthCm: 200,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
        visual: 'bed',
        hasNightstands: true,
      };

      const htmlBed = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: bedItem })
      );
      expect(htmlBed).toContain('Schwebende Nachttische anzeigen');
      expect(htmlBed).toContain('checked=""');

      // Narrow bed (160 cm) without explicit hasNightstands should NOT be checked by default
      const narrowBedItem: FurnitureItem = {
        ...bedItem,
        widthCm: 160,
        hasNightstands: undefined,
      };
      const htmlNarrow = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: narrowBedItem })
      );
      expect(htmlNarrow).toContain('Schwebende Nachttische anzeigen');
      expect(htmlNarrow).not.toContain('checked=""');

      // Wide bed (>= 190 cm) without explicit hasNightstands SHOULD be checked by default
      const wideBedItem: FurnitureItem = {
        ...bedItem,
        widthCm: 200,
        hasNightstands: undefined,
      };
      const htmlWide = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: wideBedItem })
      );
      expect(htmlWide).toContain('Schwebende Nachttische anzeigen');
      expect(htmlWide).toContain('checked=""');

      const deskItem: FurnitureItem = {
        id: 'f-desk',
        name: 'Schreibtisch',
        category: 'office',
        widthCm: 140,
        heightCm: 74,
        depthCm: 70,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#334155',
        visual: 'desk',
      };

      const htmlDesk = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: deskItem })
      );
      expect(htmlDesk).not.toContain('Schwebende Nachttische anzeigen');
    });

    it('renders clearance zone (Auszugszone) inputs for wardrobe and items with clearanceZoneCm', () => {
      const wardrobeItem: FurnitureItem = {
        id: 'f-wardrobe',
        name: 'Schrank',
        category: 'storage',
        widthCm: 200,
        heightCm: 236,
        depthCm: 60,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
        visual: 'wardrobe',
        clearanceZoneCm: 50,
      };

      const htmlWardrobe = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: wardrobeItem })
      );
      expect(htmlWardrobe).toContain('Auszugszone / Türfreiraum (cm)');
      expect(htmlWardrobe).toContain('Auszugszone vor Front prüfen');

      const simpleTableItem: FurnitureItem = {
        id: 'f-table-simple',
        name: 'Tisch ohne Auszug',
        category: 'living',
        widthCm: 120,
        heightCm: 75,
        depthCm: 80,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
        visual: 'generic-table',
      };

      const htmlTable = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: simpleTableItem })
      );
      expect(htmlTable).not.toContain('Auszugszone / Türfreiraum (cm)');
      expect(htmlTable).not.toContain('Auszugszone vor Front prüfen');
    });
  });

  describe('Clearance Zone Collision & OBB Evaluation', () => {
    it('creates correct clearance zone OBB and position', () => {
      const item: FurnitureItem = {
        id: 'f-pax',
        name: 'Kleiderschrank PAX',
        category: 'storage',
        widthCm: 100,
        heightCm: 200,
        depthCm: 60,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
        visual: 'wardrobe',
        clearanceZoneCm: 50,
      };

      const obb = computeFurnitureClearanceOBB(item);
      expect(obb).not.toBeNull();
      // Center: localZ = depth/2 + clearance/2 = 30 + 25 = 55. World: (100, 100, 155)
      expect(obb!.center.x).toBeCloseTo(100, 2);
      expect(obb!.center.y).toBeCloseTo(100, 2);
      expect(obb!.center.z).toBeCloseTo(155, 2);
      // Half sizes (width/2, height/2, clearance/2) minus epsilon (0.05)
      expect(obb!.halfSize.x).toBeCloseTo(49.95, 2);
      expect(obb!.halfSize.y).toBeCloseTo(99.95, 2);
      expect(obb!.halfSize.z).toBeCloseTo(24.95, 2);

      // With shrinkCm = 0
      const exactObb = computeFurnitureClearanceOBB(item, 0);
      expect(exactObb!.halfSize.x).toBe(50);
      expect(exactObb!.halfSize.y).toBe(100);
      expect(exactObb!.halfSize.z).toBe(25);

      // Returns null when no clearance zone
      expect(computeFurnitureClearanceOBB({ ...item, clearanceZoneCm: undefined })).toBeNull();
      expect(computeFurnitureClearanceOBB({ ...item, clearanceZoneCm: 0 })).toBeNull();
      expect(computeFurnitureClearanceOBB({ ...item, clearanceZoneCm: -10 })).toBeNull();

      // Rotated 90 degrees: front points in +X direction
      const rotatedItem: FurnitureItem = { ...item, rotationYDeg: 90 };
      const rotObb = computeFurnitureClearanceOBB(rotatedItem);
      expect(rotObb).not.toBeNull();
      expect(rotObb!.center.x).toBeCloseTo(155, 2);
      expect(rotObb!.center.y).toBeCloseTo(100, 2);
      expect(rotObb!.center.z).toBeCloseTo(100, 2);
    });

    it('detects collision when another furniture item is inside clearance zone', () => {
      const wardrobe: FurnitureItem = {
        id: 'f-wardrobe',
        name: 'Kleiderschrank',
        category: 'storage',
        widthCm: 100,
        heightCm: 200,
        depthCm: 60,
        x: 200,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
        visual: 'wardrobe',
        clearanceZoneCm: 50,
      };

      // Stuhl is placed at z: 255 (within wardrobe clearance zone z in [230, 280])
      // Wardrobe itself is z in [170, 230], so chair does NOT intersect wardrobe body
      const chair: FurnitureItem = {
        id: 'f-chair',
        name: 'Stuhl',
        category: 'living',
        widthCm: 40,
        heightCm: 80,
        depthCm: 40,
        x: 200,
        z: 255,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#94a3b8',
        visual: 'generic-seating',
      };

      const floorplan: FloorplanData = {
        corners: [],
        walls: [],
        openings: [],
        furniture: [wardrobe, chair],
      };

      const reports = evaluateFloorplanCollisions(floorplan);
      expect(reports['f-wardrobe'].hasCollision).toBe(true);

      const clearanceIssue = reports['f-wardrobe'].issues.find(
        (i) => i.type === 'clearance-blocked' && i.targetId === 'f-chair'
      );
      expect(clearanceIssue).toBeDefined();
      expect(clearanceIssue?.message).toBe(
        'Auszugszone vor "Kleiderschrank" (50 cm) blockiert durch "Stuhl".'
      );

      // Wardrobe body itself should not be intersecting with chair
      const directIntersection = reports['f-wardrobe'].issues.find(
        (i) => i.type === 'furniture-intersection' && i.targetId === 'f-chair'
      );
      expect(directIntersection).toBeUndefined();
    });

    it('reports NO clearance collision when another furniture item is outside clearance zone', () => {
      const wardrobe: FurnitureItem = {
        id: 'f-wardrobe',
        name: 'Kleiderschrank',
        category: 'storage',
        widthCm: 100,
        heightCm: 200,
        depthCm: 60,
        x: 200,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
        visual: 'wardrobe',
        clearanceZoneCm: 50,
      };

      // Chair placed at z: 320 (depth 40 -> z in [300, 340], well beyond z: 280 clearance zone)
      const chair: FurnitureItem = {
        id: 'f-chair',
        name: 'Stuhl',
        category: 'living',
        widthCm: 40,
        heightCm: 80,
        depthCm: 40,
        x: 200,
        z: 320,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#94a3b8',
        visual: 'generic-seating',
      };

      const floorplan: FloorplanData = {
        corners: [],
        walls: [],
        openings: [],
        furniture: [wardrobe, chair],
      };

      const reports = evaluateFloorplanCollisions(floorplan);
      expect(reports['f-wardrobe'].hasCollision).toBe(false);
      expect(reports['f-wardrobe'].issues).toHaveLength(0);
    });

    it('detects collision when door swing sector intersects clearance zone', () => {
      // Horizontal wall at z = 300
      const c1 = { id: 'c1', x: 50, z: 300 };
      const c2 = { id: 'c2', x: 350, z: 300 };
      const wall = {
        id: 'w1',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 10,
        heightCm: 250,
      };
      // Door opening at offset 120 cm, width 80 cm, swinging inwards (-Z direction, towards wardrobe)
      const door = {
        id: 'op-door',
        wallId: 'w1',
        type: 'door' as const,
        offsetFromStartCm: 120,
        widthCm: 80,
        heightCm: 200,
        sillHeightCm: 0,
        swingDirection: 'out-left' as const,
      };

      // Wardrobe PAX facing +Z (towards z: 300 wall), clearance zone reaching z: 280
      const wardrobe: FurnitureItem = {
        id: 'f-wardrobe',
        name: 'Kleiderschrank PAX',
        category: 'storage',
        widthCm: 100,
        heightCm: 200,
        depthCm: 60,
        x: 210,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
        visual: 'wardrobe',
        clearanceZoneCm: 60, // reach up to z: 200 + 30 + 60 = 290
      };

      const floorplan: FloorplanData = {
        corners: [c1, c2],
        walls: [wall],
        openings: [door],
        furniture: [wardrobe],
      };

      const reports = evaluateFloorplanCollisions(floorplan);
      expect(reports['f-wardrobe'].hasCollision).toBe(true);
      const doorIssue = reports['f-wardrobe'].issues.find(
        (i) => i.type === 'clearance-blocked' && i.targetId === 'op-door'
      );
      expect(doorIssue).toBeDefined();
      expect(doorIssue?.message).toBe(
        'Auszugszone vor "Kleiderschrank PAX" (60 cm) blockiert durch Türschwenkbereich.'
      );
    });

    it('detects collision when clearance zone intersects a wall', () => {
      // Facing wall at z = 260
      const c1 = { id: 'c1', x: 50, z: 260 };
      const c2 = { id: 'c2', x: 350, z: 260 };
      const wall = {
        id: 'w-facing',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 10,
        heightCm: 250,
      };

      // Wardrobe PAX at z = 200, depth = 60, clearance = 50 -> clearance zone reaches z: 280 (penetrates wall at z: 260)
      // Wardrobe body is z in [170, 230], so body does NOT intersect wall
      const wardrobe: FurnitureItem = {
        id: 'f-wardrobe',
        name: 'Kleiderschrank PAX',
        category: 'storage',
        widthCm: 100,
        heightCm: 200,
        depthCm: 60,
        x: 200,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
        visual: 'wardrobe',
        clearanceZoneCm: 50,
      };

      const floorplan: FloorplanData = {
        corners: [c1, c2],
        walls: [wall],
        openings: [],
        furniture: [wardrobe],
      };

      const reports = evaluateFloorplanCollisions(floorplan);
      expect(reports['f-wardrobe'].hasCollision).toBe(true);
      const wallIssue = reports['f-wardrobe'].issues.find(
        (i) => i.type === 'clearance-blocked' && i.targetId === 'w-facing'
      );
      expect(wallIssue).toBeDefined();
      expect(wallIssue?.message).toBe(
        'Auszugszone vor "Kleiderschrank PAX" (50 cm) ragt in Wand hinein.'
      );
    });

    it('renders 3D clearance zone ground plane rectangle when selected or blocked', () => {
      const wardrobe: FurnitureItem = {
        id: 'f-wardrobe-3d',
        name: 'Kleiderschrank PAX',
        category: 'storage',
        widthCm: 100,
        heightCm: 200,
        depthCm: 60,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
        visual: 'wardrobe',
        clearanceZoneCm: 50,
      };

      // 1. When selected: renders clearance box geometry args [100, 0.2, 50]
      const treeSelected = FurnitureMesh3D({
        item: wardrobe,
        isSelected: true,
        onStartDrag: () => {},
      }) as React.ReactElement<any>;
      const childrenSelected = React.Children.toArray(treeSelected.props.children) as React.ReactElement<any>[];
      const clearanceMeshSelected = childrenSelected.find(
        (c) => c.props?.position?.[1] === -wardrobe.heightCm / 2 + 0.1
      );
      expect(clearanceMeshSelected).toBeDefined();
      expect(clearanceMeshSelected?.props.position).toEqual([
        0,
        -wardrobe.heightCm / 2 + 0.1,
        wardrobe.depthCm / 2 + 25,
      ]);
      const clearanceChildren = React.Children.toArray(clearanceMeshSelected?.props.children) as React.ReactElement<any>[];
      const boxGeom = clearanceChildren.find((c) => c.type === 'boxGeometry');
      expect(boxGeom).toBeDefined();
      expect(boxGeom?.props.args).toEqual([100, 0.2, 50]);

      // 2. When not selected and no collision: does not render clearance mesh
      const treeUnselected = FurnitureMesh3D({
        item: wardrobe,
        isSelected: false,
        onStartDrag: () => {},
      }) as React.ReactElement<any>;
      const childrenUnselected = React.Children.toArray(treeUnselected.props.children) as React.ReactElement<any>[];
      const clearanceMeshUnselected = childrenUnselected.find(
        (c) => c.props?.position?.[1] === -wardrobe.heightCm / 2 + 0.1
      );
      expect(clearanceMeshUnselected).toBeUndefined();

      // 3. When not selected but has clearance-blocked issue: renders clearance mesh
      const treeBlocked = FurnitureMesh3D({
        item: wardrobe,
        isSelected: false,
        report: {
          furnitureId: wardrobe.id,
          hasCollision: true,
          issues: [
            {
              type: 'clearance-blocked',
              targetId: 'other-1',
              message: 'Auszugszone blockiert',
            },
          ],
          clearancesCm: { leftCm: null, rightCm: null },
        },
        onStartDrag: () => {},
      }) as React.ReactElement<any>;
      const childrenBlocked = React.Children.toArray(treeBlocked.props.children) as React.ReactElement<any>[];
      const clearanceMeshBlocked = childrenBlocked.find(
        (c) => c.props?.position?.[1] === -wardrobe.heightCm / 2 + 0.1
      );
      expect(clearanceMeshBlocked).toBeDefined();
    });

    it('renders 2D dashed clearance zone rect in FloorplanCanvas2D', () => {
      const wardrobe: FurnitureItem = {
        id: 'f-wardrobe-2d',
        name: 'Kleiderschrank PAX',
        category: 'storage',
        widthCm: 100,
        heightCm: 200,
        depthCm: 60,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
        visual: 'wardrobe',
        clearanceZoneCm: 50,
      };

      useFloorplanStore.setState({
        furniture: [wardrobe],
        walls: [],
        corners: [],
        openings: [],
      });

      const html2D = ReactDOMServer.renderToStaticMarkup(
        React.createElement(FloorplanCanvas2D)
      );
      expect(html2D).toContain('stroke-dasharray="4 3"');
      expect(html2D).toContain('width="100"');
      expect(html2D).toContain('height="50"');
    });
  });

  describe('Bed Nightstands Compound OBBs and 3D Toggle', () => {
    it('200 cm bed with hasNightstands: true generates 3 OBBs and collides with wall next to nightstand', () => {
      const bed: FurnitureItem = {
        id: 'f-bed',
        name: 'Doppelbett',
        category: 'bedroom',
        widthCm: 200,
        heightCm: 90,
        depthCm: 200,
        x: 200,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
        visual: 'bed',
        hasNightstands: true,
      };

      const obbs = computeFurnitureOBBs(bed);
      expect(obbs).toHaveLength(3);

      // Nightstand OBB center Z matches -depth / 2 + headboardD + 25
      const headboardD = Math.max(10, Math.min(18, bed.depthCm * 0.08));
      const expectedLocalZ = -bed.depthCm / 2 + headboardD + 25;
      expect(obbs[1].center.z).toBeCloseTo(bed.z + expectedLocalZ, 2);
      expect(obbs[2].center.z).toBeCloseTo(bed.z + expectedLocalZ, 2);
      expect(obbs[1].center.x).toBeCloseTo(bed.x - (bed.widthCm / 2 + 15), 2);
      expect(obbs[2].center.x).toBeCloseTo(bed.x + (bed.widthCm / 2 + 15), 2);

      // Wall at x = 75, spanning z from 0 to 400 (thickness 10 cm: x in [70, 80])
      // Bed body is x in [100, 300] -> does NOT intersect wall
      // Left nightstand is at x = 200 - 100 - 15 = 85 (width 30: x in [70, 100]) -> intersects wall
      const c1 = { id: 'c1', x: 75, z: 0 };
      const c2 = { id: 'c2', x: 75, z: 400 };
      const wall = {
        id: 'w-left',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 10,
        heightCm: 250,
      };

      const floorplan: FloorplanData = {
        corners: [c1, c2],
        walls: [wall],
        openings: [],
        furniture: [bed],
      };

      const reports = evaluateFloorplanCollisions(floorplan);
      expect(reports['f-bed'].hasCollision).toBe(true);
      const wallIssue = reports['f-bed'].issues.find(
        (i) => i.type === 'wall-intersection' && i.targetId === 'w-left'
      );
      expect(wallIssue).toBeDefined();
    });

    it('generic-bed (even with width >= 190) does not generate nightstands', () => {
      const genericBed: FurnitureItem = {
        id: 'f-gen-bed',
        name: 'Generic Bed',
        category: 'bedroom',
        widthCm: 200,
        heightCm: 90,
        depthCm: 200,
        x: 200,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
        visual: 'generic-bed',
        hasNightstands: true,
      };

      const obbs = computeFurnitureOBBs(genericBed);
      expect(obbs).toHaveLength(1);
    });

    it('narrow bed without explicit hasNightstands does not have nightstand OBBs', () => {
      const narrowBed: FurnitureItem = {
        id: 'f-narrow-bed',
        name: 'Single Bed',
        category: 'bedroom',
        widthCm: 160,
        heightCm: 90,
        depthCm: 200,
        x: 200,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
        visual: 'bed',
        hasNightstands: undefined,
      };

      const obbs = computeFurnitureOBBs(narrowBed);
      expect(obbs).toHaveLength(1);
    });

    it('200 cm bed with hasNightstands: false generates 1 OBB and does NOT collide with the same wall', () => {
      const bed: FurnitureItem = {
        id: 'f-bed',
        name: 'Doppelbett',
        category: 'bedroom',
        widthCm: 200,
        heightCm: 90,
        depthCm: 200,
        x: 200,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
        visual: 'bed',
        hasNightstands: false,
      };

      const obbs = computeFurnitureOBBs(bed);
      expect(obbs).toHaveLength(1);

      const c1 = { id: 'c1', x: 75, z: 0 };
      const c2 = { id: 'c2', x: 75, z: 400 };
      const wall = {
        id: 'w-left',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 10,
        heightCm: 250,
      };

      const floorplan: FloorplanData = {
        corners: [c1, c2],
        walls: [wall],
        openings: [],
        furniture: [bed],
      };

      const reports = evaluateFloorplanCollisions(floorplan);
      expect(reports['f-bed'].hasCollision).toBe(false);
      expect(reports['f-bed'].issues).toHaveLength(0);
    });

    it('BedModel renders nightstand meshes when hasNightstands: true, omits them when false', () => {
      const bedWithNightstands: FurnitureItem = {
        id: 'f-bed-with',
        name: 'Doppelbett',
        category: 'bedroom',
        widthCm: 200,
        heightCm: 90,
        depthCm: 200,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
        visual: 'bed',
        hasNightstands: true,
      };

      useFloorplanStore.setState({ showDecor: true });
      const htmlWith = ReactDOMServer.renderToStaticMarkup(
        React.createElement(BedModel, { item: bedWithNightstands })
      );
      // Nightstands are rendered when hasNightstands: true
      expect(htmlWith).toContain('name="bed-nightstand"');

      // With decor active, bedside lamps with cylinderGeometry are also rendered
      useFloorplanStore.setState({ showDecor: true });
      const htmlWithDecor = ReactDOMServer.renderToStaticMarkup(
        React.createElement(BedModel, { item: bedWithNightstands })
      );
      expect(htmlWithDecor).toContain('cylinderGeometry');
      useFloorplanStore.setState({ showDecor: false });

      const bedWithoutNightstands: FurnitureItem = {
        ...bedWithNightstands,
        id: 'f-bed-without',
        hasNightstands: false,
      };

      const htmlWithout = ReactDOMServer.renderToStaticMarkup(
        React.createElement(BedModel, { item: bedWithoutNightstands })
      );
      expect(htmlWithout).not.toContain('name="bed-nightstand"');
      expect(htmlWithout).not.toContain('cylinderGeometry');
    });
  });
});




