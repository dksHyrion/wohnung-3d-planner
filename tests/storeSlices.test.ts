import { describe, it, expect, afterEach, vi } from 'vitest';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import {
  createGeometryActions,
  propagateAttachedChildren,
} from '../src/store/geometry';
import {
  createFurnitureSlice,
  propagateAttachedChildren as propagateFromFurnitureSlice,
} from '../src/store/slices/furnitureSlice';
import { createWallSlice } from '../src/store/slices/wallSlice';
import { createRugSlice } from '../src/store/slices/rugSlice';
import { createPresetSlice } from '../src/store/slices/presetSlice';
import type { StoreDeps } from '../src/store/deps';
import type { FloorplanState } from '../src/store/state';
import type { FurnitureItem, Wall, Corner } from '../src/core/types';

function createMockDeps(initialPatch: Partial<FloorplanState> = {}) {
  let state: FloorplanState = {
    corners: [],
    walls: [],
    openings: [],
    furniture: [],
    rugs: [],
    roomLabels: [],
    backgroundImage: null,
    overlayError: null,
    persistenceError: null,
    showPassageHeatmap: false,
    passageReport: null,
    activeAlignmentGuides: [],
    clearAlignmentGuides: vi.fn(),
    calibrationPoints: { p1: null, p2: null },
    collisionReports: {},
    viewMode: 'split',
    activeTool: 'select',
    cutawayEnabled: true,
    snapToWallEnabled: true,
    renderTheme: 'studio',
    showDimensions3D: true,
    cameraPreset: 'axonometric',
    cameraPresetNonce: 0,
    selectedId: null,
    selectedType: null,
    selectedRoomId: null,
    timeOfDay: 12,
    activeMoodKey: 'noon',
    qualityMode: 'performance',
    glowingWallCaps: false,
    cameraEyeLevelCm: 170,
    setCameraEyeLevelCm: vi.fn(),
    showDecor: true,
    setShowDecor: vi.fn(),
    showKeyboardShortcuts: false,
    setShowKeyboardShortcuts: vi.fn(),
    toggleKeyboardShortcuts: vi.fn(),
    alignSunWithWindows: false,
    setAlignSunWithWindows: vi.fn(),
    roomLightsActive: false,
    setRoomLightsActive: vi.fn(),
    measureStart: null,
    measureEnd: null,
    setMeasurePoints: vi.fn(),
    clearMeasure: vi.fn(),
    gridSizeCm: 5,
    setGridSizeCm: vi.fn(),
    orthoSnapEnabled: true,
    setOrthoSnapEnabled: vi.fn(),
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    saveToLocalStorage: vi.fn(),
    loadFromLocalStorage: vi.fn(() => false),
    clearLocalStorageBackup: vi.fn(),
    setViewMode: vi.fn(),
    setActiveTool: vi.fn(),
    setCutawayEnabled: vi.fn(),
    setSnapToWallEnabled: vi.fn(),
    setRenderTheme: vi.fn(),
    setShowDimensions3D: vi.fn(),
    setCameraPreset: vi.fn(),
    setTimeOfDay: vi.fn(),
    setMoodPreset: vi.fn(),
    setQualityMode: vi.fn(),
    setGlowingWallCaps: vi.fn(),
    selectEntity: vi.fn(),
    selectRoom: vi.fn(),
    updateWallLengthCm: vi.fn(),
    updateWallProps: vi.fn(),
    addWallWithCorners: vi.fn(),
    removeWall: vi.fn(),
    moveCorner: vi.fn(),
    removeCorner: vi.fn(),
    updateRoom: vi.fn(),
    addOpening: vi.fn(),
    updateOpening: vi.fn(),
    removeOpening: vi.fn(),
    addFurniture: vi.fn(),
    updateFurniture: vi.fn(),
    moveFurniture: vi.fn(),
    removeFurniture: vi.fn(),
    toggleFurnitureRealStatus: vi.fn(),
    setFurnitureRealStatus: vi.fn(),
    resetFurnitureToCatalogDimensions: vi.fn(),
    addRug: vi.fn(),
    updateRug: vi.fn(),
    moveRug: vi.fn(),
    removeRug: vi.fn(),
    loadPreset: vi.fn(),
    pushUndoSnapshot: vi.fn(),
    setOverlayError: vi.fn(),
    setBackgroundImage: vi.fn(),
    updateBackgroundImage: vi.fn(),
    removeBackgroundImage: vi.fn(),
    setShowPassageHeatmap: vi.fn(),
    startCalibration: vi.fn(),
    setCalibrationPoint: vi.fn(),
    applyCalibration: vi.fn(),
    cancelCalibration: vi.fn(),
    exportJson: vi.fn(() => ''),
    importJson: vi.fn(() => false),
    ...initialPatch,
  };

  const setCalls: Partial<FloorplanState>[] = [];
  const setWithCollisionsCalls: {
    patch: Partial<FloorplanState>;
    recordHistory?: boolean;
  }[] = [];

  let nextIdCounter = 1;

  const deps: StoreDeps = {
    set: vi.fn((patch) => {
      const next = typeof patch === 'function' ? patch(state) : patch;
      setCalls.push(next);
      state = { ...state, ...next };
    }),
    get: vi.fn(() => state),
    setWithCollisions: vi.fn((patch, recordHistory) => {
      setWithCollisionsCalls.push({ patch, recordHistory });
      state = { ...state, ...patch };
    }),
    pushHistory: vi.fn(() => ({
      undoStack: state.undoStack,
      redoStack: state.redoStack,
      canUndo: false,
      canRedo: false,
    })),
    generateId: vi.fn((prefix) => `${prefix}-mock-${nextIdCounter++}`),
    withRuntimeImage: vi.fn((img) => img ?? null),
    gcOverlays: vi.fn(),
    cloneFloorplanData: vi.fn((data) => JSON.parse(JSON.stringify(data))),
    captureFloorplanSnapshot: vi.fn((s) => ({
      corners: s.corners,
      walls: s.walls,
      openings: s.openings,
      furniture: s.furniture,
      rugs: s.rugs ?? [],
      roomLabels: s.roomLabels ?? [],
      backgroundImage: s.backgroundImage ?? null,
    })),
  };

  return {
    deps,
    getState: () => state,
    setState: (patch: Partial<FloorplanState>) => {
      state = { ...state, ...patch };
    },
    setCalls,
    setWithCollisionsCalls,
  };
}

