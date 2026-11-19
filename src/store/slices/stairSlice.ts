import type { Staircase } from '../../core/types';
import type { StoreDeps } from '../deps';
import type { FloorplanState } from '../state';

export type StairActions = Pick<
  FloorplanState,
  'addStair' | 'updateStair' | 'moveStair' | 'removeStair'
>;

export function createStairSlice(deps: StoreDeps): StairActions {
  const { get, setWithCollisions, generateId } = deps;

  return {
    addStair: (stair) => {
      const state = get();
      const fromLevelId = stair?.fromLevelId ?? state.activeLevelId;
      const fromLevel = state.levels.find((l) => l.id === fromLevelId);
      const nextAbove = fromLevel
        ? state.levels.find((l) => l.index === fromLevel.index + 1)
        : undefined;
      const toLevelId = stair?.toLevelId ?? nextAbove?.id ?? fromLevelId;

      const id = generateId('stair');
      const newStair: Staircase = {
        id,
        fromLevelId,
        toLevelId,
        type: stair?.type ?? 'straight',
        x: Number((Number.isFinite(stair?.x) ? stair!.x! : 200).toFixed(2)),
        z: Number((Number.isFinite(stair?.z) ? stair!.z! : 200).toFixed(2)),
        rotationYDeg: Number(
          ((((Number.isFinite(stair?.rotationYDeg) ? stair!.rotationYDeg! : 0) % 360) + 360) %
            360).toFixed(1)
        ),
        widthCm: Math.max(60, Number.isFinite(stair?.widthCm) ? stair!.widthCm! : 100),
        treadDepthCm: Math.max(
          18,
          Number.isFinite(stair?.treadDepthCm) ? stair!.treadDepthCm! : 27
        ),
        ...(stair?.riserCount !== undefined && Number.isFinite(stair.riserCount)
          ? { riserCount: Math.max(3, Math.round(stair.riserCount)) }
          : {}),
        ...(stair?.turnDirection ? { turnDirection: stair.turnDirection } : {}),
        ...(stair?.landingLengthCm !== undefined &&
        Number.isFinite(stair.landingLengthCm)
          ? { landingLengthCm: Math.max(60, stair.landingLengthCm) }
          : {}),
        hasRailing: stair?.hasRailing ?? true,
        ...(stair?.color ? { color: stair.color } : {}),
      };

      const stairs = [...state.stairs, newStair];
      setWithCollisions({
        stairs,
        selectedId: id,
        selectedType: 'stair',
      });
      return id;
    },

    updateStair: (stairId, patch) => {
      const state = get();
      if (!state.stairs.some((s) => s.id === stairId)) return;
      const stairs = state.stairs.map((s) => {
        if (s.id !== stairId) return s;
        return {
          ...s,
          ...patch,
          widthCm:
            patch.widthCm !== undefined && Number.isFinite(patch.widthCm)
              ? Math.max(60, patch.widthCm)
              : s.widthCm,
          treadDepthCm:
            patch.treadDepthCm !== undefined && Number.isFinite(patch.treadDepthCm)
              ? Math.max(18, patch.treadDepthCm)
              : s.treadDepthCm,
          riserCount:
            patch.riserCount !== undefined
              ? patch.riserCount && Number.isFinite(patch.riserCount)
                ? Math.max(3, Math.round(patch.riserCount))
                : undefined
              : s.riserCount,
          landingLengthCm:
            patch.landingLengthCm !== undefined && Number.isFinite(patch.landingLengthCm)
              ? Math.max(60, patch.landingLengthCm)
              : s.landingLengthCm,
          rotationYDeg:
            patch.rotationYDeg !== undefined && Number.isFinite(patch.rotationYDeg)
              ? Number(((((patch.rotationYDeg % 360) + 360) % 360)).toFixed(1))
              : s.rotationYDeg,
        };
      });
      setWithCollisions({ stairs });
    },

    moveStair: (stairId, x, z, options) => {
      const recordHistory = options?.recordHistory ?? true;
      const state = get();
      const stairs = state.stairs.map((s) => {
        if (s.id !== stairId) return s;
        return {
          ...s,
          x: Number(x.toFixed(2)),
          z: Number(z.toFixed(2)),
        };
      });
      setWithCollisions({ stairs }, recordHistory);
    },

    removeStair: (stairId) => {
      const state = get();
      const stairs = state.stairs.filter((s) => s.id !== stairId);
      const isSelected = state.selectedType === 'stair' && state.selectedId === stairId;
      setWithCollisions({
        stairs,
        ...(isSelected ? { selectedId: null, selectedType: null } : {}),
      });
    },
  };
}
