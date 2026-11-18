import { computeFurnitureAlignment } from '../../core/alignmentMath';
import {
  computeGroupCentroidXZ,
  rotatePointAroundPivotXZ,
} from '../../core/groupTransformMath';
import type { AlignmentGuide, FurnitureItem } from '../../core/types';
import { findWallSnap } from '../../core/wallMath';
import type { StoreDeps } from '../deps';
import type { FloorplanState } from '../state';

export type FurnitureActions = Pick<
  FloorplanState,
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
>;

function expandAttachedDescendants(
  furniture: FurnitureItem[],
  seedIds: string[]
): Set<string> {
  const expanded = new Set<string>(seedIds);
  const queue = [...seedIds];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    for (const item of furniture) {
      if (item.attachedToId === parentId && !expanded.has(item.id)) {
        expanded.add(item.id);
        queue.push(item.id);
      }
    }
  }
  return expanded;
}

export function propagateAttachedChildren(
  beforeList: FurnitureItem[],
  afterList: FurnitureItem[],
  parentId: string
): FurnitureItem[] {
  let currentAfter = afterList;
  const queue = [parentId];
  const visited = new Set<string>([parentId]);

  while (queue.length > 0) {
    const currentParentId = queue.shift()!;
    const parentBefore = beforeList.find((f) => f.id === currentParentId);
    const parentAfter = currentAfter.find((f) => f.id === currentParentId);
    if (!parentBefore || !parentAfter) continue;

    const dx = parentAfter.x - parentBefore.x;
    const dz = parentAfter.z - parentBefore.z;
    const dRotDeg = parentAfter.rotationYDeg - parentBefore.rotationYDeg;
    const topBefore = parentBefore.elevationCm + parentBefore.heightCm;
    const topAfter = parentAfter.elevationCm + parentAfter.heightCm;
    const dTop = topAfter - topBefore;

    if (
      Math.abs(dx) < 1e-6 &&
      Math.abs(dz) < 1e-6 &&
      Math.abs(dRotDeg) < 1e-6 &&
      Math.abs(dTop) < 1e-6
    ) {
      continue;
    }

    const dRad = (dRotDeg * Math.PI) / 180;
    const cos = Math.cos(dRad);
    const sin = Math.sin(dRad);

    currentAfter = currentAfter.map((item) => {
      if (item.id === currentParentId || item.attachedToId !== currentParentId) {
        return item;
      }
      if (!visited.has(item.id)) {
        visited.add(item.id);
        queue.push(item.id);
      }
      const relX = item.x - parentBefore.x;
      const relZ = item.z - parentBefore.z;
      const rotRelX = relX * cos + relZ * sin;
      const rotRelZ = -relX * sin + relZ * cos;

      const newX = Number((parentAfter.x + rotRelX).toFixed(2));
      const newZ = Number((parentAfter.z + rotRelZ).toFixed(2));
      const newRot = Number(
        ((((item.rotationYDeg + dRotDeg) % 360) + 360) % 360).toFixed(1)
      );
      const newElevation = Math.max(
        0,
        Number((item.elevationCm + dTop).toFixed(2))
      );

      return {
        ...item,
        x: newX,
        z: newZ,
        rotationYDeg: newRot,
        elevationCm: newElevation,
      };
    });
  }

  return currentAfter;
}

