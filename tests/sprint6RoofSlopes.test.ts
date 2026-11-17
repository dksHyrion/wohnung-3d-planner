import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import type { FloorplanData, FurnitureItem, RoofSlope } from '../src/core/types';
import { computeFloorPolygons, applyRoomLabels } from '../src/core/wallMath';
import {
  resolveRoofSlopePlanes,
  getEffectiveCeilingHeightAt,
  computeRoomWoFlVBreakdown,
  computeRoofSlopeContourLines,
  computeRoofSlopeQuad3D,
} from '../src/core/roofSlopeMath';
import { evaluateFloorplanCollisions } from '../src/core/collisionEngine';
import { computeRoomBalanceSummary, exportFurnitureBomMarkdown } from '../src/core/export/bomExport';
import { WallInspector } from '../src/components/sidebar/WallInspector';
import { RoomInspector } from '../src/components/sidebar/RoomInspector';
import { OverlaysAndGuidesLayer } from '../src/components/editor2d/layers/FurnitureAndOverlaysLayers';
import { useFloorplanStore } from '../src/store/useFloorplanStore';

function createAtticRoom(roofSlopes: RoofSlope[], furniture: FurnitureItem[] = []): FloorplanData {
  // 400 x 400 cm interior wall centerline -> 10 cm walls -> inner clear span 390 x 390 cm (approx)
  // Using thin 0-offset reference or standard 10 cm walls:
  const corners = [
    { id: 'c1', x: 0, z: 0 },
    { id: 'c2', x: 400, z: 0 },
    { id: 'c3', x: 400, z: 400 },
    { id: 'c4', x: 0, z: 400 },
  ];
  const walls = [
    { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 10, heightCm: 250 },
    { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 10, heightCm: 250 },
    { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 10, heightCm: 250 },
    { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 10, heightCm: 250 },
  ];
  return {
    corners,
    walls,
    openings: [],
    furniture,
    roofSlopes,
    roomLabels: [{ name: 'Dachstudio', x: 200, z: 200, flooringType: 'parquet' }],
  };
}

