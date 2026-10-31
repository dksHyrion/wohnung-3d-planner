import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parsePlanJson } from '../src/store/planImport';
import { adoptOverlayImage } from '../src/core/overlayImageStore';
import {
  wouldClobberSavedPlan,
  rememberPristinePlan,
  markUserInteracted,
  resetUserInteractionForTests,
  resetAutosaveRestoreForTests,
  createAutosaveScheduler,
} from '../src/store/autosave';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { BackgroundImageOverlay } from '../src/core/types';

describe('Store, Import & Persistence Fixes', () => {
  beforeEach(() => {
    resetAutosaveRestoreForTests();
    resetUserInteractionForTests();
  });

  describe('W6 & W7: Hardened JSON Import', () => {
    it('rejects or sanitizes non-finite numbers (NaN, strings, Infinity) in furniture, rugs, and background', () => {
      const hostileJson = JSON.stringify({
        corners: [
          { id: 'c1', x: 0, z: 0 },
          { id: 'c2', x: 200, z: 0 },
        ],
        walls: [
          { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
        ],
        openings: [],
        furniture: [
          {
            id: 'f1',
            name: 'Stuhl',
            category: 'invalid-category', // must fallback to 'custom'
            widthCm: 50,
            heightCm: 80,
            depthCm: 50,
            x: 100,
            z: 50,
            elevationCm: 'invalid-elevation', // string -> fallback 0, not NaN
            rotationYDeg: 'invalid-rotation', // string -> fallback 0, not NaN
            snappedWallId: { evil: true }, // must fallback to null
          },
        ],
        rugs: [
          {
            id: 'r1',
            widthCm: 100,
            depthCm: 100,
            x: 50,
            z: 50,
            rotationYDeg: 'not-a-number', // string -> fallback 0
          },
        ],
        backgroundImage: {
          id: 'bg1',
          url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          xCm: 0,
          zCm: 0,
          widthCm: 500,
          heightCm: 500,
          rotationDeg: 'not-a-number', // fallback 0
        },
      });

      const parsed = parsePlanJson(hostileJson);
      expect(parsed).not.toBeNull();
      const f = parsed!.furniture[0];
      expect(Number.isFinite(f.rotationYDeg)).toBe(true);
      expect(f.rotationYDeg).toBe(0);
      expect(Number.isFinite(f.elevationCm)).toBe(true);
      expect(f.elevationCm).toBe(0);
      expect(f.category).toBe('custom');
      expect(f.snappedWallId).toBeNull();

      const r = parsed!.rugs[0];
      expect(Number.isFinite(r.rotationYDeg)).toBe(true);
      expect(r.rotationYDeg).toBe(0);

      const bg = parsed!.backgroundImage;
      expect(Number.isFinite(bg?.rotationDeg)).toBe(true);
      expect(bg?.rotationDeg).toBe(0);
    });

    it('deduplicates duplicate IDs for corners, walls, openings, furniture, and rugs', () => {
      const duplicateIdJson = JSON.stringify({
        corners: [
          { id: 'c1', x: 0, z: 0 },
          { id: 'c1', x: 200, z: 0 }, // duplicate
        ],
        walls: [
          { id: 'w1', startCornerId: 'c1', endCornerId: 'c1_dup1', thicknessCm: 15, heightCm: 250 },
          { id: 'w1', startCornerId: 'c1', endCornerId: 'c1_dup1', thicknessCm: 15, heightCm: 250 }, // duplicate
        ],
        openings: [],
        furniture: [
          { id: 'f1', name: 'Möbel 1', widthCm: 50, heightCm: 50, depthCm: 50, x: 0, z: 0 },
          { id: 'f1', name: 'Möbel 2', widthCm: 50, heightCm: 50, depthCm: 50, x: 10, z: 10 }, // duplicate
        ],
        rugs: [
          { id: 'r1', widthCm: 100, depthCm: 100, x: 0, z: 0 },
          { id: 'r1', widthCm: 100, depthCm: 100, x: 20, z: 20 }, // duplicate
        ],
      });

      const parsed = parsePlanJson(duplicateIdJson);
      expect(parsed).not.toBeNull();

      const cornerIds = parsed!.corners.map((c) => c.id);
      expect(new Set(cornerIds).size).toBe(cornerIds.length);

      const wallIds = parsed!.walls.map((w) => w.id);
      expect(new Set(wallIds).size).toBe(wallIds.length);

      const furnitureIds = parsed!.furniture.map((f) => f.id);
      expect(new Set(furnitureIds).size).toBe(furnitureIds.length);

      const rugIds = parsed!.rugs.map((r) => r.id);
      expect(new Set(rugIds).size).toBe(rugIds.length);
    });

    it('filters walls referencing non-existent corners and openings referencing non-existent walls', () => {
      const danglingJson = JSON.stringify({
        corners: [{ id: 'c1', x: 0, z: 0 }],
        walls: [
          { id: 'w1', startCornerId: 'c1', endCornerId: 'c-missing', thicknessCm: 15, heightCm: 250 },
        ],
        openings: [
          { id: 'op1', wallId: 'w-missing', type: 'door', offsetFromStartCm: 10, widthCm: 90, heightCm: 210, sillHeightCm: 0 },
        ],
        furniture: [],
      });

      const parsed = parsePlanJson(danglingJson);
      expect(parsed).not.toBeNull();
      expect(parsed!.walls).toHaveLength(0); // w1 dropped because c-missing doesn't exist
      expect(parsed!.openings).toHaveLength(0); // op1 dropped because w-missing doesn't exist
    });
  });

  describe('W8: Dropping remote http(s) URLs in overlayImageStore (Offline-First)', () => {
    it('drops external http and https urls on adoptOverlayImage', () => {
      const remoteOverlay: BackgroundImageOverlay = {
        id: 'bg-remote',
        url: 'https://malicious-tracker.com/beacon.png',
        filename: 'plan.png',
        xCm: 0,
        zCm: 0,
        widthCm: 400,
        heightCm: 300,
        rotationDeg: 0,
        opacity: 0.5,
        visible: true,
        locked: false,
        naturalWidthPx: 800,
        naturalHeightPx: 600,
      };

      const adopted = adoptOverlayImage(remoteOverlay);
      expect(adopted.url).toBe(''); // Must be cleared to prevent external network fetch
    });
  });

  describe('W11 & W12: Autosave dirty-flag semantics and lazy serialization', () => {
    it('allows deliberate saving of pristine preset when user explicitly interacted', () => {
      rememberPristinePlan('standard-55-pristine');
      // Untouched boot time: blocks clobbering
      expect(wouldClobberSavedPlan('saved-user-plan', 'standard-55-pristine')).toBe(true);

      // User deliberately interacted (e.g. loaded preset or undid)
      markUserInteracted();
      expect(wouldClobberSavedPlan('saved-user-plan', 'standard-55-pristine')).toBe(false);
    });

    it('only invokes JSON serialization lazily on timer flush, not on every intermediate notify call', () => {
      vi.useFakeTimers();
      const saveSpy = vi.fn();
      const scheduler = createAutosaveScheduler(saveSpy, 400);

      const state1 = {
        corners: [{ id: 'c1', x: 0, z: 0 }],
        walls: [],
        openings: [],
        furniture: [],
        rugs: [],
        roomLabels: [],
        backgroundImage: null,
      };
      const state2 = { ...state1, corners: [{ id: 'c1', x: 1, z: 0 }] };
      const state3 = { ...state1, corners: [{ id: 'c1', x: 2, z: 0 }] };

      const serializeSpy = vi.fn(() => '{"json": true}');

      // Simulate 5 rapid pointer-move ticks
      scheduler.notify(state1, state2, serializeSpy);
      scheduler.notify(state2, state3, serializeSpy);
      scheduler.notify(state3, state2, serializeSpy);
      scheduler.notify(state2, state3, serializeSpy);
      scheduler.notify(state3, state2, serializeSpy);

      // Intermediate serialize must not run 5 times (only start and debounced end)
      expect(serializeSpy).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(400);

      expect(serializeSpy).toHaveBeenCalledTimes(2);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });

  describe('Minor #8 & #13: Selection Reconciliation & Schema Version', () => {
    it('emits schemaVersion: 1 in exportJson', () => {
      const exported = useFloorplanStore.getState().exportJson();
      const parsed = JSON.parse(exported);
      expect(parsed.schemaVersion).toBe(1);
    });
  });
});