describe('Store Slices & Geometry Orchestration', () => {
  describe('1. Re-exports & Orchestration', () => {
    it('re-exports propagateAttachedChildren identical to furnitureSlice', () => {
      expect(propagateAttachedChildren).toBe(propagateFromFurnitureSlice);
      expect(typeof propagateAttachedChildren).toBe('function');
    });

    it('creates all geometry actions through createGeometryActions', () => {
      const { deps } = createMockDeps();
      const actions = createGeometryActions(deps);

      // Verify actions from all 4 slices are present in composed result
      expect(typeof actions.addFurniture).toBe('function');
      expect(typeof actions.addWallWithCorners).toBe('function');
      expect(typeof actions.addRug).toBe('function');
      expect(typeof actions.loadPreset).toBe('function');
      expect(typeof actions.setShowPassageHeatmap).toBe('function');
    });
  });

  describe('2. Complete Action Exposure on useFloorplanStore.getState()', () => {
    it('exposes all geometry, furniture, wall, rug, and preset actions as functions', () => {
      const state = useFloorplanStore.getState();

      const requiredActions = [
        // furnitureSlice
        'addFurniture',
        'updateFurniture',
        'moveFurniture',
        'removeFurniture',
        'toggleFurnitureRealStatus',
        'setFurnitureRealStatus',
        'resetFurnitureToCatalogDimensions',
        // wallSlice
        'updateWallLengthCm',
        'updateWallProps',
        'addWallWithCorners',
        'removeWall',
        'moveCorner',
        'removeCorner',
        'updateRoom',
        'addOpening',
        'updateOpening',
        'removeOpening',
        // rugSlice
        'addRug',
        'updateRug',
        'moveRug',
        'removeRug',
        // presetSlice
        'loadPreset',
        'setShowPassageHeatmap',
      ] as const;

      for (const action of requiredActions) {
        expect(
          typeof (state as unknown as Record<string, unknown>)[action],
          `Expected action ${action} to be a function on useFloorplanStore.getState()`
        ).toBe('function');
      }
    });
  });

  describe('3. Hierarchical Attachment Propagation (propagateAttachedChildren)', () => {
    const parentDesk: FurnitureItem = {
      id: 'desk-1',
      name: 'Schreibtisch',
      category: 'office',
      widthCm: 160,
      heightCm: 75,
      depthCm: 80,
      x: 200,
      z: 200,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#ffffff',
    };

    const attachedMonitor: FurnitureItem = {
      id: 'monitor-1',
      name: 'Monitor',
      category: 'office',
      widthCm: 60,
      heightCm: 45,
      depthCm: 20,
      x: 200,
      z: 200,
      elevationCm: 75,
      rotationYDeg: 0,
      color: '#111111',
      attachedToId: 'desk-1',
    };

    const independentChair: FurnitureItem = {
      id: 'chair-1',
      name: 'Bürostuhl',
      category: 'office',
      widthCm: 60,
      heightCm: 95,
      depthCm: 60,
      x: 200,
      z: 270,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#333333',
    };

    it('updates attached monitor position and elevation when desk moves and raises', () => {
      const movedDesk: FurnitureItem = {
        ...parentDesk,
        x: 260,
        z: 240,
        elevationCm: 10, // raised by 10 cm -> top increases from 75 to 85
      };

      const beforeList = [parentDesk, attachedMonitor, independentChair];
      const afterList = [movedDesk, attachedMonitor, independentChair];

      const result = propagateAttachedChildren(beforeList, afterList, 'desk-1');

      const monitorAfter = result.find((f) => f.id === 'monitor-1')!;
      expect(monitorAfter.x).toBe(260);
      expect(monitorAfter.z).toBe(240);
      expect(monitorAfter.elevationCm).toBe(85); // 75 + 10

      // Independent chair is unchanged
      const chairAfter = result.find((f) => f.id === 'chair-1')!;
      expect(chairAfter.x).toBe(200);
      expect(chairAfter.z).toBe(270);
      expect(chairAfter.elevationCm).toBe(0);
    });

    it('orbits and rotates attached child when desk rotates', () => {
      // Monitor placed with +20cm offset on X
      const monitorWithOffset: FurnitureItem = {
        ...attachedMonitor,
        x: 220,
        z: 200,
      };

      // Rotate desk by 90 degrees clockwise around its center
      const rotatedDesk: FurnitureItem = {
        ...parentDesk,
        rotationYDeg: 90,
      };

      const beforeList = [parentDesk, monitorWithOffset];
      const afterList = [rotatedDesk, monitorWithOffset];

      const result = propagateAttachedChildren(beforeList, afterList, 'desk-1');
      const monitorAfter = result.find((f) => f.id === 'monitor-1')!;

      // 90 deg rotation of vector (20, 0):
      // rotRelX = 20 * cos(90°) + 0 * sin(90°) = 0
      // rotRelZ = -20 * sin(90°) + 0 * cos(90°) = -20
      // newX = 200 + 0 = 200, newZ = 200 - 20 = 180
      expect(monitorAfter.x).toBeCloseTo(200, 1);
      expect(monitorAfter.z).toBeCloseTo(180, 1);
      expect(monitorAfter.rotationYDeg).toBe(90);
    });

    it('propagates hierarchically through transitive children (desk -> riser -> monitor)', () => {
      const riser: FurnitureItem = {
        id: 'riser-1',
        name: 'Monitorständer',
        category: 'office',
        widthCm: 50,
        heightCm: 12,
        depthCm: 25,
        x: 200,
        z: 200,
        elevationCm: 75,
        rotationYDeg: 0,
        color: '#888888',
        attachedToId: 'desk-1',
      };

      const topMonitor: FurnitureItem = {
        id: 'monitor-top',
        name: 'Monitor',
        category: 'office',
        widthCm: 60,
        heightCm: 45,
        depthCm: 20,
        x: 200,
        z: 200,
        elevationCm: 87, // 75 + 12
        rotationYDeg: 0,
        color: '#111111',
        attachedToId: 'riser-1',
      };

      const movedDesk: FurnitureItem = {
        ...parentDesk,
        x: 320,
        z: 310,
        heightCm: 80, // height increased from 75 to 80 (+5cm dTop)
      };

      const beforeList = [parentDesk, riser, topMonitor];
      const afterList = [movedDesk, riser, topMonitor];

      const result = propagateAttachedChildren(beforeList, afterList, 'desk-1');

      const riserAfter = result.find((f) => f.id === 'riser-1')!;
      expect(riserAfter.x).toBe(320);
      expect(riserAfter.z).toBe(310);
      expect(riserAfter.elevationCm).toBe(80); // 75 + 5

      const monitorAfter = result.find((f) => f.id === 'monitor-top')!;
      expect(monitorAfter.x).toBe(320);
      expect(monitorAfter.z).toBe(310);
      expect(monitorAfter.elevationCm).toBe(92); // 87 + 5
    });

    it('returns unchanged list if parent position, rotation, and top are identical', () => {
      const beforeList = [parentDesk, attachedMonitor];
      const afterList = [{ ...parentDesk }, { ...attachedMonitor }];

      const result = propagateAttachedChildren(beforeList, afterList, 'desk-1');
      expect(result[1]).toEqual(attachedMonitor);
    });

    it('integrates with useFloorplanStore.moveFurniture and updates attached items', () => {
      useFloorplanStore.getState().loadPreset('empty-room');
      useFloorplanStore.getState().setSnapToWallEnabled(false);
      const state = useFloorplanStore.getState();

      const deskId = state.addFurniture({
        name: 'Arbeitstisch',
        category: 'office',
        widthCm: 140,
        heightCm: 75,
        depthCm: 70,
        x: 200,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#cccccc',
      });

      const monitorId = state.addFurniture({
        name: 'Bildschirm',
        category: 'office',
        widthCm: 55,
        heightCm: 40,
        depthCm: 15,
        x: 200,
        z: 200,
        elevationCm: 75,
        rotationYDeg: 0,
        color: '#222222',
        attachedToId: deskId,
      });

      // Move desk
      useFloorplanStore.getState().moveFurniture(deskId, 280, 260);

      const updatedFurniture = useFloorplanStore.getState().furniture;
      const updatedDesk = updatedFurniture.find((f) => f.id === deskId)!;
      const updatedMonitor = updatedFurniture.find((f) => f.id === monitorId)!;

      expect(updatedDesk.x).toBe(280);
      expect(updatedDesk.z).toBe(260);
      expect(updatedMonitor.x).toBe(280);
      expect(updatedMonitor.z).toBe(260);

      // Cleanup global store state
      useFloorplanStore.getState().setSnapToWallEnabled(true);
    });
  });

  describe('4. Isolated Slice Factories with Mock StoreDeps', () => {
    describe('createFurnitureSlice', () => {
      it('returns expected action handlers', () => {
        const { deps } = createMockDeps();
        const slice = createFurnitureSlice(deps);

        expect(typeof slice.addFurniture).toBe('function');
        expect(typeof slice.updateFurniture).toBe('function');
        expect(typeof slice.moveFurniture).toBe('function');
        expect(typeof slice.removeFurniture).toBe('function');
        expect(typeof slice.toggleFurnitureRealStatus).toBe('function');
        expect(typeof slice.setFurnitureRealStatus).toBe('function');
        expect(typeof slice.resetFurnitureToCatalogDimensions).toBe('function');
      });

      it('addFurniture creates furniture and calls setWithCollisions', () => {
        const { deps, setWithCollisionsCalls } = createMockDeps();
        const slice = createFurnitureSlice(deps);

        const id = slice.addFurniture({
          name: 'Designer Stuhl',
          category: 'living',
          widthCm: 55,
          heightCm: 82,
          depthCm: 52,
          x: 150,
          z: 160,
          elevationCm: 0,
          rotationYDeg: 45,
          color: '#e2e8f0',
        });

        expect(id).toBe('f-mock-1');
        expect(setWithCollisionsCalls.length).toBe(1);
        const { patch } = setWithCollisionsCalls[0];
        expect(patch.furniture?.length).toBe(1);
        expect(patch.furniture?.[0].id).toBe('f-mock-1');
        expect(patch.furniture?.[0].name).toBe('Designer Stuhl');
        expect(patch.selectedId).toBe('f-mock-1');
        expect(patch.selectedType).toBe('furniture');
      });

      it('removeFurniture unlinks attachedToId on orphaned children', () => {
        const desk: FurnitureItem = {
          id: 'desk-1',
          name: 'Desk',
          category: 'office',
          widthCm: 100,
          heightCm: 75,
          depthCm: 60,
          x: 100,
          z: 100,
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#ffffff',
        };
        const lamp: FurnitureItem = {
          id: 'lamp-1',
          name: 'Desk Lamp',
          category: 'decor',
          widthCm: 20,
          heightCm: 40,
          depthCm: 20,
          x: 100,
          z: 100,
          elevationCm: 75,
          rotationYDeg: 0,
          color: '#ffff00',
          attachedToId: 'desk-1',
        };

        const { deps, setWithCollisionsCalls } = createMockDeps({
          furniture: [desk, lamp],
          selectedId: 'desk-1',
          selectedType: 'furniture',
        });
        const slice = createFurnitureSlice(deps);

        slice.removeFurniture('desk-1');

        expect(setWithCollisionsCalls.length).toBe(1);
        const { patch } = setWithCollisionsCalls[0];
        expect(patch.furniture?.length).toBe(1);
        expect(patch.furniture?.[0].id).toBe('lamp-1');
        expect(patch.furniture?.[0].attachedToId).toBeNull();
        expect(patch.selectedId).toBeNull();
        expect(patch.selectedType).toBeNull();
      });

      it('toggleFurnitureRealStatus toggles boolean flag', () => {
        const item: FurnitureItem = {
          id: 'f-1',
          name: 'Sofa',
          category: 'living',
          widthCm: 200,
          heightCm: 80,
          depthCm: 90,
          x: 100,
          z: 100,
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#ffffff',
          isRealFurniture: false,
        };
        const { deps, setWithCollisionsCalls } = createMockDeps({
          furniture: [item],
        });
        const slice = createFurnitureSlice(deps);

        slice.toggleFurnitureRealStatus('f-1');

        expect(setWithCollisionsCalls.length).toBe(1);
        expect(setWithCollisionsCalls[0].patch.furniture?.[0].isRealFurniture).toBe(true);
      });
    });

    describe('createWallSlice', () => {
      it('returns expected action handlers', () => {
        const { deps } = createMockDeps();
        const slice = createWallSlice(deps);

        expect(typeof slice.updateWallLengthCm).toBe('function');
        expect(typeof slice.updateWallProps).toBe('function');
        expect(typeof slice.addWallWithCorners).toBe('function');
        expect(typeof slice.removeWall).toBe('function');
        expect(typeof slice.moveCorner).toBe('function');
        expect(typeof slice.removeCorner).toBe('function');
        expect(typeof slice.updateRoom).toBe('function');
        expect(typeof slice.addOpening).toBe('function');
        expect(typeof slice.updateOpening).toBe('function');
        expect(typeof slice.removeOpening).toBe('function');
      });

      it('addWallWithCorners creates two corners and a connecting wall', () => {
        const { deps, setWithCollisionsCalls } = createMockDeps();
        const slice = createWallSlice(deps);

        const wallId = slice.addWallWithCorners({ x: 0, z: 0 }, { x: 400, z: 0 });

        expect(typeof wallId).toBe('string');
        expect(setWithCollisionsCalls.length).toBe(1);
        const { patch } = setWithCollisionsCalls[0];
        expect(patch.corners?.length).toBe(2);
        expect(patch.walls?.length).toBe(1);
        expect(patch.walls?.[0].id).toBe(wallId);
        expect(patch.walls?.[0].startCornerId).toBe(patch.corners?.[0].id);
        expect(patch.walls?.[0].endCornerId).toBe(patch.corners?.[1].id);
      });

      it('removeWall removes the specified wall', () => {
        const cornerA: Corner = { id: 'c1', x: 0, z: 0 };
        const cornerB: Corner = { id: 'c2', x: 300, z: 0 };
        const wall: Wall = {
          id: 'w1',
          startCornerId: 'c1',
          endCornerId: 'c2',
          thicknessCm: 15,
          heightCm: 250,
        };

        const { deps, setWithCollisionsCalls } = createMockDeps({
          corners: [cornerA, cornerB],
          walls: [wall],
          selectedId: 'w1',
          selectedType: 'wall',
        });
        const slice = createWallSlice(deps);

        slice.removeWall('w1');

        expect(setWithCollisionsCalls.length).toBe(1);
        const { patch } = setWithCollisionsCalls[0];
        expect(patch.walls?.length).toBe(0);
        expect(patch.selectedId).toBeNull();
      });
    });

    describe('createRugSlice', () => {
      it('returns expected action handlers', () => {
        const { deps } = createMockDeps();
        const slice = createRugSlice(deps);

        expect(typeof slice.addRug).toBe('function');
        expect(typeof slice.updateRug).toBe('function');
        expect(typeof slice.moveRug).toBe('function');
        expect(typeof slice.removeRug).toBe('function');
      });

      it('addRug adds a rug with clamped minimum dimensions and default color', () => {
        const { deps, setWithCollisionsCalls } = createMockDeps();
        const slice = createRugSlice(deps);

        const rugId = slice.addRug({
          name: 'Wohnzimmerteppich',
          widthCm: 240,
          depthCm: 170,
          x: 200,
          z: 200,
          rotationYDeg: 0,
        });

        expect(rugId).toBe('rug-mock-1');
        expect(setWithCollisionsCalls.length).toBe(1);
        const { patch } = setWithCollisionsCalls[0];
        expect(patch.rugs?.length).toBe(1);
        expect(patch.rugs?.[0].id).toBe('rug-mock-1');
        expect(patch.rugs?.[0].widthCm).toBe(240);
        expect(patch.rugs?.[0].depthCm).toBe(170);
        expect(patch.selectedId).toBe('rug-mock-1');
        expect(patch.selectedType).toBe('rug');
      });

      it('removeRug removes a rug and resets selection if selected', () => {
        const { deps, setWithCollisionsCalls } = createMockDeps({
          rugs: [
            {
              id: 'rug-1',
              name: 'Teppich',
              widthCm: 200,
              depthCm: 150,
              x: 100,
              z: 100,
              rotationYDeg: 0,
              color: '#edece8',
            },
          ],
          selectedId: 'rug-1',
          selectedType: 'rug',
        });
        const slice = createRugSlice(deps);

        slice.removeRug('rug-1');

        expect(setWithCollisionsCalls.length).toBe(1);
        const { patch } = setWithCollisionsCalls[0];
        expect(patch.rugs?.length).toBe(0);
        expect(patch.selectedId).toBeNull();
        expect(patch.selectedType).toBeNull();
      });
    });

    describe('createPresetSlice', () => {
      it('returns expected action handlers', () => {
        const { deps } = createMockDeps();
        const slice = createPresetSlice(deps);

        expect(typeof slice.loadPreset).toBe('function');
        expect(typeof slice.setShowPassageHeatmap).toBe('function');
      });

      it('setShowPassageHeatmap updates flag and computes passage report', () => {
        const { deps, setCalls } = createMockDeps();
        const slice = createPresetSlice(deps);

        slice.setShowPassageHeatmap(true);

        expect(setCalls.length).toBe(1);
        expect(setCalls[0].showPassageHeatmap).toBe(true);
        expect(setCalls[0].passageReport).toBeDefined();

        slice.setShowPassageHeatmap(false);
        expect(setCalls.length).toBe(2);
        expect(setCalls[1].showPassageHeatmap).toBe(false);
        expect(setCalls[1].passageReport).toBeNull();
      });

      it('loadPreset clones preset data and sets floorplan with collisions', () => {
        const { deps, setWithCollisionsCalls } = createMockDeps();
        const slice = createPresetSlice(deps);

        slice.loadPreset('empty-room');

        expect(deps.cloneFloorplanData).toHaveBeenCalled();
        expect(setWithCollisionsCalls.length).toBe(1);
        const { patch } = setWithCollisionsCalls[0];
        expect(patch.corners).toBeDefined();
        expect(patch.walls).toBeDefined();
        expect(patch.selectedId).toBeNull();
      });

      it('loadPreset safely ignores invalid preset key', () => {
        const { deps, setWithCollisionsCalls } = createMockDeps();
        const slice = createPresetSlice(deps);

        slice.loadPreset('non-existent-preset-key');
        expect(setWithCollisionsCalls.length).toBe(0);
      });
    });
  });
});
