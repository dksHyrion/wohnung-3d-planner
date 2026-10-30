import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { MOOD_PRESETS, presetToHour, MoodPresetKey } from '../src/core/lighting/moodPresets';
import { useFloorplanStore, CameraPreset } from '../src/store/useFloorplanStore';
import { Corner, Wall, WallOpening, FurnitureItem } from '../src/core/types';
import {
  computeDominantWindowDirection,
  RoomBounds,
} from '../src/components/viewer3d/StudioStage3D';
import { DiningTableModel } from '../src/components/viewer3d/furniture/DiningTableModel';
import { DeskModel } from '../src/components/viewer3d/furniture/DeskModel';
import { CoffeeTableModel } from '../src/components/viewer3d/furniture/CoffeeTableModel';
import { BedModel } from '../src/components/viewer3d/furniture/BedModel';
import { KitchenIslandModel } from '../src/components/viewer3d/furniture/KitchenIslandModel';
import { ArtemideTolomeoModel } from '../src/components/viewer3d/furniture/ArtemideTolomeoModel';
import { ProceduralCurtain3D } from '../src/components/viewer3d/decor/ProceduralCurtain3D';
import { TopBar } from '../src/components/layout/TopBar';

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
    RoundedBox: (props: any) => React.createElement('roundedBox', props, props.children),
  };
});

