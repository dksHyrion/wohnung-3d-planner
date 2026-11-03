import type { StoreDeps } from './deps';
import type { FloorplanState } from './state';
import { createFurnitureSlice, propagateAttachedChildren } from './slices/furnitureSlice';
import { createWallSlice } from './slices/wallSlice';
import { createRugSlice } from './slices/rugSlice';
import { createPresetSlice } from './slices/presetSlice';

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
  return {
    ...createPresetSlice(deps),
    ...createWallSlice(deps),
    ...createFurnitureSlice(deps),
    ...createRugSlice(deps),
  };
}
