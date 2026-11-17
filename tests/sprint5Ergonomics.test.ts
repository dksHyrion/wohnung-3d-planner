import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import type { FloorplanData, FurnitureItem } from '../src/core/types';
import { evaluateErgonomicsScorecard } from '../src/core/ergonomicsEngine';
import { InspectorSidebar } from '../src/components/sidebar/InspectorSidebar';
import { OverlaysAndGuidesLayer } from '../src/components/editor2d/layers/FurnitureAndOverlaysLayers';
import { useFloorplanStore } from '../src/store/useFloorplanStore';

function createApartmentWithHallway(hallWidthCm: number): FloorplanData {
  // L-shaped hallway from x=0..600 turning south at x=(600-hallWidthCm)..600 down to z=500 into a 400x400 room
  // Actually simpler: two rectangular rooms joined by an L-bend corridor:
  // Outer walls around corridor top arm: x=0..300, z=0..hallWidthCm
  // Corner turn down at x=(300 - hallWidthCm)..300, z=0..350 into room (x=0..450, z=350..750)
  // Using inner walls for crisp clean corridors of exact `hallWidthCm`:
  const H = hallWidthCm;
  const corners = [
    { id: 'c1', x: 0, z: 0 },
    { id: 'c2', x: 300, z: 0 },
    { id: 'c3', x: 300, z: 350 },
    { id: 'c4', x: 450, z: 350 },
    { id: 'c5', x: 450, z: 750 },
    { id: 'c6', x: 0, z: 750 },
    { id: 'c7', x: 0, z: 350 },
    { id: 'c8', x: 300 - H, z: 350 },
    { id: 'c9', x: 300 - H, z: H },
    { id: 'c10', x: 0, z: H },
  ];
  const walls = [
    { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 10, heightCm: 250 },
    { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 10, heightCm: 250 },
    { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 10, heightCm: 250 },
    { id: 'w4', startCornerId: 'c4', endCornerId: 'c5', thicknessCm: 10, heightCm: 250 },
    { id: 'w5', startCornerId: 'c5', endCornerId: 'c6', thicknessCm: 10, heightCm: 250 },
    { id: 'w6', startCornerId: 'c6', endCornerId: 'c7', thicknessCm: 10, heightCm: 250 },
    { id: 'w7', startCornerId: 'c7', endCornerId: 'c8', thicknessCm: 10, heightCm: 250 },
    { id: 'w8', startCornerId: 'c8', endCornerId: 'c9', thicknessCm: 10, heightCm: 250 },
    { id: 'w9', startCornerId: 'c9', endCornerId: 'c10', thicknessCm: 10, heightCm: 250 },
    { id: 'w10', startCornerId: 'c10', endCornerId: 'c1', thicknessCm: 10, heightCm: 250 },
  ];
  const openings = [
    {
      id: 'op-ent',
      wallId: 'w10',
      type: 'door' as const,
      offsetFromStartCm: 5,
      widthCm: Math.min(95, H - 10),
      heightCm: 210,
      sillHeightCm: 0,
      swingDirection: 'in-left' as const,
    },
  ];
  return {
    corners,
    walls,
    openings,
    furniture: [],
    roomLabels: [{ name: 'Wohnbereich', x: 220, z: 550 }],
  };
}

