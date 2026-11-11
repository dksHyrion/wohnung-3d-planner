import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { getCatalogCategoryLabel } from '../src/core/catalog';
import { getFurnitureVisualLabel } from '../src/core/furnitureVisualCatalog';
import {
  getPassageSeverityLabel,
  formatPassageDescription,
  formatClearanceWarning,
  PassageClearance,
} from '../src/core/ergonomicsEngine';
import { FurnitureCategory, FurnitureItem } from '../src/core/types';
import { setGlobalLanguage } from '../src/i18n/i18n';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { FurnitureInspector } from '../src/components/sidebar/FurnitureInspector';

describe('Catalog Categories & Ergonomics Messages Localization (Task 6)', () => {
  beforeEach(() => {
    setGlobalLanguage('de');
    useFloorplanStore.getState().setLanguage?.('de');
  });

  afterAll(() => {
    setGlobalLanguage('de');
    useFloorplanStore.getState().setLanguage?.('de');
  });

  describe('getCatalogCategoryLabel', () => {
    const allCategories: FurnitureCategory[] = [
      'living',
      'bedroom',
      'kitchen',
      'office',
      'storage',
      'bathroom',
      'decor',
      'custom',
    ];

    it('returns accurate German labels for all categories', () => {
      expect(getCatalogCategoryLabel('living', 'de')).toBe('Wohnen');
      expect(getCatalogCategoryLabel('bedroom', 'de')).toBe('Schlafen');
      expect(getCatalogCategoryLabel('kitchen', 'de')).toBe('Küche');
      expect(getCatalogCategoryLabel('office', 'de')).toBe('Büro');
      expect(getCatalogCategoryLabel('storage', 'de')).toBe('Aufbewahrung');
      expect(getCatalogCategoryLabel('bathroom', 'de')).toBe('Bad');
      expect(getCatalogCategoryLabel('decor', 'de')).toBe('Deko');
      expect(getCatalogCategoryLabel('custom', 'de')).toBe('Individuell');
    });

    it('returns accurate English labels for all categories', () => {
      expect(getCatalogCategoryLabel('living', 'en')).toBe('Living');
      expect(getCatalogCategoryLabel('bedroom', 'en')).toBe('Bedroom');
      expect(getCatalogCategoryLabel('kitchen', 'en')).toBe('Kitchen');
      expect(getCatalogCategoryLabel('office', 'en')).toBe('Office');
      expect(getCatalogCategoryLabel('storage', 'en')).toBe('Storage');
      expect(getCatalogCategoryLabel('bathroom', 'en')).toBe('Bathroom');
      expect(getCatalogCategoryLabel('decor', 'en')).toBe('Decor');
      expect(getCatalogCategoryLabel('custom', 'en')).toBe('Custom');
    });

    it('defaults to global language when lang parameter is omitted', () => {
      setGlobalLanguage('de');
      expect(getCatalogCategoryLabel('storage')).toBe('Aufbewahrung');
      setGlobalLanguage('en');
      expect(getCatalogCategoryLabel('storage')).toBe('Storage');
    });

    it('covers all items of FurnitureCategory union exhaustively without returning raw key', () => {
      for (const cat of allCategories) {
        const deLabel = getCatalogCategoryLabel(cat, 'de');
        const enLabel = getCatalogCategoryLabel(cat, 'en');
        expect(deLabel).toBeTruthy();
        expect(enLabel).toBeTruthy();
        expect(deLabel).not.toContain('catalog.categories');
        expect(enLabel).not.toContain('catalog.categories');
      }
    });
  });

  describe('getFurnitureVisualLabel', () => {
    it('returns accurate German and English labels for visual types', () => {
      expect(getFurnitureVisualLabel('sofa', 'de')).toBe('Sofa (Linear)');
      expect(getFurnitureVisualLabel('sofa', 'en')).toBe('Sofa (Linear)');

      expect(getFurnitureVisualLabel('sectional-sofa', 'de')).toBe('Ecksofa / L-Form');
      expect(getFurnitureVisualLabel('sectional-sofa', 'en')).toBe('Sectional Sofa / L-Shape');

      expect(getFurnitureVisualLabel('box', 'de')).toBe('Schlichter Quader (Box)');
      expect(getFurnitureVisualLabel('box', 'en')).toBe('Plain Box');

      expect(getFurnitureVisualLabel('bathtub', 'de')).toBe('Badewanne');
      expect(getFurnitureVisualLabel('bathtub', 'en')).toBe('Bathtub');

      expect(getFurnitureVisualLabel('boconcept-osaka', 'de')).toBe('Designer: BoConcept Osaka');
      expect(getFurnitureVisualLabel('boconcept-osaka', 'en')).toBe('Designer: BoConcept Osaka');
    });

    it('defaults to active global language when lang is omitted', () => {
      setGlobalLanguage('de');
      expect(getFurnitureVisualLabel('box')).toBe('Schlichter Quader (Box)');
      setGlobalLanguage('en');
      expect(getFurnitureVisualLabel('box')).toBe('Plain Box');
    });
  });

  describe('getPassageSeverityLabel', () => {
    it('translates severity labels in German and English', () => {
      expect(getPassageSeverityLabel('critical', 'de')).toBe('Kritisch');
      expect(getPassageSeverityLabel('warning', 'de')).toBe('Warnung');
      expect(getPassageSeverityLabel('optimal', 'de')).toBe('Optimal');

      expect(getPassageSeverityLabel('critical', 'en')).toBe('Critical');
      expect(getPassageSeverityLabel('warning', 'en')).toBe('Warning');
      expect(getPassageSeverityLabel('optimal', 'en')).toBe('Optimal');
    });

    it('defaults to active global language when lang is omitted', () => {
      setGlobalLanguage('de');
      expect(getPassageSeverityLabel('critical')).toBe('Kritisch');
      setGlobalLanguage('en');
      expect(getPassageSeverityLabel('critical')).toBe('Critical');
    });
  });

  describe('formatPassageDescription and formatClearanceWarning', () => {
    const samplePassage: PassageClearance = {
      id: 'f1-f2',
      entity1Id: 'f1',
      entity1Type: 'furniture',
      entity1Name: 'Sofa',
      entity2Id: 'f2',
      entity2Type: 'furniture',
      entity2Name: 'Esstisch',
      clearanceCm: 75.4,
      severity: 'warning',
      point1: { x: 0, z: 0 },
      point2: { x: 75.4, z: 0 },
    };

    it('formats passage description in German and English', () => {
      const descDe = formatPassageDescription(samplePassage, 'de');
      expect(descDe).toBe('Durchgang zwischen Sofa und Esstisch: 75 cm');

      const descEn = formatPassageDescription(samplePassage, 'en');
      expect(descEn).toBe('Passage between Sofa and Esstisch: 75 cm');
    });

    it('formats clearance warnings in German and English', () => {
      const warningDe = formatClearanceWarning(75, 90, 'de');
      expect(warningDe).toContain('Hauptdurchgang zu schmal');
      expect(warningDe).toContain('75 cm < 90 cm');

      const warningEn = formatClearanceWarning(75, 90, 'en');
      expect(warningEn).toContain('Passage too narrow');
      expect(warningEn).toContain('75 cm < 90 cm');
    });
  });

  describe('FurnitureInspector dropdown localization', () => {
    const dummyFurniture: FurnitureItem = {
      id: 'furn-test-1',
      name: 'Testmöbel',
      category: 'living',
      widthCm: 100,
      heightCm: 80,
      depthCm: 90,
      elevationCm: 0,
      rotationYDeg: 0,
      x: 100,
      z: 100,
      color: '#64748b',
      visual: 'box',
    };

    it('renders 3D model dropdown with German visual labels in German mode', () => {
      useFloorplanStore.getState().setLanguage?.('de');
      setGlobalLanguage('de');

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(FurnitureInspector, { selectedFurniture: dummyFurniture })
      );

      expect(html).toContain('Schlichter Quader (Box)');
      expect(html).toContain('Ecksofa / L-Form');
      expect(html).not.toContain('Plain Box');
    });

    it('renders 3D model dropdown with English visual labels in English mode', () => {
      useFloorplanStore.getState().setLanguage?.('en');
      setGlobalLanguage('en');

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(FurnitureInspector, { selectedFurniture: dummyFurniture })
      );

      expect(html).toContain('Plain Box');
      expect(html).toContain('Sectional Sofa / L-Shape');
      expect(html).not.toContain('Schlichter Quader (Box)');
    });
  });

  describe('InspectorSidebar catalog category rendering', () => {
    it('renders localized category in catalog templates list', async () => {
      const { InspectorSidebar } = await import('../src/components/sidebar/InspectorSidebar');

      useFloorplanStore.getState().setLanguage?.('de');
      setGlobalLanguage('de');
      const htmlDe = ReactDOMServer.renderToStaticMarkup(React.createElement(InspectorSidebar));
      expect(htmlDe).toContain('Wohnen');

      useFloorplanStore.getState().setLanguage?.('en');
      setGlobalLanguage('en');
      const htmlEn = ReactDOMServer.renderToStaticMarkup(React.createElement(InspectorSidebar));
      expect(htmlEn).toContain('Living');
    });
  });
});