describe('Sprint 3 Honest Visuals & Camera Core (Task 1)', () => {
  describe('Neutral Lighting Preset (MOOD_PRESETS.neutral)', () => {
    it('defines neutral daylight preset with honest, uncolored values', () => {
      const neutral = MOOD_PRESETS.neutral;
      expect(neutral).toBeDefined();
      expect(neutral.key).toBe('neutral');
      expect(neutral.name).toBe('Neutrales Tageslicht');
      expect(neutral.hour).toBe(12.0);
      expect(neutral.sunElevationDeg).toBe(65);
      expect(neutral.sunAzimuthDeg).toBe(180);
      expect(neutral.sunColor).toBe('#ffffff');
      expect(neutral.sunIntensity).toBe(2.2);
      expect(neutral.hemiSkyColor).toBe('#f1f5f9');
      expect(neutral.hemiGroundColor).toBe('#e2e8f0');
      expect(neutral.hemiIntensity).toBe(0.55);
      expect(neutral.environmentIntensity).toBe(0.7);
      expect(neutral.lampsActive).toBe(false);
      expect(neutral.lampColor).toBe('#ffb870');
      expect(neutral.lampEmissiveIntensity).toBe(0);
      expect(neutral.lampBloomIntensity).toBe(0);
      expect(neutral.windowLightColor).toBe('#ffffff');
      expect(neutral.windowLightIntensity).toBe(2.5);
      expect(neutral.backdropTheme).toBe('day');
      expect(neutral.backdropOpacity).toBe(0.8);
      expect(neutral.exposure).toBe(1.0);
      expect(neutral.n8aoIntensity).toBe(2.0);
      expect(neutral.vignetteDarkness).toBe(0.0);
      expect(neutral.stageGradientTop).toBe('#f1f5f9');
      expect(neutral.stageGradientBottom).toBe('#e2e8f0');
      expect(neutral.plinthColor).toBe('#cbd5e1');
      expect(neutral.wallCapGlowColor).toBe('#ffffff');
      expect(neutral.wallCapGlowIntensity).toBe(0.0);
    });

    it('returns 12.0 for presetToHour("neutral")', () => {
      expect(presetToHour('neutral')).toBe(12.0);
    });
  });

  describe('useFloorplanStore Honest Visuals State & Actions', () => {
    it('has initial default values matching Honest Visuals specification', () => {
      const state = useFloorplanStore.getState();
      expect(state.activeMoodKey).toBe('morning');
      expect(state.timeOfDay).toBe(8.0);
      expect(state.qualityMode).toBe('performance');
      expect(state.cameraEyeLevelCm).toBe(170);
      expect(state.showDecor).toBe(true);
      expect(state.alignSunWithWindows).toBe(true);
      expect(state.roomLightsActive).toBe(false);
    });

    describe('cameraEyeLevelCm actions & clamping', () => {
      beforeEach(() => {
        useFloorplanStore.setState({ cameraEyeLevelCm: 170 });
      });

      it('sets valid camera eye level in cm', () => {
        useFloorplanStore.getState().setCameraEyeLevelCm(160);
        expect(useFloorplanStore.getState().cameraEyeLevelCm).toBe(160);

        useFloorplanStore.getState().setCameraEyeLevelCm(185);
        expect(useFloorplanStore.getState().cameraEyeLevelCm).toBe(185);
      });

      it('clamps cameraEyeLevelCm to minimum 50 cm and maximum 250 cm', () => {
        useFloorplanStore.getState().setCameraEyeLevelCm(30);
        expect(useFloorplanStore.getState().cameraEyeLevelCm).toBe(50);

        useFloorplanStore.getState().setCameraEyeLevelCm(-100);
        expect(useFloorplanStore.getState().cameraEyeLevelCm).toBe(50);

        useFloorplanStore.getState().setCameraEyeLevelCm(280);
        expect(useFloorplanStore.getState().cameraEyeLevelCm).toBe(250);

        useFloorplanStore.getState().setCameraEyeLevelCm(500);
        expect(useFloorplanStore.getState().cameraEyeLevelCm).toBe(250);
      });

      it('guards against non-finite eye level inputs leaving value unchanged', () => {
        useFloorplanStore.getState().setCameraEyeLevelCm(175);
        expect(useFloorplanStore.getState().cameraEyeLevelCm).toBe(175);

        useFloorplanStore.getState().setCameraEyeLevelCm(NaN);
        expect(useFloorplanStore.getState().cameraEyeLevelCm).toBe(175);

        useFloorplanStore.getState().setCameraEyeLevelCm(Infinity);
        expect(useFloorplanStore.getState().cameraEyeLevelCm).toBe(175);

        useFloorplanStore.getState().setCameraEyeLevelCm(-Infinity);
        expect(useFloorplanStore.getState().cameraEyeLevelCm).toBe(175);
      });
    });

    describe('showDecor actions', () => {
      it('toggles showDecor flag between true and false', () => {
        useFloorplanStore.getState().setShowDecor(true);
        expect(useFloorplanStore.getState().showDecor).toBe(true);

        useFloorplanStore.getState().setShowDecor(false);
        expect(useFloorplanStore.getState().showDecor).toBe(false);
      });
    });

    describe('alignSunWithWindows & roomLightsActive actions', () => {
      it('toggles alignSunWithWindows', () => {
        useFloorplanStore.getState().setAlignSunWithWindows(false);
        expect(useFloorplanStore.getState().alignSunWithWindows).toBe(false);

        useFloorplanStore.getState().setAlignSunWithWindows(true);
        expect(useFloorplanStore.getState().alignSunWithWindows).toBe(true);
      });

      it('toggles roomLightsActive', () => {
        useFloorplanStore.getState().setRoomLightsActive(true);
        expect(useFloorplanStore.getState().roomLightsActive).toBe(true);

        useFloorplanStore.getState().setRoomLightsActive(false);
        expect(useFloorplanStore.getState().roomLightsActive).toBe(false);
      });
    });

    describe('cameraPreset extension', () => {
      it('allows setting first-person camera preset and increments cameraPresetNonce', () => {
        const initialNonce = useFloorplanStore.getState().cameraPresetNonce;
        useFloorplanStore.getState().setCameraPreset('first-person');

        const state = useFloorplanStore.getState();
        expect(state.cameraPreset).toBe('first-person');
        expect(state.cameraPresetNonce).toBe(initialNonce + 1);

        // Also ensure existing presets still work
        useFloorplanStore.getState().setCameraPreset('top-down');
        expect(useFloorplanStore.getState().cameraPreset).toBe('top-down');
      });
    });
  });

  describe('Human Perspective Camera & computeFirstPersonViewpoint (Task 2)', () => {
    const corners: Corner[] = [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 600, z: 0 },
      { id: 'c3', x: 600, z: 400 },
      { id: 'c4', x: 0, z: 400 },
    ];

    const walls: Wall[] = [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 20, heightCm: 260 },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 20, heightCm: 260 },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 20, heightCm: 260 },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 20, heightCm: 260 },
    ];

    const doorOpening: WallOpening = {
      id: 'd1',
      wallId: 'w1',
      type: 'door',
      offsetFromStartCm: 200,
      widthCm: 100,
      heightCm: 210,
      sillHeightCm: 0,
    };

    const roomBounds = {
      minX: 0,
      maxX: 600,
      minZ: 0,
      maxZ: 400,
      cx: 300,
      cz: 200,
    };

    it('standard room with a door: camera position Y is exactly 170cm, stand position is offset 80cm inward from door, target Y is 170cm', async () => {
      const { computeFirstPersonViewpoint } = await import('../src/components/viewer3d/Scene3D');

      const vp = computeFirstPersonViewpoint(corners, walls, [doorOpening], roomBounds, 170);

      // Door center is along w1 (c1=(0,0) to c2=(600,0)) at 200 + 50 = 250 cm -> door is at (250, 0)
      // Normal pointing inward towards room centroid (300, 200) is (0, 1)
      // Standing position is offset 80cm inward: (250, 80)
      expect(vp.cameraPosition[0]).toBeCloseTo(250, 1);
      expect(vp.cameraPosition[1]).toBe(170);
      expect(vp.cameraPosition[2]).toBeCloseTo(80, 1);

      // Target is at room centroid at eye level: (300, 170, 200)
      expect(vp.targetPosition[0]).toBe(300);
      expect(vp.targetPosition[1]).toBe(170);
      expect(vp.targetPosition[2]).toBe(200);
    });

    it('child eye level (115cm): camera Y and target Y are 115cm', async () => {
      const { computeFirstPersonViewpoint } = await import('../src/components/viewer3d/Scene3D');

      const vp = computeFirstPersonViewpoint(corners, walls, [doorOpening], roomBounds, 115);

      expect(vp.cameraPosition[0]).toBeCloseTo(250, 1);
      expect(vp.cameraPosition[1]).toBe(115);
      expect(vp.cameraPosition[2]).toBeCloseTo(80, 1);

      expect(vp.targetPosition[0]).toBe(300);
      expect(vp.targetPosition[1]).toBe(115);
      expect(vp.targetPosition[2]).toBe(200);
    });

    it('room without doors: valid coordinates within room bounds, camera Y is 170cm, target Y is 170cm', async () => {
      const { computeFirstPersonViewpoint } = await import('../src/components/viewer3d/Scene3D');

      // No door openings (e.g. only a window or empty array)
      const windowOpening: WallOpening = {
        id: 'win1',
        wallId: 'w2',
        type: 'window',
        offsetFromStartCm: 100,
        widthCm: 120,
        heightCm: 140,
        sillHeightCm: 80,
      };

      const vp = computeFirstPersonViewpoint(corners, walls, [windowOpening], roomBounds, 170);

      // Fallback perimeter position: roomBounds.minX + 80 = 80, roomBounds.cz = 200
      expect(vp.cameraPosition[0]).toBe(80);
      expect(vp.cameraPosition[1]).toBe(170);
      expect(vp.cameraPosition[2]).toBe(200);

      expect(vp.targetPosition[0]).toBe(300);
      expect(vp.targetPosition[1]).toBe(170);
      expect(vp.targetPosition[2]).toBe(200);
    });

    it('focuses on a specific target room or furniture point when focusPoint is provided', async () => {
      const { computeFirstPersonViewpoint } = await import('../src/components/viewer3d/Scene3D');

      const focusPoint = { x: 450, z: 260 };
      const vp = computeFirstPersonViewpoint(
        corners,
        walls,
        [doorOpening],
        roomBounds,
        170,
        focusPoint
      );

      expect(vp.targetPosition).toEqual([450, 170, 260]);
      expect(vp.cameraPosition[1]).toBe(170);
    });
  });

  describe('Lighting Alignment & Window Coupling (Task 3)', () => {
    const roomBounds: RoomBounds = {
      cx: 200,
      cz: 200,
      minX: 0,
      maxX: 400,
      minZ: 0,
      maxZ: 400,
    };

    const corners: Corner[] = [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 400, z: 0 },
      { id: 'c3', x: 400, z: 400 },
      { id: 'c4', x: 0, z: 400 },
    ];

    const walls: Wall[] = [
      { id: 'w-north', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 20, heightCm: 250 },
      { id: 'w-east', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 20, heightCm: 250 },
      { id: 'w-south', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 20, heightCm: 250 },
      { id: 'w-west', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 20, heightCm: 250 },
    ];

    it('returns hasWindows: false when room has no windows', () => {
      const result = computeDominantWindowDirection(corners, walls, [], roomBounds);
      expect(result.hasWindows).toBe(false);
      expect(result.sunPosition).toEqual([0, 0, 0]);
      expect(result.dominantNormal).toEqual({ x: 0, z: 0 });
      expect(result.windowCount).toBe(0);
    });

    it('returns hasWindows: false when room only has door openings', () => {
      const doorsOnly: WallOpening[] = [
        {
          id: 'd1',
          wallId: 'w-south',
          type: 'door',
          offsetFromStartCm: 100,
          widthCm: 90,
          heightCm: 210,
          sillHeightCm: 0,
        },
      ];
      const result = computeDominantWindowDirection(corners, walls, doorsOnly, roomBounds);
      expect(result.hasWindows).toBe(false);
      expect(result.sunPosition).toEqual([0, 0, 0]);
      expect(result.dominantNormal).toEqual({ x: 0, z: 0 });
      expect(result.windowCount).toBe(0);
    });

    it('places sun south of room (larger Z than room center) shining north into room for south wall window', () => {
      const openings: WallOpening[] = [
        {
          id: 'win1',
          wallId: 'w-south',
          type: 'window',
          offsetFromStartCm: 100,
          widthCm: 120,
          heightCm: 140,
          sillHeightCm: 80,
        },
      ];

      const result = computeDominantWindowDirection(corners, walls, openings, roomBounds);
      expect(result.hasWindows).toBe(true);
      expect(result.windowCount).toBe(1);

      // Dominant normal points inward into room (towards north, so -Z direction)
      expect(result.dominantNormal.z).toBeCloseTo(-1, 4);
      expect(result.dominantNormal.x).toBeCloseTo(0, 4);

      // Sun is placed outside south of room (larger Z than room center) shining north into room
      expect(result.sunPosition[2]).toBeGreaterThan(roomBounds.cz);
      expect(result.sunPosition[0]).toBeCloseTo(roomBounds.cx, 1);
      expect(result.sunPosition[1]).toBeGreaterThan(20);
    });

    it('ensures window orientation normal is unit length', () => {
      const openings: WallOpening[] = [
        {
          id: 'win1',
          wallId: 'w-south',
          type: 'window',
          offsetFromStartCm: 50,
          widthCm: 100,
          heightCm: 140,
          sillHeightCm: 80,
        },
        {
          id: 'win2',
          wallId: 'w-east',
          type: 'window',
          offsetFromStartCm: 50,
          widthCm: 100,
          heightCm: 140,
          sillHeightCm: 80,
        },
      ];

      const result = computeDominantWindowDirection(corners, walls, openings, roomBounds);
      expect(result.hasWindows).toBe(true);
      expect(result.windowCount).toBe(2);
      const normLen = Math.hypot(result.dominantNormal.x, result.dominantNormal.z);
      expect(normLen).toBeCloseTo(1, 5);
    });

    it('weights multiple windows by opening width', () => {
      const openings: WallOpening[] = [
        {
          id: 'win-huge-south',
          wallId: 'w-south',
          type: 'window',
          offsetFromStartCm: 50,
          widthCm: 300,
          heightCm: 200,
          sillHeightCm: 20,
        },
        {
          id: 'win-tiny-east',
          wallId: 'w-east',
          type: 'window',
          offsetFromStartCm: 50,
          widthCm: 30,
          heightCm: 100,
          sillHeightCm: 100,
        },
      ];

      const result = computeDominantWindowDirection(corners, walls, openings, roomBounds);
      // Dominant direction should be heavily biased towards south (inward normal z close to -1)
      expect(result.dominantNormal.z).toBeLessThan(-0.95);
      expect(result.sunPosition[2]).toBeGreaterThan(roomBounds.cz + 500);
    });
  });
});

