import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import * as THREE from 'three';
import { useFloorplanStore } from '../src/store/useFloorplanStore';

// Mock useFrame from @react-three/fiber so components can be rendered without WebGL Canvas
vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@react-three/fiber');
  return {
    ...actual,
    useFrame: vi.fn(),
  };
});

describe('Linen S-Fold Curtains & Window Textiles (Task 2)', () => {
  beforeEach(() => {
    useFloorplanStore.setState({ showDecor: true });
  });
  describe('createCurtainWaveShape (Sinusoidal Shape Generator)', () => {
    it('creates a closed 2D sinusoidal profile along X with 0.35 cm fabric thickness', async () => {
      const { createCurtainWaveShape } = await import(
        '../src/components/viewer3d/decor/ProceduralCurtain3D'
      );

      const widthCm = 45;
      const amplitudeCm = 3.2;
      const waveLengthCm = 12;

      const shape = createCurtainWaveShape(widthCm, amplitudeCm, waveLengthCm);
      expect(shape).toBeInstanceOf(THREE.Shape);

      const points = shape.getPoints();
      expect(points.length).toBeGreaterThan(20);

      // Starting point at origin (0, 0)
      expect(points[0].x).toBeCloseTo(0, 1);
      expect(points[0].y).toBeCloseTo(0, 1);

      // Verify sinusoidal wave peak at lambda / 4 = 3 cm: sin(pi/2) * 3.2 = 3.2
      const quarterPoint = points.find((p) => Math.abs(p.x - 3) < 0.25);
      expect(quarterPoint).toBeDefined();
      expect(quarterPoint!.y).toBeCloseTo(amplitudeCm, 1);

      // Verify sinusoidal wave trough at 3 * lambda / 4 = 9 cm: sin(3pi/2) * 3.2 = -3.2
      const threeQuarterPoint = points.find((p) => Math.abs(p.x - 9) < 0.25);
      expect(threeQuarterPoint).toBeDefined();
      expect(threeQuarterPoint!.y).toBeCloseTo(-amplitudeCm, 1);

      // Verify closed path: end point connects back to or near starting point
      const lastPoint = points[points.length - 1];
      const startPoint = points[0];
      const dist = Math.hypot(lastPoint.x - startPoint.x, lastPoint.y - startPoint.y);
      expect(dist).toBeLessThan(0.4);

      // Verify fabric thickness: back curve is offset by 0.35 cm
      const backQuarterPoint = points
        .slice(Math.floor(points.length / 2))
        .find((p) => Math.abs(p.x - 3) < 0.25);
      expect(backQuarterPoint).toBeDefined();
      expect(quarterPoint!.y - backQuarterPoint!.y).toBeCloseTo(0.35, 1);
    });

    it('uses default parameters amplitude = 3.2 cm and wavelength = 12 cm', async () => {
      const { createCurtainWaveShape } = await import(
        '../src/components/viewer3d/decor/ProceduralCurtain3D'
      );
      const shape = createCurtainWaveShape(40);
      const points = shape.getPoints();
      const peak = points.find((p) => Math.abs(p.x - 3) < 0.25);
      expect(peak).toBeDefined();
      expect(peak!.y).toBeCloseTo(3.2, 1);
    });
  });

  describe('computeWindowCurtainPlacement', () => {
    const opening = {
      offsetFromStartCm: 150,
      widthCm: 120,
      heightCm: 140,
      sillHeightCm: 80,
    };
    const wallLengthCm = 400;
    const wallHeightCm = 250;

    it('computes floor-to-ceiling full height placement when isCutaway is false', async () => {
      const { computeWindowCurtainPlacement } = await import(
        '../src/components/viewer3d/decor/ProceduralCurtain3D'
      );

      const placement = computeWindowCurtainPlacement(
        wallLengthCm,
        opening,
        wallHeightCm,
        false
      );

      // Floor-to-ceiling height (wallHeightCm - 3 cm)
      expect(placement.heightCm).toBe(247);
      expect(placement.elevationCm).toBe(0);

      // Panels flank the window (width 40..50 cm, overlapping window by 15 cm)
      expect(placement.leftPanel.widthCm).toBeGreaterThanOrEqual(40);
      expect(placement.leftPanel.widthCm).toBeLessThanOrEqual(50);
      expect(placement.rightPanel.widthCm).toBeGreaterThanOrEqual(40);
      expect(placement.rightPanel.widthCm).toBeLessThanOrEqual(50);

      // Left panel overlaps window left edge (offset 150) by 15 cm -> right edge of left panel is 165
      const leftPanelRightEdge =
        placement.leftPanel.offsetCm + placement.leftPanel.widthCm;
      expect(leftPanelRightEdge).toBe(opening.offsetFromStartCm + 15);

      // Right panel overlaps window right edge (offset 150 + 120 = 270) by 15 cm -> left edge of right panel is 255
      expect(placement.rightPanel.offsetCm).toBe(
        opening.offsetFromStartCm + opening.widthCm - 15
      );

      // Rail spans across panels
      expect(placement.railOffsetCm).toBe(placement.leftPanel.offsetCm);
      expect(placement.railLengthCm).toBe(
        placement.rightPanel.offsetCm +
          placement.rightPanel.widthCm -
          placement.railOffsetCm
      );
    });

    it('adapts height down to cutaway height (~30 cm) when isCutaway is true', async () => {
      const { computeWindowCurtainPlacement } = await import(
        '../src/components/viewer3d/decor/ProceduralCurtain3D'
      );

      const placement = computeWindowCurtainPlacement(
        wallLengthCm,
        opening,
        wallHeightCm,
        true
      );

      // Cutaway height clamped to ~27-30 cm
      expect(placement.heightCm).toBeLessThanOrEqual(30);
      expect(placement.heightCm).toBeGreaterThanOrEqual(25);
      expect(placement.elevationCm).toBe(0);
    });

    it('handles window near wall start and end without exceeding wall boundaries', async () => {
      const { computeWindowCurtainPlacement } = await import(
        '../src/components/viewer3d/decor/ProceduralCurtain3D'
      );

      const nearStartOpening = {
        offsetFromStartCm: 10,
        widthCm: 100,
        heightCm: 140,
        sillHeightCm: 80,
      };

      const placement = computeWindowCurtainPlacement(
        200,
        nearStartOpening,
        250,
        false
      );

      expect(placement.leftPanel.offsetCm).toBeGreaterThanOrEqual(0);
      expect(placement.railOffsetCm).toBeGreaterThanOrEqual(0);
      expect(placement.railOffsetCm + placement.railLengthCm).toBeLessThanOrEqual(200);
    });
  });

  describe('ProceduralCurtain3D Component Rendering & Materials', () => {
    it('renders left and right drape panels with extrudeGeometry and top rail with cylinderGeometry', async () => {
      const { ProceduralCurtain3D } = await import(
        '../src/components/viewer3d/decor/ProceduralCurtain3D'
      );

      const opening = {
        id: 'win-test-1',
        offsetFromStartCm: 100,
        widthCm: 120,
        heightCm: 140,
        sillHeightCm: 80,
      };

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProceduralCurtain3D, {
          wallLengthCm: 350,
          opening,
          wallHeightCm: 250,
          isCutaway: false,
        })
      );

      // Must have extrudeGeometry for both drape panels
      expect(markup).toContain('extrudeGeometry');
      // Must have cylinderGeometry for the curtain rail
      expect(markup).toContain('cylinderGeometry');
      // Rail color anthracite #262626
      expect(markup).toContain('color="#262626"');
      // Linen fabric warm tone #f6f4ee
      expect(markup).toContain('color="#f6f4ee"');
      // Linen translucency, double side, and roughness
      expect(markup).toContain('roughness="0.96"');
      expect(markup).toContain('metalness="0.02"');
      expect(markup).toContain('opacity="0.88"');
      expect(markup).toContain('side="2"'); // THREE.DoubleSide === 2
    });

    it('renders with custom placement prop directly', async () => {
      const { ProceduralCurtain3D } = await import(
        '../src/components/viewer3d/decor/ProceduralCurtain3D'
      );

      const customPlacement = {
        key: 'custom-curtain',
        leftPanel: { offsetCm: 50, widthCm: 45 },
        rightPanel: { offsetCm: 180, widthCm: 45 },
        railLengthCm: 175,
        railOffsetCm: 50,
        heightCm: 247,
        elevationCm: 0,
      };

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProceduralCurtain3D, {
          placement: customPlacement,
        })
      );

      expect(markup).toContain('extrudeGeometry');
      expect(markup).toContain('cylinderGeometry');
    });
  });

  describe('Procedural Linen Canvas Texture Generator', () => {
    it('exports getLinenTexture producing a seamless CanvasTexture', async () => {
      const { getLinenTexture } = await import(
        '../src/core/materials/proceduralTextures'
      );

      expect(typeof getLinenTexture).toBe('function');
      const tex = getLinenTexture();
      expect(tex).toBeInstanceOf(THREE.CanvasTexture);
      expect(tex.wrapS).toBe(THREE.RepeatWrapping);
      expect(tex.wrapT).toBe(THREE.RepeatWrapping);
    });
  });

  describe('Scene3D Integration & Cutaway Reaction', () => {
    it('ProceduralCurtain3D adapts dynamically to cutaway mode vs full-height', async () => {
      const { ProceduralCurtain3D } = await import(
        '../src/components/viewer3d/decor/ProceduralCurtain3D'
      );
      const opening = {
        id: 'win-cut-test',
        offsetFromStartCm: 100,
        widthCm: 120,
        heightCm: 140,
        sillHeightCm: 80,
      };

      // Full height rendering when isCutaway is false
      const fullMarkup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProceduralCurtain3D, {
          wallLengthCm: 350,
          opening,
          wallHeightCm: 250,
          isCutaway: false,
        })
      );
      // Rail should be at top (Y = 248 = 247 + 1)
      expect(fullMarkup).toContain('position="160,248,0"');

      // Cutaway rendering when isCutaway is true
      const cutawayMarkup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProceduralCurtain3D, {
          wallLengthCm: 350,
          opening,
          wallHeightCm: 250,
          isCutaway: true,
        })
      );
      // In cutaway mode, curtain height adapts down to 27 cm, rail at Y = 28 cm
      expect(cutawayMarkup).toContain('position="160,28,0"');
    });
  });
});