function createTwoRoomPlan(blockingCorridor: boolean): FloorplanData {
  // Room A (0..300, 0..300) with exterior door on left wall w4; Room B (300..600, 0..300) connected by 90 cm door in w_mid
  const corners = [
    { id: 'c1', x: 0, z: 0 },
    { id: 'c2', x: 300, z: 0 },
    { id: 'c3', x: 600, z: 0 },
    { id: 'c4', x: 600, z: 300 },
    { id: 'c5', x: 300, z: 300 },
    { id: 'c6', x: 0, z: 300 },
  ];
  const walls = [
    { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
    { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
    { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
    { id: 'w4', startCornerId: 'c4', endCornerId: 'c5', thicknessCm: 15, heightCm: 250 },
    { id: 'w5', startCornerId: 'c5', endCornerId: 'c6', thicknessCm: 15, heightCm: 250 },
    { id: 'w6', startCornerId: 'c6', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
    { id: 'w_mid', startCornerId: 'c2', endCornerId: 'c5', thicknessCm: 15, heightCm: 250 },
  ];
  const openings = [
    {
      id: 'op-ent',
      wallId: 'w6',
      type: 'door' as const,
      offsetFromStartCm: 100,
      widthCm: 95,
      heightCm: 210,
      sillHeightCm: 0,
      swingDirection: 'in-left' as const,
    },
    {
      id: 'op-inner',
      wallId: 'w_mid',
      type: 'door' as const,
      offsetFromStartCm: 100,
      widthCm: 90,
      heightCm: 210,
      sillHeightCm: 0,
      swingDirection: 'in-left' as const,
    },
  ];
  const furniture: FurnitureItem[] = [
    {
      id: 'f-bed',
      name: 'Bett',
      category: 'bedroom',
      visual: 'bed',
      widthCm: 160,
      depthCm: 200,
      heightCm: 45,
      x: 470,
      z: 150,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#cbd5e1',
    },
  ];
  if (blockingCorridor) {
    // Huge wardrobe parked right across the inner doorway
    furniture.push({
      id: 'f-blocker',
      name: 'Schrank-Barriere',
      category: 'storage',
      visual: 'wardrobe',
      widthCm: 60,
      depthCm: 240,
      heightCm: 220,
      x: 260,
      z: 150,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#94a3b8',
    });
  }
  return {
    corners,
    walls,
    openings,
    furniture,
    roomLabels: [
      { name: 'Flur', x: 120, z: 150 },
      { name: 'Schlafzimmer', x: 470, z: 150 },
    ],
  };
}

describe('Sprint 5: Ergonomics 2.0 (Reachability, Delivery Path, DIN Turning Circle & Scorecard)', () => {
  it('detects reachable rooms when open and unreachable room/furniture when a doorway is blocked', () => {
    const openPlan = createTwoRoomPlan(false);
    const openReport = evaluateErgonomicsScorecard(openPlan);
    expect(openReport.hasEntranceSeed).toBe(true);
    expect(openReport.rooms).toHaveLength(2);
    expect(openReport.rooms.every((r) => r.reachableFromEntrance)).toBe(true);
    expect(openReport.unreachableFurnitureIds).toEqual([]);

    const blockedPlan = createTwoRoomPlan(true);
    const blockedReport = evaluateErgonomicsScorecard(blockedPlan);
    const schlafzimmer = blockedReport.rooms.find((r) => r.roomName === 'Schlafzimmer')!;
    expect(schlafzimmer.reachableFromEntrance).toBe(false);
    expect(blockedReport.unreachableFurnitureIds).toContain('f-bed');
    expect(blockedReport.overallScore).toBeLessThan(openReport.overallScore);
  });

  it('evaluates rigid L-corner delivery paths ("Passt der Tisch um die Flurecke?")', () => {
    const longTable: FurnitureItem = {
      id: 'f-long-table',
      name: 'Langer Esstisch',
      category: 'living',
      visual: 'generic-table',
      widthCm: 230,
      depthCm: 95,
      heightCm: 95,
      x: 220,
      z: 550,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#d6d3d1',
    };
    const compactShelf: FurnitureItem = {
      id: 'f-compact',
      name: 'Kommode',
      category: 'storage',
      visual: 'sideboard',
      widthCm: 110,
      depthCm: 45,
      heightCm: 80,
      x: 220,
      z: 550,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#cbd5e1',
    };

    // Tight 100 cm L-bend hallway (95 cm thick table cannot turn 90 deg corner cleanly)
    const tightPlan = createApartmentWithHallway(100);
    tightPlan.furniture = [longTable, compactShelf];
    const tightReport = evaluateErgonomicsScorecard(tightPlan);

    const tableCheckTight = tightReport.deliveryChecks.find((d) => d.furnitureId === 'f-long-table')!;
    const shelfCheckTight = tightReport.deliveryChecks.find((d) => d.furnitureId === 'f-compact')!;
    expect(tableCheckTight.status).toBe('blocked');
    expect(shelfCheckTight.status).toBe('fits');

    // Wide 170 cm L-bend hallway lets the 230x95 table turn cleanly around the corner
    const widePlan = createApartmentWithHallway(170);
    widePlan.furniture = [longTable];
    const wideReport = evaluateErgonomicsScorecard(widePlan);
    const tableCheckWide = wideReport.deliveryChecks.find((d) => d.furnitureId === 'f-long-table')!;
    expect(tableCheckWide.status).toBe('fits');
  });

  it('checks DIN 18040-2 150x150 cm turning circle and chair pullback clearance', () => {
    const corners = [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 400, z: 0 },
      { id: 'c3', x: 400, z: 400 },
      { id: 'c4', x: 0, z: 400 },
    ];
    const walls = [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
    ];
    const openings = [
      {
        id: 'op1',
        wallId: 'w4',
        type: 'door' as const,
        offsetFromStartCm: 150,
        widthCm: 95,
        heightCm: 210,
        sillHeightCm: 0,
        swingDirection: 'in-left' as const,
      },
    ];

    // Table pushed close to top wall -> chair pullback space < 55 cm (critical)
    // Room stays spacious enough near bottom for 150 cm turning circle
    const report = evaluateErgonomicsScorecard({
      corners,
      walls,
      openings,
      furniture: [
        {
          id: 'f-dining',
          name: 'Esstisch',
          category: 'living',
          visual: 'dining-table',
          widthCm: 160,
          depthCm: 90,
          heightCm: 75,
          x: 200,
          z: 85,
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#b45309',
        },
      ],
      roomLabels: [{ name: 'Esszimmer', x: 200, z: 250 }],
    });

    expect(report.rooms[0].hasTurningCircle150).toBe(true);
    expect(report.rooms[0].maxTurningDiameterCm).toBeGreaterThanOrEqual(150);
    expect(report.chairPullbackIssues).toHaveLength(1);
    expect(report.chairPullbackIssues[0].severity).toBe('critical');

    // Narrow 120 cm room fails 150 cm turning circle
    const narrowReport = evaluateErgonomicsScorecard({
      corners: [
        { id: 'n1', x: 0, z: 0 },
        { id: 'n2', x: 120, z: 0 },
        { id: 'n3', x: 120, z: 320 },
        { id: 'n4', x: 0, z: 320 },
      ],
      walls: [
        { id: 'nw1', startCornerId: 'n1', endCornerId: 'n2', thicknessCm: 15, heightCm: 250 },
        { id: 'nw2', startCornerId: 'n2', endCornerId: 'n3', thicknessCm: 15, heightCm: 250 },
        { id: 'nw3', startCornerId: 'n3', endCornerId: 'n4', thicknessCm: 15, heightCm: 250 },
        { id: 'nw4', startCornerId: 'n4', endCornerId: 'n1', thicknessCm: 15, heightCm: 250 },
      ],
      openings: [],
      furniture: [],
      roomLabels: [{ name: 'Schmalflur', x: 60, z: 160 }],
    });
    expect(narrowReport.rooms[0].hasTurningCircle150).toBe(false);
    expect(narrowReport.rooms[0].maxTurningDiameterCm).toBeLessThan(150);
  });

  it('computes Klapp-Diff for pose: "open" sofa bed against obstacle in front', () => {
    const basePlan: FloorplanData = {
      corners: [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 400, z: 0 },
        { id: 'c3', x: 400, z: 400 },
        { id: 'c4', x: 0, z: 400 },
      ],
      walls: [
        { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
        { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
        { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
        { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
      ],
      openings: [],
      furniture: [
        {
          id: 'osaka-1',
          name: 'Osaka Sofa',
          category: 'living',
          visual: 'boconcept-osaka',
          pose: 'closed',
          widthCm: 190,
          depthCm: 95,
          heightCm: 90,
          x: 200,
          z: 65,
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#2a2a2a',
        },
        {
          id: 'coffee-1',
          name: 'Couchtisch',
          category: 'living',
          visual: 'coffee-table',
          widthCm: 110,
          depthCm: 60,
          heightCm: 40,
          x: 200,
          z: 185,
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#78716c',
        },
      ],
      roomLabels: [{ name: 'Wohnzimmer', x: 200, z: 220 }],
    };

    const report = evaluateErgonomicsScorecard(basePlan);
    expect(report.foldOpenDiffs).toHaveLength(1);
    expect(report.foldOpenDiffs[0].currentPose).toBe('closed');
    expect(report.foldOpenDiffs[0].simulatedPose).toBe('open');
    expect(report.foldOpenDiffs[0].introducesCollisions).toBe(true);
    expect(report.foldOpenDiffs[0].newIssueMessages.length).toBeGreaterThan(0);
  });

  describe('Store Integration, 2D Turning Circles, and Scorecard UI (DE/EN)', () => {
    beforeEach(() => {
      useFloorplanStore.getState().loadPreset('standard-55');
      useFloorplanStore.getState().setLanguage('de');
      useFloorplanStore.getState().setShowPassageHeatmap(false);
    });

    it('populates ergonomicsScorecard in store when showPassageHeatmap is toggled and renders UI + 2D circles', () => {
      expect(useFloorplanStore.getState().ergonomicsScorecard).toBeNull();

      useFloorplanStore.getState().setShowPassageHeatmap(true);
      const scorecard = useFloorplanStore.getState().ergonomicsScorecard;
      expect(scorecard).not.toBeNull();
      expect(scorecard!.rooms.length).toBeGreaterThan(0);

      const sidebarDe = ReactDOMServer.renderToStaticMarkup(React.createElement(InspectorSidebar));
      expect(sidebarDe).toContain('Ergonomie-Scorecard');
      expect(sidebarDe).toContain('Gesamtwert:');

      const overlaySvg = ReactDOMServer.renderToStaticMarkup(
        React.createElement(
          'svg',
          null,
          React.createElement(OverlaysAndGuidesLayer, {
            dragState: null,
            calibrationHoverPt: null,
          })
        )
      );
      expect(overlaySvg).toContain('data-testid="turning-circle-');

      useFloorplanStore.getState().setLanguage('en');
      const sidebarEn = ReactDOMServer.renderToStaticMarkup(React.createElement(InspectorSidebar));
      expect(sidebarEn).toContain('Ergonomics Scorecard');
      expect(sidebarEn).toContain('Score:');
    });
  });
});
