import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  clientDeltaToWorldDelta,
  clientPointToSvgWorldCm,
  computeWallEndpointFromLength,
  zoomViewBoxAtPoint,
  type CanvasViewBox,
} from '../src/core/canvas2dMath';
import { getWallGeometry } from '../src/core/wallMath';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { WallInspector } from '../src/components/sidebar/WallInspector';
import { FloorplanCanvas2D } from '../src/components/editor2d/FloorplanCanvas2D';

describe('Sprint 2: 2D CAD Projection, Zoom, Numeric Input & Wall Splitting', () => {
  describe('clientPointToSvgWorldCm & clientDeltaToWorldDelta', () => {
    it('maps client coordinates accurately even when SVG container is letterboxed (wide container)', () => {
      // ViewBox 1000x500 (aspect 2:1) inside a 1000x1000 square container:
      // Uniform scale = min(1000/1000, 1000/500) = 1 px/cm
      // Rendered height = 500 px -> vertical letterbox offset = 250 px
      const vb: CanvasViewBox = { x: 0, y: 0, w: 1000, h: 500 };
      const rect = { left: 0, top: 0, width: 1000, height: 1000 };

      const topLeftContent = clientPointToSvgWorldCm(0, 250, rect, vb);
      expect(topLeftContent).toEqual({ x: 0, z: 0 });

      const bottomRightContent = clientPointToSvgWorldCm(1000, 750, rect, vb);
      expect(bottomRightContent).toEqual({ x: 1000, z: 500 });

      const delta = clientDeltaToWorldDelta(120, -60, rect, vb);
      expect(delta).toEqual({ dxCm: 120, dzCm: -60 });
    });

    it('uses inverse screen CTM when provided', () => {
      const vb: CanvasViewBox = { x: 0, y: 0, w: 800, h: 600 };
      const rect = { left: 0, top: 0, width: 800, height: 600 };
      const invCtm = { a: 0.5, b: 0, c: 0, d: 0.5, e: 100, f: 50 };

      const pt = clientPointToSvgWorldCm(200, 300, rect, vb, invCtm);
      expect(pt).toEqual({ x: 200, z: 200 });
    });
  });

  describe('zoomViewBoxAtPoint', () => {
    it('keeps the world point under the cursor stationary when zooming in and out', () => {
      const vb: CanvasViewBox = { x: -100, y: -100, w: 1000, h: 800 };
      const cursorWorld = { x: 300, z: 220 };
      const relXBefore = (cursorWorld.x - vb.x) / vb.w;
      const relZBefore = (cursorWorld.z - vb.y) / vb.h;

      const zoomedIn = zoomViewBoxAtPoint(vb, cursorWorld, 0.8);
      expect(zoomedIn.w).toBeCloseTo(800, 4);
      expect(zoomedIn.h).toBeCloseTo(640, 4);

      const relXAfter = (cursorWorld.x - zoomedIn.x) / zoomedIn.w;
      const relZAfter = (cursorWorld.z - zoomedIn.y) / zoomedIn.h;
      expect(relXAfter).toBeCloseTo(relXBefore, 6);
      expect(relZAfter).toBeCloseTo(relZBefore, 6);
    });

    it('clamps zoom width between minW and maxW while preserving aspect ratio', () => {
      const vb: CanvasViewBox = { x: 0, y: 0, w: 500, h: 400 };
      const minClamped = zoomViewBoxAtPoint(vb, { x: 250, z: 200 }, 0.1, 250, 3000);
      expect(minClamped.w).toBe(250);
      expect(minClamped.h).toBe(200);

      const maxClamped = zoomViewBoxAtPoint(vb, { x: 250, z: 200 }, 20, 250, 3000);
      expect(maxClamped.w).toBe(3000);
      expect(maxClamped.h).toBe(2400);
    });
  });

  describe('computeWallEndpointFromLength', () => {
    it('computes exact wall endpoint along ortho-snapped direction', () => {
      // Cursor slightly off horizontal (dx = 100, dz = 4) -> ortho snaps to 0° (+X)
      const end = computeWallEndpointFromLength(
        { x: 50, z: 100 },
        { x: 150, z: 104 },
        435,
        true,
        false
      );
      expect(end).toEqual({ x: 485, z: 100 });
    });

    it('computes exact diagonal wall endpoint when ortho snap is disabled', () => {
      // 3-4-5 triangle direction -> length 250 cm => dx = 150, dz = 200
      const end = computeWallEndpointFromLength(
        { x: 0, z: 0 },
        { x: 30, z: 40 },
        250,
        false,
        false
      );
      expect(end).toEqual({ x: 150, z: 200 });
    });
  });

  describe('splitWallAt store action & UI', () => {
    beforeEach(() => {
      useFloorplanStore.getState().loadPreset('empty-room');
    });

    it('splits a wall at a given world point and reassigns openings to the second segment', () => {
      const state = useFloorplanStore.getState();
      const topWall = state.walls[0]; // (0,0) -> (400,0), 400 cm
      const opId = state.addOpening({
        wallId: topWall.id,
        type: 'window',
        offsetFromStartCm: 250,
        widthCm: 100,
        heightCm: 130,
        sillHeightCm: 90,
      });

      const cornerId = useFloorplanStore.getState().splitWallAt(topWall.id, { x: 150, z: 20 });
      expect(cornerId).toBeTruthy();

      const after = useFloorplanStore.getState();
      expect(after.selectedId).toBe(cornerId);
      expect(after.selectedType).toBe('corner');
      expect(after.walls).toHaveLength(5);

      const newCorner = after.corners.find((c) => c.id === cornerId)!;
      expect(newCorner.x).toBeCloseTo(150, 1);
      expect(newCorner.z).toBeCloseTo(0, 1);

      const secondHalf = after.walls.find((w) => w.startCornerId === cornerId)!;
      expect(secondHalf).toBeDefined();

      const movedOp = after.openings.find((o) => o.id === opId)!;
      expect(movedOp.wallId).toBe(secondHalf.id);
      expect(movedOp.offsetFromStartCm).toBeCloseTo(100, 1);

      const firstHalf = after.walls.find((w) => w.endCornerId === cornerId)!;
      const startC = after.corners.find((c) => c.id === firstHalf.startCornerId)!;
      expect(getWallGeometry(startC, newCorner).lengthCm).toBeCloseTo(150, 1);
    });

    it('splits at midpoint when no point is passed and rejects walls shorter than 20 cm', () => {
      const state = useFloorplanStore.getState();
      const wall = state.walls[0];
      const midCornerId = state.splitWallAt(wall.id);
      expect(midCornerId).toBeTruthy();
      const midCorner = useFloorplanStore
        .getState()
        .corners.find((c) => c.id === midCornerId)!;
      expect(midCorner.x).toBeCloseTo(200, 1);

      // Short wall (15 cm) cannot be split
      const shortId = useFloorplanStore
        .getState()
        .addWallWithCorners({ x: 0, z: 500 }, { x: 15, z: 500 });
      expect(useFloorplanStore.getState().splitWallAt(shortId)).toBeNull();
    });

    it('renders WallInspector split button and layered FloorplanCanvas2D cleanly in SSR', () => {
      const wall = useFloorplanStore.getState().walls[0];
      const inspectorHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WallInspector, { selectedWall: wall })
      );
      expect(inspectorHtml).toContain('Wand teilen');

      const canvasHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(FloorplanCanvas2D)
      );
      expect(canvasHtml).toContain('grid-100cm');
    });
  });
});