export function createFurnitureSlice(deps: StoreDeps): FurnitureActions {
  const { setWithCollisions, get, generateId } = deps;

  return {
    addFurniture: (item) => {
      const state = get();
      const newFurniture: FurnitureItem = {
        ...item,
        id: generateId('f'),
        widthCm: Math.max(1, item.widthCm),
        heightCm: Math.max(1, item.heightCm),
        depthCm: Math.max(1, item.depthCm),
        elevationCm: Math.max(0, item.elevationCm),
        isRealFurniture: item.isRealFurniture ?? false,
        brand: item.brand,
        modelName: item.modelName,
        articleNumber: item.articleNumber,
        notes: item.notes,
        visual: item.visual,
        catalogWidthCm: item.catalogWidthCm,
        catalogHeightCm: item.catalogHeightCm,
        catalogDepthCm: item.catalogDepthCm,
        clearanceZoneCm: item.clearanceZoneCm,
        hasNightstands: item.hasNightstands,
        attachedToId: item.attachedToId,
        customModelId: item.customModelId,
        customModelFilename: item.customModelFilename,
      };

      const furniture = [...state.furniture, newFurniture];
      setWithCollisions({
        furniture,
        selectedId: newFurniture.id,
        selectedIds: [newFurniture.id],
        selectedType: 'furniture',
      });

      return newFurniture.id;
    },

    updateFurniture: (furnitureId, patch, options) => {
      const recordHistory = options?.recordHistory ?? true;
      const state = get();
      const updatedList = state.furniture.map((f) => {
        if (f.id !== furnitureId) return f;
        let nextElevation =
          patch.elevationCm !== undefined
            ? Math.max(0, patch.elevationCm)
            : f.elevationCm;

        if (
          patch.attachedToId !== undefined &&
          patch.attachedToId !== null &&
          patch.attachedToId !== f.attachedToId &&
          patch.elevationCm === undefined
        ) {
          const parent = state.furniture.find((p) => p.id === patch.attachedToId);
          if (parent) {
            nextElevation = Number((parent.elevationCm + parent.heightCm).toFixed(2));
          }
        }

        const updated: FurnitureItem = {
          ...f,
          ...patch,
          widthCm:
            patch.widthCm !== undefined ? Math.max(1, patch.widthCm) : f.widthCm,
          heightCm:
            patch.heightCm !== undefined
              ? Math.max(1, patch.heightCm)
              : f.heightCm,
          depthCm:
            patch.depthCm !== undefined ? Math.max(1, patch.depthCm) : f.depthCm,
          elevationCm: nextElevation,
        };

        if (
          (patch.x !== undefined ||
            patch.z !== undefined ||
            patch.rotationYDeg !== undefined) &&
          patch.snappedWallId === undefined
        ) {
          if (
            patch.rotationYDeg === undefined &&
            state.snapToWallEnabled &&
            !updated.attachedToId
          ) {
            const snap = findWallSnap(updated, state.corners, state.walls);
            updated.snappedWallId = snap ? snap.snappedWallId : null;
          } else {
            updated.snappedWallId = null;
          }
        }

        return updated;
      });

      const furniture = propagateAttachedChildren(
        state.furniture,
        updatedList,
        furnitureId
      );

      setWithCollisions({ furniture }, recordHistory);
    },

    moveFurniture: (furnitureId, x, z, options) => {
      const recordHistory = options?.recordHistory ?? true;
      const state = get();
      let nextGuides: AlignmentGuide[] = [];
      const movedList = state.furniture.map((f) => {
        if (f.id !== furnitureId) return f;
        const candidate: FurnitureItem = {
          ...f,
          x: Number(x.toFixed(2)),
          z: Number(z.toFixed(2)),
        };

        if (state.snapToWallEnabled && !f.attachedToId) {
          const snap = findWallSnap(candidate, state.corners, state.walls);
          const wallSnapped: FurnitureItem = snap
            ? {
                ...candidate,
                x: snap.x,
                z: snap.z,
                rotationYDeg: snap.rotationYDeg,
                snappedWallId: snap.snappedWallId,
              }
            : {
                ...candidate,
                snappedWallId: null,
              };

          const align = computeFurnitureAlignment(
            wallSnapped,
            state.furniture,
            state.corners,
            state.walls
          );
          nextGuides = align.guides;
          return {
            ...wallSnapped,
            x: align.x,
            z: align.z,
          };
        }

        return {
          ...candidate,
          snappedWallId: null,
        };
      });

      const furniture = propagateAttachedChildren(
        state.furniture,
        movedList,
        furnitureId
      );

      setWithCollisions(
        { furniture, activeAlignmentGuides: nextGuides },
        recordHistory
      );
    },

    moveSelectedFurniture: (furnitureIds, dx, dz, options) => {
      const recordHistory = options?.recordHistory ?? true;
      if (furnitureIds.length === 0) return;
      if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return;
      const state = get();
      const moveSet = expandAttachedDescendants(state.furniture, furnitureIds);
      const furniture = state.furniture.map((f) => {
        if (!moveSet.has(f.id)) return f;
        return {
          ...f,
          x: Number((f.x + dx).toFixed(2)),
          z: Number((f.z + dz).toFixed(2)),
          snappedWallId: null,
        };
      });
      setWithCollisions({ furniture, activeAlignmentGuides: [] }, recordHistory);
    },

    rotateSelectedFurniture: (furnitureIds, deltaDeg, options) => {
      const recordHistory = options?.recordHistory ?? true;
      if (furnitureIds.length === 0 || Math.abs(deltaDeg) < 1e-6) return;
      const state = get();
      const idSet = new Set(furnitureIds);
      const primaryItems = state.furniture.filter((f) => idSet.has(f.id));
      if (primaryItems.length === 0) return;

      const pivot = computeGroupCentroidXZ(primaryItems);
      const rotateSet = expandAttachedDescendants(state.furniture, furnitureIds);

      const furniture = state.furniture.map((f) => {
        if (!rotateSet.has(f.id)) return f;
        const nextPos = rotatePointAroundPivotXZ(
          f.x,
          f.z,
          pivot.x,
          pivot.z,
          deltaDeg
        );
        const nextRot = Number(
          ((((f.rotationYDeg + deltaDeg) % 360) + 360) % 360).toFixed(1)
        );
        return {
          ...f,
          x: nextPos.x,
          z: nextPos.z,
          rotationYDeg: nextRot,
          snappedWallId: null,
        };
      });

      setWithCollisions({ furniture, activeAlignmentGuides: [] }, recordHistory);
    },

    removeFurniture: (furnitureId) => {
      const state = get();
      const furniture = state.furniture
        .filter((f) => f.id !== furnitureId)
        .map((f) =>
          f.attachedToId === furnitureId ? { ...f, attachedToId: null } : f
        );
      const nextIds =
        state.selectedType === 'furniture'
          ? state.selectedIds.filter((id) => id !== furnitureId)
          : state.selectedIds;
      const nextPrimary =
        state.selectedType === 'furniture'
          ? state.selectedId === furnitureId
            ? nextIds[0] ?? null
            : state.selectedId
          : state.selectedId;
      setWithCollisions({
        furniture,
        selectedIds: nextIds,
        selectedId: nextPrimary,
        selectedType:
          state.selectedType === 'furniture' && nextIds.length === 0
            ? null
            : state.selectedType,
      });
    },

    removeSelectedFurniture: (furnitureIds) => {
      if (furnitureIds.length === 0) return;
      const state = get();
      const removeSet = new Set(furnitureIds);
      const furniture = state.furniture
        .filter((f) => !removeSet.has(f.id))
        .map((f) =>
          f.attachedToId && removeSet.has(f.attachedToId)
            ? { ...f, attachedToId: null }
            : f
        );
      setWithCollisions({
        furniture,
        selectedId: null,
        selectedIds: [],
        selectedType: null,
        activeAlignmentGuides: [],
      });
    },

    toggleFurnitureRealStatus: (id) => {
      const state = get();
      const target = state.furniture.find((f) => f.id === id);
      if (!target) return;
      const isReal = !target.isRealFurniture;
      const furniture = state.furniture.map((f) => {
        if (f.id !== id) return f;
        return {
          ...f,
          isRealFurniture: isReal,
        };
      });
      setWithCollisions({ furniture }, true);
    },

    setFurnitureRealStatus: (id, isReal, brand, modelName) => {
      const state = get();
      const target = state.furniture.find((f) => f.id === id);
      if (!target) return;
      const furniture = state.furniture.map((f) => {
        if (f.id !== id) return f;
        return {
          ...f,
          isRealFurniture: isReal,
          brand: brand !== undefined ? brand : f.brand,
          modelName: modelName !== undefined ? modelName : f.modelName,
        };
      });
      setWithCollisions({ furniture }, true);
    },

    resetFurnitureToCatalogDimensions: (furnitureId: string) => {
      const state = get();
      const target = state.furniture.find((f) => f.id === furnitureId);
      if (!target) return;
      if (
        target.catalogWidthCm === undefined &&
        target.catalogHeightCm === undefined &&
        target.catalogDepthCm === undefined
      ) {
        return;
      }
      const furniture = state.furniture.map((f) => {
        if (f.id !== furnitureId) return f;
        return {
          ...f,
          widthCm:
            f.catalogWidthCm !== undefined
              ? Math.max(1, f.catalogWidthCm)
              : f.widthCm,
          heightCm:
            f.catalogHeightCm !== undefined
              ? Math.max(1, f.catalogHeightCm)
              : f.heightCm,
          depthCm:
            f.catalogDepthCm !== undefined
              ? Math.max(1, f.catalogDepthCm)
              : f.depthCm,
        };
      });
      setWithCollisions({ furniture });
    },
  };
}
