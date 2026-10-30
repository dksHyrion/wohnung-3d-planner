import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { FurnitureItem } from '../src/core/types';
import { CatalogFurnitureTemplate, FURNITURE_CATALOG } from '../src/core/presets';
import {
  InspectorSidebar,
  filterCatalogTemplates,
} from '../src/components/sidebar/InspectorSidebar';

describe('Furniture Inventory System (Real Furniture vs Placeholders)', () => {
  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('empty-room');
  });

  describe('FurnitureItem Types & Store Metadata defaults', () => {
    it('defaults isRealFurniture to false when adding furniture without inventory metadata', () => {
      const store = useFloorplanStore.getState();
      const id = store.addFurniture({
        name: 'Standard Sofa',
        category: 'living',
        widthCm: 200,
        heightCm: 80,
        depthCm: 90,
        elevationCm: 0,
        x: 150,
        z: 150,
        rotationYDeg: 0,
        color: '#4f46e5',
        snappedWallId: null,
      });

      const item = useFloorplanStore.getState().furniture.find((f) => f.id === id);
      expect(item).toBeDefined();
      expect(item?.isRealFurniture).toBe(false);
      expect(item?.brand).toBeUndefined();
      expect(item?.modelName).toBeUndefined();
    });

    it('preserves isRealFurniture, brand, modelName, articleNumber, and notes when provided', () => {
      const store = useFloorplanStore.getState();
      const id = store.addFurniture({
        name: 'BoConcept Osaka Sofa',
        category: 'living',
        widthCm: 170,
        heightCm: 77,
        depthCm: 87.5,
        elevationCm: 0,
        x: 200,
        z: 150,
        rotationYDeg: 0,
        color: '#3b82f6',
        snappedWallId: null,
        isRealFurniture: true,
        brand: 'BoConcept',
        modelName: 'Osaka',
        articleNumber: 'BC-OSA-170',
        notes: 'Anthrazit Stoff, 15cm Beine',
      });

      const item = useFloorplanStore.getState().furniture.find((f) => f.id === id);
      expect(item?.isRealFurniture).toBe(true);
      expect(item?.brand).toBe('BoConcept');
      expect(item?.modelName).toBe('Osaka');
      expect(item?.articleNumber).toBe('BC-OSA-170');
      expect(item?.notes).toBe('Anthrazit Stoff, 15cm Beine');
    });
  });

  describe('Store Actions: toggleFurnitureRealStatus & setFurnitureRealStatus', () => {
    it('toggleFurnitureRealStatus toggles real furniture status back and forth', () => {
      const store = useFloorplanStore.getState();
      const id = store.addFurniture({
        name: 'Test Regal',
        category: 'storage',
        widthCm: 100,
        heightCm: 180,
        depthCm: 35,
        elevationCm: 0,
        x: 100,
        z: 100,
        rotationYDeg: 0,
        color: '#94a3b8',
        snappedWallId: null,
      });

      expect(useFloorplanStore.getState().furniture.find((f) => f.id === id)?.isRealFurniture).toBe(false);

      // Toggle from false -> true
      useFloorplanStore.getState().toggleFurnitureRealStatus(id);
      expect(useFloorplanStore.getState().furniture.find((f) => f.id === id)?.isRealFurniture).toBe(true);

      // Toggle from true -> false
      useFloorplanStore.getState().toggleFurnitureRealStatus(id);
      expect(useFloorplanStore.getState().furniture.find((f) => f.id === id)?.isRealFurniture).toBe(false);
    });

    it('setFurnitureRealStatus updates real status and optionally sets brand and modelName', () => {
      const store = useFloorplanStore.getState();
      const id = store.addFurniture({
        name: 'Vitsœ Regal',
        category: 'storage',
        widthCm: 91.2,
        heightCm: 170,
        depthCm: 22,
        elevationCm: 0,
        x: 120,
        z: 120,
        rotationYDeg: 0,
        color: '#ffffff',
        snappedWallId: null,
      });

      useFloorplanStore
        .getState()
        .setFurnitureRealStatus(id, true, 'Vitsœ', '606 Universal Shelving System');

      const updated = useFloorplanStore.getState().furniture.find((f) => f.id === id);
      expect(updated?.isRealFurniture).toBe(true);
      expect(updated?.brand).toBe('Vitsœ');
      expect(updated?.modelName).toBe('606 Universal Shelving System');
    });

    it('updateFurniture allows updating brand and modelName properties directly', () => {
      const store = useFloorplanStore.getState();
      const id = store.addFurniture({
        name: 'Custom Couch',
        category: 'living',
        widthCm: 180,
        heightCm: 80,
        depthCm: 90,
        elevationCm: 0,
        x: 150,
        z: 150,
        rotationYDeg: 0,
        color: '#6366f1',
        snappedWallId: null,
        isRealFurniture: true,
      });

      store.updateFurniture(id, {
        brand: 'Muuto',
        modelName: 'Outline Sofa',
      });

      const updated = useFloorplanStore.getState().furniture.find((f) => f.id === id);
      expect(updated?.brand).toBe('Muuto');
      expect(updated?.modelName).toBe('Outline Sofa');
    });

    it('addFurniture preserves isRealFurniture, brand, and modelName from catalog templates', () => {
      const store = useFloorplanStore.getState();
      const realTemplate: CatalogFurnitureTemplate = {
        name: 'Vitsœ 606 Regalsystem',
        category: 'storage',
        widthCm: 91.2,
        heightCm: 170,
        depthCm: 22,
        elevationCm: 0,
        color: '#e2e8f0',
        isRealFurniture: true,
        brand: 'Vitsœ',
        modelName: '606 Universal Shelving System',
      };

      const id = store.addFurniture({
        ...realTemplate,
        x: 200,
        z: 200,
        rotationYDeg: 0,
        snappedWallId: null,
      });

      const created = useFloorplanStore.getState().furniture.find((f) => f.id === id);
      expect(created?.isRealFurniture).toBe(true);
      expect(created?.brand).toBe('Vitsœ');
      expect(created?.modelName).toBe('606 Universal Shelving System');
    });

    it('exportJson and importJson round-trip preserves real furniture metadata', () => {
      const store = useFloorplanStore.getState();
      store.addFurniture({
        name: 'BoConcept Osaka Couch',
        category: 'living',
        widthCm: 170,
        heightCm: 77,
        depthCm: 87.5,
        elevationCm: 0,
        x: 180,
        z: 180,
        rotationYDeg: 90,
        color: '#475569',
        snappedWallId: null,
        isRealFurniture: true,
        brand: 'BoConcept',
        modelName: 'Osaka',
        articleNumber: 'ART-9988',
        notes: '2-Sitzer mit 15cm Beinen',
      });

      const json = store.exportJson();
      store.loadPreset('empty-room');
      expect(useFloorplanStore.getState().furniture.length).toBe(0);

      const success = useFloorplanStore.getState().importJson(json);
      expect(success).toBe(true);

      const imported = useFloorplanStore.getState().furniture[0];
      expect(imported.isRealFurniture).toBe(true);
      expect(imported.brand).toBe('BoConcept');
      expect(imported.modelName).toBe('Osaka');
      expect(imported.articleNumber).toBe('ART-9988');
      expect(imported.notes).toBe('2-Sitzer mit 15cm Beinen');
    });
  });

  describe('Catalog Filter Logic', () => {
    const sampleCatalog: CatalogFurnitureTemplate[] = [
      {
        name: 'Standard Tisch',
        category: 'living',
        widthCm: 120,
        heightCm: 75,
        depthCm: 80,
        elevationCm: 0,
        color: '#333333',
        isRealFurniture: false,
      },
      {
        name: 'BoConcept Osaka Couch',
        category: 'living',
        widthCm: 170,
        heightCm: 77,
        depthCm: 87.5,
        elevationCm: 0,
        color: '#475569',
        isRealFurniture: true,
        brand: 'BoConcept',
        modelName: 'Osaka',
      },
      {
        name: 'Vitsœ 606 Regal',
        category: 'storage',
        widthCm: 91.2,
        heightCm: 170,
        depthCm: 22,
        elevationCm: 0,
        color: '#f8fafc',
        isRealFurniture: true,
        brand: 'Vitsœ',
        modelName: '606',
      },
      {
        name: 'Platzhalter Stuhl',
        category: 'living',
        widthCm: 50,
        heightCm: 85,
        depthCm: 50,
        elevationCm: 0,
        color: '#111111',
      },
    ];

    it('filters all items when filter is "all"', () => {
      const items = filterCatalogTemplates(sampleCatalog, 'all');
      expect(items.length).toBe(4);
    });

    it('filters only real furniture items when filter is "real"', () => {
      const items = filterCatalogTemplates(sampleCatalog, 'real');
      expect(items.length).toBe(2);
      expect(items.every((i) => i.isRealFurniture === true)).toBe(true);
      expect(items.map((i) => i.name)).toEqual(['BoConcept Osaka Couch', 'Vitsœ 606 Regal']);
    });

    it('filters only placeholder items when filter is "placeholder"', () => {
      const items = filterCatalogTemplates(sampleCatalog, 'placeholder');
      expect(items.length).toBe(2);
      expect(items.every((i) => !i.isRealFurniture)).toBe(true);
      expect(items.map((i) => i.name)).toEqual(['Standard Tisch', 'Platzhalter Stuhl']);
    });
  });

  describe('InspectorSidebar UI Component Rendering', () => {
    it('renders catalog filter tabs for [Alle], [Mein Inventar (Echte Möbel)], and [Platzhalter]', () => {
      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar)
      );

      expect(markup).toContain('Alle');
      expect(markup).toContain('Mein Inventar (Echte Möbel)');
      expect(markup).toContain('Platzhalter');
    });

    it('renders badges in catalog items: "Echtes Möbel" vs "Platzhalter"', () => {
      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar)
      );

      // In default catalog, standard items are placeholders
      expect(markup).toContain('Platzhalter');
    });

    it('renders selected furniture inspector with placeholder status badge and toggle button when isRealFurniture is false', () => {
      const store = useFloorplanStore.getState();
      const id = store.addFurniture({
        name: 'Einfaches Regal',
        category: 'storage',
        widthCm: 100,
        heightCm: 180,
        depthCm: 40,
        elevationCm: 0,
        x: 100,
        z: 100,
        rotationYDeg: 0,
        color: '#64748b',
        snappedWallId: null,
        isRealFurniture: false,
      });

      useFloorplanStore.getState().selectEntity(id, 'furniture');
      const selected = useFloorplanStore
        .getState()
        .furniture.find((f) => f.id === id)!;

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: selected })
      );

      // Status badge for placeholder
      expect(markup).toContain('Platzhalter');
      // Toggle button/checkbox
      expect(markup).toContain('Als echtes Möbelstück (Inventar) markieren');
      // Should not display Brand / Model inputs for placeholders
      expect(markup).not.toContain('Marke / Hersteller');
      expect(markup).not.toContain('>Modell</label>');
    });

    it('renders selected furniture inspector with green badge "Echtes Möbel (Inventar)" and brand/model inputs when isRealFurniture is true', () => {
      const id = useFloorplanStore.getState().addFurniture({
        name: 'BoConcept Osaka 170cm',
        category: 'living',
        widthCm: 170,
        heightCm: 77,
        depthCm: 87.5,
        elevationCm: 0,
        x: 150,
        z: 150,
        rotationYDeg: 0,
        color: '#475569',
        snappedWallId: null,
        isRealFurniture: true,
        brand: 'BoConcept',
        modelName: 'Osaka Couch 170',
      });

      useFloorplanStore.getState().selectEntity(id, 'furniture');
      const selected = useFloorplanStore
        .getState()
        .furniture.find((f) => f.id === id)!;

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { selectedFurniture: selected })
      );

      // Status badge for real furniture
      expect(markup).toContain('Echtes Möbel (Inventar)');
      // Toggle button/checkbox
      expect(markup).toContain('Als echtes Möbelstück (Inventar) markieren');
      // Inputs for Brand and Model
      expect(markup).toContain('Marke / Hersteller');
      expect(markup).toContain('Modell');
      expect(markup).toContain('BoConcept');
      expect(markup).toContain('Osaka Couch 170');
    });

    it('renders catalog filtered view according to initialCatalogFilter prop', () => {
      // With real filter prop
      const markupReal = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { initialCatalogFilter: 'real' })
      );
      expect(markupReal).toBeDefined();

      // With placeholder filter prop
      const markupPlaceholder = ReactDOMServer.renderToStaticMarkup(
        React.createElement(InspectorSidebar, { initialCatalogFilter: 'placeholder' })
      );
      expect(markupPlaceholder).toContain('Platzhalter');
    });
  });
});
