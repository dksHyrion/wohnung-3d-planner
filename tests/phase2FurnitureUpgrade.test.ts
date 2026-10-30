import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import * as THREE from 'three';
import { FurnitureItem } from '../src/core/types';
import {
  getOakFurnitureTexture,
  getMarbleQuartzTexture,
  getLinenTexture,
  clearTextureCache,
} from '../src/core/materials/proceduralTextures';
import { SofaModel } from '../src/components/viewer3d/furniture/SofaModel';
import { DiningTableModel } from '../src/components/viewer3d/furniture/DiningTableModel';
import { KitchenIslandModel } from '../src/components/viewer3d/furniture/KitchenIslandModel';
import { BedModel } from '../src/components/viewer3d/furniture/BedModel';
import { FURNITURE_CATALOG } from '../src/core/presets';
import { useFloorplanStore } from '../src/store/useFloorplanStore';

describe('Phase 2: Furniture Quality Upgrade (Designer Models & PBR Materials)', () => {
  beforeEach(() => {
    clearTextureCache();
  });

  describe('New Procedural PBR Textures', () => {
    it('creates and caches oak furniture wood grain texture', () => {
      const tex1 = getOakFurnitureTexture();
      expect(tex1).toBeInstanceOf(THREE.CanvasTexture);
      expect(tex1.wrapS).toBe(THREE.RepeatWrapping);
      expect(tex1.wrapT).toBe(THREE.RepeatWrapping);

      // Verify caching returns same instance
      const tex2 = getOakFurnitureTexture();
      expect(tex2).toBe(tex1);
    });

    it('creates and caches marble/quartz stone texture', () => {
      const tex1 = getMarbleQuartzTexture();
      expect(tex1).toBeInstanceOf(THREE.CanvasTexture);
      expect(tex1.wrapS).toBe(THREE.RepeatWrapping);
      expect(tex1.wrapT).toBe(THREE.RepeatWrapping);

      const tex2 = getMarbleQuartzTexture();
      expect(tex2).toBe(tex1);
    });
  });

  describe('Upgraded SofaModel (Sectional Chaise & PBR Linen)', () => {
    it('renders a standard linear sofa with linen-textured rounded cushions', () => {
      const sofaItem: FurnitureItem = {
        id: 'f-sofa-std',
        name: '3-Sitzer Designer Couch',
        category: 'living',
        widthCm: 200,
        heightCm: 78,
        depthCm: 90,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#e7e5e4',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(SofaModel, { item: sofaItem })
      );
      expect(html).toBeTruthy();
      expect(html).toContain('name="sofa-seat-cushion"');
    });

    it('renders an L-shaped sectional sofa with extended chaise lounge', () => {
      const sectionalItem: FurnitureItem = {
        id: 'f-sectional',
        name: 'Skandinavisches Ecksofa mit Chaiselongue (L-Form)',
        category: 'living',
        widthCm: 240,
        heightCm: 78,
        depthCm: 160,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#e7e5e4',
        visual: 'sectional-sofa',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(SofaModel, { item: sectionalItem })
      );
      expect(html).toBeTruthy();
      expect(html).toContain('name="sofa-seat-cushion"');
      expect(html).toContain('name="sofa-chaise-cushion"');
    });
  });

  describe('Upgraded DiningTableModel (Bentwood Chairs & Centerpiece)', () => {
    it('renders Scandinavian dining table with curved wishbone chairs and fruit bowl', () => {
      const tableItem: FurnitureItem = {
        id: 'f-dining',
        name: 'Designer-Esstisch Eiche Natur (8 Plätze)',
        category: 'living',
        widthCm: 220,
        heightCm: 75,
        depthCm: 100,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#e8dbc8',
      };

      useFloorplanStore.setState({ showDecor: true });
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(DiningTableModel, { item: tableItem })
      );
      expect(html).toBeTruthy();
      expect(html).toContain('name="dining-tabletop"');
      expect(html).toContain('name="dining-chair"');
      expect(html).toContain('name="fruit-bowl"');
    });
  });

  describe('Upgraded KitchenIslandModel (Waterfall Quartz & Barstools)', () => {
    it('renders waterfall quartz countertop, sink and upgraded barstools with footrests', () => {
      const islandItem: FurnitureItem = {
        id: 'f-island',
        name: 'Kücheninsel mit Quarz-Wasserfallplatte',
        category: 'kitchen',
        widthCm: 240,
        heightCm: 92,
        depthCm: 100,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#1e293b',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(KitchenIslandModel, { item: islandItem })
      );
      expect(html).toBeTruthy();
      expect(html).toContain('name="island-barstool"');
      expect(html.toLowerCase()).toContain('polygonoffsetfactor="-2"');
    });
  });

  describe('Upgraded BedModel (Tufted Headboard, Duvet & Nightstands)', () => {
    it('renders luxury hotel double bed with linen textures, layered duvet and nightstands', () => {
      const bedItem: FurnitureItem = {
        id: 'f-bed',
        name: 'Doppelbett 180x200',
        category: 'bedroom',
        widthCm: 200,
        heightCm: 110,
        depthCm: 210,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#e2d8ce',
      };

      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(BedModel, { item: bedItem })
      );
      expect(html).toBeTruthy();
      expect(html).toContain('name="bed-headboard-channel"');
    });
  });

  describe('Furniture Catalog Extensions', () => {
    it('includes Ecksofa and 8-Personen-Esstisch in FURNITURE_CATALOG', () => {
      const ecksofa = FURNITURE_CATALOG.find((c) =>
        c.name.toLowerCase().includes('ecksofa')
      );
      expect(ecksofa).toBeDefined();
      expect(ecksofa?.widthCm).toBe(240);
      expect(ecksofa?.depthCm).toBe(160);

      const table8 = FURNITURE_CATALOG.find((c) =>
        c.name.toLowerCase().includes('8 plätze')
      );
      expect(table8).toBeDefined();
      expect(table8?.widthCm).toBe(220);
      expect(table8?.depthCm).toBe(100);
    });
  });
});