describe('Sprint 6: RoofSlopes (Dachschrägen), WoFlV Area, and 3D Collision', () => {
  it('computes ceiling height, 1m/2m WoFlV contour lines, 3D quad, and WoFlV area breakdown', () => {
    // 45 deg pitch from knee wall 50 cm along w1 (z=0..5 interior face at z=5)
    // At distInward = 50 cm (z = 55): h = 50 + 50*1 = 100 cm
    // At distInward = 150 cm (z = 155): h = 50 + 150*1 = 200 cm
    const slope: RoofSlope = {
      id: 'rs-1',
      wallId: 'w1',
      kneeWallHeightCm: 50,
      pitchDeg: 45,
      side: 'pos',
    };
    const data = createAtticRoom([slope]);
    const rooms = applyRoomLabels(computeFloorPolygons(data.corners, data.walls), data.roomLabels);
    const planes = resolveRoofSlopePlanes(data.corners, data.walls, data.roofSlopes, rooms);

    expect(planes).toHaveLength(1);
    expect(planes[0].inwardNormalZ).toBeCloseTo(1, 4);

    // Height check inside room
    const hNearWall = getEffectiveCeilingHeightAt(200, 30, planes, 250);
    expect(hNearWall.ceilingYCm).toBeCloseTo(75, 1); // z=30 is 25 cm inward -> 50 + 25 = 75 cm
    const hDeep = getEffectiveCeilingHeightAt(200, 300, planes, 250);
    expect(hDeep.ceilingYCm).toBeCloseTo(250, 1);

    // 1.00 m line at z = 5 + 50 = 55; 2.00 m line at z = 5 + 150 = 155
    const contours = computeRoofSlopeContourLines(planes[0]);
    expect(contours.line100).not.toBeNull();
    expect(contours.line200).not.toBeNull();
    expect(contours.line100![0].z).toBeCloseTo(55, 1);
    expect(contours.line200![0].z).toBeCloseTo(155, 1);

    // 3D Quad corners rise from y=50 to y=250 over runCm=200
    const quad = computeRoofSlopeQuad3D(planes[0], 250);
    expect(quad.corners[0].y).toBe(50);
    expect(quad.corners[2].y).toBeCloseTo(250, 1);
    expect(quad.corners[2].z).toBeCloseTo(205, 1);

    // WoFlV calculation: clear interior is 390 x 390 cm = 15.21 m2
    // Strips along 390 cm depth (from z=5 to z=395):
    // 0% band (z=5..55): 50/390, 50% band (z=55..155): 100/390, 100% band (z=155..395): 240/390
    const breakdown = computeRoomWoFlVBreakdown(rooms[0], planes, 250);
    expect(breakdown.hasRoofSlopes).toBe(true);
    expect(breakdown.netAreaSqM).toBeCloseTo(15.21, 2);
    expect(breakdown.areaZeroSqM).toBeCloseTo((50 * 390) / 10000, 1);
    expect(breakdown.areaHalfSqM).toBeCloseTo((100 * 390) / 10000, 1);
    expect(breakdown.areaFullSqM).toBeCloseTo((240 * 390) / 10000, 1);
    expect(breakdown.woflvAreaSqM).toBeCloseTo(
      breakdown.areaFullSqM + 0.5 * breakdown.areaHalfSqM,
      1
    );
    expect(breakdown.woflvAreaSqM).toBeLessThan(breakdown.netAreaSqM);
  });

  it('flags 3D height collision when tall wardrobe intersects RoofSlope while low bed fits', () => {
    const slope: RoofSlope = {
      id: 'rs-1',
      wallId: 'w1',
      kneeWallHeightCm: 80,
      pitchDeg: 45,
      side: 'pos',
    };

    const tallWardrobe: FurnitureItem = {
      id: 'f-pax',
      name: 'PAX Schrank',
      category: 'storage',
      visual: 'wardrobe',
      widthCm: 100,
      depthCm: 60,
      heightCm: 220,
      x: 80,
      z: 60, // spans z=30..90 -> at z=30 (25 cm inward), ceiling is 105 cm < 220 cm!
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#cbd5e1',
    };
    const lowBed: FurnitureItem = {
      id: 'f-low-bed',
      name: 'Futon',
      category: 'bedroom',
      visual: 'bed',
      widthCm: 140,
      depthCm: 200,
      heightCm: 45,
      x: 280,
      z: 130, // z=30..230, x=210..350 -> lowest ceiling at z=30 (25 cm inward) is 105 cm > 45 cm!
      hasNightstands: false,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#e2e8f0',
    };

    const data = createAtticRoom([slope], [tallWardrobe, lowBed]);
    const reports = evaluateFloorplanCollisions(data);

    expect(reports['f-pax'].hasCollision).toBe(true);
    const roofIssue = reports['f-pax'].issues.find((i) => i.type === 'roof-slope-exceeded');
    expect(roofIssue).toBeDefined();
    expect(roofIssue!.overflowCm).toBeGreaterThan(100);

    expect(reports['f-low-bed'].hasCollision).toBe(false);
  });

  it('includes WoFlV area in BOM room balance summary and Markdown export when roof slopes exist', () => {
    const slope: RoofSlope = {
      id: 'rs-1',
      wallId: 'w1',
      kneeWallHeightCm: 50,
      pitchDeg: 45,
      side: 'pos',
    };
    const data = createAtticRoom([slope]);
    const summary = computeRoomBalanceSummary(data, 'de');
    expect(summary.hasRoofSlopes).toBe(true);
    expect(summary.totalWoFlVSqM).toBeLessThan(summary.totalNetSqM);

    const md = exportFurnitureBomMarkdown(data, { language: 'de' });
    expect(md).toContain('WoFlV-Wohnfläche');
  });

  describe('Store Actions, Undo/Redo, JSON Serialization, and 2D/UI Integration', () => {
    beforeEach(() => {
      useFloorplanStore.getState().loadPreset('empty-400x320');
      useFloorplanStore.getState().setLanguage('de');
    });

    it('adds/updates/removes roof slopes with undo/redo, JSON round-trip, and renders UI + 2D contours', () => {
      const state0 = useFloorplanStore.getState();
      const firstWall = state0.walls[0];
      expect(state0.roofSlopes).toEqual([]);

      const slopeId = state0.addRoofSlope({
        wallId: firstWall.id,
        kneeWallHeightCm: 90,
        pitchDeg: 40,
      });
      expect(useFloorplanStore.getState().roofSlopes).toHaveLength(1);

      useFloorplanStore.getState().updateRoofSlope(slopeId, { kneeWallHeightCm: 75 });
      expect(useFloorplanStore.getState().roofSlopes[0].kneeWallHeightCm).toBe(75);

      // JSON export + import round-trip preserves roofSlopes
      const exported = useFloorplanStore.getState().exportJson();
      useFloorplanStore.getState().removeRoofSlope(slopeId);
      expect(useFloorplanStore.getState().roofSlopes).toHaveLength(0);
      expect(useFloorplanStore.getState().importJson(exported)).toBe(true);
      expect(useFloorplanStore.getState().roofSlopes).toHaveLength(1);
      expect(useFloorplanStore.getState().roofSlopes[0].kneeWallHeightCm).toBe(75);

      // Undo restores pre-import (empty roofSlopes), Redo brings it back
      useFloorplanStore.getState().undo();
      expect(useFloorplanStore.getState().roofSlopes).toHaveLength(0);
      useFloorplanStore.getState().redo();
      expect(useFloorplanStore.getState().roofSlopes).toHaveLength(1);

      // UI checks: WallInspector shows roof slope controls; RoomInspector shows WoFlV; 2D SVG renders 1,00 m / 2,00 m lines
      const wallHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WallInspector, { selectedWall: firstWall })
      );
      expect(wallHtml).toContain('Dachschräge (WoFlV)');
      expect(wallHtml).toContain('Kniestock (cm)');

      const rooms = applyRoomLabels(
        computeFloorPolygons(
          useFloorplanStore.getState().corners,
          useFloorplanStore.getState().walls
        ),
        useFloorplanStore.getState().roomLabels
      );
      const roomHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(RoomInspector, { selectedRoom: rooms[0], roomIndex: 0 })
      );
      expect(roomHtml).toContain('data-testid="room-woflv-readout"');
      expect(roomHtml).toContain('WoFlV Wohnfläche');

      const svgOverlay = ReactDOMServer.renderToStaticMarkup(
        React.createElement(
          'svg',
          null,
          React.createElement(OverlaysAndGuidesLayer, {
            dragState: null,
            calibrationHoverPt: null,
          })
        )
      );
      expect(svgOverlay).toContain('data-testid="roof-slope-contours-2d"');
      expect(svgOverlay).toContain('1,00 m');
      expect(svgOverlay).toContain('2,00 m');
    });
  });
});
