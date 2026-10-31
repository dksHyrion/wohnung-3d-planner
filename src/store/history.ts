import {
  compressStoredOverlay,
  hydrateOverlayUrl,
  backgroundImageForExport,
} from '../core/overlayImageStore';
import { calculateScaleFromReference } from '../core/tracingMath';
import {
  BackgroundImageOverlay,
  FloorplanData,
} from '../core/types';
import type { StoreDeps } from './deps';
import { wouldClobberSavedPlan } from './autosave';
import { parsePlanJson } from './planImport';
import { writePlanFile } from './planFile';
import type { FloorplanState } from './state';

type HistoryActions = Pick<
  FloorplanState,
  | 'pushUndoSnapshot'
  | 'undo'
  | 'redo'
  | 'saveToLocalStorage'
  | 'loadFromLocalStorage'
  | 'clearLocalStorageBackup'
  | 'setBackgroundImage'
  | 'updateBackgroundImage'
  | 'removeBackgroundImage'
  | 'setOverlayError'
  | 'startCalibration'
  | 'setCalibrationPoint'
  | 'applyCalibration'
  | 'cancelCalibration'
  | 'exportJson'
  | 'importJson'
>;

export function createHistoryActions(deps: StoreDeps): HistoryActions {
  const {
    set,
    get,
    setWithCollisions,
    pushHistory,
    withRuntimeImage,
    captureFloorplanSnapshot,
  } = deps;
  return {
  pushUndoSnapshot: () => {
    set(pushHistory());
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    const currentSnapshot = captureFloorplanSnapshot(state);
    const previousSnapshot = state.undoStack[state.undoStack.length - 1];
    const nextUndo = state.undoStack.slice(0, state.undoStack.length - 1);
    const nextRedo = [...state.redoStack, currentSnapshot];

    const validEntityIds = new Set([
      ...previousSnapshot.corners.map((c) => c.id),
      ...previousSnapshot.walls.map((w) => w.id),
      ...previousSnapshot.openings.map((o) => o.id),
      ...previousSnapshot.furniture.map((f) => f.id),
      ...(previousSnapshot.rugs ?? []).map((r) => r.id),
    ]);
    const keepSelection = state.selectedId ? validEntityIds.has(state.selectedId) : false;

    setWithCollisions(
      {
        corners: previousSnapshot.corners,
        walls: previousSnapshot.walls,
        openings: previousSnapshot.openings,
        furniture: previousSnapshot.furniture,
        rugs: previousSnapshot.rugs ?? [],
        roomLabels: previousSnapshot.roomLabels ?? [],
        backgroundImage: withRuntimeImage(previousSnapshot.backgroundImage),
        selectedId: keepSelection ? state.selectedId : null,
        selectedType: keepSelection ? state.selectedType : null,
        activeAlignmentGuides: [],
        undoStack: nextUndo,
        redoStack: nextRedo,
        canUndo: nextUndo.length > 0,
        canRedo: true,
      },
      false
    );
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const currentSnapshot = captureFloorplanSnapshot(state);
    const nextSnapshot = state.redoStack[state.redoStack.length - 1];
    const nextRedo = state.redoStack.slice(0, state.redoStack.length - 1);
    const nextUndo = [...state.undoStack, currentSnapshot];

    const validEntityIds = new Set([
      ...nextSnapshot.corners.map((c) => c.id),
      ...nextSnapshot.walls.map((w) => w.id),
      ...nextSnapshot.openings.map((o) => o.id),
      ...nextSnapshot.furniture.map((f) => f.id),
      ...(nextSnapshot.rugs ?? []).map((r) => r.id),
    ]);
    const keepSelection = state.selectedId ? validEntityIds.has(state.selectedId) : false;

    setWithCollisions(
      {
        corners: nextSnapshot.corners,
        walls: nextSnapshot.walls,
        openings: nextSnapshot.openings,
        furniture: nextSnapshot.furniture,
        rugs: nextSnapshot.rugs ?? [],
        roomLabels: nextSnapshot.roomLabels ?? [],
        backgroundImage: withRuntimeImage(nextSnapshot.backgroundImage),
        selectedId: keepSelection ? state.selectedId : null,
        selectedType: keepSelection ? state.selectedType : null,
        activeAlignmentGuides: [],
        undoStack: nextUndo,
        redoStack: nextRedo,
        canUndo: true,
        canRedo: nextRedo.length > 0,
      },
      false
    );
  },

  saveToLocalStorage: (jsonOverride) => {
    try {
      if (typeof localStorage !== 'undefined') {
        const json = jsonOverride ?? get().exportJson();
        const existing = localStorage.getItem('wohnung_autosave');
        if (wouldClobberSavedPlan(existing, json)) return;
        localStorage.setItem('wohnung_autosave', json);
        set({ persistenceError: null });
        void writePlanFile(json);
      }
    } catch {
      set({ persistenceError: 'Der Plan konnte nicht im Browser gesichert werden.' });
      void writePlanFile(jsonOverride ?? get().exportJson());
    }
  },

  loadFromLocalStorage: () => {
    try {
      if (typeof localStorage !== 'undefined') {
        const json = localStorage.getItem('wohnung_autosave');
        if (json) {
          const ok = get().importJson(json);
          if (ok) {
            set({
              undoStack: [],
              redoStack: [],
              canUndo: false,
              canRedo: false,
              persistenceError: null,
            });
            return true;
          } else {
            try {
              localStorage.setItem('wohnung_autosave.corrupt', json);
            } catch {
              // ignore
            }
            set({
              persistenceError: 'Die automatische Sicherung war beschädigt und wurde als Kopie gesichert.',
            });
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  },

  clearLocalStorageBackup: () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('wohnung_autosave');
      }
    } catch (err) {
      console.warn('Clear localStorage error:', err);
    }
  },

  setBackgroundImage: (image) => {
    setWithCollisions({
      backgroundImage: image ? { ...image } : null,
    });
  },

  updateBackgroundImage: (patch, options) => {
    const recordHistory = options?.recordHistory ?? true;
    const state = get();
    if (!state.backgroundImage) return;
    const current = state.backgroundImage;

    const widthCm =
      patch.widthCm !== undefined
        ? Number.isFinite(patch.widthCm)
          ? Math.max(1, patch.widthCm)
          : current.widthCm
        : current.widthCm;

    const heightCm =
      patch.heightCm !== undefined
        ? Number.isFinite(patch.heightCm)
          ? Math.max(1, patch.heightCm)
          : current.heightCm
        : current.heightCm;

    const opacity =
      patch.opacity !== undefined
        ? Number.isFinite(patch.opacity)
          ? Math.max(0, Math.min(1, patch.opacity))
          : current.opacity
        : current.opacity;

    const xCm =
      patch.xCm !== undefined && Number.isFinite(patch.xCm)
        ? patch.xCm
        : current.xCm;

    const zCm =
      patch.zCm !== undefined && Number.isFinite(patch.zCm)
        ? patch.zCm
        : current.zCm;

    const rotationDeg =
      patch.rotationDeg !== undefined && Number.isFinite(patch.rotationDeg)
        ? patch.rotationDeg
        : current.rotationDeg;

    setWithCollisions(
      {
        backgroundImage: {
          ...current,
          ...patch,
          widthCm,
          heightCm,
          opacity,
          xCm,
          zCm,
          rotationDeg,
        },
      },
      recordHistory
    );
  },

  removeBackgroundImage: () => {
    const state = get();
    if (!state.backgroundImage) return;
    setWithCollisions({
      backgroundImage: null,
    });
  },

  setOverlayError: (message) => set({ overlayError: message }),

  startCalibration: () => {
    set({
      activeTool: 'calibrate-scale',
      calibrationPoints: { p1: null, p2: null },
    });
  },

  setCalibrationPoint: (pt) => {
    if (!Number.isFinite(pt?.x) || !Number.isFinite(pt?.z)) return;
    const state = get();
    if (!state.calibrationPoints.p1) {
      set({
        calibrationPoints: { p1: { x: pt.x, z: pt.z }, p2: null },
      });
    } else if (!state.calibrationPoints.p2) {
      set({
        calibrationPoints: {
          p1: state.calibrationPoints.p1,
          p2: { x: pt.x, z: pt.z },
        },
      });
    } else {
      set({
        calibrationPoints: { p1: { x: pt.x, z: pt.z }, p2: null },
      });
    }
  },

  applyCalibration: (realDistanceCm) => {
    const state = get();
    const { backgroundImage, calibrationPoints } = state;
    if (!backgroundImage || !calibrationPoints.p1 || !calibrationPoints.p2) {
      return;
    }
    const result = calculateScaleFromReference(
      calibrationPoints.p1,
      calibrationPoints.p2,
      realDistanceCm,
      backgroundImage.naturalWidthPx,
      backgroundImage.naturalHeightPx
    );
    if (!result) return;
    setWithCollisions({
      backgroundImage: {
        ...backgroundImage,
        widthCm: result.widthCm,
        heightCm: result.heightCm,
      },
      calibrationPoints: { p1: null, p2: null },
      activeTool: 'select',
    });
  },

  cancelCalibration: () => {
    set({
      calibrationPoints: { p1: null, p2: null },
      activeTool: 'select',
    });
  },

  exportJson: (options?: { includeOverlayImage?: boolean }) => {
    const state = get();
    let bg = backgroundImageForExport(state.backgroundImage);
    if (options?.includeOverlayImage && state.backgroundImage?.url) {
      bg = state.backgroundImage;
    }
    const payload = {
      schemaVersion: 1,
      corners: state.corners,
      walls: state.walls,
      openings: state.openings,
      furniture: state.furniture,
      rugs: state.rugs,
      roomLabels: state.roomLabels,
      backgroundImage: bg,
    };
    return JSON.stringify(payload, null, 2);
  },

  importJson: (jsonStr) => {
    const parsed = parsePlanJson(jsonStr);
    if (!parsed) return false;
    const { importedWasDataUrl, ...plan } = parsed;
    setWithCollisions({
      ...plan,
      selectedId: null,
      selectedType: null,
    });
    const importedImage = plan.backgroundImage;
    if (importedImage?.imageId) {
      const imageId = importedImage.imageId;
      const naturalWidthPx = importedImage.naturalWidthPx;
      const naturalHeightPx = importedImage.naturalHeightPx;
      void (async () => {
        const url = importedWasDataUrl
          ? await compressStoredOverlay(imageId, naturalWidthPx, naturalHeightPx)
          : await hydrateOverlayUrl(imageId);
        const current = get().backgroundImage;
        if (!current || current.imageId !== imageId || !url || current.url === url) return;
        set({ backgroundImage: { ...current, url } });
      })();
    }
    return true;
  },
  };
}
