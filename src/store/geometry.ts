import type { StoreDeps } from './deps';
import type { FloorplanState } from './state';
import { createFurnitureSlice, propagateAttachedChildren } from './slices/furnitureSlice';
import { createWallSlice } from './slices/wallSlice';
import { createRugSlice } from './slices/rugSlice';
import { createPresetSlice } from './slices/presetSlice';
import { createVariantSlice } from './slices/variantSlice';

export type GeometryActions = Pick<
  FloorplanState,
  | 'setShowPassageHeatmap'
  | 'updateWallLengthCm'
  | 'updateWallProps'
  | 'addWallWithCorners'
  | 'splitWallAt'
  | 'removeWall'
  | 'moveCorner'
  | 'removeCorner'
  | 'updateRoom'
  | 'addOpening'
  | 'updateOpening'
  | 'removeOpening'
  | 'addRoofSlope'
  | 'updateRoofSlope'
  | 'removeRoofSlope'
  | 'addFixture'
  | 'updateFixture'
  | 'removeFixture'
  | 'addFurniture'
  | 'updateFurniture'
  | 'moveFurniture'
  | 'moveSelectedFurniture'
  | 'rotateSelectedFurniture'
  | 'removeFurniture'
  | 'removeSelectedFurniture'
  | 'toggleFurnitureRealStatus'
  | 'setFurnitureRealStatus'
  | 'resetFurnitureToCatalogDimensions'
  | 'addRug'
  | 'updateRug'
  | 'moveRug'
  | 'removeRug'
  | 'saveLayoutVariant'
  | 'switchLayoutVariant'
  | 'setGhostVariantId'
  | 'renameLayoutVariant'
  | 'deleteLayoutVariant'
  | 'loadPreset'
>;

export { propagateAttachedChildren };

export function createGeometryActions(deps: StoreDeps): GeometryActions {
  return {
    ...createPresetSlice(deps),
    ...createWallSlice(deps),
    ...createFurnitureSlice(deps),
    ...createRugSlice(deps),
    ...createVariantSlice(deps),
  };
}
