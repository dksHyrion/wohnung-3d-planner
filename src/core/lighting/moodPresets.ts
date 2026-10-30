import * as THREE from 'three';

export type MoodPresetKey = 'neutral' | 'morning' | 'noon' | 'golden_hour' | 'blue_hour' | 'night';
export type QualityMode = 'performance' | 'beauty';

export interface MoodConfig {
  key: MoodPresetKey | 'custom';
  name: string;
  hour: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  sunColor: string;
  sunIntensity: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  hemiIntensity: number;
  environmentIntensity: number;
  lampsActive: boolean;
  lampColor: string;
  lampEmissiveIntensity: number;
  lampBloomIntensity: number;
  windowLightColor: string;
  windowLightIntensity: number;
  backdropTheme: 'day' | 'golden' | 'dusk' | 'night';
  backdropOpacity: number;
  exposure: number;
  n8aoIntensity: number;
  vignetteDarkness: number;
  stageGradientTop: string;
  stageGradientBottom: string;
  plinthColor: string;
  wallCapGlowColor: string;
  wallCapGlowIntensity: number;
}

export const MOOD_PRESETS: Record<MoodPresetKey, MoodConfig> = {
  neutral: {
    key: 'neutral',
    name: 'Neutrales Tageslicht',
    hour: 12.0,
    sunElevationDeg: 65,
    sunAzimuthDeg: 180,
    sunColor: '#ffffff',
    sunIntensity: 2.2,
    hemiSkyColor: '#f1f5f9',
    hemiGroundColor: '#e2e8f0',
    hemiIntensity: 0.55,
    environmentIntensity: 0.7,
    lampsActive: false,
    lampColor: '#ffb870',
    lampEmissiveIntensity: 0,
    lampBloomIntensity: 0,
    windowLightColor: '#ffffff',
    windowLightIntensity: 2.5,
    backdropTheme: 'day',
    backdropOpacity: 0.8,
    exposure: 1.0,
    n8aoIntensity: 2.0,
    vignetteDarkness: 0.0,
    stageGradientTop: '#f1f5f9',
    stageGradientBottom: '#e2e8f0',
    plinthColor: '#cbd5e1',
    wallCapGlowColor: '#ffffff',
    wallCapGlowIntensity: 0.0,
  },
  morning: {
    key: 'morning',
    name: 'Morgen',
    hour: 8.0,
    sunElevationDeg: 18,
    sunAzimuthDeg: 110,
    sunColor: '#ffe2c0',
    sunIntensity: 2.8,
    hemiSkyColor: '#e0f0fe',
    hemiGroundColor: '#eae0d2',
    hemiIntensity: 0.45,
    environmentIntensity: 0.65,
    lampsActive: false,
    lampColor: '#ffb870',
    lampEmissiveIntensity: 0,
    lampBloomIntensity: 0.15,
    windowLightColor: '#dbeafe',
    windowLightIntensity: 2.5,
    backdropTheme: 'day',
    backdropOpacity: 0.85,
    exposure: 1.1,
    n8aoIntensity: 2.4,
    vignetteDarkness: 0.35,
    stageGradientTop: '#ede8e1',
    stageGradientBottom: '#d9d2c8',
    plinthColor: '#cfc6ba',
    wallCapGlowColor: '#ffe4b5',
    wallCapGlowIntensity: 0.2,
  },
  noon: {
    key: 'noon',
    name: 'Mittag',
    hour: 12.5,
    sunElevationDeg: 58,
    sunAzimuthDeg: 180,
    sunColor: '#fff8ee',
    sunIntensity: 3.6,
    hemiSkyColor: '#d4eafe',
    hemiGroundColor: '#ddd7ce',
    hemiIntensity: 0.55,
    environmentIntensity: 0.85,
    lampsActive: false,
    lampColor: '#ffb870',
    lampEmissiveIntensity: 0,
    lampBloomIntensity: 0.1,
    windowLightColor: '#e0f2fe',
    windowLightIntensity: 3.0,
    backdropTheme: 'day',
    backdropOpacity: 0.95,
    exposure: 1.05,
    n8aoIntensity: 2.2,
    vignetteDarkness: 0.32,
    stageGradientTop: '#eae5de',
    stageGradientBottom: '#d5cec4',
    plinthColor: '#cfc6ba',
    wallCapGlowColor: '#ffe4b5',
    wallCapGlowIntensity: 0.1,
  },
  golden_hour: {
    key: 'golden_hour',
    name: 'Golden Hour',
    hour: 18.0,
    sunElevationDeg: 22,
    sunAzimuthDeg: 245,
    sunColor: '#ffb070',
    sunIntensity: 3.8,
    hemiSkyColor: '#bfd4ea',
    hemiGroundColor: '#c8b8a2',
    hemiIntensity: 0.48,
    environmentIntensity: 0.6,
    lampsActive: true,
    lampColor: '#ffb870',
    lampEmissiveIntensity: 1.2,
    lampBloomIntensity: 0.45,
    windowLightColor: '#fed7aa',
    windowLightIntensity: 4.0,
    backdropTheme: 'golden',
    backdropOpacity: 0.9,
    exposure: 1.15,
    n8aoIntensity: 2.6,
    vignetteDarkness: 0.42,
    stageGradientTop: '#ede4d8',
    stageGradientBottom: '#d2c5b4',
    plinthColor: '#c9beaf',
    wallCapGlowColor: '#ffc078',
    wallCapGlowIntensity: 0.4,
  },
  blue_hour: {
    key: 'blue_hour',
    name: 'Blaue Stunde',
    hour: 20.5,
    sunElevationDeg: -2,
    sunAzimuthDeg: 285,
    sunColor: '#fdba74',
    sunIntensity: 0.0,
    hemiSkyColor: '#2c4375',
    hemiGroundColor: '#1f2433',
    hemiIntensity: 0.28,
    environmentIntensity: 0.25,
    lampsActive: true,
    lampColor: '#ffa852',
    lampEmissiveIntensity: 3.2,
    lampBloomIntensity: 0.75,
    windowLightColor: '#38bdf8',
    windowLightIntensity: 1.5,
    backdropTheme: 'dusk',
    backdropOpacity: 0.9,
    exposure: 1.2,
    n8aoIntensity: 2.8,
    vignetteDarkness: 0.48,
    stageGradientTop: '#242e42',
    stageGradientBottom: '#181f2c',
    plinthColor: '#2d3748',
    wallCapGlowColor: '#ffedd5',
    wallCapGlowIntensity: 0.8,
  },
  night: {
    key: 'night',
    name: 'Nacht',
    hour: 22.0,
    sunElevationDeg: -20,
    sunAzimuthDeg: 310,
    sunColor: '#f97316',
    sunIntensity: 0.0,
    hemiSkyColor: '#111827',
    hemiGroundColor: '#0f172a',
    hemiIntensity: 0.15,
    environmentIntensity: 0.12,
    lampsActive: true,
    lampColor: '#ffa852',
    lampEmissiveIntensity: 4.0,
    lampBloomIntensity: 0.85,
    windowLightColor: '#1e293b',
    windowLightIntensity: 0.5,
    backdropTheme: 'night',
    backdropOpacity: 0.95,
    exposure: 1.25,
    n8aoIntensity: 2.8,
    vignetteDarkness: 0.52,
    stageGradientTop: '#151922',
    stageGradientBottom: '#0d1117',
    plinthColor: '#1e2533',
    wallCapGlowColor: '#fed7aa',
    wallCapGlowIntensity: 1.0,
  },
};

