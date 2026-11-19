import type { StoreDeps } from './deps';
import type { FloorplanState } from './state';
import { createFurnitureSlice, propagateAttachedChildren } from './slices/furnitureSlice';
import { createWallSlice } from './slices/wallSlice';
import { createRugSlice } from './slices/rugSlice';
import { createPresetSlice } from './slices/presetSlice';
import { createVariantSlice } from './slices/variantSlice';
import { createLevelSlice } from './slices/levelSlice';
import { createStairSlice } from './slices/stairSlice';

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
  | 'addLevel'
  | 'updateLevel'
  | 'removeLevel'
  | 'setActiveLevel'
  | 'setLevelViewMode'
  | 'setShowGhostBelow2D'
  | 'addStair'
  | 'updateStair'
  | 'moveStair'
  | 'removeStair'
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
    ...createLevelSlice(deps),
    ...createStairSlice(deps),
  };
}
