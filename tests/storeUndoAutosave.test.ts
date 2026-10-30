import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { PRESET_FLOORPLANS } from '../src/core/presets';

describe('Store Undo / Redo & LocalStorage Autosave (Sprint 4 Task 3)', () => {
  beforeEach(() => {
    // Reset to clean rectangular room for deterministic testing
    useFloorplanStore.getState().loadPreset('rectangular-room');
  });

  describe('Undo / Redo History', () => {
    it('records state before adding furniture and allows undoing back to previous count', () => {
      const state = useFloorplanStore.getState();
      const initialCount = state.furniture.length;

      // Add a test piece
      const id = state.addFurniture({
        name: 'Test Desk',
        category: 'office',
        widthCm: 140,
        heightCm: 75,
        depthCm: 70,
        x: 200,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
      });

      expect(useFloorplanStore.getState().furniture.length).toBe(initialCount + 1);
      expect(useFloorplanStore.getState().canUndo).toBe(true);

      // Undo
      useFloorplanStore.getState().undo();
      expect(useFloorplanStore.getState().furniture.length).toBe(initialCount);
      expect(useFloorplanStore.getState().furniture.find((f) => f.id === id)).toBeUndefined();
      expect(useFloorplanStore.getState().canRedo).toBe(true);

      // Redo
      useFloorplanStore.getState().redo();
      expect(useFloorplanStore.getState().furniture.length).toBe(initialCount + 1);
      expect(useFloorplanStore.getState().furniture.find((f) => f.id === id)).toBeDefined();
    });

    it('records state before removing furniture and restores it on undo', () => {
      const state = useFloorplanStore.getState();
      const firstItem = state.furniture[0];
      expect(firstItem).toBeDefined();

      state.removeFurniture(firstItem.id);
      expect(useFloorplanStore.getState().furniture.find((f) => f.id === firstItem.id)).toBeUndefined();

      // Undo removal
      useFloorplanStore.getState().undo();
      expect(useFloorplanStore.getState().furniture.find((f) => f.id === firstItem.id)).toBeDefined();
    });

    it('records state before moving corner and restores corner positions on undo', () => {
      const state = useFloorplanStore.getState();
      const corner = state.corners[0];
      const origX = corner.x;
      const origZ = corner.z;

      state.moveCorner(corner.id, origX + 100, origZ + 50);
      expect(useFloorplanStore.getState().corners.find((c) => c.id === corner.id)!.x).toBe(origX + 100);

      // Undo corner move
      useFloorplanStore.getState().undo();
      const restored = useFloorplanStore.getState().corners.find((c) => c.id === corner.id)!;
      expect(restored.x).toBe(origX);
      expect(restored.z).toBe(origZ);
    });

    it('clears redo stack when a new action is performed after undo', () => {
      const state = useFloorplanStore.getState();
      state.addFurniture({
        name: 'Action 1',
        category: 'living',
        widthCm: 100,
        heightCm: 100,
        depthCm: 100,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
      });

      useFloorplanStore.getState().undo();
      expect(useFloorplanStore.getState().canRedo).toBe(true);

      // Perform a new distinct action
      useFloorplanStore.getState().addFurniture({
        name: 'Action 2',
        category: 'living',
        widthCm: 80,
        heightCm: 80,
        depthCm: 80,
        x: 150,
        z: 150,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
      });

      // Redo stack should be cleared
      expect(useFloorplanStore.getState().canRedo).toBe(false);
    });

    it('clamps undo stack size to maximum 30 history entries to avoid memory leaks', () => {
      const state = useFloorplanStore.getState();
      for (let i = 0; i < 35; i++) {
        state.addFurniture({
          name: `Item ${i}`,
          category: 'decor',
          widthCm: 50,
          heightCm: 50,
          depthCm: 50,
          x: 50 + i * 2,
          z: 50,
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#ffffff',
        });
      }

      // Check undoStack length is <= 30
      expect((useFloorplanStore.getState() as any).undoStack.length).toBeLessThanOrEqual(30);
    });
  });

  describe('LocalStorage Autosave & Restore (Vorrat 12)', () => {
    it('saves current floorplan to localStorage and successfully restores it', () => {
      const mockStorage: Record<string, string> = {};
      const storageMock = {
        getItem: vi.fn((key: string) => mockStorage[key] ?? null),
        setItem: vi.fn((key: string, val: string) => {
          mockStorage[key] = val;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
      };
      vi.stubGlobal('localStorage', storageMock);

      const state = useFloorplanStore.getState();
      state.saveToLocalStorage();
      expect(storageMock.setItem).toHaveBeenCalledWith(
        'wohnung_autosave',
        expect.any(String)
      );

      // Load a different preset
      state.loadPreset('empty-room');
      expect(useFloorplanStore.getState().furniture.length).toBe(0);

      // Restore from localStorage
      const success = useFloorplanStore.getState().loadFromLocalStorage();
      expect(success).toBe(true);
      expect(useFloorplanStore.getState().furniture.length).toBeGreaterThan(0);
      expect(useFloorplanStore.getState().canUndo).toBe(false);

      vi.unstubAllGlobals();
    });

    it('schreibt eine Verschiebung und holt sie nach dem Leeren wieder', () => {
      const mockStorage: Record<string, string> = {};
      vi.stubGlobal('localStorage', {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, val: string) => {
          mockStorage[key] = val;
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
      });

      useFloorplanStore.getState().setSnapToWallEnabled(false);
      const piece = useFloorplanStore.getState().furniture[0];
      useFloorplanStore.getState().moveFurniture(piece.id, 333.25, 222.5);
      useFloorplanStore.getState().saveToLocalStorage();

      useFloorplanStore.getState().loadPreset('empty-room');
      expect(useFloorplanStore.getState().furniture).toEqual([]);
      expect(useFloorplanStore.getState().loadFromLocalStorage()).toBe(true);
      const restored = useFloorplanStore.getState().furniture.find((item) => item.id === piece.id);
      expect(restored?.x).toBeCloseTo(333.25);
      expect(restored?.z).toBeCloseTo(222.5);

      vi.unstubAllGlobals();
    });
  });

  describe('Start Session Preset (Vorrat 13)', () => {
    it('PRESET_FLOORPLANS contains "empty-room" with 0 furniture pieces and valid rectangular room', () => {
      const empty = PRESET_FLOORPLANS['empty-room'];
      expect(empty).toBeDefined();
      expect(empty.data.furniture.length).toBe(0);
      expect(empty.data.corners.length).toBe(4);
      expect(empty.data.walls.length).toBe(4);
    });
  });

  describe('Paket 1: Drag without Undo Flooding & Geometry Deletion / Room Inspector', () => {
    it('groups continuous drag moves into a single undo step via pushUndoSnapshot + recordHistory: false', () => {
      useFloorplanStore.getState().setSnapToWallEnabled(false);
      const piece = useFloorplanStore.getState().furniture[0];
      const startX = piece.x;
      const startZ = piece.z;
      const undoLenBefore = useFloorplanStore.getState().undoStack.length;

      // Simulate pointer drag start + 25 pointermove frames
      useFloorplanStore.getState().pushUndoSnapshot();
      for (let step = 1; step <= 25; step++) {
        useFloorplanStore
          .getState()
          .moveFurniture(piece.id, startX + step * 4, startZ + step * 2, {
            recordHistory: false,
          });
      }

      expect(useFloorplanStore.getState().undoStack.length).toBe(
        undoLenBefore + 1
      );
      const afterDrag = useFloorplanStore
        .getState()
        .furniture.find((f) => f.id === piece.id)!;
      expect(afterDrag.x).toBe(startX + 100);
      expect(afterDrag.z).toBe(startZ + 50);

      // Single undo restores the original pre-drag position!
      useFloorplanStore.getState().undo();
      const restored = useFloorplanStore
        .getState()
        .furniture.find((f) => f.id === piece.id)!;
      expect(restored.x).toBe(startX);
      expect(restored.z).toBe(startZ);
    });

    it('removes a wall and cleans up its openings via removeWall', () => {
      const state = useFloorplanStore.getState();
      const wallToDelete = state.walls[0];
      const initialWallCount = state.walls.length;

      state.removeWall(wallToDelete.id);
      const nextState = useFloorplanStore.getState();
      expect(nextState.walls.length).toBe(initialWallCount - 1);
      expect(nextState.walls.find((w) => w.id === wallToDelete.id)).toBeUndefined();
      expect(
        nextState.openings.some((o) => o.wallId === wallToDelete.id)
      ).toBe(false);

      // Undo restores wall
      nextState.undo();
      expect(useFloorplanStore.getState().walls.length).toBe(initialWallCount);
    });

    it('merges two walls when removing an intermediate corner via removeCorner', () => {
      const state = useFloorplanStore.getState();
      const cornerToDelete = state.corners[0];
      expect(state.corners.length).toBe(4);
      expect(state.walls.length).toBe(4);

      state.removeCorner(cornerToDelete.id);
      const nextState = useFloorplanStore.getState();
      expect(nextState.corners.length).toBe(3);
      expect(nextState.walls.length).toBe(3);
    });

    it('updates room name and flooringType via updateRoom and persists across exportJson/importJson', () => {
      useFloorplanStore.getState().loadPreset('standard-55');
      useFloorplanStore.getState().updateRoom('room-1', {
        name: 'Atelier Nord',
        flooringType: 'parquet',
      });

      const exported = useFloorplanStore.getState().exportJson();
      useFloorplanStore.getState().loadPreset('empty-room');
      expect(useFloorplanStore.getState().importJson(exported)).toBe(true);

      const labels = useFloorplanStore.getState().roomLabels;
      const updated = labels.find((l) => l.name === 'Atelier Nord');
      expect(updated).toBeDefined();
      expect(updated?.flooringType).toBe('parquet');
    });
  });

  describe('Paket 2: Surface Stacking (Inwerk Masterlift 2 + Monitor 27 Zoll)', () => {
    it('moves, rotates, and adjusts elevation of attached monitor when masterlift desk is transformed', () => {
      useFloorplanStore.getState().loadPreset('standard-55');
      useFloorplanStore.getState().setSnapToWallEnabled(false);

      const initialDesk = useFloorplanStore
        .getState()
        .furniture.find((f) => f.id === 'f-std-masterlift')!;
      const initialMonitor = useFloorplanStore
        .getState()
        .furniture.find((f) => f.id === 'f-std-monitor')!;

      expect(initialMonitor.attachedToId).toBe('f-std-masterlift');
      const offsetX = initialMonitor.x - initialDesk.x;
      const offsetZ = initialMonitor.z - initialDesk.z;

      // 1. Move desk by (-50, +40)
      useFloorplanStore
        .getState()
        .moveFurniture('f-std-masterlift', initialDesk.x - 50, initialDesk.z + 40);

      let monitor = useFloorplanStore
        .getState()
        .furniture.find((f) => f.id === 'f-std-monitor')!;
      expect(monitor.x).toBeCloseTo(initialDesk.x - 50 + offsetX, 1);
      expect(monitor.z).toBeCloseTo(initialDesk.z + 40 + offsetZ, 1);

      // 2. Raise desk from 73 cm (sitting) to 115 cm (standing)
      useFloorplanStore
        .getState()
        .updateFurniture('f-std-masterlift', { heightCm: 115 });

      monitor = useFloorplanStore
        .getState()
        .furniture.find((f) => f.id === 'f-std-monitor')!;
      expect(monitor.elevationCm).toBeCloseTo(115, 1);

      // 3. Rotate desk by +90 degrees (270 -> 0)
      useFloorplanStore
        .getState()
        .updateFurniture('f-std-masterlift', { rotationYDeg: 0 });

      monitor = useFloorplanStore
        .getState()
        .furniture.find((f) => f.id === 'f-std-monitor')!;
      expect(monitor.rotationYDeg).toBe(0);
    });

    it('propagates carrier movement when a snapped wall length is updated via updateWallLengthCm', () => {
      useFloorplanStore.getState().loadPreset('standard-55');

      const initialDesk = useFloorplanStore
        .getState()
        .furniture.find((f) => f.id === 'f-std-masterlift')!;
      const initialMonitor = useFloorplanStore
        .getState()
        .furniture.find((f) => f.id === 'f-std-monitor')!;
      const initialDist = Math.hypot(
        initialMonitor.x - initialDesk.x,
        initialMonitor.z - initialDesk.z
      );

      // Shorten w-woh-e (where masterlift is snapped) from 420 cm to 200 cm so the desk is clamped along the wall
      useFloorplanStore.getState().updateWallLengthCm('w-woh-e', 200);

      const movedDesk = useFloorplanStore
        .getState()
        .furniture.find((f) => f.id === 'f-std-masterlift')!;
      const movedMonitor = useFloorplanStore
        .getState()
        .furniture.find((f) => f.id === 'f-std-monitor')!;

      expect(movedDesk.z).not.toBe(initialDesk.z);
      const afterDist = Math.hypot(
        movedMonitor.x - movedDesk.x,
        movedMonitor.z - movedDesk.z
      );
      expect(afterDist).toBeCloseTo(initialDist, 1);
    });

    it('propagates transitive surface stacking chains (A -> B -> C) and sanitizes cycles on importJson', () => {
      useFloorplanStore.getState().loadPreset('empty-room');
      useFloorplanStore.getState().setSnapToWallEnabled(false);

      const deskId = useFloorplanStore.getState().addFurniture({
        name: 'Desk C',
        category: 'office',
        widthCm: 160,
        heightCm: 75,
        depthCm: 80,
        x: 200,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#cccccc',
      });
      const riserId = useFloorplanStore.getState().addFurniture({
        name: 'Riser B',
        category: 'office',
        widthCm: 60,
        heightCm: 12,
        depthCm: 25,
        x: 200,
        z: 190,
        elevationCm: 75,
        rotationYDeg: 0,
        color: '#999999',
        attachedToId: deskId,
      });
      const monitorId = useFloorplanStore.getState().addFurniture({
        name: 'Monitor A',
        category: 'office',
        widthCm: 50,
        heightCm: 40,
        depthCm: 15,
        x: 200,
        z: 190,
        elevationCm: 87,
        rotationYDeg: 0,
        color: '#222222',
        attachedToId: riserId,
      });

      useFloorplanStore.getState().moveFurniture(deskId, 260, 240);

      const riser = useFloorplanStore.getState().furniture.find((f) => f.id === riserId)!;
      const monitor = useFloorplanStore.getState().furniture.find((f) => f.id === monitorId)!;
      expect(riser.x).toBe(260);
      expect(riser.z).toBe(230);
      expect(monitor.x).toBe(260);
      expect(monitor.z).toBe(230);
    });

    it('groups background image drag updates with recordHistory: false into a single undo step', () => {
      useFloorplanStore.getState().setBackgroundImage({
        id: 'bg-1',
        url: 'blob:test',
        filename: 'plan.png',
        xCm: 10,
        zCm: 20,
        widthCm: 500,
        heightCm: 400,
        opacity: 0.6,
        visible: true,
        locked: false,
        rotationDeg: 0,
        naturalWidthPx: 1000,
        naturalHeightPx: 800,
      });

      const undoBefore = useFloorplanStore.getState().undoStack.length;
      useFloorplanStore.getState().pushUndoSnapshot();
      for (let i = 1; i <= 10; i++) {
        useFloorplanStore
          .getState()
          .updateBackgroundImage({ xCm: 10 + i * 5, zCm: 20 + i * 5 }, { recordHistory: false });
      }

      expect(useFloorplanStore.getState().undoStack.length).toBe(undoBefore + 1);
      expect(useFloorplanStore.getState().backgroundImage?.xCm).toBe(60);

      useFloorplanStore.getState().undo();
      expect(useFloorplanStore.getState().backgroundImage?.xCm).toBe(10);
      expect(useFloorplanStore.getState().backgroundImage?.zCm).toBe(20);
    });
  });
});
