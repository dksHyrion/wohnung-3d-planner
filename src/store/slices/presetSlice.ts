import {
  evaluatePassageClearances,
  evaluateErgonomicsScorecard,
} from '../../core/ergonomicsEngine';
import { sharedErgonomicsWorkerClient } from '../../core/workers/ergonomicsWorkerClient';
import { PRESET_FLOORPLANS } from '../../core/presets';
import { DEFAULT_LEVEL_ID, normalizeLevels, scopeFloorplanToLevel } from '../../core/levels';
import type { StoreDeps } from '../deps';
import type { FloorplanState } from '../state';

export type PresetActions = Pick<
  FloorplanState,
  | 'loadPreset'
  | 'setShowPassageHeatmap'
>;

export function createPresetSlice(deps: StoreDeps): PresetActions {
  const { set, get, setWithCollisions, cloneFloorplanData } = deps;

  return {
    setShowPassageHeatmap: (show) => {
      const enabled = Boolean(show);
      const state = get();
      if (!enabled) {
        sharedErgonomicsWorkerClient.cancelPending();
        set({
          showPassageHeatmap: false,
          passageReport: null,
          ergonomicsScorecard: null,
          isComputingErgonomics: false,
        });
        return;
      }

      if (!sharedErgonomicsWorkerClient.isWorkerSupported()) {
        const planData = {
          corners: state.corners,
          walls: state.walls,
          openings: state.openings,
          furniture: state.furniture,
          roomLabels: state.roomLabels,
          levels: state.levels,
          stairs: state.stairs,
        };
        const scoped = scopeFloorplanToLevel(planData, state.activeLevelId);
        const passageReport = evaluatePassageClearances(
          scoped.furniture,
          scoped.walls,
          scoped.corners
        );
        const ergonomicsScorecard = evaluateErgonomicsScorecard(
          planData,
          passageReport,
          { levelId: state.activeLevelId }
        );
        set({
          showPassageHeatmap: true,
          passageReport,
          ergonomicsScorecard,
          isComputingErgonomics: false,
        });
        return;
      }

      set({
        showPassageHeatmap: true,
        isComputingErgonomics: true,
      });
      void sharedErgonomicsWorkerClient
        .evaluateErgonomicsAsync(
          {
            corners: state.corners,
            walls: state.walls,
            openings: state.openings,
            furniture: state.furniture,
            roomLabels: state.roomLabels,
            levels: state.levels,
            stairs: state.stairs,
          },
          { immediate: true }
        )
        .then((res) => {
          if (!res || !get().showPassageHeatmap) return;
          set({
            passageReport: res.passageReport,
            ergonomicsScorecard: res.ergonomicsScorecard,
            isComputingErgonomics: false,
          });
        });
    },

    loadPreset: (presetKey) => {
      const preset = PRESET_FLOORPLANS[presetKey];
      if (!preset) return;
      const cloned = cloneFloorplanData(preset.data);
      const levels = normalizeLevels(cloned.levels);
      const activeLevelId =
        levels.find((l) => l.index === 0)?.id ?? levels[0]?.id ?? DEFAULT_LEVEL_ID;
      setWithCollisions({
        corners: cloned.corners,
        walls: cloned.walls,
        openings: cloned.openings,
        furniture: cloned.furniture,
        rugs: cloned.rugs ?? [],
        roomLabels: cloned.roomLabels ?? [],
        roofSlopes: cloned.roofSlopes ?? [],
        fixtures: cloned.fixtures ?? [],
        levels,
        activeLevelId,
        stairs: cloned.stairs ?? [],
        layoutVariants: cloned.variants ?? [],
        activeVariantId: cloned.activeVariantId ?? null,
        ghostVariantId: null,
        backgroundImage: cloned.backgroundImage ?? null,
        activeAlignmentGuides: [],
        selectedId: null,
        selectedType: null,
      });
    },
  };
}
