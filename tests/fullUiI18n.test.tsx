import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { setGlobalLanguage, getTranslation } from '../src/i18n/i18n';
import { TopBar, formatTimeOfDay } from '../src/components/layout/TopBar';
import { LightingControls } from '../src/components/layout/LightingControls';
import { FloorplanCanvas2D } from '../src/components/editor2d/FloorplanCanvas2D';
import { InspectorSidebar } from '../src/components/sidebar/InspectorSidebar';
import { getCatalogItemName } from '../src/core/catalog';
import { exportScaledFloorplanSvg } from '../src/core/export/planSvgExport';
import { PRESET_FLOORPLANS } from '../src/core/presets';

describe('Full UI English Translation Polish (Addressing Remaining German Strings)', () => {
  beforeEach(() => {
    setGlobalLanguage('de');
    useFloorplanStore.getState().setLanguage?.('de');
    useFloorplanStore.setState({
      viewMode: '2d',
      activeTool: 'select',
      selectedId: null,
      selectedType: null,
    });
  });

  afterAll(() => {
    setGlobalLanguage('de');
    useFloorplanStore.getState().setLanguage?.('de');
  });

  describe('formatTimeOfDay and Lighting Controls', () => {
    it('formats time with "Uhr" in German by default and when lang is "de"', () => {
      expect(formatTimeOfDay(18.0)).toBe('18:00 Uhr');
      expect(formatTimeOfDay(18.0, 'de')).toBe('18:00 Uhr');
      expect(formatTimeOfDay(8.25, 'de')).toBe('08:15 Uhr');
    });

    it('formats time without "Uhr" when lang is "en"', () => {
      expect(formatTimeOfDay(18.0, 'en')).toBe('18:00');
      expect(formatTimeOfDay(8.25, 'en')).toBe('08:15');
      expect(formatTimeOfDay(12.5, 'en')).toBe('12:30');
      expect(formatTimeOfDay(NaN, 'en')).toBe('12:00');
    });

    it('renders LightingControls readout without "Uhr" when language is "en"', () => {
      useFloorplanStore.getState().setLanguage?.('en');
      useFloorplanStore.setState({ timeOfDay: 18.0 });
      const html = ReactDOMServer.renderToStaticMarkup(<LightingControls isOpen={true} />);

      expect(html).toContain('18:00');
      expect(html).not.toContain('18:00 Uhr');
    });
  });

  describe('TopBar Brand & Preset Floorplans Dropdown', () => {
    it('renders "Apartment 3D Planner" as brand title in English', () => {
      useFloorplanStore.getState().setLanguage?.('en');
      const html = ReactDOMServer.renderToStaticMarkup(<TopBar />);

      expect(html).toContain('Apartment 3D Planner');
      expect(html).not.toContain('Wohnung 3D Planner');
    });

    it('renders localized floorplan preset labels in English', () => {
      useFloorplanStore.getState().setLanguage?.('en');
      const html = ReactDOMServer.renderToStaticMarkup(<TopBar />);

      expect(html).toContain('55 m² Standard Apartment');
      expect(html).toContain('110 m² 4-Room Apartment');
      expect(html).toContain('L-Shape Apartment + 22 m² Side Room');
      expect(html).toContain('Studio Apartment (500 × 400 cm)');
      expect(html).toContain('Empty Room (400 × 320 cm)');

      expect(html).not.toContain('Standard-Wohnung');
      expect(html).not.toContain('Leerer Raum');
    });
  });

  describe('2D Floorplan Canvas & Controls', () => {
    it('renders English badge and button tooltips in 2D Floorplan Canvas', () => {
      useFloorplanStore.getState().setLanguage?.('en');
      const html = ReactDOMServer.renderToStaticMarkup(<FloorplanCanvas2D />);

      // Viewport badge
      expect(html).toContain('2D Floorplan Editor');
      expect(html).not.toContain('2D Grundriss-Editor');

      // Zoom & Center controls
      expect(html).toContain('title="Zoom In"');
      expect(html).toContain('title="Zoom Out"');
      expect(html).toContain('title="Center View"');
      expect(html).toContain('<span>Center</span>');
      expect(html).not.toContain('<span>Zentrieren</span>');

      // SVG aria-label
      expect(html).toContain('aria-label="2D Floorplan Editor"');
    });
  });

  describe('Catalog Furniture Template Names in Sidebar', () => {
    it('translates generic catalog template names in English', () => {
      expect(getCatalogItemName({ name: '3-Sitzer Sofa' }, 'de')).toBe('3-Sitzer Sofa');
      expect(getCatalogItemName({ name: '3-Sitzer Sofa' }, 'en')).toBe('3-Seater Sofa');

      expect(getCatalogItemName({ name: 'Kleiderschrank PAX' }, 'en')).toBe('PAX Wardrobe');
      expect(getCatalogItemName({ name: 'Doppelbett (180×200)' }, 'en')).toBe('Double Bed (180×200)');
      expect(getCatalogItemName({ name: 'Schreibtisch' }, 'en')).toBe('Desk');
      expect(getCatalogItemName({ name: 'Couchtisch' }, 'en')).toBe('Coffee Table');
      expect(getCatalogItemName({ name: 'Wandbild' }, 'en')).toBe('Wall Picture');
    });

    it('renders translated catalog item names in InspectorSidebar drawer in English', () => {
      useFloorplanStore.getState().setLanguage?.('en');
      const html = ReactDOMServer.renderToStaticMarkup(<InspectorSidebar />);

      expect(html).toContain('3-Seater Sofa');
      expect(html).toContain('PAX Wardrobe');
      expect(html).toContain('Double Bed (180×200)');
    });
  });

  describe('Document Title & 3D Badges', () => {
    it('provides accurate documentTitle in German and English', () => {
      expect(getTranslation('de', 'documentTitle')).toBe(
        'Wohnung 3D-Raumplaner & Grundriss-Editor (cm)'
      );
      expect(getTranslation('en', 'documentTitle')).toBe(
        'Apartment 3D Planner & Floorplan Editor (cm)'
      );
    });

    it('provides accurate 3D badges in German and English', () => {
      expect(getTranslation('de', 'viewer3d.perspectiveBadge')).toBe(
        '3D Perspektive (Orbit + Zoom | 1 Unit = 1 cm)'
      );
      expect(getTranslation('en', 'viewer3d.perspectiveBadge')).toBe(
        '3D Perspective (Orbit + Zoom | 1 Unit = 1 cm)'
      );
      expect(getTranslation('de', 'viewer3d.isometricBadge')).toBe(
        '3D Isometrie / Cutaway-Ansicht (1 Unit = 1 cm)'
      );
      expect(getTranslation('en', 'viewer3d.isometricBadge')).toBe(
        '3D Isometric / Cutaway View (1 Unit = 1 cm)'
      );
    });
  });

  describe('Scaled SVG Plan Export Localization', () => {
    it('exports title block in English when language is "en"', () => {
      const planData = PRESET_FLOORPLANS['empty-room'].data;
      const svg = exportScaledFloorplanSvg(planData, {
        scale: '1:50',
        language: 'en',
      });

      expect(svg).toContain('Scale:');
      expect(svg).toContain('Date:');
      expect(svg).toContain('Interior Net Area:');
      expect(svg).toContain('Scale Bar');
      expect(svg).not.toContain('Maßstabsleiste');
      expect(svg).not.toContain('Lichte Innenfläche:');
    });
  });
});
