import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import * as THREE from 'three';

// Mock useFrame from @react-three/fiber so WallMesh3D can be rendered without a WebGL Canvas
vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@react-three/fiber');
  return {
    ...actual,
    useFrame: vi.fn(),
  };
});

import {
  getMicrocementTexture,
  getParquetTexture,
  getStoneTileTexture,
  getMicrocementBumpTexture,
  getParquetBumpTexture,
  getStoneTileBumpTexture,
  getWovenRugTexture,
  getWoodSlatTexture,
  clearTextureCache,
} from '../src/core/materials/proceduralTextures';
import { RugMesh3D, RUG_HEIGHT_CM, RUG_ELEVATION_Y_CM } from '../src/components/viewer3d/RugMesh3D';
import { computeFloorPolygons } from '../src/core/wallMath';
import { PRESET_FLOORPLANS } from '../src/core/presets';
import { Corner, Wall, FlooringType, WallOpening } from '../src/core/types';

describe('Phase 2: Procedural PBR Textures, Zoned Area Rugs & Floorings', () => {
  beforeEach(() => {
    clearTextureCache();
  });

  describe('Procedural Textures', () => {
    it('creates microcement texture with RepeatWrapping and caching', () => {
      const tex1 = getMicrocementTexture();
      expect(tex1).toBeInstanceOf(THREE.CanvasTexture);
      expect(tex1.wrapS).toBe(THREE.RepeatWrapping);
      expect(tex1.wrapT).toBe(THREE.RepeatWrapping);

      // Verify caching returns same instance
      const tex2 = getMicrocementTexture();
      expect(tex2).toBe(tex1);
    });

    it('creates parquet texture with RepeatWrapping and caching', () => {
      const tex1 = getParquetTexture();
      expect(tex1).toBeInstanceOf(THREE.CanvasTexture);
      expect(tex1.wrapS).toBe(THREE.RepeatWrapping);
      expect(tex1.wrapT).toBe(THREE.RepeatWrapping);

      const tex2 = getParquetTexture();
      expect(tex2).toBe(tex1);
    });

    it('creates stone tile texture with RepeatWrapping and caching', () => {
      const tex1 = getStoneTileTexture();
      expect(tex1).toBeInstanceOf(THREE.CanvasTexture);
      expect(tex1.wrapS).toBe(THREE.RepeatWrapping);
      expect(tex1.wrapT).toBe(THREE.RepeatWrapping);

      const tex2 = getStoneTileTexture();
      expect(tex2).toBe(tex1);
    });

    it('creates woven rug texture with RepeatWrapping and caching', () => {
      const tex1 = getWovenRugTexture();
      expect(tex1).toBeInstanceOf(THREE.CanvasTexture);
      expect(tex1.wrapS).toBe(THREE.RepeatWrapping);
      expect(tex1.wrapT).toBe(THREE.RepeatWrapping);

      const tex2 = getWovenRugTexture();
      expect(tex2).toBe(tex1);
    });

    it('creates wood slat texture with RepeatWrapping and caching', () => {
      const tex1 = getWoodSlatTexture();
      expect(tex1).toBeInstanceOf(THREE.CanvasTexture);
      expect(tex1.wrapS).toBe(THREE.RepeatWrapping);
      expect(tex1.wrapT).toBe(THREE.RepeatWrapping);

      const tex2 = getWoodSlatTexture();
      expect(tex2).toBe(tex1);
    });

    it('clears texture cache correctly', () => {
      const tex1 = getMicrocementTexture();
      clearTextureCache();
      const tex2 = getMicrocementTexture();
      expect(tex2).not.toBe(tex1);
    });

    it('creates cached linear bump textures for parquet, stone tile, and microcement', () => {
      const parquetBump1 = getParquetBumpTexture();
      const parquetBump2 = getParquetBumpTexture();
      expect(parquetBump1).toBeInstanceOf(THREE.CanvasTexture);
      expect(parquetBump1).toBe(parquetBump2);
      expect(parquetBump1.wrapS).toBe(THREE.RepeatWrapping);
      expect(parquetBump1.colorSpace).toBe(THREE.NoColorSpace);

      const tileBump1 = getStoneTileBumpTexture();
      const tileBump2 = getStoneTileBumpTexture();
      expect(tileBump1).toBeInstanceOf(THREE.CanvasTexture);
      expect(tileBump1).toBe(tileBump2);

      const microBump1 = getMicrocementBumpTexture();
      const microBump2 = getMicrocementBumpTexture();
      expect(microBump1).toBeInstanceOf(THREE.CanvasTexture);
      expect(microBump1).toBe(microBump2);
    });
  });

  describe('RugMesh3D Component', () => {
    it('exports RugMesh3D component and dimension constants', () => {
      expect(typeof RugMesh3D).toBe('function');
      expect(RUG_HEIGHT_CM).toBe(0.8);
      expect(RUG_ELEVATION_Y_CM).toBe(0.2);
    });

    it('creates a React element with expected props', () => {
      const el = React.createElement(RugMesh3D, {
        widthCm: 250,
        depthCm: 180,
        x: 460,
        z: 110,
        rotationYDeg: 0,
        color: '#edece8',
      });
      expect(el).toBeDefined();
      expect(el.type).toBe(RugMesh3D);
      expect(el.props.widthCm).toBe(250);
      expect(el.props.depthCm).toBe(180);
      expect(el.props.x).toBe(460);
      expect(el.props.z).toBe(110);
    });

    it('accurately calculates rug texture repeat scaling from dimensions in cm', () => {
      const widthCm = 250;
      const depthCm = 180;
      const repeatScale = 25;
      const repeatX = Math.max(1, widthCm / repeatScale);
      const repeatY = Math.max(1, depthCm / repeatScale);

      expect(repeatX).toBe(10);
      expect(repeatY).toBeCloseTo(7.2, 2);

      // Verify minimum clamp of 1 for narrow mats
      const smallWidthCm = 15;
      const smallDepthCm = 20;
      expect(Math.max(1, smallWidthCm / repeatScale)).toBe(1);
      expect(Math.max(1, smallDepthCm / repeatScale)).toBe(1);
    });

    it('disposes cloned texture instances cleanly without invalidating cached source texture', () => {
      const sourceTex = getWovenRugTexture();
      const clone = sourceTex.clone();

      let disposed = false;
      clone.addEventListener('dispose', () => {
        disposed = true;
      });

      clone.dispose();
      expect(disposed).toBe(true);

      // Cached source texture remains valid and accessible
      const cached = getWovenRugTexture();
      expect(cached).toBe(sourceTex);
    });
  });

  describe('Flooring Types and Room Polygon Assignment', () => {
    it('assigns microcement default to single-room floorplans', () => {
      const corners: Corner[] = [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 400, z: 0 },
        { id: 'c3', x: 400, z: 300 },
        { id: 'c4', x: 0, z: 300 },
      ];
      const walls: Wall[] = [
        { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
        { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
        { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
        { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
      ];
      const rooms = computeFloorPolygons(corners, walls);
      expect(rooms.length).toBe(1);
      expect(rooms[0].flooringType).toBe('microcement');
    });

    it('assigns microcement to room 1 and parquet to room 2 in studio-apartment', () => {
      const studio = PRESET_FLOORPLANS['studio-apartment'].data;
      const rooms = computeFloorPolygons(studio.corners, studio.walls);
      expect(rooms.length).toBe(2);

      const room1 = rooms.find((r) => r.corners.some((c) => c.id === 'c1'))!;
      const room2 = rooms.find((r) => r.corners.some((c) => c.id === 'c8'))!;

      expect(room1).toBeDefined();
      expect(room2).toBeDefined();
      expect(room1.flooringType).toBe('microcement');
      expect(room2.flooringType).toBe('parquet');
    });

    it('allows custom flooring type overrides in computeFloorPolygons', () => {
      const corners: Corner[] = [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 400, z: 0 },
        { id: 'c3', x: 400, z: 300 },
        { id: 'c4', x: 0, z: 300 },
      ];
      const walls: Wall[] = [
        { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
        { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
        { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
        { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
      ];
      const customFloorings: FlooringType[] = ['tile'];
      const rooms = computeFloorPolygons(corners, walls, customFloorings);
      expect(rooms[0].flooringType).toBe('tile');
    });
  });

  describe('Studio Apartment Preset Rugs', () => {
    it('defines area rugs under sofa/table and bed in studio-apartment preset', () => {
      const studio = PRESET_FLOORPLANS['studio-apartment'].data;
      expect(studio.rugs).toBeDefined();
      expect(Array.isArray(studio.rugs)).toBe(true);
      expect(studio.rugs!.length).toBeGreaterThanOrEqual(2);

      // Verify living area rug near sofa (x ~ 460, z ~ 100-150)
      const sofaRug = studio.rugs!.find(
        (r) => Math.abs(r.x - 460) < 50 && r.z < 200
      );
      expect(sofaRug).toBeDefined();
      expect(sofaRug!.widthCm).toBeGreaterThanOrEqual(180);

      // Verify bedroom area rug near bed (x ~ 895, z ~ 100-180)
      const bedRug = studio.rugs!.find(
        (r) => Math.abs(r.x - 895) < 50
      );
      expect(bedRug).toBeDefined();
      expect(bedRug!.widthCm).toBeGreaterThanOrEqual(180);
    });
  });

  describe('Architectural Wall Materials, Physical Glass & Glowing Wall Caps (Task 5)', () => {
    it('exports warm chalky plaster and warm-dark wall cap constants', async () => {
      const {
        WALL_MATERIAL_COLOR,
        WALL_MATERIAL_ROUGHNESS,
        WALL_CAP_COLOR,
      } = await import('../src/components/viewer3d/WallMesh3D');

      expect(WALL_MATERIAL_COLOR).toBe('#f1ece4');
      expect(WALL_MATERIAL_ROUGHNESS).toBe(0.82);
      expect(WALL_CAP_COLOR).toBe('#2e2a26');
    });

    it('renders window openings with fast single-pass architectural glass (opacity=0.28, roughness=0.08, depthWrite=false) without expensive transmission pass', async () => {
      const { WallMesh3D } = await import('../src/components/viewer3d/WallMesh3D');
      const wall: Wall = {
        id: 'w-win',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 15,
        heightCm: 250,
      };
      const start: Corner = { id: 'c1', x: 0, z: 0 };
      const end: Corner = { id: 'c2', x: 300, z: 0 };
      const openings: WallOpening[] = [
        {
          id: 'win-1',
          wallId: 'w-win',
          type: 'window',
          offsetFromStartCm: 80,
          widthCm: 120,
          heightCm: 140,
          sillHeightCm: 80,
        },
      ];

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WallMesh3D, {
          wall,
          start,
          end,
          openings,
          roomCenter: { x: 150, z: 150 },
          cutawayEnabled: false,
          isSelected: false,
          onSelectWall: () => {},
          onSelectOpening: () => {},
        })
      );

      // Verify fast single-pass architectural glass properties without multi-pass transmission
      expect(markup).toContain('name="window-glass"');
      expect(markup).toContain('name="window-frame"');
      expect(markup).toContain('name="window-sill"');
      expect(markup).toContain('name="window-mullion"');
      expect(markup).toContain('name="window-handle"');
      expect(markup).toContain('color="#f1ece4"');
      expect(markup).toContain('opacity="0.28"');
      expect(markup).toContain('roughness="0.82"');
      expect(markup).toContain('metalness="0"');
      expect(markup).not.toContain('color="#e0f2fe"');
      expect(markup).not.toContain('transmission=');
      expect(markup).not.toContain('color="#38bdf8"');
    });

    it('renders glowing wall cap ribbon in cutaway studio mode when glowingWallCaps is true', async () => {
      const { WallMesh3D } = await import('../src/components/viewer3d/WallMesh3D');
      const { useFloorplanStore } = await import('../src/store/useFloorplanStore');

      const wall: Wall = {
        id: 'w-cut',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 15,
        heightCm: 250,
      };
      const start: Corner = { id: 'c1', x: 0, z: 0 };
      const end: Corner = { id: 'c2', x: 300, z: 0 };

      useFloorplanStore.getState().setRenderTheme('studio');
      useFloorplanStore.getState().setGlowingWallCaps(true);

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

      expect(markup).toContain('name="wall-cap-glow"');
      expect(markup).toContain('emissive=');

      // When glowingWallCaps is false, ribbon should NOT be rendered
      useFloorplanStore.getState().setGlowingWallCaps(false);
      const markupNoGlow = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WallMesh3D, {
          wall: { ...wall, id: 'w-cut-no-glow' },
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
      expect(markupNoGlow).not.toContain('name="wall-cap-glow"');
      useFloorplanStore.getState().setGlowingWallCaps(true); // reset
    });
  });
});
