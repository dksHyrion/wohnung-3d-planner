import {
  Corner,
  Wall,
  WallOpening,
  FurnitureItem,
  FloorplanData,
  FlooringType,
  FurnitureCollisionReport,
  ViewMode,
  EditorTool,
  AreaRug,
  RoomLabel,
  RoofSlope,
  WallFixture,
  LayoutVariant,
  BackgroundImageOverlay,
  Point2D,
  AlignmentGuide,
} from '../core/types';
import { MoodPresetKey, QualityMode } from '../core/lighting/moodPresets';
import { PassageClearanceReport } from '../core/ergonomicsEngine';
import type { ErgonomicsScorecardReport } from '../core/ergonomicsScorecard';
import type { Language } from '../i18n/types';

export type { Language };

export type SelectableEntityType =
  | 'wall'
  | 'corner'
  | 'opening'
  | 'furniture'
  | 'room'
  | 'rug'
  | 'fixture'
  | null;
export type CameraPreset = 'axonometric' | 'isometric' | 'top-down' | 'first-person';

export interface FloorplanState {
  language: Language;
  corners: Corner[];
  walls: Wall[];
  openings: WallOpening[];
  furniture: FurnitureItem[];
  rugs: AreaRug[];
  roomLabels: RoomLabel[];
  roofSlopes: RoofSlope[];
  fixtures: WallFixture[];
  layoutVariants: LayoutVariant[];
  activeVariantId: string | null;
  ghostVariantId: string | null;
  backgroundImage: BackgroundImageOverlay | null;
  overlayError: string | null;
  persistenceError: string | null;
  showPassageHeatmap: boolean;
  passageReport: PassageClearanceReport | null;
  ergonomicsScorecard: ErgonomicsScorecardReport | null;
  isComputingErgonomics: boolean;
  activeAlignmentGuides: AlignmentGuide[];
  clearAlignmentGuides: () => void;
  calibrationPoints: { p1: Point2D | null; p2: Point2D | null };
  collisionReports: Record<string, FurnitureCollisionReport>;
  viewMode: ViewMode;
  activeTool: EditorTool;
  cutawayEnabled: boolean;
  snapToWallEnabled: boolean;
  renderTheme: 'studio' | 'blueprint';
  showDimensions3D: boolean;
  cameraPreset: CameraPreset;
  cameraPresetNonce: number;
  selectedId: string | null;
  selectedIds: string[];
  selectedType: SelectableEntityType;
  selectedRoomId: string | null;
  timeOfDay: number;
  activeMoodKey: MoodPresetKey | 'custom';
  qualityMode: QualityMode;
  glowingWallCaps: boolean;
  cameraEyeLevelCm: number;
  setCameraEyeLevelCm: (heightCm: number) => void;
  showDecor: boolean;
  setShowDecor: (show: boolean) => void;
  showKeyboardShortcuts: boolean;
  setShowKeyboardShortcuts: (show: boolean) => void;
  toggleKeyboardShortcuts: () => void;
  alignSunWithWindows: boolean;
  setAlignSunWithWindows: (align: boolean) => void;
  roomLightsActive: boolean;
  setRoomLightsActive: (active: boolean) => void;
  measureStart: { x: number; z: number } | null;
  measureEnd: { x: number; z: number } | null;
  setMeasurePoints: (
    start: { x: number; z: number } | null,
    end: { x: number; z: number } | null
  ) => void;
  clearMeasure: () => void;
  gridSizeCm: number;
  setGridSizeCm: (size: number) => void;
  orthoSnapEnabled: boolean;
  setOrthoSnapEnabled: (enabled: boolean) => void;
  undoStack: FloorplanData[];
  redoStack: FloorplanData[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  saveToLocalStorage: (jsonOverride?: string) => void;
  loadFromLocalStorage: () => boolean;
  clearLocalStorageBackup: () => void;

  setViewMode: (mode: ViewMode) => void;
  setActiveTool: (tool: EditorTool) => void;
  setCutawayEnabled: (enabled: boolean) => void;
  setSnapToWallEnabled: (enabled: boolean) => void;
  setRenderTheme: (theme: 'studio' | 'blueprint') => void;
  setShowDimensions3D: (show: boolean) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setTimeOfDay: (hour: number) => void;
  setMoodPreset: (preset: MoodPresetKey) => void;
  setQualityMode: (mode: QualityMode) => void;
  setGlowingWallCaps: (enabled: boolean) => void;
  selectEntity: (id: string | null, type: SelectableEntityType) => void;
  selectRoom: (roomId: string | null) => void;
  toggleSelectFurniture: (furnitureId: string) => void;
  selectMultipleFurniture: (furnitureIds: string[]) => void;
  updateWallLengthCm: (wallId: string, lengthCm: number) => void;
  updateWallProps: (
    wallId: string,
    patch: Partial<Pick<Wall, 'thicknessCm' | 'heightCm' | 'posFinish' | 'negFinish'>>
  ) => void;
  addWallWithCorners: (
    start: { x: number; z: number },
    end: { x: number; z: number }
  ) => string;
  splitWallAt: (
    wallId: string,
    point?: { x: number; z: number }
  ) => string | null;
  removeWall: (wallId: string) => void;
  moveCorner: (
    cornerId: string,
    x: number,
    z: number,
    options?: { recordHistory?: boolean }
  ) => void;
  removeCorner: (cornerId: string) => void;
  updateRoom: (
    roomId: string,
    patch: { name?: string; flooringType?: FlooringType }
  ) => void;
  addOpening: (opening: Omit<WallOpening, 'id'>) => string;
  updateOpening: (
    openingId: string,
    patch: Partial<Omit<WallOpening, 'id'>>
  ) => void;
  removeOpening: (openingId: string) => void;
  addRoofSlope: (slope: Omit<RoofSlope, 'id'>) => string;
  updateRoofSlope: (
    slopeId: string,
    patch: Partial<Omit<RoofSlope, 'id' | 'wallId'>>
  ) => void;
  removeRoofSlope: (slopeId: string) => void;
  addFixture: (fixture: Omit<WallFixture, 'id'>) => string;
  updateFixture: (
    fixtureId: string,
    patch: Partial<Omit<WallFixture, 'id' | 'wallId'>>
  ) => void;
  removeFixture: (fixtureId: string) => void;
  addFurniture: (item: Omit<FurnitureItem, 'id'>) => string;
  updateFurniture: (
    furnitureId: string,
    patch: Partial<Omit<FurnitureItem, 'id'>>,
    options?: { recordHistory?: boolean }
  ) => void;
  moveFurniture: (
    furnitureId: string,
    x: number,
    z: number,
    options?: { recordHistory?: boolean }
  ) => void;
  moveSelectedFurniture: (
    furnitureIds: string[],
    dx: number,
    dz: number,
    options?: { recordHistory?: boolean }
  ) => void;
  rotateSelectedFurniture: (
    furnitureIds: string[],
    deltaDeg: number,
    options?: { recordHistory?: boolean }
  ) => void;
  removeFurniture: (furnitureId: string) => void;
  removeSelectedFurniture: (furnitureIds: string[]) => void;
  toggleFurnitureRealStatus: (id: string) => void;
  setFurnitureRealStatus: (
    id: string,
    isReal: boolean,
    brand?: string,
    modelName?: string
  ) => void;
  resetFurnitureToCatalogDimensions: (furnitureId: string) => void;
  addRug: (rug: Omit<AreaRug, 'id'>) => string;
  updateRug: (rugId: string, patch: Partial<Omit<AreaRug, 'id'>>) => void;
  moveRug: (
    rugId: string,
    x: number,
    z: number,
    options?: { recordHistory?: boolean }
  ) => void;
  removeRug: (rugId: string) => void;
  saveLayoutVariant: (name?: string) => string;
  switchLayoutVariant: (variantId: string) => void;
  setGhostVariantId: (variantId: string | null) => void;
  renameLayoutVariant: (variantId: string, name: string) => void;
  deleteLayoutVariant: (variantId: string) => void;
  loadPreset: (presetKey: string) => void;
  pushUndoSnapshot: () => void;
  setOverlayError: (message: string | null) => void;
  setBackgroundImage: (image: BackgroundImageOverlay | null) => void;
  updateBackgroundImage: (
    patch: Partial<Omit<BackgroundImageOverlay, 'id'>>,
    options?: { recordHistory?: boolean }
  ) => void;
  removeBackgroundImage: () => void;
  setShowPassageHeatmap: (show: boolean) => void;
  startCalibration: () => void;
  setCalibrationPoint: (pt: Point2D) => void;
  applyCalibration: (realDistanceCm: number) => void;
  cancelCalibration: () => void;
  exportJson: () => string;
  importJson: (jsonStr: string) => boolean;
  setLanguage: (lang: Language) => void;
}
