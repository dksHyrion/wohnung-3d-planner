import {
  evaluatePassageClearances,
  evaluateErgonomicsScorecard,
} from '../../core/ergonomicsEngine';
import { PRESET_FLOORPLANS } from '../../core/presets';
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
      const passageReport = enabled
        ? evaluatePassageClearances(state.furniture, state.walls, state.corners)
        : null;
      const ergonomicsScorecard = enabled
        ? evaluateErgonomicsScorecard(
            {
              corners: state.corners,
              walls: state.walls,
              openings: state.openings,
              furniture: state.furniture,
              roomLabels: state.roomLabels,
            },
            passageReport
          )
        : null;
      set({
        showPassageHeatmap: enabled,
        passageReport,
        ergonomicsScorecard,
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
        roofSlopes: cloned.roofSlopes ?? [],
        backgroundImage: cloned.backgroundImage ?? null,
        activeAlignmentGuides: [],
        selectedId: null,
        selectedType: null,
      });
    },
  };
}
