import { useStore } from 'zustand';
import type { UseBoundStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import {
  Corner,
  Wall,
  WallOpening,
  FurnitureItem,
  FloorplanData,
  AreaRug,
  RoomLabel,
  RoofSlope,
  WallFixture,
  LayoutVariant,
  BackgroundImageOverlay,
  BuildingLevel,
  Staircase,
} from '../core/types';
import {
  DEFAULT_LEVEL_ID,
  normalizeLevels,
  scopeFloorplanToLevel,
} from '../core/levels';
import { evaluateFloorplanCollisions } from '../core/collisionEngine';
import { PRESET_FLOORPLANS } from '../core/presets';
import { nextFloorplanStoreGeneration, rememberPristinePlan } from './autosave';
import { createGeometryActions } from './geometry';
import { createHistoryActions } from './history';
import { createViewActions } from './view';
import {
  evaluatePassageClearances,
  evaluateErgonomicsScorecard,
} from '../core/ergonomicsEngine';
import { sharedErgonomicsWorkerClient } from '../core/workers/ergonomicsWorkerClient';
import {
  backgroundImageForExport,
  deleteOverlayBlobs,
  memoryOverlayIds,
  runtimeUrlForOverlay,
} from '../core/overlayImageStore';
import {
  deleteCustomModelBlobs,
  memoryCustomModelIds,
} from '../core/customModelStore';
import { getGlobalLanguage, subscribeLanguage } from '../i18n/i18n';
import type {
  CameraPreset,
  FloorplanState,
  Language,
  SelectableEntityType,
} from './state';

export type { CameraPreset, FloorplanState, Language, SelectableEntityType };

let idCounter = 1;
function generateId(prefix: string): string {
  const id = `${prefix}-${Date.now().toString(36)}-${idCounter++}`;
  return id;
}

function cloneFloorplanData(data: FloorplanData): FloorplanData {
  return {
    levels: normalizeLevels(data.levels).map((l) => ({ ...l })),
    stairs: (data.stairs ?? []).map((st) => ({ ...st })),
    corners: data.corners.map((c) => ({ ...c })),
    walls: data.walls.map((w) => ({ ...w })),
    openings: data.openings.map((o) => ({ ...o })),
    furniture: data.furniture.map((f) => ({ ...f })),
    rugs: (data.rugs ?? []).map((r) => ({ ...r })),
    roomLabels: (data.roomLabels ?? []).map((label) => ({ ...label })),
    roofSlopes: (data.roofSlopes ?? []).map((s) => ({ ...s })),
    fixtures: (data.fixtures ?? []).map((fx) => ({ ...fx })),
    variants: (data.variants ?? []).map((v) => ({
      ...v,
      furniture: v.furniture.map((f) => ({ ...f })),
      rugs: v.rugs.map((r) => ({ ...r })),
    })),
    activeVariantId: data.activeVariantId ?? null,
    backgroundImage: backgroundImageForExport(data.backgroundImage),
  };
}

function getInitialData(): FloorplanData {
  const preset =
    PRESET_FLOORPLANS['standard-55'] ??
    PRESET_FLOORPLANS['luxury-villa'] ??
    Object.values(PRESET_FLOORPLANS)[0];
  return cloneFloorplanData(preset.data);
}

const MAX_HISTORY = 30;

function captureFloorplanSnapshot(state: {
  levels?: BuildingLevel[];
  stairs?: Staircase[];
  corners: Corner[];
  walls: Wall[];
  openings: WallOpening[];
  furniture: FurnitureItem[];
  rugs?: AreaRug[];
  roomLabels?: RoomLabel[];
  roofSlopes?: RoofSlope[];
  fixtures?: WallFixture[];
  layoutVariants?: LayoutVariant[];
  activeVariantId?: string | null;
  backgroundImage?: BackgroundImageOverlay | null;
}): FloorplanData {
  return cloneFloorplanData({
    levels: state.levels,
    stairs: state.stairs,
    corners: state.corners,
    walls: state.walls,
    openings: state.openings,
    furniture: state.furniture,
    rugs: state.rugs ?? [],
    roomLabels: state.roomLabels ?? [],
    roofSlopes: state.roofSlopes ?? [],
    fixtures: state.fixtures ?? [],
    variants: state.layoutVariants ?? [],
    activeVariantId: state.activeVariantId ?? null,
    backgroundImage: backgroundImageForExport(state.backgroundImage),
  });
}

function getInitialStoreLanguage(): Language {
  return getGlobalLanguage() || 'de';
}

const initialData = getInitialData();

const floorplanStoreApi = createStore<FloorplanState>()((set, get) => {
  const pushHistory = () => {
    const state = get();
    const snapshot = captureFloorplanSnapshot(state);
    const nextUndo = [...state.undoStack, snapshot];
    if (nextUndo.length > MAX_HISTORY) {
      nextUndo.shift();
    }
    return {
      undoStack: nextUndo,
      redoStack: [],
      canUndo: true,
      canRedo: false,
    };
  };

  const setWithCollisions = (patch: Partial<FloorplanState>, recordHistory = true) => {
    const state = get();
    const hasDataChanged =
      (patch.levels !== undefined && patch.levels !== state.levels) ||
      (patch.stairs !== undefined && patch.stairs !== state.stairs) ||
      (patch.corners !== undefined && patch.corners !== state.corners) ||
      (patch.walls !== undefined && patch.walls !== state.walls) ||
      (patch.openings !== undefined && patch.openings !== state.openings) ||
      (patch.furniture !== undefined && patch.furniture !== state.furniture) ||
      (patch.rugs !== undefined && patch.rugs !== state.rugs) ||
      (patch.roomLabels !== undefined && patch.roomLabels !== state.roomLabels) ||
      (patch.roofSlopes !== undefined && patch.roofSlopes !== state.roofSlopes) ||
      (patch.fixtures !== undefined && patch.fixtures !== state.fixtures) ||
      (patch.layoutVariants !== undefined && patch.layoutVariants !== state.layoutVariants) ||
      (patch.activeVariantId !== undefined && patch.activeVariantId !== state.activeVariantId) ||
      (patch.backgroundImage !== undefined && patch.backgroundImage !== state.backgroundImage);

    const historyPatch = recordHistory && hasDataChanged ? pushHistory() : {};
    const levels = patch.levels ?? state.levels;
    const stairs = patch.stairs ?? state.stairs;
    const activeLevelId = patch.activeLevelId ?? state.activeLevelId;
    const corners = patch.corners ?? state.corners;
    const walls = patch.walls ?? state.walls;
    const openings = patch.openings ?? state.openings;
    const furniture = patch.furniture ?? state.furniture;
    const roomLabels = patch.roomLabels ?? state.roomLabels;
    const roofSlopes = patch.roofSlopes ?? state.roofSlopes;
    const fixtures = patch.fixtures ?? state.fixtures;

    // Rug, label, overlay and selection patches do not affect collisions; keep the old
    // report references so subscribers do not re-render.
    const layoutChanged =
      corners !== state.corners ||
      walls !== state.walls ||
      furniture !== state.furniture ||
      levels !== state.levels ||
      stairs !== state.stairs;
    const collisionReports =
      layoutChanged ||
      openings !== state.openings ||
      roofSlopes !== state.roofSlopes ||
      fixtures !== state.fixtures
        ? evaluateFloorplanCollisions({
            levels,
            stairs,
            corners,
            walls,
            openings,
            furniture,
            roofSlopes,
            fixtures,
          })
        : state.collisionReports;
    const showPassageHeatmap = patch.showPassageHeatmap ?? state.showPassageHeatmap;
    const scorecardChanged =
      layoutChanged ||
      openings !== state.openings ||
      roomLabels !== state.roomLabels ||
      activeLevelId !== state.activeLevelId;
    const needsErgonomics =
      showPassageHeatmap &&
      (layoutChanged ||
        scorecardChanged ||
        !state.passageReport ||
        !state.ergonomicsScorecard);

    let passageReport = showPassageHeatmap ? state.passageReport : null;
    let ergonomicsScorecard = showPassageHeatmap ? state.ergonomicsScorecard : null;
    let isComputingErgonomics = false;

    const ergonomicsPlanData: FloorplanData = {
      levels,
      stairs,
      corners,
      walls,
      openings,
      furniture,
      roomLabels,
    };

    if (!showPassageHeatmap) {
      sharedErgonomicsWorkerClient.cancelPending();
    } else if (needsErgonomics) {
      if (!sharedErgonomicsWorkerClient.isWorkerSupported()) {
        const scoped =
          levels.length > 1
            ? scopeFloorplanToLevel(ergonomicsPlanData, activeLevelId)
            : ergonomicsPlanData;
        passageReport =
          layoutChanged || activeLevelId !== state.activeLevelId || !state.passageReport
            ? evaluatePassageClearances(scoped.furniture, scoped.walls, scoped.corners)
            : state.passageReport;
        ergonomicsScorecard =
          scorecardChanged || !state.ergonomicsScorecard
            ? evaluateErgonomicsScorecard(ergonomicsPlanData, passageReport, {
                levelId: activeLevelId,
              })
            : state.ergonomicsScorecard;
      } else {
        isComputingErgonomics = true;
      }
    }

    const syncedSelectionPatch =
      patch.selectedId !== undefined && patch.selectedIds === undefined
        ? { selectedIds: patch.selectedId ? [patch.selectedId] : [] }
        : {};

    set({
      ...historyPatch,
      ...patch,
      ...syncedSelectionPatch,
      passageReport,
      ergonomicsScorecard,
      isComputingErgonomics,
      collisionReports,
    });
    if (isComputingErgonomics) {
      void sharedErgonomicsWorkerClient
        .evaluateErgonomicsAsync(ergonomicsPlanData, {
          immediate: recordHistory,
          levelId: activeLevelId,
        })
        .then((res) => {
          if (!res || !get().showPassageHeatmap) return;
          set({
            passageReport: res.passageReport,
            ergonomicsScorecard: res.ergonomicsScorecard,
            isComputingErgonomics: false,
          });
        });
    }
    gcOverlays();
    gcCustomModels();
  };

  const gcOverlays = () => {
    const state = get();
    const keep = new Set<string>();
    const add = (image?: BackgroundImageOverlay | null) => {
      if (image?.imageId) keep.add(image.imageId);
    };
    add(state.backgroundImage);
    for (const snap of state.undoStack) add(snap.backgroundImage);
    for (const snap of state.redoStack) add(snap.backgroundImage);
    const stale = memoryOverlayIds().filter((id) => !keep.has(id));
    if (stale.length > 0) void deleteOverlayBlobs(stale).catch(() => {});
  };

  const gcCustomModels = () => {
    const state = get();
    const keep = new Set<string>();
    const collect = (items?: FurnitureItem[]) => {
      if (!items) return;
      for (const f of items) {
        if (f.customModelId) keep.add(f.customModelId);
      }
    };
    collect(state.furniture);
    for (const snap of state.undoStack) collect(snap.furniture);
    for (const snap of state.redoStack) collect(snap.furniture);
    for (const variant of state.layoutVariants) collect(variant.furniture);
    const stale = memoryCustomModelIds().filter((id) => !keep.has(id));
    if (stale.length > 0) void deleteCustomModelBlobs(stale).catch(() => {});
  };

  const withRuntimeImage = (
    image: BackgroundImageOverlay | null | undefined
  ): BackgroundImageOverlay | null => {
    if (!image) return null;
    if (image.imageId) {
      const url = runtimeUrlForOverlay(image.imageId);
      if (url) return { ...image, url };
    }
    return backgroundImageForExport(image);
  };

  const deps = {
    set,
    get,
    setWithCollisions,
    pushHistory,
    generateId,
    withRuntimeImage,
    gcOverlays,
    cloneFloorplanData,
    captureFloorplanSnapshot,
  };

  return {
    language: getInitialStoreLanguage(),
    levels: normalizeLevels(initialData.levels),
    activeLevelId: normalizeLevels(initialData.levels)[0]?.id ?? DEFAULT_LEVEL_ID,
    levelViewMode: 'all-stacked',
    showGhostBelow2D: true,
    stairs: initialData.stairs ?? [],
    corners: initialData.corners,
    walls: initialData.walls,
    openings: initialData.openings,
    furniture: initialData.furniture,
    rugs: initialData.rugs ?? [],
    roomLabels: initialData.roomLabels ?? [],
    roofSlopes: initialData.roofSlopes ?? [],
    fixtures: initialData.fixtures ?? [],
    layoutVariants: initialData.variants ?? [],
    activeVariantId: initialData.activeVariantId ?? null,
    ghostVariantId: null,
    backgroundImage: initialData.backgroundImage ?? null,
    overlayError: null,
    persistenceError: null,
    showPassageHeatmap: false,
    passageReport: null,
    ergonomicsScorecard: null,
    isComputingErgonomics: false,
    activeAlignmentGuides: [],
    calibrationPoints: { p1: null, p2: null },
    collisionReports: evaluateFloorplanCollisions(initialData),
    viewMode: 'split',
    activeTool: 'select',
    cutawayEnabled: true,
    snapToWallEnabled: true,
    renderTheme: 'studio',
    showDimensions3D: true,
    cameraPreset: 'axonometric',
    cameraPresetNonce: 0,
    selectedId: null,
    selectedIds: [],
    selectedType: null,
    selectedRoomId: null,
    timeOfDay: 8.0,
    activeMoodKey: 'morning',
    qualityMode: 'performance',
    glowingWallCaps: true,
    cameraEyeLevelCm: 170,
    showDecor: true,
    showKeyboardShortcuts: false,
    alignSunWithWindows: true,
    roomLightsActive: false,
    measureStart: null,
    measureEnd: null,
    gridSizeCm: 5,
    orthoSnapEnabled: true,
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,

    ...createViewActions(deps),
    ...createGeometryActions(deps),
    ...createHistoryActions(deps),
  };
});

// renderToStaticMarkup liest getInitialState, nicht getState. Die Funktion sitzt
// auf dem Store-Objekt, das useStore schließt. Eine spätere Zuweisung an den Hook
floorplanStoreApi.getInitialState = () => floorplanStoreApi.getState();

subscribeLanguage(() => {
  const current = getGlobalLanguage();
  if (floorplanStoreApi.getState().language !== current) {
    floorplanStoreApi.setState({ language: current });
  }
});

function useFloorplanStoreHook(): FloorplanState;
function useFloorplanStoreHook<T>(selector: (state: FloorplanState) => T): T;
function useFloorplanStoreHook<T>(
  selector: (state: FloorplanState) => T = (state) => state as T,
): T {
  return useStore(floorplanStoreApi, selector);
}

export const useFloorplanStore: UseBoundStore<StoreApi<FloorplanState>> = Object.assign(
  useFloorplanStoreHook,
  floorplanStoreApi,
);

export const floorplanStoreGeneration = nextFloorplanStoreGeneration();
rememberPristinePlan(useFloorplanStore.getState().exportJson());
