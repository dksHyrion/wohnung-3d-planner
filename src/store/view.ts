import { MOOD_PRESETS, presetToHour } from '../core/lighting/moodPresets';
import { setGlobalLanguage } from '../i18n/i18n';
import type { Language } from '../i18n/types';
import type { StoreDeps } from './deps';
import type { FloorplanState } from './state';

type ViewActions = Pick<
  FloorplanState,
  | 'setMeasurePoints'
  | 'clearMeasure'
  | 'clearAlignmentGuides'
  | 'setGridSizeCm'
  | 'setOrthoSnapEnabled'
  | 'setTimeOfDay'
  | 'setMoodPreset'
  | 'setQualityMode'
  | 'setGlowingWallCaps'
  | 'setCameraEyeLevelCm'
  | 'setShowDecor'
  | 'setShowKeyboardShortcuts'
  | 'toggleKeyboardShortcuts'
  | 'setAlignSunWithWindows'
  | 'setRoomLightsActive'
  | 'setViewMode'
  | 'setActiveTool'
  | 'setCutawayEnabled'
  | 'setSnapToWallEnabled'
  | 'setRenderTheme'
  | 'setShowDimensions3D'
  | 'setCameraPreset'
  | 'selectEntity'
  | 'selectRoom'
  | 'setLanguage'
>;

export function createViewActions(deps: StoreDeps): ViewActions {
  const { set } = deps;
  return {
  setMeasurePoints: (start, end) => set({ measureStart: start, measureEnd: end }),

  clearMeasure: () => set({ measureStart: null, measureEnd: null }),

  clearAlignmentGuides: () => set({ activeAlignmentGuides: [] }),

  setGridSizeCm: (size) => set({ gridSizeCm: Math.max(1, size) }),

  setOrthoSnapEnabled: (enabled) => set({ orthoSnapEnabled: enabled }),

  setTimeOfDay: (hour) => {
    if (!Number.isFinite(hour)) return;
    const clamped = Math.max(6.0, Math.min(22.0, hour));
    set({
      timeOfDay: clamped,
      activeMoodKey: 'custom',
    });
  },

  setMoodPreset: (preset) => {
    if (!preset || !(preset in MOOD_PRESETS)) return;
    set({
      activeMoodKey: preset,
      timeOfDay: presetToHour(preset),
    });
  },

  setQualityMode: (mode) => set({ qualityMode: mode }),

  setGlowingWallCaps: (enabled) => set({ glowingWallCaps: enabled }),

  setCameraEyeLevelCm: (heightCm) => {
    if (!Number.isFinite(heightCm)) return;
    const clamped = Math.round(Math.max(50, Math.min(250, heightCm)) * 10) / 10;
    set({ cameraEyeLevelCm: clamped });
  },

  setShowDecor: (show) => set({ showDecor: Boolean(show) }),

  setShowKeyboardShortcuts: (show) => set({ showKeyboardShortcuts: Boolean(show) }),

  toggleKeyboardShortcuts: () => set((s) => ({ showKeyboardShortcuts: !s.showKeyboardShortcuts })),

  setAlignSunWithWindows: (align) => set({ alignSunWithWindows: Boolean(align) }),

  setRoomLightsActive: (active) => set({ roomLightsActive: Boolean(active) }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setCutawayEnabled: (enabled) => set({ cutawayEnabled: enabled }),

  setSnapToWallEnabled: (enabled) => set({ snapToWallEnabled: enabled }),

  setRenderTheme: (theme) => set({ renderTheme: theme }),

  setShowDimensions3D: (show) => set({ showDimensions3D: show }),

  setCameraPreset: (preset) =>
    set((s) => ({
      cameraPreset: preset,
      cameraPresetNonce: s.cameraPresetNonce + 1,
    })),

  selectEntity: (id, type) =>
    set({
      selectedId: id,
      selectedType: id ? type : null,
      selectedRoomId: id && type === 'room' ? id : null,
    }),

  selectRoom: (roomId) =>
    set({
      selectedId: roomId,
      selectedType: roomId ? 'room' : null,
      selectedRoomId: roomId,
    }),

  setLanguage: (lang: Language) => {
    setGlobalLanguage(lang);
    set({ language: lang });
  },
  };
}