describe('Toggleable Staging & Decor in Furniture Models (Task 4)', () => {
  const diningItem: FurnitureItem = {
    id: 'dining-1',
    name: 'Dining Table',
    category: 'living',
    widthCm: 180,
    heightCm: 75,
    depthCm: 90,
    x: 0,
    z: 0,
    elevationCm: 0,
    rotationYDeg: 0,
    color: '#e8dbc8',
  };

  const deskItem: FurnitureItem = {
    id: 'desk-1',
    name: 'Desk',
    category: 'office',
    widthCm: 150,
    heightCm: 75,
    depthCm: 75,
    x: 0,
    z: 0,
    elevationCm: 0,
    rotationYDeg: 0,
    color: '#d6c5b3',
  };

  const coffeeTableItem: FurnitureItem = {
    id: 'coffee-table-1',
    name: 'Coffee Table',
    category: 'living',
    widthCm: 120,
    heightCm: 42,
    depthCm: 70,
    x: 0,
    z: 0,
    elevationCm: 0,
    rotationYDeg: 0,
    color: '#f8fafc',
  };

  const sideboardItem: FurnitureItem = {
    id: 'sideboard-1',
    name: 'Sideboard',
    category: 'storage',
    widthCm: 160,
    heightCm: 75,
    depthCm: 45,
    x: 0,
    z: 0,
    elevationCm: 0,
    rotationYDeg: 0,
    color: '#c7b299',
  };

  const bedItem: FurnitureItem = {
    id: 'bed-1',
    name: 'Double Bed',
    category: 'bedroom',
    widthCm: 200,
    heightCm: 100,
    depthCm: 210,
    x: 0,
    z: 0,
    elevationCm: 0,
    rotationYDeg: 0,
    color: '#e2d8ce',
    visual: 'bed',
    hasNightstands: true,
  };

  const islandItem: FurnitureItem = {
    id: 'island-1',
    name: 'Kitchen Island',
    category: 'kitchen',
    widthCm: 240,
    heightCm: 92,
    depthCm: 100,
    x: 0,
    z: 0,
    elevationCm: 0,
    rotationYDeg: 0,
    color: '#1e293b',
  };

  const tolomeoItem: FurnitureItem = {
    id: 'tolomeo-1',
    name: 'Artemide Tolomeo Decentrata',
    category: 'decor',
    widthCm: 45,
    heightCm: 90,
    depthCm: 150,
    x: 0,
    z: 0,
    elevationCm: 155,
    rotationYDeg: 0,
    color: '#cbd5e1',
  };

  describe('When showDecor === false', () => {
    beforeEach(() => {
      useFloorplanStore.setState({ showDecor: false });
    });

    it('DiningTableModel does not contain fruit-bowl', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(DiningTableModel, { item: diningItem })
      );
      expect(html).not.toContain('name="fruit-bowl"');
      expect(html).not.toContain('fruit-bowl');
    });

    it('DeskModel does not contain desk-monitor or felt pad', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(DeskModel, { item: deskItem })
      );
      expect(html).not.toContain('name="desk-monitor"');
      expect(html).not.toContain('desk-monitor');
    });

    it('CoffeeTableModel does not contain coffee-table-decor in both coffee-table and sideboard variants', () => {
      const ctHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CoffeeTableModel, { item: coffeeTableItem, variant: 'coffee-table' })
      );
      expect(ctHtml).not.toContain('name="coffee-table-decor"');
      expect(ctHtml).not.toContain('coffee-table-decor');

      const sbHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CoffeeTableModel, { item: sideboardItem, variant: 'sideboard' })
      );
      expect(sbHtml).not.toContain('name="coffee-table-decor"');
      expect(sbHtml).not.toContain('coffee-table-decor');
    });

    it('KitchenIslandModel does not contain decorative fruit bowl', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(KitchenIslandModel, { item: islandItem })
      );
      // Apple color or specific bowl mesh
      expect(html).not.toContain('args="9,5,3.8,24"');
    });

    it('BedModel does not contain bedside lamps or accent turn-down runner', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(BedModel, { item: bedItem })
      );
      // Bedside lamp cylinder
      expect(html).not.toContain('args="4,6,16,16"');
      // Emissive yellow lamp glow
      expect(html).not.toContain('emissive="#fef08a"');
    });

    it('ProceduralCurtain3D returns null (empty markup)', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProceduralCurtain3D, {
          wallLengthCm: 300,
          wallHeightCm: 250,
          opening: { offsetFromStartCm: 50, widthCm: 100, heightCm: 120, sillHeightCm: 80 },
        })
      );
      expect(html).toBe('');
    });
  });

  describe('When showDecor === true', () => {
    beforeEach(() => {
      useFloorplanStore.setState({ showDecor: true });
    });

    it('DiningTableModel contains fruit-bowl', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(DiningTableModel, { item: diningItem })
      );
      expect(html).toContain('fruit-bowl');
    });

    it('DeskModel contains desk-monitor', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(DeskModel, { item: deskItem })
      );
      expect(html).toContain('desk-monitor');
    });

    it('CoffeeTableModel contains coffee-table-decor in both coffee-table and sideboard variants', () => {
      const ctHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CoffeeTableModel, { item: coffeeTableItem, variant: 'coffee-table' })
      );
      expect(ctHtml).toContain('coffee-table-decor');

      const sbHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(CoffeeTableModel, { item: sideboardItem, variant: 'sideboard' })
      );
      expect(sbHtml).toContain('coffee-table-decor');
    });

    it('KitchenIslandModel contains decorative fruit bowl', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(KitchenIslandModel, { item: islandItem })
      );
      expect(html).toContain('args="9,5,3.8,24"');
    });

    it('BedModel contains bedside lamps and accent turn-down runner', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(BedModel, { item: bedItem })
      );
      expect(html).toContain('args="4,6,16,16"');
      expect(html).toContain('emissive="#fef08a"');
    });

    it('ProceduralCurtain3D renders curtain mesh', () => {
      const html = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProceduralCurtain3D, {
          wallLengthCm: 300,
          wallHeightCm: 250,
          opening: { offsetFromStartCm: 50, widthCm: 100, heightCm: 120, sillHeightCm: 80 },
        })
      );
      expect(html).toContain('extrudeGeometry');
    });
  });

  describe('ArtemideTolomeoModel roomLightsActive switch integration', () => {
    it('downward point light reflects roomLightsActive === true even when timeOfDay is daytime (12.0)', () => {
      // 1. Daytime with room lights OFF: intensity should be low ambient (0.05) and emissiveIntensity 0
      useFloorplanStore.setState({ timeOfDay: 12.0, roomLightsActive: false });
      const offHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ArtemideTolomeoModel, { item: tolomeoItem })
      );
      expect(offHtml).toContain('intensity="0.05"');
      expect(offHtml).toContain('emissiveIntensity="0"');

      // 2. Daytime with room lights ON: downward point light on (1.6) and emissiveIntensity >= 1.2
      useFloorplanStore.setState({ timeOfDay: 12.0, roomLightsActive: true });
      const onHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ArtemideTolomeoModel, { item: tolomeoItem })
      );
      expect(onHtml).toContain('intensity="1.6"');
      expect(onHtml).toContain('emissiveIntensity="1.2"');

      // 3. Evening (20.5) when lampsActive is true: should remain ON regardless
      useFloorplanStore.setState({ timeOfDay: 20.5, roomLightsActive: false });
      const eveningHtml = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ArtemideTolomeoModel, { item: tolomeoItem })
      );
      expect(eveningHtml).toContain('intensity="1.6"');
      expect(eveningHtml).not.toContain('emissiveIntensity="0"');
    });
  });

  describe('TopBar UI Controls (Task 5)', () => {
    beforeEach(() => {
      useFloorplanStore.setState({
        viewMode: '3d-persp',
        cameraPreset: 'axonometric',
        cameraEyeLevelCm: 170,
        showDecor: false,
        alignSunWithWindows: true,
        roomLightsActive: false,
      });
    });

    it('renders first-person option in camera selector with current eye level', () => {
      useFloorplanStore.setState({ cameraEyeLevelCm: 170 });
      let html = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));
      expect(html).toContain('value="first-person"');
      expect(html).toContain('Augenhöhe (170 cm)');

      useFloorplanStore.setState({ cameraEyeLevelCm: 115 });
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));
      expect(html).toContain('Augenhöhe (115 cm)');
    });

    it('renders eye level quick buttons (170 cm, 115 cm) and number input only when cameraPreset is first-person', () => {
      // 1. With axonometric preset: quick buttons and input should NOT be rendered
      useFloorplanStore.setState({ cameraPreset: 'axonometric' });
      let html = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));
      expect(html).not.toContain('<span>170 cm</span>');
      expect(html).not.toContain('<span>115 cm</span>');
      expect(html).not.toContain('type="number"');

      // 2. With first-person preset: quick buttons and input ARE rendered
      useFloorplanStore.setState({ cameraPreset: 'first-person', cameraEyeLevelCm: 170 });
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));
      expect(html).toContain('<span>170 cm</span>');
      expect(html).toContain('<span>115 cm</span>');
      expect(html).toContain('type="number"');
      expect(html).toContain('min="50"');
      expect(html).toContain('max="250"');
      expect(html).toContain('step="5"');
      expect(html).toContain('value="170"');
    });

    it('renders Deko toggle button and reflects showDecor state', () => {
      // Clean mode (showDecor === false)
      useFloorplanStore.setState({ showDecor: false });
      let html = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));
      expect(html).toContain('📐 Clean');
      expect(html).toContain('title="Dekoration ausgeblendet (Ehrlicher Architektur-Modus)"');

      // Deko mode (showDecor === true)
      useFloorplanStore.setState({ showDecor: true });
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));
      expect(html).toContain('✨ Deko');
      expect(html).toContain('title="Dekoration eingeblendet (Klicken zum Ausblenden für ehrliche Stellprobe)"');
    });

    it('renders Raumlicht and Fenster-Licht buttons in atmosphere group and reflects active states', () => {
      useFloorplanStore.setState({
        viewMode: '3d-persp',
        roomLightsActive: false,
        alignSunWithWindows: false,
      });
      let html = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));
      expect(html).toContain('Raumlicht');
      expect(html).toContain('title="Raumleuchten (z. B. Artemide Tolomeo) manuell ein-/ausschalten"');
      expect(html).toContain('Fenster-Licht');
      expect(html).toContain('title="Sonnen-Lichteinfall an den Fenstern des Grundrisses ausrichten"');

      // Active state
      useFloorplanStore.setState({
        viewMode: '3d-persp',
        roomLightsActive: true,
        alignSunWithWindows: true,
      });
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));
      expect(html).toContain('Raumlicht');
      expect(html).toContain('Fenster-Licht');
    });
  });
});


