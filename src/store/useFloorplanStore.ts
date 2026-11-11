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
  BackgroundImageOverlay,
} from '../core/types';
import { evaluateFloorplanCollisions } from '../core/collisionEngine';
import { PRESET_FLOORPLANS } from '../core/presets';
import { nextFloorplanStoreGeneration, rememberPristinePlan } from './autosave';
import { createGeometryActions } from './geometry';
import { createHistoryActions } from './history';
import { createViewActions } from './view';
import { evaluatePassageClearances } from '../core/ergonomicsEngine';
import {
  backgroundImageForExport,
  deleteOverlayBlobs,
  memoryOverlayIds,
  runtimeUrlForOverlay,
} from '../core/overlayImageStore';
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
    corners: data.corners.map((c) => ({ ...c })),
    walls: data.walls.map((w) => ({ ...w })),
    openings: data.openings.map((o) => ({ ...o })),
    furniture: data.furniture.map((f) => ({ ...f })),
    rugs: (data.rugs ?? []).map((r) => ({ ...r })),
    roomLabels: (data.roomLabels ?? []).map((label) => ({ ...label })),
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
  corners: Corner[];
  walls: Wall[];
  openings: WallOpening[];
  furniture: FurnitureItem[];
  rugs?: AreaRug[];
  roomLabels?: RoomLabel[];
  backgroundImage?: BackgroundImageOverlay | null;
}): FloorplanData {
  return cloneFloorplanData({
    corners: state.corners,
    walls: state.walls,
    openings: state.openings,
    furniture: state.furniture,
    rugs: state.rugs ?? [],
    roomLabels: state.roomLabels ?? [],
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
      (patch.corners !== undefined && patch.corners !== state.corners) ||
      (patch.walls !== undefined && patch.walls !== state.walls) ||
      (patch.openings !== undefined && patch.openings !== state.openings) ||
      (patch.furniture !== undefined && patch.furniture !== state.furniture) ||
      (patch.rugs !== undefined && patch.rugs !== state.rugs) ||
      (patch.roomLabels !== undefined && patch.roomLabels !== state.roomLabels) ||
      (patch.backgroundImage !== undefined && patch.backgroundImage !== state.backgroundImage);

    const historyPatch = recordHistory && hasDataChanged ? pushHistory() : {};
    const corners = patch.corners ?? state.corners;
    const walls = patch.walls ?? state.walls;
    const openings = patch.openings ?? state.openings;
    const furniture = patch.furniture ?? state.furniture;

    const collisionReports = evaluateFloorplanCollisions({
      corners,
      walls,
      openings,
      furniture,
    });
    const showPassageHeatmap = patch.showPassageHeatmap ?? state.showPassageHeatmap;
    const passageReport = showPassageHeatmap
      ? evaluatePassageClearances(furniture, walls, corners)
      : null;

    set({
      ...historyPatch,
      ...patch,
      passageReport,
      collisionReports,
    });
    gcOverlays();
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
    corners: initialData.corners,
    walls: initialData.walls,
    openings: initialData.openings,
    furniture: initialData.furniture,
    rugs: initialData.rugs ?? [],
    roomLabels: initialData.roomLabels ?? [],
    backgroundImage: initialData.backgroundImage ?? null,
    overlayError: null,
    persistenceError: null,
    showPassageHeatmap: false,
    passageReport: null,
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
