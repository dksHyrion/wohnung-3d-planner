import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import type { FloorplanData, FurnitureItem, WallFixture } from '../src/core/types';
import { computeFloorPolygons } from '../src/core/wallMath';
import { evaluateFloorplanCollisions, computeFurnitureOBBs } from '../src/core/collisionEngine';
import { createDefaultFixture, evaluateMepDiagnostics } from '../src/core/mepFixtures';
import { exportScaledFloorplanSvg } from '../src/core/export/planSvgExport';
import { exportFloorplanDxf } from '../src/core/export/dxfExport';
import { WallInspector } from '../src/components/sidebar/WallInspector';
import { FixtureInspector } from '../src/components/sidebar/FixtureInspector';
import { InspectorSidebar } from '../src/components/sidebar/InspectorSidebar';
import { useFloorplanStore } from '../src/store/useFloorplanStore';

function createMepRoom(fixtures: WallFixture[], furniture: FurnitureItem[] = []): FloorplanData {
  const corners = [
    { id: 'c1', x: 0, z: 0 },
    { id: 'c2', x: 500, z: 0 },
    { id: 'c3', x: 500, z: 400 },
    { id: 'c4', x: 0, z: 400 },
  ];
  const walls = [
    { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
    { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
    { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
    { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
  ];
  return {
    corners,
    walls,
    openings: [],
    furniture,
    fixtures,
    roomLabels: [{ name: 'Arbeitszimmer', x: 250, z: 200 }],
  };
}

describe('Paket 3A: Haustechnik, Anschlüsse, Heizkörper & Versorgungsschächte', () => {
  it('flags radiator heat-trap when furniture blocks airflow within 30 cm, clears when spaced away', () => {
    const rad: WallFixture = {
      id: 'fix-rad',
      wallId: 'w1',
      type: 'radiator',
      offsetFromStartCm: 200,
      widthCm: 100,
      heightCm: 60,
      depthCm: 12,
      elevationCm: 15,
      side: 'pos',
    };

    const sofaBlocking: FurnitureItem = {
      id: 'f-sofa-close',
      name: 'Sofa nah',
      category: 'living',
      visual: 'sofa',
      widthCm: 180,
      depthCm: 90,
      heightCm: 80,
      x: 200,
      z: 75, // wall interior face at z=7.5, radiator front at z=19.5, sofa back at z=30 (gap 10.5 cm < 30 cm)
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#64748b',
    };

    const sofaClear: FurnitureItem = {
      ...sofaBlocking,
      id: 'f-sofa-clear',
      name: 'Sofa mit Abstand',
      z: 105, // sofa back at z=60 -> 40.5 cm clear in front of radiator
    };

    const blockedRep = evaluateFloorplanCollisions(createMepRoom([rad], [sofaBlocking]));
    expect(blockedRep['f-sofa-close'].hasCollision).toBe(true);
    expect(blockedRep['f-sofa-close'].issues.some((i) => i.type === 'fixture-blocked')).toBe(true);

    const clearRep = evaluateFloorplanCollisions(createMepRoom([rad], [sofaClear]));
    expect(clearRep['f-sofa-clear'].hasCollision).toBe(false);
  });

  it('flags switch & socket covered by wardrobe, allows open-underneath desk at low socket and computes Masterlift socket distance', () => {
    const sw: WallFixture = {
      id: 'fix-sw',
      wallId: 'w1',
      type: 'switch',
      offsetFromStartCm: 100,
      widthCm: 8,
      heightCm: 8,
      depthCm: 3,
      elevationCm: 105,
      side: 'pos',
    };
    const sock: WallFixture = {
      id: 'fix-sock',
      wallId: 'w1',
      type: 'socket',
      offsetFromStartCm: 300,
      widthCm: 14,
      heightCm: 8,
      depthCm: 3,
      elevationCm: 30,
      side: 'pos',
    };

    const pax: FurnitureItem = {
      id: 'f-pax',
      name: 'PAX Schrank',
      category: 'storage',
      visual: 'wardrobe',
      widthCm: 100,
      depthCm: 60,
      heightCm: 220,
      x: 100,
      z: 42, // right in front of switch at x=100
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#cbd5e1',
    };
    const masterliftNear: FurnitureItem = {
      id: 'f-desk-near',
      name: 'Inwerk Masterlift 2',
      category: 'office',
      visual: 'inwerk-masterlift',
      widthCm: 160,
      depthCm: 80,
      heightCm: 73,
      x: 300,
      z: 52, // desk spans z=12..92, sits right over low socket at z=9 without blocking it!
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#f8fafc',
    };
    const masterliftFar: FurnitureItem = {
      ...masterliftNear,
      id: 'f-desk-far',
      name: 'Masterlift Fern',
      x: 420,
      z: 300, // ~315 cm away from socket at (300, 9)
    };

    const data = createMepRoom([sw, sock], [pax, masterliftNear]);
    const rep = evaluateFloorplanCollisions(data);
    expect(rep['f-pax'].issues.some((i) => i.type === 'fixture-blocked')).toBe(true);
    expect(rep['f-desk-near'].issues.some((i) => i.type === 'fixture-blocked')).toBe(false);

    const farData = createMepRoom([sock], [masterliftNear, masterliftFar]);
    const obbMap = new Map(farData.furniture.map((f) => [f.id, computeFurnitureOBBs(f)]));
    const diag = evaluateMepDiagnostics(farData, obbMap, computeFloorPolygons(farData.corners, farData.walls));
    const nearDist = diag.socketDistances.find((d) => d.furnitureId === 'f-desk-near')!;
    const farDist = diag.socketDistances.find((d) => d.furnitureId === 'f-desk-far')!;
    expect(nearDist.warning).toBe(false);
    expect(nearDist.distanceCm).toBeLessThan(100);
    expect(farDist.warning).toBe(true);
    expect(farDist.distanceCm).toBeGreaterThan(200);
  });

  it('allows plumbing appliances at water-outlet while flagging non-plumbing furniture and 3D shaft collisions', () => {
    const water: WallFixture = {
      id: 'fix-water',
      wallId: 'w1',
      type: 'water-outlet',
      offsetFromStartCm: 150,
      widthCm: 20,
      heightCm: 25,
      depthCm: 10,
      elevationCm: 50,
      side: 'pos',
    };
    const shaft: WallFixture = {
      id: 'fix-shaft',
      wallId: 'w1',
      type: 'shaft',
      offsetFromStartCm: 400,
      widthCm: 35,
      heightCm: 250,
      depthCm: 35,
      elevationCm: 0,
      side: 'pos',
    };

    const kitchen: FurnitureItem = {
      id: 'f-kitchen',
      name: 'Küchenzeile',
      category: 'kitchen',
      visual: 'kitchen-unit',
      widthCm: 180,
      depthCm: 60,
      heightCm: 90,
      x: 150,
      z: 50, // right in front of water outlet (normal hookup)
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#cbd5e1',
    };
    const bedAtShaft: FurnitureItem = {
      id: 'f-bed-shaft',
      name: 'Bett',
      category: 'bedroom',
      visual: 'bed',
      widthCm: 140,
      depthCm: 200,
      heightCm: 45,
      x: 400,
      z: 115, // spans z=15..215, collides physically with shaft z=7.5..42.5
      hasNightstands: false,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#e2e8f0',
    };

    const rep = evaluateFloorplanCollisions(createMepRoom([water, shaft], [kitchen, bedAtShaft]));
    expect(rep['f-kitchen'].issues.some((i) => i.type === 'fixture-blocked')).toBe(false);
    expect(rep['f-bed-shaft'].issues.some((i) => i.type === 'fixture-blocked')).toBe(true);
  });

  it('exports MEP fixtures to scaled SVG (arch-fixture) and DXF (MEP layer)', () => {
    const rad = { ...createDefaultFixture('radiator', 'w1', 500, 'pos'), id: 'fix-1' };
    const shaft = { ...createDefaultFixture('shaft', 'w2', 400, 'pos'), id: 'fix-2' };
    const data = createMepRoom([rad, shaft]);

    const svg = exportScaledFloorplanSvg(data, { scale: '1:50', language: 'de' });
    expect(svg).toContain('class="arch-fixture"');
    expect(svg).toContain('data-fixture-type="radiator"');
    expect(svg).toContain('data-fixture-type="shaft"');

    const dxf = exportFloorplanDxf(data, { language: 'de' });
    expect(dxf).toContain('0\nLAYER\n2\nMEP');
    expect(dxf).toContain('0\nPOLYLINE\n8\nMEP');
  });

  describe('Store Actions, Undo/Redo, JSON Serialization, and Localized Inspectors (DE/EN)', () => {
    beforeEach(() => {
      useFloorplanStore.getState().loadPreset('standard-55');
      useFloorplanStore.getState().setLanguage('de');
      useFloorplanStore.getState().setShowPassageHeatmap(false);
    });

    it('creates/updates/deletes fixtures, supports undo/redo & JSON round-trip, and renders DE/EN UI', () => {
      const state0 = useFloorplanStore.getState();
      const firstWall = state0.walls[0];
      const fxId = state0.addFixture(createDefaultFixture('radiator', firstWall.id, 300));
      expect(useFloorplanStore.getState().fixtures).toHaveLength(1);
      expect(useFloorplanStore.getState().selectedId).toBe(fxId);
      expect(useFloorplanStore.getState().selectedType).toBe('fixture');

      useFloorplanStore.getState().updateFixture(fxId, { widthCm: 120 });
      expect(useFloorplanStore.getState().fixtures[0].widthCm).toBe(120);

      // JSON round-trip preserves fixtures
      const exported = useFloorplanStore.getState().exportJson();
      useFloorplanStore.getState().removeFixture(fxId);
      expect(useFloorplanStore.getState().fixtures).toHaveLength(0);
      expect(useFloorplanStore.getState().importJson(exported)).toBe(true);
      expect(useFloorplanStore.getState().fixtures).toHaveLength(1);
      expect(useFloorplanStore.getState().fixtures[0].widthCm).toBe(120);

      // Undo/redo works
      useFloorplanStore.getState().undo();
      expect(useFloorplanStore.getState().fixtures).toHaveLength(0);
      useFloorplanStore.getState().redo();
      expect(useFloorplanStore.getState().fixtures).toHaveLength(1);

      // Inspectors & Scorecard UI in DE & EN
      const fx = useFloorplanStore.getState().fixtures[0];
      const wallHtmlDe = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WallInspector, { selectedWall: firstWall })
      );
      expect(wallHtmlDe).toContain('Haustechnik / Anschlüsse');
      expect(wallHtmlDe).toContain('+ Heizkörper');

      const fixHtmlDe = ReactDOMServer.renderToStaticMarkup(
        React.createElement(FixtureInspector, { selectedFixture: fx })
      );
      expect(fixHtmlDe).toContain('Haustechnik-Inspektor');
      expect(fixHtmlDe).toContain('Heizkörper');

      useFloorplanStore.getState().setShowPassageHeatmap(true);
      useFloorplanStore.getState().setLanguage('en');
      const sidebarEn = ReactDOMServer.renderToStaticMarkup(React.createElement(InspectorSidebar));
      expect(sidebarEn).toContain('No socket placed in plan');

      const wallHtmlEn = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WallInspector, { selectedWall: firstWall })
      );
      expect(wallHtmlEn).toContain('MEP / Building Services');
      expect(wallHtmlEn).toContain('+ Radiator');
    });
  });
});
