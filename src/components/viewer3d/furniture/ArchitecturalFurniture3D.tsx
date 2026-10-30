import React from 'react';
import { Edges } from '@react-three/drei';
import { FurnitureCategory, FurnitureItem } from '../../../core/types';
import { resolveFurnitureVisual } from '../../../core/furnitureVisual';
import { FURNITURE_VISUAL_CATALOG } from '../../../core/furnitureVisualCatalog';
import { FURNITURE_MODELS } from './furnitureRegistry';
import type { FurnitureModelProps } from './SofaModel';

export type ArchitecturalModelType =
  | 'sofa'
  | 'bed'
  | 'dining-table'
  | 'kitchen-island'
  | 'kitchen-unit'
  | 'plant'
  | 'bathtub'
  | 'shower'
  | 'toilet'
  | 'washing-machine'
  | 'boconcept-osaka'
  | 'vitsoe-606'
  | 'artemide-tolomeo'
  | 'musterring-sorrent'
  | 'inwerk-masterlift'
  | 'steelcase-gesture'
  | 'desk-monitor'
  | 'regalraum-lium'
  | 'neona-viva'
  | 'wall-picture'
  | 'picture-rail'
  | 'generic';

export type GenericFurnitureSubType =
  | 'wardrobe'
  | 'desk'
  | 'coffee-table'
  | 'sideboard'
  | 'vanity'
  | 'table'
  | 'seating'
  | 'storage'
  | 'bed'
  | 'box';

/**
 * Resolves the detailed architectural sub-model for items classified as 'generic'
 * (wardrobes, office desks, coffee tables, sideboards, bathroom vanities, or generic parametric models).
 */
export function resolveGenericFurnitureSubType(
  item: FurnitureItem
): GenericFurnitureSubType {
  return FURNITURE_VISUAL_CATALOG[resolveFurnitureVisual(item)].genericSubType;
}

/**
 * Deterministically resolves the detailed 3D model component to render
 * based on resolveFurnitureVisual.
 */
export function resolveFurnitureModelType(item: FurnitureItem): ArchitecturalModelType {
  return FURNITURE_VISUAL_CATALOG[resolveFurnitureVisual(item)].modelType;
}

export const CATEGORY_DEFAULT_COLORS: Record<FurnitureCategory, string> = {
  living: '#64748b',
  bedroom: '#78716c',
  kitchen: '#475569',
  office: '#64748b',
  storage: '#94a3b8',
  bathroom: '#f8fafc',
  decor: '#a8a29e',
  custom: '#94a3b8',
};

export const LEGACY_SATURATED_COLORS = new Set([
  '#0284c7',
  '#0d9488',
  '#3b82f6',
  '#4f46e5',
  '#7c3aed',
  '#d97706',
  '#ea580c',
]);

/**
 * Sanitizes furniture colors by filtering out legacy saturated CAD/neon colors
 * in favor of curated architectural fallback tones.
 */
export function sanitizeFurnitureColor(
  color: string | undefined,
  fallback: string
): string {
  if (!color) return fallback;
  if (LEGACY_SATURATED_COLORS.has(color.toLowerCase())) {
    return fallback;
  }
  return color;
}

export const ArchitecturalFurniture3D: React.FC<FurnitureModelProps> = React.memo((props) => {
  const { item, hasCollision = false, isSelected = false } = props;
  const Model = FURNITURE_MODELS[resolveFurnitureVisual(item)];

  const edgeColor = hasCollision
    ? '#fca5a5'
    : isSelected
    ? '#38bdf8'
    : undefined;

  const content = <Model {...props} />;

  return (
    <group>
      {content}

      {/* Visual edge outline when colliding or selected */}
      {edgeColor && (
        <mesh>
          <boxGeometry args={[item.widthCm, item.heightCm, item.depthCm]} />
          <meshBasicMaterial visible={false} />
          <Edges scale={1.002} threshold={15} color={edgeColor} />
        </mesh>
      )}
    </group>
  );
});
