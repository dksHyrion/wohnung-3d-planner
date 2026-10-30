import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import * as THREE from 'three';
import { Corner, Wall, WallOpening } from '../src/core/types';

// Mock useFrame from @react-three/fiber so components can be rendered without WebGL Canvas
vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@react-three/fiber');
  return {
    ...actual,
    useFrame: vi.fn(),
  };
});

vi.mock('@react-three/drei', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@react-three/drei');
  return {
    ...actual,
    ContactShadows: (props: any) => React.createElement('contactShadows', props),
    Environment: (props: any) => React.createElement('environment', props, props.children),
    Lightformer: (props: any) => React.createElement('lightformer', props),
    SoftShadows: (props: any) => React.createElement('softShadows', props),
    RoundedBox: (props: any) => React.createElement('roundedBox', props, props.children),
  };
});

describe('Architectural Lighting, Tone Mapping & Skirting Boards (Task 1)', () => {
  describe('Canvas & Tone Mapping Configuration', () => {
    it('configures NoToneMapping and disabled preserveDrawingBuffer (prevents GPU swapchain stalls)', async () => {
      const { CANVAS_GL_CONFIG } = await import('../src/components/viewer3d/Scene3D');
      expect(CANVAS_GL_CONFIG).toBeDefined();
      expect(CANVAS_GL_CONFIG.preserveDrawingBuffer).toBe(false);
      expect(CANVAS_GL_CONFIG.toneMapping).toBe(THREE.NoToneMapping);
    });

    it('computes meshPhysicalMaterial props for parquet, tile, and microcement floors', async () => {
      const { getFloorMaterialProps } = await import('../src/components/viewer3d/Scene3D');

      // Studio parquet floor
      const parquetStudio = getFloorMaterialProps('parquet', true, null);
      expect(parquetStudio.color).toBe('#ffffff');
      expect(parquetStudio.clearcoat).toBe(0.18);
      expect(parquetStudio.clearcoatRoughness).toBe(0.25);
      expect(parquetStudio.roughness).toBe(0.38);
      expect(parquetStudio.metalness).toBe(0.05);

      // Studio tile floor
      const tileStudio = getFloorMaterialProps('tile', true, null);
      expect(tileStudio.clearcoat).toBe(0.18);
      expect(tileStudio.clearcoatRoughness).toBe(0.25);
      expect(tileStudio.roughness).toBe(0.38);
      expect(tileStudio.metalness).toBe(0.05);

      // Studio microcement floor
      const microStudio = getFloorMaterialProps('microcement', true, null);
      expect(microStudio.roughness).toBe(0.85);
      expect(microStudio.clearcoat).toBe(0.18);
      expect(microStudio.polygonOffset).toBe(true);
      expect(microStudio.polygonOffsetFactor).toBe(-1);

      // Performance mode disables expensive dual-lobe clearcoat on floor
      const perfFloor = getFloorMaterialProps('parquet', true, null, false);
      expect(perfFloor.clearcoat).toBe(0);

      // Blueprint floor color
      const parquetBlueprint = getFloorMaterialProps('parquet', false, null);
      expect(parquetBlueprint.color).toBe('#334155');
      expect(parquetBlueprint.clearcoat).toBe(0);
    });
  });

  describe('Studio Stage Lighting & Atmosphere', () => {
    it('defines hemisphere and directional sun lighting constants', async () => {
      const stageMod = await import('../src/components/viewer3d/StudioStage3D');
      expect(stageMod.STUDIO_HEMISPHERE_SKY).toBe('#e0f2fe');
      expect(stageMod.STUDIO_HEMISPHERE_GROUND).toBe('#f0e6d8');
      expect(stageMod.STUDIO_HEMISPHERE_INTENSITY).toBe(0.35);

      expect(stageMod.BLUEPRINT_HEMISPHERE_SKY).toBe('#64748b');
      expect(stageMod.BLUEPRINT_HEMISPHERE_GROUND).toBe('#1e293b');
      expect(stageMod.BLUEPRINT_HEMISPHERE_INTENSITY).toBe(0.45);

      expect(stageMod.STUDIO_SUN_INTENSITY).toBe(2.2);
      expect(stageMod.BLUEPRINT_SUN_INTENSITY).toBe(1.4);
      expect(stageMod.FILL_LIGHT_INTENSITY).toBe(0.25);
    });

    it('renders hemisphere light instead of ambient light in StudioStage3D', async () => {
      const { StudioStage3D } = await import('../src/components/viewer3d/StudioStage3D');
      const { useFloorplanStore } = await import('../src/store/useFloorplanStore');
      useFloorplanStore.setState({ timeOfDay: 12.5 });
      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(StudioStage3D, {
          roomBounds: { minX: 0, maxX: 600, minZ: 0, maxZ: 500, cx: 300, cz: 250 },
          theme: 'studio',
        })
      );

      // Flat ambientLight should no longer exist
      expect(markup).not.toContain('<ambientLight');
      // Physical hemisphereLight should be present and connected to dynamic mood (default Noon daylight)
      expect(markup).toContain('hemisphereLight');
      expect(markup).toContain('color="#d4eafe"');
      expect(markup).toContain('groundColor="#ddd7ce"');
      expect(markup).toContain('intensity="0.55"');
    });
  });

  describe('Skirting Boards (Fußleisten) & Cutaways', () => {
    it('exports skirting board constants', async () => {
      const wallMod = await import('../src/components/viewer3d/WallMesh3D');
      expect(wallMod.SKIRTING_HEIGHT_CM).toBe(8);
      expect(wallMod.SKIRTING_THICKNESS_CM).toBe(1.6);
      expect(wallMod.SKIRTING_COLOR).toBe('#e4ddd4');
      expect(wallMod.SKIRTING_ROUGHNESS).toBe(wallMod.WALL_MATERIAL_ROUGHNESS);
      expect(typeof wallMod.computeSkirtingSegments).toBe('function');
    });

    it('computes 1 continuous skirting segment for a wall with no openings', async () => {
      const { computeSkirtingSegments } = await import('../src/components/viewer3d/WallMesh3D');
      const segments = computeSkirtingSegments(400, []);

      expect(segments.length).toBe(1);
      expect(segments[0].startCm).toBe(0);
      expect(segments[0].lengthCm).toBe(400);
    });

    it('breaks skirting board cleanly at a floor-level door opening (sill < 5 cm)', async () => {
      const { computeSkirtingSegments } = await import('../src/components/viewer3d/WallMesh3D');
      const door: WallOpening = {
        id: 'door-1',
        wallId: 'w1',
        type: 'door',
        offsetFromStartCm: 100,
        widthCm: 90,
        heightCm: 210,
        sillHeightCm: 0,
      };

      const segments = computeSkirtingSegments(400, [door]);
      // Left segment (0..100) and right segment (190..400)
      expect(segments.length).toBe(2);
      expect(segments[0].startCm).toBe(0);
      expect(segments[0].lengthCm).toBe(100);

      expect(segments[1].startCm).toBe(190);
      expect(segments[1].lengthCm).toBe(210);

      const totalLength = segments.reduce((sum, s) => sum + s.lengthCm, 0);
      expect(totalLength).toBe(310);
    });

    it('keeps skirting continuous under a window with sill >= 5 cm', async () => {
      const { computeSkirtingSegments } = await import('../src/components/viewer3d/WallMesh3D');
      const window: WallOpening = {
        id: 'win-1',
        wallId: 'w1',
        type: 'window',
        offsetFromStartCm: 120,
        widthCm: 140,
        heightCm: 120,
        sillHeightCm: 85,
      };

      const segments = computeSkirtingSegments(400, [window]);
      // Skirting board does NOT break under windows
      expect(segments.length).toBe(1);
      expect(segments[0].startCm).toBe(0);
      expect(segments[0].lengthCm).toBe(400);
    });

    it('handles wall with both a door and a window correctly', async () => {
      const { computeSkirtingSegments } = await import('../src/components/viewer3d/WallMesh3D');
      const door: WallOpening = {
        id: 'door-1',
        wallId: 'w1',
        type: 'door',
        offsetFromStartCm: 60,
        widthCm: 80,
        heightCm: 210,
        sillHeightCm: 0,
      };
      const window: WallOpening = {
        id: 'win-1',
        wallId: 'w1',
        type: 'window',
        offsetFromStartCm: 200,
        widthCm: 120,
        heightCm: 120,
        sillHeightCm: 90,
      };

      const segments = computeSkirtingSegments(450, [door, window]);
      // Door breaks skirting into 0..60 and 140..450; window doesn't break
      expect(segments.length).toBe(2);
      expect(segments[0].startCm).toBe(0);
      expect(segments[0].lengthCm).toBe(60);
      expect(segments[1].startCm).toBe(140);
      expect(segments[1].lengthCm).toBe(310);
    });

    it('renders solid cutaway wall with opacity 1.0, wall caps, and skirting boards', async () => {
      const { WallMesh3D } = await import('../src/components/viewer3d/WallMesh3D');
      const wall: Wall = {
        id: 'w-cutaway',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 15,
        heightCm: 250,
      };
      const start: Corner = { id: 'c1', x: 0, z: 0 };
      const end: Corner = { id: 'c2', x: 300, z: 0 };

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WallMesh3D, {
          wall,
          start,
          end,
          openings: [],
          roomCenter: { x: 150, z: 150 },
          cutawayEnabled: true,
          isCutaway: true,
          isSelected: false,
          onSelectWall: () => {},
          onSelectOpening: () => {},
        })
      );

      // Must be solid/opaque, not transparent with opacity 0.55
      expect(markup).toContain('name="wall-body"');
      expect(markup).not.toContain('opacity="0.55"');
      expect(markup).not.toContain('transparent="true"');
      // Cutaway wall cap
      expect(markup).toContain('name="wall-cap"');
      // Skirting boards on both front and back
      expect(markup).toContain('name="skirting-board"');
      expect(markup).toContain('color="#e4ddd4"');
    });

    it('renders skirting boards on both front and back in full-height wall', async () => {
      const { WallMesh3D } = await import('../src/components/viewer3d/WallMesh3D');
      const wall: Wall = {
        id: 'w-full',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 15,
        heightCm: 250,
      };
      const start: Corner = { id: 'c1', x: 0, z: 0 };
      const end: Corner = { id: 'c2', x: 200, z: 0 };

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WallMesh3D, {
          wall,
          start,
          end,
          openings: [],
          roomCenter: { x: 100, z: 100 },
          cutawayEnabled: false,
          isSelected: false,
          onSelectWall: () => {},
          onSelectOpening: () => {},
        })
      );

      expect(markup).toContain('name="skirting-board"');
      expect(markup).toContain('color="#e4ddd4"');
    });
  });
});
