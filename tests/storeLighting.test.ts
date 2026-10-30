import { describe, it, expect, beforeEach } from 'vitest';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { MoodPresetKey } from '../src/core/lighting/moodPresets';

describe('useFloorplanStore Lighting & Quality State', () => {
  it('has initial default values matching morning light, Performance mode and glowing architectural wall caps', () => {
    const state = useFloorplanStore.getState();
    expect(state.timeOfDay).toBe(8.0);
    expect(state.activeMoodKey).toBe('morning');
    expect(state.qualityMode).toBe('performance');
    expect(state.glowingWallCaps).toBe(true);
  });

  describe('actions and mutations', () => {
    beforeEach(() => {
      // Reset store to known defaults
      useFloorplanStore.setState({
        timeOfDay: 12.5,
        activeMoodKey: 'noon',
        qualityMode: 'beauty',
        glowingWallCaps: false,
      });
    });

    it('updates timeOfDay and flags custom mood if off-preset, clamping between 6.0 and 22.0', () => {
      useFloorplanStore.getState().setTimeOfDay(14.5);
      expect(useFloorplanStore.getState().timeOfDay).toBe(14.5);
      expect(useFloorplanStore.getState().activeMoodKey).toBe('custom');

      // Test lower clamp
      useFloorplanStore.getState().setTimeOfDay(4.0);
      expect(useFloorplanStore.getState().timeOfDay).toBe(6.0);
      expect(useFloorplanStore.getState().activeMoodKey).toBe('custom');

      // Test upper clamp
      useFloorplanStore.getState().setTimeOfDay(25.0);
      expect(useFloorplanStore.getState().timeOfDay).toBe(22.0);
      expect(useFloorplanStore.getState().activeMoodKey).toBe('custom');
    });

    it('ignores non-finite inputs (NaN, Infinity, -Infinity) leaving timeOfDay unchanged', () => {
      useFloorplanStore.getState().setTimeOfDay(15.0);
      expect(useFloorplanStore.getState().timeOfDay).toBe(15.0);

      useFloorplanStore.getState().setTimeOfDay(NaN);
      expect(useFloorplanStore.getState().timeOfDay).toBe(15.0);

      useFloorplanStore.getState().setTimeOfDay(Infinity);
      expect(useFloorplanStore.getState().timeOfDay).toBe(15.0);

      useFloorplanStore.getState().setTimeOfDay(-Infinity);
      expect(useFloorplanStore.getState().timeOfDay).toBe(15.0);
    });

    it('sets mood preset by key and updates timeOfDay accordingly', () => {
      useFloorplanStore.getState().setMoodPreset('blue_hour');
      expect(useFloorplanStore.getState().activeMoodKey).toBe('blue_hour');
      expect(useFloorplanStore.getState().timeOfDay).toBe(20.5);

      useFloorplanStore.getState().setMoodPreset('noon');
      expect(useFloorplanStore.getState().activeMoodKey).toBe('noon');
      expect(useFloorplanStore.getState().timeOfDay).toBe(12.5);

      useFloorplanStore.getState().setMoodPreset('morning');
      expect(useFloorplanStore.getState().activeMoodKey).toBe('morning');
      expect(useFloorplanStore.getState().timeOfDay).toBe(8.0);

      useFloorplanStore.getState().setMoodPreset('night');
      expect(useFloorplanStore.getState().activeMoodKey).toBe('night');
      expect(useFloorplanStore.getState().timeOfDay).toBe(22.0);

      useFloorplanStore.getState().setMoodPreset('golden_hour');
      expect(useFloorplanStore.getState().activeMoodKey).toBe('golden_hour');
      expect(useFloorplanStore.getState().timeOfDay).toBe(18.0);
    });

    it('gracefully ignores invalid mood preset keys', () => {
      useFloorplanStore.getState().setMoodPreset('noon');
      expect(useFloorplanStore.getState().activeMoodKey).toBe('noon');
      expect(useFloorplanStore.getState().timeOfDay).toBe(12.5);

      // Attempt invalid preset key
      useFloorplanStore.getState().setMoodPreset('invalid_key' as MoodPresetKey);
      expect(useFloorplanStore.getState().activeMoodKey).toBe('noon');
      expect(useFloorplanStore.getState().timeOfDay).toBe(12.5);
    });

    it('toggles qualityMode between performance and beauty', () => {
      useFloorplanStore.getState().setQualityMode('performance');
      expect(useFloorplanStore.getState().qualityMode).toBe('performance');

      useFloorplanStore.getState().setQualityMode('beauty');
      expect(useFloorplanStore.getState().qualityMode).toBe('beauty');
    });

    it('toggles glowingWallCaps flag', () => {
      useFloorplanStore.getState().setGlowingWallCaps(false);
      expect(useFloorplanStore.getState().glowingWallCaps).toBe(false);

      useFloorplanStore.getState().setGlowingWallCaps(true);
      expect(useFloorplanStore.getState().glowingWallCaps).toBe(true);
    });
  });
});
