import { evaluatePassageClearances } from '../core/ergonomicsEngine';
import { PRESET_FLOORPLANS } from '../core/presets';
import type { AreaRug } from '../core/types';
import type { StoreDeps } from './deps';
import {
  createFurnitureSlice,
  propagateAttachedChildren,
} from './slices/furnitureSlice';
import { createWallSlice } from './slices/wallSlice';
import type { FloorplanState } from './state';

export type GeometryActions = Pick<
  FloorplanState,
  | 'setShowPassageHeatmap'
  | 'updateWallLengthCm'
  | 'updateWallProps'
  | 'addWallWithCorners'
  | 'removeWall'
  | 'moveCorner'
  | 'removeCorner'
  | 'updateRoom'
  | 'addOpening'
  | 'updateOpening'
  | 'removeOpening'
  | 'addFurniture'
  | 'updateFurniture'
  | 'moveFurniture'
  | 'removeFurniture'
  | 'toggleFurnitureRealStatus'
  | 'setFurnitureRealStatus'
  | 'resetFurnitureToCatalogDimensions'
  | 'addRug'
  | 'updateRug'
  | 'moveRug'
  | 'removeRug'
  | 'loadPreset'
>;

export { propagateAttachedChildren };

export function createGeometryActions(deps: StoreDeps): GeometryActions {
  const { set, get, setWithCollisions, generateId, cloneFloorplanData } = deps;
  const furnitureActions = createFurnitureSlice(deps);
  const wallActions = createWallSlice(deps);

  return {
    ...furnitureActions,
    ...wallActions,
    setShowPassageHeatmap: (show) => {
      const enabled = Boolean(show);
      const state = get();
      set({
        showPassageHeatmap: enabled,
        passageReport: enabled
          ? evaluatePassageClearances(state.furniture, state.walls, state.corners)
          : null,
      });
    },

  addRug: (rug) => {
    const state = get();
    const newRug: AreaRug = {
      id: generateId('rug'),
      name: rug.name?.trim() || 'Teppich',
      widthCm: Math.max(20, Number.isFinite(rug.widthCm) ? rug.widthCm : 200),
      depthCm: Math.max(20, Number.isFinite(rug.depthCm) ? rug.depthCm : 160),
      x: Number((Number.isFinite(rug.x) ? rug.x : 200).toFixed(2)),
      z: Number((Number.isFinite(rug.z) ? rug.z : 200).toFixed(2)),
      rotationYDeg: Number(
        ((((Number.isFinite(rug.rotationYDeg) ? rug.rotationYDeg! : 0) % 360) + 360) %
          360).toFixed(1)
      ),
      color: rug.color ?? '#edece8',
    };
    const rugs = [...state.rugs, newRug];
    setWithCollisions({
      rugs,
      selectedId: newRug.id,
      selectedType: 'rug',
    });
    return newRug.id;
  },

  updateRug: (rugId, patch) => {
    const state = get();
    const existing = state.rugs.find((r) => r.id === rugId);
    if (!existing) return;
    const rugs = state.rugs.map((r) => {
      if (r.id !== rugId) return r;
      return {
        ...r,
        ...patch,
        name:
          patch.name !== undefined
            ? patch.name.trim() || 'Teppich'
            : r.name,
        widthCm:
          patch.widthCm !== undefined && Number.isFinite(patch.widthCm)
            ? Math.max(20, patch.widthCm)
            : r.widthCm,
        depthCm:
          patch.depthCm !== undefined && Number.isFinite(patch.depthCm)
            ? Math.max(20, patch.depthCm)
            : r.depthCm,
        x:
          patch.x !== undefined && Number.isFinite(patch.x)
            ? Number(patch.x.toFixed(2))
            : r.x,
        z:
          patch.z !== undefined && Number.isFinite(patch.z)
            ? Number(patch.z.toFixed(2))
            : r.z,
        rotationYDeg:
          patch.rotationYDeg !== undefined && Number.isFinite(patch.rotationYDeg)
            ? Number((((patch.rotationYDeg % 360) + 360) % 360).toFixed(1))
            : r.rotationYDeg,
      };
    });
    setWithCollisions({ rugs });
  },

  moveRug: (rugId, x, z, options) => {
    const recordHistory = options?.recordHistory ?? true;
    const state = get();
    if (!state.rugs.some((r) => r.id === rugId)) return;
    const rugs = state.rugs.map((r) =>
      r.id === rugId
        ? {
            ...r,
            x: Number(x.toFixed(2)),
            z: Number(z.toFixed(2)),
          }
        : r
    );
    setWithCollisions({ rugs }, recordHistory);
  },

  removeRug: (rugId) => {
    const state = get();
    if (!state.rugs.some((r) => r.id === rugId)) return;
    const rugs = state.rugs.filter((r) => r.id !== rugId);
    setWithCollisions({
      rugs,
      selectedId: state.selectedId === rugId ? null : state.selectedId,
      selectedType: state.selectedId === rugId ? null : state.selectedType,
    });
  },

  loadPreset: (presetKey) => {
    const preset = PRESET_FLOORPLANS[presetKey];
    if (!preset) return;
    const cloned = cloneFloorplanData(preset.data);
    setWithCollisions({
      corners: cloned.corners,
      walls: cloned.walls,
      openings: cloned.openings,
      furniture: cloned.furniture,
      rugs: cloned.rugs ?? [],
      roomLabels: cloned.roomLabels ?? [],
      backgroundImage: cloned.backgroundImage ?? null,
      activeAlignmentGuides: [],
      selectedId: null,
      selectedType: null,
    });
  },
  };
}
