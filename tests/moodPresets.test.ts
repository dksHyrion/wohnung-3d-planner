import { describe, it, expect } from 'vitest';
import {
  MOOD_PRESETS,
  presetToHour,
  hourToNearestPresetKey,
  interpolateMood,
  MoodPresetKey,
} from '../src/core/lighting/moodPresets';

describe('moodPresets Core Math & Interpolation', () => {
  it('defines 5 architectural mood presets with expected hours', () => {
    const keys: MoodPresetKey[] = ['morning', 'noon', 'golden_hour', 'blue_hour', 'night'];
    keys.forEach((key) => {
      expect(MOOD_PRESETS[key]).toBeDefined();
      expect(MOOD_PRESETS[key].key).toBe(key);
      expect(typeof MOOD_PRESETS[key].sunElevationDeg).toBe('number');
      expect(typeof MOOD_PRESETS[key].sunColor).toBe('string');
      expect(typeof MOOD_PRESETS[key].lampsActive).toBe('boolean');
    });

    expect(presetToHour('morning')).toBe(8.0);
    expect(presetToHour('noon')).toBe(12.5);
    expect(presetToHour('golden_hour')).toBe(18.0);
    expect(presetToHour('blue_hour')).toBe(20.5);
    expect(presetToHour('night')).toBe(22.0);
  });

  it('maps hours to nearest preset key', () => {
    expect(hourToNearestPresetKey(7.5)).toBe('morning');
    expect(hourToNearestPresetKey(13.0)).toBe('noon');
    expect(hourToNearestPresetKey(18.2)).toBe('golden_hour');
    expect(hourToNearestPresetKey(20.4)).toBe('blue_hour');
    expect(hourToNearestPresetKey(22.0)).toBe('night');
  });

  it('returns exact preset values when queried at each of the 5 preset hours', () => {
    const keys: MoodPresetKey[] = ['morning', 'noon', 'golden_hour', 'blue_hour', 'night'];
    for (const key of keys) {
      const expected = MOOD_PRESETS[key];
      const actual = interpolateMood(expected.hour);
      expect(actual.key).toBe(key);
      expect(actual.name).toBe(expected.name);
      expect(actual.hour).toBe(expected.hour);
      expect(actual.sunElevationDeg).toBeCloseTo(expected.sunElevationDeg, 2);
      expect(actual.sunIntensity).toBeCloseTo(expected.sunIntensity, 2);
      expect(actual.sunColor.toLowerCase()).toBe(expected.sunColor.toLowerCase());
      expect(actual.lampsActive).toBe(expected.lampsActive);
      expect(actual.lampEmissiveIntensity).toBeCloseTo(expected.lampEmissiveIntensity, 2);
      expect(actual.lampBloomIntensity).toBeCloseTo(expected.lampBloomIntensity, 2);
    }
  });

  it('smoothly interpolates sun elevation, intensity and colors between noon and golden hour', () => {
    const mid = interpolateMood(15.25); // exactly halfway between 12.5 and 18.0
    const noon = MOOD_PRESETS.noon;
    const golden = MOOD_PRESETS.golden_hour;

    expect(mid.sunElevationDeg).toBeLessThan(noon.sunElevationDeg);
    expect(mid.sunElevationDeg).toBeGreaterThan(golden.sunElevationDeg);
    expect(mid.sunElevationDeg).toBeCloseTo((noon.sunElevationDeg + golden.sunElevationDeg) / 2, 1);
  });

  it('activates interior practical lamps from 17.5 hours and maintains smooth intensity', () => {
    const day = interpolateMood(14.0);
    expect(day.lampsActive).toBe(false);
    expect(day.lampEmissiveIntensity).toBe(0);

    const earlyEvening = interpolateMood(17.0);
    expect(earlyEvening.lampsActive).toBe(false);
    expect(earlyEvening.lampEmissiveIntensity).toBeGreaterThan(0);
    expect(earlyEvening.lampEmissiveIntensity).toBeLessThan(MOOD_PRESETS.golden_hour.lampEmissiveIntensity);

    const sunset = interpolateMood(17.5);
    expect(sunset.lampsActive).toBe(true);
    expect(sunset.lampEmissiveIntensity).toBeGreaterThan(0.5);

    const dusk = interpolateMood(20.5);
    expect(dusk.lampsActive).toBe(true);
    expect(dusk.lampEmissiveIntensity).toBeGreaterThan(1.0);

    const night = interpolateMood(22.0);
    expect(night.lampsActive).toBe(true);
    expect(night.lampBloomIntensity).toBeGreaterThanOrEqual(0.6);
  });

  it('maintains monotonic lamp intensity growth from 16.0h to 22.0h without sudden drops or popping', () => {
    let prevIntensity = -1;
    // Sample densely every 6 minutes (0.1h)
    for (let h = 16.0; h <= 22.001; h += 0.1) {
      const mood = interpolateMood(h);
      expect(mood.lampEmissiveIntensity).toBeGreaterThanOrEqual(prevIntensity - 1e-6);
      if (h < 17.5) {
        expect(mood.lampsActive).toBe(false);
      } else {
        expect(mood.lampsActive).toBe(true);
      }
      prevIntensity = mood.lampEmissiveIntensity;
    }
  });

  it('assigns custom name for non-preset morning hours (6.0h - 7.9h)', () => {
    const earlyMorning = interpolateMood(6.0);
    expect(earlyMorning.key).toBe('custom');
    expect(earlyMorning.name).toBe('Individuell (6.0 Uhr)');

    const customMorning = interpolateMood(7.0);
    expect(customMorning.key).toBe('custom');
    expect(customMorning.name).toBe('Individuell (7.0 Uhr)');

    const nearPreset = interpolateMood(7.98);
    expect(nearPreset.key).toBe('morning');
    expect(nearPreset.name).toBe('Morgen');
  });

  it('gracefully handles non-finite or NaN hour inputs by falling back to 12.0', () => {
    const nanMood = interpolateMood(NaN);
    expect(nanMood.hour).toBe(12.0);

    const infMood = interpolateMood(Infinity);
    expect(infMood.hour).toBe(12.0);

    expect(hourToNearestPresetKey(NaN)).toBe('noon');
  });

  it('clamps gracefully for hours outside 6.0 - 22.0 range', () => {
    const early = interpolateMood(5.0);
    expect(early.hour).toBe(6.0);
    const late = interpolateMood(23.5);
    expect(late.hour).toBe(22.0);
  });
});
