import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  formatDimension,
  computeExteriorDimensionChains,
  DIMENSION_LINE_COLOR,
  DIMENSION_LINE_THICKNESS_CM,
  DIMENSION_ELEVATION_Y_CM,
} from '../src/core/dimensionMath';
import {
  DIMENSION_LINE_COLOR as COMP_DIM_COLOR,
  computeExteriorDimensionChains as compComputeExteriorDimensionChains,
} from '../src/components/viewer3d/ArchitecturalDimensionLines3D';
import { useFloorplanStore, CameraPreset } from '../src/store/useFloorplanStore';
import { PRESET_FLOORPLANS } from '../src/core/presets';
import { Corner, Wall } from '../src/core/types';

describe('ArchitecturalDimensionLines3D (Phase 4)', () => {
  describe('formatDimension', () => {
    it('formats centimeter dimensions without thousand separators when < 1000', () => {
      expect(formatDimension(620, 'cm')).toBe('620 cm');
      expect(formatDimension(550, 'cm')).toBe('550 cm');
      expect(formatDimension(80, 'cm')).toBe('80 cm');
    });

    it('formats centimeter dimensions with space thousand separators when >= 1000', () => {
      expect(formatDimension(1185, 'cm')).toBe('1 185 cm');
      expect(formatDimension(1400, 'cm')).toBe('1 400 cm');
      expect(formatDimension(2500, 'cm')).toBe('2 500 cm');
    });

    it('formats meter dimensions with comma decimal separator', () => {
      expect(formatDimension(620, 'm')).toBe('6,20 m');
      expect(formatDimension(550, 'm')).toBe('5,50 m');
      expect(formatDimension(1185, 'm')).toBe('11,85 m');
      expect(formatDimension(1400, 'm')).toBe('14,00 m');
    });
  });

  describe('computeExteriorDimensionChains for Single Rectangular Room (620 x 550 cm)', () => {
    const singleRoomCorners: Corner[] = [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 620, z: 0 },
      { id: 'c3', x: 620, z: 550 },
      { id: 'c4', x: 0, z: 550 },
    ];
    const singleRoomWalls: Wall[] = [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
    ];
    const roomBounds = {
      minX: 0,
      maxX: 620,
      minZ: 0,
      maxZ: 550,
      cx: 310,
      cz: 275,
    };

    it('exports standard architectural constants matching spec and re-exports from component', () => {
      expect(DIMENSION_LINE_COLOR).toBe('#94a3b8');
      expect(DIMENSION_LINE_THICKNESS_CM).toBe(0.5);
      expect(DIMENSION_ELEVATION_Y_CM).toBe(0.5);
      expect(COMP_DIM_COLOR).toBe(DIMENSION_LINE_COLOR);
      expect(compComputeExteriorDimensionChains).toBe(computeExteriorDimensionChains);
    });

    it('calculates 4 exterior perimeter dimension chains for top, bottom, left, and right', () => {
      const result = computeExteriorDimensionChains(
        singleRoomCorners,
        singleRoomWalls,
        roomBounds,
        { offsetCm: 60, unit: 'cm' }
      );

      expect(result.chains.length).toBe(4);
      const sideMap = new Map(result.chains.map((c) => [c.side, c]));

      // Top chain: spans X from 0 to 620 at Z < minZ
      const top = sideMap.get('top');
      expect(top).toBeDefined();
      expect(top!.segments.length).toBe(1);
      expect(top!.segments[0].lengthCm).toBe(620);
      expect(top!.segments[0].formattedLength).toBe('620 cm');
      expect(top!.segments[0].start.z).toBeCloseTo(-60, 1);
      expect(top!.segments[0].end.z).toBeCloseTo(-60, 1);
      expect(top!.ticks.length).toBe(2);
      expect(top!.ticks[0].rotationY).toBeCloseTo(Math.PI / 4, 3);

      // Bottom chain: spans X from 0 to 620 at Z > maxZ
      const bottom = sideMap.get('bottom');
      expect(bottom).toBeDefined();
      expect(bottom!.segments.length).toBe(1);
      expect(bottom!.segments[0].lengthCm).toBe(620);
      expect(bottom!.segments[0].formattedLength).toBe('620 cm');
      expect(bottom!.segments[0].start.z).toBeCloseTo(550 + 60, 1);

      // Left chain: spans Z from 0 to 550 at X < minX
      const left = sideMap.get('left');
      expect(left).toBeDefined();
      expect(left!.segments.length).toBe(1);
      expect(left!.segments[0].lengthCm).toBe(550);
      expect(left!.segments[0].formattedLength).toBe('550 cm');
      expect(left!.segments[0].start.x).toBeCloseTo(-60, 1);

      // Right chain: spans Z from 0 to 550 at X > maxX
      const right = sideMap.get('right');
      expect(right).toBeDefined();
      expect(right!.segments.length).toBe(1);
      expect(right!.segments[0].lengthCm).toBe(550);
      expect(right!.segments[0].formattedLength).toBe('550 cm');
      expect(right!.segments[0].start.x).toBeCloseTo(620 + 60, 1);
    });

    it('generates extension witness lines connecting wall perimeter to dimension line', () => {
      const result = computeExteriorDimensionChains(
        singleRoomCorners,
        singleRoomWalls,
        roomBounds,
        { offsetCm: 60 }
      );

      const topChain = result.chains.find((c) => c.side === 'top')!;
      expect(topChain.extensionLines.length).toBeGreaterThanOrEqual(2);
      // Top extension lines should start near minZ (0) and project past dimZ (-60)
      const ext0 = topChain.extensionLines[0];
      expect(ext0.start.x).toBe(0);
      expect(ext0.start.z).toBe(0);
      expect(ext0.end.z).toBeLessThan(-60);
    });
  });

  describe('computeExteriorDimensionChains for L-Cut Studio Apartment (1 185 cm total width)', () => {
    const studioData = PRESET_FLOORPLANS['studio-apartment'].data;
    const roomBounds = {
      minX: 0,
      maxX: 1185,
      minZ: 0,
      maxZ: 480,
      cx: 1185 / 2,
      cz: 240,
    };

    it('calculates top chain with sub-segments (620 cm, 565 cm) and overall span (1 185 cm)', () => {
      const result = computeExteriorDimensionChains(
        studioData.corners,
        studioData.walls,
        roomBounds,
        { offsetCm: 60, unit: 'cm' }
      );

      const top = result.chains.find((c) => c.side === 'top')!;
      expect(top).toBeDefined();

      const subSegments = top.segments.filter((s) => s.lengthCm < 1185);
      expect(subSegments.map((s) => s.lengthCm)).toEqual([620, 565]);
      expect(subSegments.map((s) => s.formattedLength)).toEqual(['620 cm', '565 cm']);

      const overall = top.segments.find((s) => s.lengthCm === 1185);
      expect(overall).toBeDefined();
      expect(overall!.formattedLength).toBe('1 185 cm');
    });
  });

  describe('computeExteriorDimensionChains for Multi-Room Villa (Luxury Villa)', () => {
    const villaData = PRESET_FLOORPLANS['luxury-villa'].data;
    const roomBounds = {
      minX: 0,
      maxX: 1400,
      minZ: 0,
      maxZ: 900,
      cx: 700,
      cz: 450,
    };

    it('calculates sub-segment dimension chains and overall building dimension', () => {
      const result = computeExteriorDimensionChains(
        villaData.corners,
        villaData.walls,
        roomBounds,
        { offsetCm: 65, unit: 'cm' }
      );

      const top = result.chains.find((c) => c.side === 'top')!;
      // Top has corners at x=0, x=850, x=1400 along z=0
      // Should include sub-segments 850 cm and 550 cm
      const subSegments = top.segments.filter((s) => s.lengthCm < 1400);
      expect(subSegments.map((s) => s.lengthCm)).toEqual([850, 550]);
      expect(subSegments.map((s) => s.formattedLength)).toEqual(['850 cm', '550 cm']);

      // Should also include overall dimension of 1400 cm
      const overall = top.segments.find((s) => s.lengthCm === 1400);
      expect(overall).toBeDefined();
      expect(overall!.formattedLength).toBe('1 400 cm');

      // Bottom has corners at x=0, x=850, x=1150, x=1400
      // Sub-segments: 850 cm, 300 cm, 250 cm and overall 1400 cm
      const bottom = result.chains.find((c) => c.side === 'bottom')!;
      const bottomSub = bottom.segments.filter((s) => s.lengthCm < 1400);
      expect(bottomSub.map((s) => s.lengthCm)).toEqual([850, 300, 250]);

      // Right has corners at z=0, z=480, z=900 along x=1400
      // Sub-segments: 480 cm, 420 cm and overall 900 cm
      const right = result.chains.find((c) => c.side === 'right')!;
      const rightSub = right.segments.filter((s) => s.lengthCm < 900);
      expect(rightSub.map((s) => s.lengthCm)).toEqual([480, 420]);
    });

    it('handles empty corner lists gracefully', () => {
      const result = computeExteriorDimensionChains([], [], {
        minX: 0,
        maxX: 0,
        minZ: 0,
        maxZ: 0,
        cx: 0,
        cz: 0,
      });
      expect(result.chains).toEqual([]);
    });
  });

  describe('useFloorplanStore Dimension & Camera Preset State', () => {
    beforeEach(() => {
      useFloorplanStore.getState().loadPreset('studio-apartment');
    });

    it('initializes showDimensions3D to true and allows toggling', () => {
      const state = useFloorplanStore.getState();
      expect(state.showDimensions3D).toBe(true);

      state.setShowDimensions3D(false);
      expect(useFloorplanStore.getState().showDimensions3D).toBe(false);

      state.setShowDimensions3D(true);
      expect(useFloorplanStore.getState().showDimensions3D).toBe(true);
    });

    it('sets camera presets (axonometric, isometric, top-down) and increments nonce', () => {
      const state = useFloorplanStore.getState();
      const initialNonce = state.cameraPresetNonce;

      state.setCameraPreset('axonometric');
      expect(useFloorplanStore.getState().cameraPreset).toBe('axonometric');
      expect(useFloorplanStore.getState().cameraPresetNonce).toBe(initialNonce + 1);

      state.setCameraPreset('isometric');
      expect(useFloorplanStore.getState().cameraPreset).toBe('isometric');
      expect(useFloorplanStore.getState().cameraPresetNonce).toBe(initialNonce + 2);

      state.setCameraPreset('top-down');
      expect(useFloorplanStore.getState().cameraPreset).toBe('top-down');
      expect(useFloorplanStore.getState().cameraPresetNonce).toBe(initialNonce + 3);
    });
  });

  describe('TopBar UI & Render Snapshot Export', () => {
    const origDocument = globalThis.document;

    afterEach(() => {
      globalThis.document = origDocument;
    });

    it('exports snapshot helper and creates PNG download from canvas with DOM attachment', async () => {
      const { capture3DCanvasSnapshot } = await import(
        '../src/components/layout/TopBar'
      );
      expect(typeof capture3DCanvasSnapshot).toBe('function');

      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };

      const appendChildSpy = vi.fn();
      const removeChildSpy = vi.fn();

      globalThis.document = {
        createElement: vi.fn().mockImplementation((tag: string) => {
          if (tag === 'a') return mockAnchor;
          return {};
        }),
        body: {
          appendChild: appendChildSpy,
          removeChild: removeChildSpy,
        },
      } as any;

      const mockCanvas = {
        toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockPngData'),
      };

      const result = capture3DCanvasSnapshot(mockCanvas as any, 'luxury-villa');
      expect(result).toBe(true);
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png');
      expect(mockAnchor.download).toContain('luxury-villa');
      expect(mockAnchor.href).toBe('data:image/png;base64,mockPngData');
      expect(appendChildSpy).toHaveBeenCalledWith(mockAnchor);
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalledWith(mockAnchor);
    });
  });
});
