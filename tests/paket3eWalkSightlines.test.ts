import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import type { FloorplanData } from '../src/core/types';
import {
  stepFirstPersonWalk,
  evaluateWalkAndSightlines,
} from '../src/core/walkAndSightlines';
import { InspectorSidebar } from '../src/components/sidebar/InspectorSidebar';
import { OverlaysAndGuidesLayer } from '../src/components/editor2d/layers/FurnitureAndOverlaysLayers';
import { useFloorplanStore } from '../src/store/useFloorplanStore';

function createWalkPlan(): FloorplanData {
  // Room A (0..300, 0..300) and Room B (300..600, 0..300) separated by w_mid with 90 cm door at z=105..195
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
      id: 'op-door',
      wallId: 'w_mid',
      type: 'door' as const,
      offsetFromStartCm: 105,
      widthCm: 90,
      heightCm: 210,
      sillHeightCm: 0,
      swingDirection: 'in-left' as const,
    },
    {
      id: 'op-win',
      wallId: 'w1',
      type: 'window' as const,
      offsetFromStartCm: 80,
      widthCm: 140,
      heightCm: 130,
      sillHeightCm: 90,
    },
  ];
  return { corners, walls, openings, furniture: [] };
}

describe('Paket 3E: Interactive WASD Walkthrough & Sightline/Glare Analysis', () => {
  it('walks smoothly through walkthrough doorways, blocks solid walls & windows, and slides along walls', () => {
    const plan = createWalkPlan();

    // Walking straight through door center at (300, 150) along +X succeeds
    let pos = { x: 260, y: 170, z: 150 };
    let target = { x: 360, y: 170, z: 150 };
    for (let i = 0; i < 4; i++) {
      const res = stepFirstPersonWalk({
        pos,
        target,
        forwardInput: 1,
        strafeInput: 0,
        stepCm: 20,
        eyeLevelCm: 170,
        corners: plan.corners,
        walls: plan.walls,
        openings: plan.openings,
      });
      expect(res.moved).toBe(true);
      pos = res.pos;
      target = res.target;
    }
    expect(pos.x).toBeGreaterThan(320); // crossed partition wall at x=300 cleanly!
    expect(pos.y).toBe(170);

    // Walking directly into solid window wall w1 at z=0 stops before passing through window
    const winStep = stepFirstPersonWalk({
      pos: { x: 150, y: 115, z: 30 },
      target: { x: 150, y: 115, z: -50 },
      forwardInput: 1,
      strafeInput: 0,
      stepCm: 40,
      eyeLevelCm: 115,
      corners: plan.corners,
      walls: plan.walls,
      openings: plan.openings,
    });
    expect(winStep.blocked).toBe(true);
    expect(winStep.pos.z).toBe(30);

    // Angled walk toward solid wall w_mid at z=50 slides along Z without crossing wall
    const slideStep = stepFirstPersonWalk({
      pos: { x: 270, y: 170, z: 50 },
      target: { x: 350, y: 170, z: 90 },
      forwardInput: 1,
      strafeInput: 0,
      stepCm: 20,
      eyeLevelCm: 170,
      corners: plan.corners,
      walls: plan.walls,
      openings: plan.openings,
    });
    expect(slideStep.moved).toBe(true);
    expect(slideStep.pos.x).toBe(270);
    expect(slideStep.pos.z).toBeGreaterThan(50);
  });

  it('detects screen reflection-glare, backlight-contrast, and clear ergonomic side-lighting', () => {
    const base = createWalkPlan(); // window on top wall w1 centered at (150, 0)

    // 1. Reflection glare: desk at (150, 140) facing South (rot=0 -> viewer at z=180 looking North at screen, window behind viewer? Wait: front +localZ = (0, +1) -> viewer sits at +Z looking -Z!)
    // So if rot=180 deg, front +localZ = (0, -1) -> faces North toward window at z=0 (window shines onto screen!)
    const glarePlan: FloorplanData = {
      ...base,
      furniture: [
        {
          id: 'mon-glare',
          name: 'Monitor Blendung',
          category: 'office',
          visual: 'desk-monitor',
          widthCm: 62,
          depthCm: 22,
          heightCm: 50,
          x: 150,
          z: 140,
          elevationCm: 75,
          rotationYDeg: 180,
          color: '#0f172a',
        },
        {
          id: 'mon-backlight',
          name: 'Monitor Gegenlicht',
          category: 'office',
          visual: 'desk-monitor',
          widthCm: 62,
          depthCm: 22,
          heightCm: 50,
          x: 150,
          z: 90,
          elevationCm: 75,
          rotationYDeg: 0, // front +Z faces South; window at z=0 is directly BEHIND monitor
          color: '#0f172a',
        },
        {
          id: 'mon-ergonomic',
          name: 'Monitor Ergonomisch',
          category: 'office',
          visual: 'desk-monitor',
          widthCm: 62,
          depthCm: 22,
          heightCm: 50,
          x: 150,
          z: 200,
          elevationCm: 75,
          rotationYDeg: 90, // 90 deg side light from window
          color: '#0f172a',
        },
      ],
    };

    const rep = evaluateWalkAndSightlines(glarePlan, {
      timeOfDay: 12,
      alignSunWithWindows: true,
    });
    const glareIssue = rep.glareIssues.find((g) => g.furnitureId === 'mon-glare')!;
    const backlightIssue = rep.glareIssues.find((g) => g.furnitureId === 'mon-backlight')!;
    const ergoIssue = rep.glareIssues.find((g) => g.furnitureId === 'mon-ergonomic');

    expect(glareIssue.kind).toBe('reflection-glare');
    expect(backlightIssue.kind).toBe('backlight-contrast');
    expect(ergoIssue).toBeUndefined();
  });

  it('evaluates seating-to-artwork sightlines including tall furniture obstruction', () => {
    const base = createWalkPlan();
    const clearPlan: FloorplanData = {
      ...base,
      furniture: [
        {
          id: 'sofa-1',
          name: 'Wohnsofa',
          category: 'living',
          visual: 'sofa',
          widthCm: 200,
          depthCm: 90,
          heightCm: 80,
          x: 150,
          z: 240,
          elevationCm: 0,
          rotationYDeg: 180, // faces North (-Z) toward w1
          color: '#64748b',
        },
        {
          id: 'art-1',
          name: 'Wandbild',
          category: 'decor',
          visual: 'wall-picture',
          widthCm: 100,
          depthCm: 4,
          heightCm: 70,
          x: 150,
          z: 14,
          elevationCm: 135,
          rotationYDeg: 0,
          color: '#38bdf8',
        },
      ],
    };

    const repClear = evaluateWalkAndSightlines(clearPlan);
    expect(repClear.sightlines).toHaveLength(1);
    expect(repClear.sightlines[0].status).toBe('clear');
    expect(repClear.sightlines[0].viewingAngleDeg).toBeLessThanOrEqual(5);

    const obstructedPlan: FloorplanData = {
      ...clearPlan,
      furniture: [
        ...clearPlan.furniture,
        {
          id: 'pax-mid',
          name: 'Hoher Raumteiler',
          category: 'storage',
          visual: 'bookcase',
          widthCm: 120,
          depthCm: 40,
          heightCm: 200,
          x: 150,
          z: 130,
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#cbd5e1',
        },
      ],
    };

    const repBlocked = evaluateWalkAndSightlines(obstructedPlan);
    expect(repBlocked.sightlines[0].status).toBe('obstructed');
    expect(repBlocked.sightlines[0].obstructedByName).toBe('Hoher Raumteiler');
  });

  describe('UI Scorecard & 2D Rays (DE / EN)', () => {
    beforeEach(() => {
      useFloorplanStore.getState().loadPreset('standard-55');
      useFloorplanStore.getState().setLanguage('de');
      useFloorplanStore.getState().setShowPassageHeatmap(true);
    });

    it('renders glare & sightline diagnostics in InspectorSidebar and 2D SVG overlay in DE and EN', () => {
      // standard-55 has sofa, wall pictures / monitor, and windows
      const sidebarDe = ReactDOMServer.renderToStaticMarkup(React.createElement(InspectorSidebar));
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

      // Should cleanly render without errors and reflect DE/EN state
      expect(sidebarDe).toContain('Ergonomie-Scorecard');
      expect(overlaySvg).toContain('data-testid="passage-heatmap-2d"');

      useFloorplanStore.getState().setLanguage('en');
      const sidebarEn = ReactDOMServer.renderToStaticMarkup(React.createElement(InspectorSidebar));
      expect(sidebarEn).toContain('Ergonomics Scorecard');
    });
  });
});
