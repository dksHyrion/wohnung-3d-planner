import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import {
  computeWallMiterMap,
  createMiteredPrismGeometry,
} from '../src/core/wallMiter';
import {
  computeEffectiveSunLight,
  computeWindowSunPolygon,
} from '../src/core/windowLight';
import { WindowLightPool3D } from '../src/components/viewer3d/decor/WindowLightPool3D';
import type { Corner, Wall, WallOpening } from '../src/core/types';

vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@react-three/fiber');
  return {
    ...actual,
    useFrame: vi.fn(),
  };
});

describe('Sprint 3: 3D Miter Joints, Demand Rendering & Dynamic Sun Projection', () => {
  describe('computeWallMiterMap', () => {
    it('miters a 90° L-corner cleanly (+7.5 cm outer, -7.5 cm inner for 15 cm walls)', () => {
      const corners: Corner[] = [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 400, z: 0 },
        { id: 'c3', x: 400, z: 300 },
      ];
      const walls: Wall[] = [
        { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
        { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
      ];

      const map = computeWallMiterMap(corners, walls);
      const m1 = map.get('w1')!;
      const m2 = map.get('w2')!;

      // Open ends have 0 miter
      expect(m1.startPosExt).toBe(0);
      expect(m1.startNegExt).toBe(0);
      expect(m2.endPosExt).toBe(0);
      expect(m2.endNegExt).toBe(0);

      // Corner c2: +normal is inner (+Z for w1, -X for w2), -normal is outer
      expect(m1.endPosExt).toBeCloseTo(-7.5, 2);
      expect(m1.endNegExt).toBeCloseTo(7.5, 2);
      expect(m2.startPosExt).toBeCloseTo(-7.5, 2);
      expect(m2.startNegExt).toBeCloseTo(7.5, 2);
    });

    it('handles asymmetric wall thicknesses at a 90° corner accurately', () => {
      const corners: Corner[] = [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 400, z: 0 },
        { id: 'c3', x: 400, z: 300 },
      ];
      const walls: Wall[] = [
        { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 20, heightCm: 250 },
        { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 10, heightCm: 250 },
      ];

      const map = computeWallMiterMap(corners, walls);
      const m1 = map.get('w1')!;
      const m2 = map.get('w2')!;

      // w1 extends/recesses by w2's half-thickness (5 cm); w2 by w1's half-thickness (10 cm)
      expect(m1.endNegExt).toBeCloseTo(5, 2);
      expect(m1.endPosExt).toBeCloseTo(-5, 2);
      expect(m2.startNegExt).toBeCloseTo(10, 2);
      expect(m2.startPosExt).toBeCloseTo(-10, 2);
    });

    it('handles T-junctions without overhanging branch walls', () => {
      const corners: Corner[] = [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 200, z: 0 },
        { id: 'c3', x: 400, z: 0 },
        { id: 'c4', x: 200, z: 250 },
      ];
      const walls: Wall[] = [
        { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 16, heightCm: 250 },
        { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 16, heightCm: 250 },
        { id: 'w-branch', startCornerId: 'c2', endCornerId: 'c4', thicknessCm: 12, heightCm: 250 },
      ];

      const map = computeWallMiterMap(corners, walls);
      const branch = map.get('w-branch')!;
      // Both faces of the branch wall recess by -8 cm into the 16 cm main wall
      expect(branch.startPosExt).toBeCloseTo(-8, 2);
      expect(branch.startNegExt).toBeCloseTo(-8, 2);

      // Opposite collinear outer face of w1/w2 stays flush (0)
      expect(map.get('w1')!.endNegExt).toBeCloseTo(0, 2);
      expect(map.get('w2')!.startNegExt).toBeCloseTo(0, 2);
    });

    it('builds valid mitered BufferGeometry prism', () => {
      const geom = createMiteredPrismGeometry(-107.5, -92.5, 107.5, 92.5, 15, 250);
      expect(geom.getAttribute('position').count).toBe(36);
      expect(geom.boundingBox).not.toBeNull();
      expect(geom.boundingBox!.min.x).toBeCloseTo(-107.5, 2);
      expect(geom.boundingBox!.max.x).toBeCloseTo(107.5, 2);
      geom.dispose();
    });
  });

  describe('Dynamic Sun Projection (computeWindowSunPolygon & computeEffectiveSunLight)', () => {
    it('projects deeper sunlight into the room at low sun elevation than at noon', () => {
      const lowSun = computeWindowSunPolygon({
        offsetFromStartCm: 100,
        widthCm: 120,
        sillHeightCm: 90,
        heightCm: 130,
        wallLengthCm: 400,
        wallThicknessCm: 15,
        inwardSign: 1,
        wallAngleRad: 0,
        sunDirToRoom: { x: 0, y: -Math.sin((18 * Math.PI) / 180), z: Math.cos((18 * Math.PI) / 180) },
      });
      const highSun = computeWindowSunPolygon({
        offsetFromStartCm: 100,
        widthCm: 120,
        sillHeightCm: 90,
        heightCm: 130,
        wallLengthCm: 400,
        wallThicknessCm: 15,
        inwardSign: 1,
        wallAngleRad: 0,
        sunDirToRoom: { x: 0, y: -Math.sin((58 * Math.PI) / 180), z: Math.cos((58 * Math.PI) / 180) },
      });

      expect(lowSun).not.toBeNull();
      expect(highSun).not.toBeNull();
      expect(lowSun!.farLeft.z).toBeGreaterThan(highSun!.farLeft.z);
    });

    it('skews the sun trapezoid laterally under oblique sun azimuth and returns null when wall faces away', () => {
      const oblique = computeWindowSunPolygon({
        offsetFromStartCm: 100,
        widthCm: 120,
        sillHeightCm: 90,
        heightCm: 130,
        wallLengthCm: 400,
        wallThicknessCm: 15,
        inwardSign: 1,
        wallAngleRad: 0,
        sunDirToRoom: { x: 0.4, y: -0.5, z: 0.76 },
      });
      expect(oblique).not.toBeNull();
      expect(oblique!.farLeft.x).toBeGreaterThan(oblique!.nearLeft.x);

      const shaded = computeWindowSunPolygon({
        offsetFromStartCm: 100,
        widthCm: 120,
        sillHeightCm: 90,
        heightCm: 130,
        wallLengthCm: 400,
        wallThicknessCm: 15,
        inwardSign: 1,
        wallAngleRad: 0,
        sunDirToRoom: { x: 0, y: -0.5, z: -0.86 }, // pointing outward away from room
      });
      expect(shaded).toBeNull();
    });

    it('renders projected WindowLightPool3D quad when sunDirToRoom is provided', () => {
      const opening: WallOpening = {
        id: 'win-1',
        wallId: 'w1',
        type: 'window',
        offsetFromStartCm: 100,
        widthCm: 120,
        heightCm: 130,
        sillHeightCm: 90,
      };
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WindowLightPool3D, {
          opening,
          wallLengthCm: 400,
          wallThicknessCm: 15,
          inwardSign: 1,
          color: '#ffe2c0',
          intensity: 2.8,
          wallAngleRad: 0,
          sunDirToRoom: { x: 0.2, y: -0.5, z: 0.84 },
        })
      );
      expect(html).toContain('name="window-light-pool"');

      const sun = computeEffectiveSunLight({
        corners: [
          { id: 'c1', x: 0, z: 0 },
          { id: 'c2', x: 400, z: 0 },
        ],
        walls: [
          { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
        ],
        openings: [opening],
        roomCenter: { cx: 200, cz: 150 },
        sunElevationDeg: 30,
        sunAzimuthDeg: 180,
        alignSunWithWindows: true,
      });
      expect(sun.dirToRoom.y).toBeLessThan(0);
      expect(sun.dirToRoom.z).toBeGreaterThan(0.5);
    });
  });

  describe('Scene3D demand rendering & netCorners floor shapes', () => {
    it('configures Canvas frameloop="demand" and netCorners floor geometry in Scene3D.tsx', () => {
      const sceneSrc = fs.readFileSync(
        path.resolve(__dirname, '../src/components/viewer3d/Scene3D.tsx'),
        'utf-8'
      );
      expect(sceneSrc).toContain('frameloop="demand"');
      expect(sceneSrc).toContain('DemandRenderController');
      expect(sceneSrc).toContain('room.netCorners');
      expect(sceneSrc).toContain('computeWallMiterMap');
    });
  });
});
