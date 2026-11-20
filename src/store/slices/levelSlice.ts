import {
  DEFAULT_CEILING_HEIGHT_CM,
  DEFAULT_SLAB_THICKNESS_CM,
  getEntityLevelId,
  recomputeLevelElevations,
} from '../../core/levels';
import type { BuildingLevel, Corner, Wall } from '../../core/types';
import type { StoreDeps } from '../deps';
import type { FloorplanState } from '../state';

export type LevelActions = Pick<
  FloorplanState,
  | 'addLevel'
  | 'updateLevel'
  | 'removeLevel'
  | 'setActiveLevel'
  | 'setLevelViewMode'
  | 'setShowGhostBelow2D'
>;

export function createLevelSlice(deps: StoreDeps): LevelActions {
  const { get, set, setWithCollisions, generateId } = deps;

  return {
    addLevel: (options) => {
      const state = get();
      const direction = options?.direction ?? 'above';
      const indices = state.levels.map((l) => l.index);
      const nextIndex =
        direction === 'above'
          ? (indices.length > 0 ? Math.max(...indices) + 1 : 1)
          : (indices.length > 0 ? Math.min(...indices) - 1 : -1);

      const fallbackName =
        nextIndex > 0
          ? state.language === 'en'
            ? `Floor ${nextIndex}`
            : `${nextIndex}. Obergeschoss`
          : nextIndex < 0
          ? state.language === 'en'
            ? `Basement ${Math.abs(nextIndex)}`
            : `Untergeschoss ${Math.abs(nextIndex)}`
          : state.language === 'en'
          ? 'Ground Floor'
          : 'Erdgeschoss';

      const id = generateId('lvl');
      const newLevel: BuildingLevel = {
        id,
        name: options?.name?.trim() || fallbackName,
        index: nextIndex,
        elevationCm: 0,
        ceilingHeightCm: DEFAULT_CEILING_HEIGHT_CM,
        slabThicknessCm: DEFAULT_SLAB_THICKNESS_CM,
      };

      const nextLevels = recomputeLevelElevations([...state.levels, newLevel]);
      let nextCorners = state.corners;
      let nextWalls = state.walls;

      if (options?.copyFromLevelId) {
        const srcId = options.copyFromLevelId;
        const srcCorners = state.corners.filter(
          (c) => getEntityLevelId(c) === srcId
        );
        const cornerIdMap = new Map<string, string>();
        const clonedCorners: Corner[] = srcCorners.map((c) => {
          const newCornerId = generateId('c');
          cornerIdMap.set(c.id, newCornerId);
          return {
            id: newCornerId,
            x: c.x,
            z: c.z,
            levelId: id,
          };
        });
        const srcWalls = state.walls.filter((w) => getEntityLevelId(w) === srcId);
        const clonedWalls: Wall[] = srcWalls
          .filter(
            (w) =>
              cornerIdMap.has(w.startCornerId) && cornerIdMap.has(w.endCornerId)
          )
          .map((w) => ({
            ...w,
            id: generateId('w'),
            startCornerId: cornerIdMap.get(w.startCornerId)!,
            endCornerId: cornerIdMap.get(w.endCornerId)!,
            levelId: id,
          }));
        nextCorners = [...state.corners, ...clonedCorners];
        nextWalls = [...state.walls, ...clonedWalls];
      }

      setWithCollisions({
        levels: nextLevels,
        activeLevelId: id,
        corners: nextCorners,
        walls: nextWalls,
        selectedId: null,
        selectedIds: [],
        selectedType: null,
        selectedRoomId: null,
        activeAlignmentGuides: [],
      });

      return id;
    },

    updateLevel: (levelId, patch) => {
      const state = get();
      if (!state.levels.some((l) => l.id === levelId)) return;
      const updated = state.levels.map((l) => {
        if (l.id !== levelId) return l;
        return {
          ...l,
          name:
            patch.name !== undefined && patch.name.trim().length > 0
              ? patch.name.trim()
              : l.name,
          ceilingHeightCm:
            patch.ceilingHeightCm !== undefined && Number.isFinite(patch.ceilingHeightCm)
              ? Math.max(100, Math.min(600, patch.ceilingHeightCm))
              : l.ceilingHeightCm,
          slabThicknessCm:
            patch.slabThicknessCm !== undefined && Number.isFinite(patch.slabThicknessCm)
              ? Math.max(5, Math.min(100, patch.slabThicknessCm))
              : l.slabThicknessCm,
        };
      });
      setWithCollisions({
        levels: recomputeLevelElevations(updated),
      });
    },

    removeLevel: (levelId) => {
      const state = get();
      if (state.levels.length <= 1) return;
      if (!state.levels.some((l) => l.id === levelId)) return;

      const nextLevels = recomputeLevelElevations(
        state.levels.filter((l) => l.id !== levelId)
      );
      const nextActive =
        state.activeLevelId === levelId
          ? nextLevels[0].id
          : state.activeLevelId;

      const nextLayoutVariants = state.layoutVariants.map((variant) => ({
        ...variant,
        furniture: variant.furniture.filter((f) => getEntityLevelId(f) !== levelId),
        rugs: variant.rugs.filter((r) => getEntityLevelId(r) !== levelId),
      }));

      setWithCollisions({
        levels: nextLevels,
        activeLevelId: nextActive,
        corners: state.corners.filter((c) => getEntityLevelId(c) !== levelId),
        walls: state.walls.filter((w) => getEntityLevelId(w) !== levelId),
        openings: state.openings.filter((o) => getEntityLevelId(o) !== levelId),
        furniture: state.furniture.filter((f) => getEntityLevelId(f) !== levelId),
        rugs: state.rugs.filter((r) => getEntityLevelId(r) !== levelId),
        roomLabels: state.roomLabels.filter((rl) => getEntityLevelId(rl) !== levelId),
        roofSlopes: state.roofSlopes.filter((rs) => getEntityLevelId(rs) !== levelId),
        fixtures: state.fixtures.filter((fx) => getEntityLevelId(fx) !== levelId),
        stairs: state.stairs.filter(
          (st) => st.fromLevelId !== levelId && st.toLevelId !== levelId
        ),
        layoutVariants: nextLayoutVariants,
        selectedId: null,
        selectedIds: [],
        selectedType: null,
        selectedRoomId: null,
        activeAlignmentGuides: [],
      });
    },

    setActiveLevel: (levelId) => {
      const state = get();
      if (!state.levels.some((l) => l.id === levelId)) return;
      if (state.activeLevelId === levelId) return;
      setWithCollisions(
        {
          activeLevelId: levelId,
          selectedId: null,
          selectedIds: [],
          selectedType: null,
          selectedRoomId: null,
          activeAlignmentGuides: [],
        },
        false
      );
    },

    setLevelViewMode: (mode) => set({ levelViewMode: mode }),

    setShowGhostBelow2D: (show) => set({ showGhostBelow2D: Boolean(show) }),
  };
}
