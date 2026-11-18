import * as THREE from 'three';
import type { WallFinishType, WallSideFinish } from '../types';
import {
  getMarbleQuartzTexture,
  getMicrocementBumpTexture,
  getMicrocementTexture,
  getStoneTileBumpTexture,
  getStoneTileTexture,
  getWoodSlatTexture,
} from './proceduralTextures';

export const WALL_FINISH_TYPES: readonly WallFinishType[] = [
  'plaster',
  'accent-paint',
  'wood-slats',
  'tile',
  'microcement',
  'marble',
] as const;

const VALID_FINISH_SET = new Set<string>(WALL_FINISH_TYPES);

export function isWallFinishType(value: unknown): value is WallFinishType {
  return typeof value === 'string' && VALID_FINISH_SET.has(value);
}

export function sanitizeWallSideFinish(
  raw: unknown
): WallSideFinish | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as { finish?: unknown; color?: unknown };
  if (!isWallFinishType(obj.finish) || obj.finish === 'plaster') {
    return undefined;
  }
  const color =
    typeof obj.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(obj.color.trim())
      ? obj.color.trim()
      : undefined;
  return color ? { finish: obj.finish, color } : { finish: obj.finish };
}

export interface WallSideMaterialProps {
  color: string;
  map: THREE.Texture | null;
  bumpMap: THREE.Texture | null;
  bumpScale: number;
  roughness: number;
  metalness: number;
}

const DEFAULT_PLASTER_COLOR = '#f1ece4';

/**
 * Resolves Three.js MeshStandardMaterial properties for a single wall side finish.
 * Reuses the cached procedural CanvasTextures without mutating their shared repeat settings.
 */
export function resolveWallSideFinishProps(
  sideFinish: WallSideFinish | undefined,
  isSelected = false,
  renderTheme: 'studio' | 'blueprint' = 'studio'
): WallSideMaterialProps {
  if (isSelected) {
    return {
      color: '#818cf8',
      map: null,
      bumpMap: null,
      bumpScale: 0,
      roughness: 0.82,
      metalness: 0.02,
    };
  }

  if (renderTheme === 'blueprint') {
    return {
      color: '#e2e8f0',
      map: null,
      bumpMap: null,
      bumpScale: 0,
      roughness: 0.82,
      metalness: 0.02,
    };
  }

  const finish = sideFinish?.finish ?? 'plaster';
  const customColor = sideFinish?.color;

  switch (finish) {
    case 'accent-paint':
      return {
        color: customColor ?? '#475569',
        map: null,
        bumpMap: null,
        bumpScale: 0,
        roughness: 0.84,
        metalness: 0.02,
      };
    case 'wood-slats':
      return {
        color: customColor ?? '#ffffff',
        map: getWoodSlatTexture(),
        bumpMap: null,
        bumpScale: 0,
        roughness: 0.72,
        metalness: 0.02,
      };
    case 'tile':
      return {
        color: customColor ?? '#ffffff',
        map: getStoneTileTexture(),
        bumpMap: getStoneTileBumpTexture(),
        bumpScale: 0.3,
        roughness: 0.42,
        metalness: 0.05,
      };
    case 'microcement':
      return {
        color: customColor ?? '#e2e8f0',
        map: getMicrocementTexture(),
        bumpMap: getMicrocementBumpTexture(),
        bumpScale: 0.12,
        roughness: 0.78,
        metalness: 0.03,
      };
    case 'marble':
      return {
        color: customColor ?? '#ffffff',
        map: getMarbleQuartzTexture(),
        bumpMap: null,
        bumpScale: 0,
        roughness: 0.25,
        metalness: 0.06,
      };
    case 'plaster':
    default:
      return {
        color: customColor ?? DEFAULT_PLASTER_COLOR,
        map: null,
        bumpMap: null,
        bumpScale: 0,
        roughness: 0.82,
        metalness: 0.02,
      };
  }
}