const ORDERED_KEYS: MoodPresetKey[] = ['morning', 'noon', 'golden_hour', 'blue_hour', 'night'];

export function presetToHour(key: MoodPresetKey): number {
  return MOOD_PRESETS[key].hour;
}

export function hourToNearestPresetKey(rawHour: number): MoodPresetKey {
  const hour = Number.isFinite(rawHour) ? rawHour : 12.0;
  let closestKey = ORDERED_KEYS[0];
  let minDiff = Infinity;
  for (const k of ORDERED_KEYS) {
    const diff = Math.abs(MOOD_PRESETS[k].hour - hour);
    if (diff < minDiff) {
      minDiff = diff;
      closestKey = k;
    }
  }
  return closestKey;
}

const _scratchColor1 = new THREE.Color();
const _scratchColor2 = new THREE.Color();

function lerpColor(c1: string, c2: string, t: number): string {
  _scratchColor1.set(c1);
  _scratchColor2.set(c2);
  _scratchColor1.lerp(_scratchColor2, t);
  return '#' + _scratchColor1.getHexString();
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const moodCache = new Map<number, MoodConfig>();

/**
 * Clears the mood interpolation cache. Useful for tests or preset reload.
 */
export function clearMoodCache(): void {
  moodCache.clear();
}

function computeInterpolatedMood(hour: number): MoodConfig {
  if (hour <= MOOD_PRESETS.morning.hour) {
    if (Math.abs(hour - MOOD_PRESETS.morning.hour) < 0.001) {
      return { ...MOOD_PRESETS.morning, hour: MOOD_PRESETS.morning.hour };
    }
    const isMorningPreset = Math.abs(hour - MOOD_PRESETS.morning.hour) < 0.05;
    const t = Math.max(0, (hour - 6.0) / (MOOD_PRESETS.morning.hour - 6.0));
    return {
      ...MOOD_PRESETS.morning,
      hour,
      key: isMorningPreset ? 'morning' : 'custom',
      name: isMorningPreset ? MOOD_PRESETS.morning.name : `Individuell (${hour.toFixed(1)} Uhr)`,
      sunElevationDeg: lerp(5, MOOD_PRESETS.morning.sunElevationDeg, t),
      sunIntensity: lerp(1.2, MOOD_PRESETS.morning.sunIntensity, t),
    };
  }

  if (hour >= MOOD_PRESETS.night.hour) {
    return {
      ...MOOD_PRESETS.night,
      hour: 22.0,
    };
  }

  // Find two bounding presets
  let prevKey = ORDERED_KEYS[0];
  let nextKey = ORDERED_KEYS[1];

  for (let i = 0; i < ORDERED_KEYS.length - 1; i++) {
    const k1 = ORDERED_KEYS[i];
    const k2 = ORDERED_KEYS[i + 1];
    if (hour >= MOOD_PRESETS[k1].hour && hour <= MOOD_PRESETS[k2].hour) {
      prevKey = k1;
      nextKey = k2;
      break;
    }
  }

  const p1 = MOOD_PRESETS[prevKey];
  const p2 = MOOD_PRESETS[nextKey];

  if (Math.abs(hour - p1.hour) < 0.001) return { ...p1, hour: p1.hour };
  if (Math.abs(hour - p2.hour) < 0.001) return { ...p2, hour: p2.hour };

  const t = (hour - p1.hour) / (p2.hour - p1.hour);

  const lampsActive = hour >= 17.5;
  const lampEmissiveIntensity =
    hour < 16.0
      ? 0
      : hour < 18.0
        ? lerp(0, MOOD_PRESETS.golden_hour.lampEmissiveIntensity, (hour - 16.0) / (18.0 - 16.0))
        : lerp(p1.lampEmissiveIntensity, p2.lampEmissiveIntensity, t);

  return {
    key: 'custom',
    name: `Individuell (${hour.toFixed(1)} Uhr)`,
    hour,
    sunElevationDeg: lerp(p1.sunElevationDeg, p2.sunElevationDeg, t),
    sunAzimuthDeg: lerp(p1.sunAzimuthDeg, p2.sunAzimuthDeg, t),
    sunColor: lerpColor(p1.sunColor, p2.sunColor, t),
    sunIntensity: Math.max(0, lerp(p1.sunIntensity, p2.sunIntensity, t)),
    hemiSkyColor: lerpColor(p1.hemiSkyColor, p2.hemiSkyColor, t),
    hemiGroundColor: lerpColor(p1.hemiGroundColor, p2.hemiGroundColor, t),
    hemiIntensity: lerp(p1.hemiIntensity, p2.hemiIntensity, t),
    environmentIntensity: lerp(p1.environmentIntensity, p2.environmentIntensity, t),
    lampsActive,
    lampColor: lerpColor(p1.lampColor, p2.lampColor, t),
    lampEmissiveIntensity,
    lampBloomIntensity: lerp(p1.lampBloomIntensity, p2.lampBloomIntensity, t),
    windowLightColor: lerpColor(p1.windowLightColor, p2.windowLightColor, t),
    windowLightIntensity: lerp(p1.windowLightIntensity, p2.windowLightIntensity, t),
    backdropTheme: t > 0.5 ? p2.backdropTheme : p1.backdropTheme,
    backdropOpacity: lerp(p1.backdropOpacity, p2.backdropOpacity, t),
    exposure: lerp(p1.exposure, p2.exposure, t),
    n8aoIntensity: lerp(p1.n8aoIntensity, p2.n8aoIntensity, t),
    vignetteDarkness: lerp(p1.vignetteDarkness, p2.vignetteDarkness, t),
    stageGradientTop: lerpColor(p1.stageGradientTop, p2.stageGradientTop, t),
    stageGradientBottom: lerpColor(p1.stageGradientBottom, p2.stageGradientBottom, t),
    plinthColor: lerpColor(p1.plinthColor, p2.plinthColor, t),
    wallCapGlowColor: lerpColor(p1.wallCapGlowColor, p2.wallCapGlowColor, t),
    wallCapGlowIntensity: lerp(p1.wallCapGlowIntensity, p2.wallCapGlowIntensity, t),
  };
}

export function interpolateMood(rawHour: number): MoodConfig {
  const safeHour = Number.isFinite(rawHour) ? rawHour : 12.0;
  const hour = Math.max(6.0, Math.min(22.0, safeHour));
  const cacheKey = Math.round(hour * 1000) / 1000;
  const cached = moodCache.get(cacheKey);
  if (cached) return cached;

  const result = computeInterpolatedMood(hour);
  if (moodCache.size >= 128) {
    const firstKey = moodCache.keys().next().value;
    if (firstKey !== undefined) moodCache.delete(firstKey);
  }
  moodCache.set(cacheKey, result);
  return result;
}
