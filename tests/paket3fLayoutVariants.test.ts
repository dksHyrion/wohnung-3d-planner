import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import type { FloorplanData, LayoutVariant } from '../src/core/types';
import { compareLayoutVariants } from '../src/core/layoutVariants';
import { InspectorSidebar } from '../src/components/sidebar/InspectorSidebar';
import { useFloorplanStore } from '../src/store/useFloorplanStore';

describe('Paket 3F: Layout Variants (Stellproben-Varianten A/B)', () => {
  it('computes comparative metrics (free %, critical passages, collisions, score) and picks the better variant', () => {
    const baseArch: Omit<FloorplanData, 'furniture' | 'rugs'> = {
      corners: [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 500, z: 0 },
        { id: 'c3', x: 500, z: 400 },
        { id: 'c4', x: 0, z: 400 },
      ],
      walls: [
        { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
        { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
        { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
        { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
      ],
      openings: [
        {
          id: 'op1',
          wallId: 'w4',
          type: 'door',
          offsetFromStartCm: 150,
          widthCm: 95,
          heightCm: 210,
          sillHeightCm: 0,
          swingDirection: 'in-left',
        },
      ],
      roomLabels: [{ name: 'Wohnraum', x: 250, z: 200 }],
    };

    const variantGood: LayoutVariant = {
      id: 'var-a',
      name: 'Variante A: Luftig',
      createdAt: '2026-11-17T11:00:00Z',
      rugs: [],
      furniture: [
        {
          id: 'f1',
          name: 'Sofa',
          category: 'living',
          visual: 'sofa',
          widthCm: 200,
          depthCm: 90,
          heightCm: 80,
          x: 250,
          z: 60,
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#64748b',
        },
      ],
    };

    const variantCrowded: LayoutVariant = {
      id: 'var-b',
      name: 'Variante B: Kollision & Eng',
      createdAt: '2026-11-17T11:05:00Z',
      rugs: [],
      furniture: [
        {
          id: 'f1',
          name: 'Sofa',
          category: 'living',
          visual: 'sofa',
          widthCm: 200,
          depthCm: 90,
          heightCm: 80,
          x: 250,
          z: 60,
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#64748b',
        },
        {
          id: 'f2',
          name: 'Schrank kollidierend',
          category: 'storage',
          visual: 'wardrobe',
          widthCm: 180,
          depthCm: 60,
          heightCm: 220,
          x: 250,
          z: 75, // collides straight into Sofa!
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#cbd5e1',
        },
      ],
    };

    const report = compareLayoutVariants(baseArch, [variantGood, variantCrowded]);
    expect(report.metrics).toHaveLength(2);
    expect(report.recommendedVariantId).toBe('var-a');

    const mA = report.metrics.find((m) => m.variantId === 'var-a')!;
    const mB = report.metrics.find((m) => m.variantId === 'var-b')!;
    expect(mA.collisionCount).toBe(0);
    expect(mB.collisionCount).toBeGreaterThan(0);
    expect(mA.freeFloorPercent).toBeGreaterThan(mB.freeFloorPercent);
    expect(mA.overallScore).toBeGreaterThan(mB.overallScore);
  });

  describe('Store Lifecycle, JSON Round-Trip, and UI Comparison Rendering (DE / EN)', () => {
    beforeEach(() => {
      useFloorplanStore.getState().loadPreset('empty-room');
      useFloorplanStore.getState().setLanguage('de');
    });

    it('saves, switches, auto-syncs edits, renames, deletes, and serializes variants in DE and EN', () => {
      const s0 = useFloorplanStore.getState();
      const sofaId = s0.addFurniture({
        name: 'Test-Sofa',
        category: 'living',
        visual: 'sofa',
        widthCm: 180,
        depthCm: 90,
        heightCm: 80,
        x: 150,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
      });

      const varAId = useFloorplanStore.getState().saveLayoutVariant('Variante A: Nord');
      expect(useFloorplanStore.getState().activeVariantId).toBe(varAId);

      // Move sofa and save as Variant B
      useFloorplanStore.getState().moveFurniture(sofaId, 260, 220);
      const varBId = useFloorplanStore.getState().saveLayoutVariant('Variante B: Süd');
      expect(useFloorplanStore.getState().activeVariantId).toBe(varBId);
      expect(useFloorplanStore.getState().layoutVariants).toHaveLength(2);

      // Switch back to Variant A -> restores sofa to (150, 100)
      useFloorplanStore.getState().switchLayoutVariant(varAId);
      expect(useFloorplanStore.getState().activeVariantId).toBe(varAId);
      expect(useFloorplanStore.getState().furniture[0].x).toBeCloseTo(150, 0);
      expect(useFloorplanStore.getState().furniture[0].z).toBeCloseTo(100, 0);

      // Edit while in Variant A, then switch to B -> A retains the edit
      useFloorplanStore.getState().moveFurniture(sofaId, 175, 110);
      useFloorplanStore.getState().switchLayoutVariant(varBId);
      expect(useFloorplanStore.getState().furniture[0].x).toBeCloseTo(260, 0);
      useFloorplanStore.getState().switchLayoutVariant(varAId);
      expect(useFloorplanStore.getState().furniture[0].x).toBeCloseTo(175, 0);

      // Rename & JSON export/import round-trip
      useFloorplanStore.getState().renameLayoutVariant(varAId, 'Variante A: Optimiert');
      const json = useFloorplanStore.getState().exportJson();
      useFloorplanStore.getState().deleteLayoutVariant(varAId);
      useFloorplanStore.getState().deleteLayoutVariant(varBId);
      expect(useFloorplanStore.getState().layoutVariants).toHaveLength(0);

      expect(useFloorplanStore.getState().importJson(json)).toBe(true);
      expect(useFloorplanStore.getState().layoutVariants).toHaveLength(2);
      expect(useFloorplanStore.getState().layoutVariants[0].name).toBe('Variante A: Optimiert');

      // Render localized InspectorSidebar in DE & EN
      const htmlDe = ReactDOMServer.renderToStaticMarkup(React.createElement(InspectorSidebar));
      expect(htmlDe).toContain('Stellproben-Varianten (A/B)');
      expect(htmlDe).toContain('Variante A: Optimiert');
      expect(htmlDe).toContain('% frei');

      useFloorplanStore.getState().setLanguage('en');
      const htmlEn = ReactDOMServer.renderToStaticMarkup(React.createElement(InspectorSidebar));
      expect(htmlEn).toContain('Layout Variants (A/B)');
      expect(htmlEn).toContain('% free');
    });
  });
});
