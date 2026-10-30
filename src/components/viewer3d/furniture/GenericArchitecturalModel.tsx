import React from 'react';
import { RoundedBox } from '@react-three/drei';
import { FurnitureItem } from '../../../core/types';
import {
  CATEGORY_DEFAULT_COLORS,
  sanitizeFurnitureColor,
} from './ArchitecturalFurniture3D';

export type GenericModelSubType = 'table' | 'seating' | 'storage' | 'bed' | 'box';

export interface GenericArchitecturalModelProps {
  item: FurnitureItem;
  subType?: GenericModelSubType;
  hasCollision?: boolean;
  isSelected?: boolean;
}

const clamp = (min: number, val: number, max: number): number => {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.max(lo, Math.min(hi, val));
};

/**
 * Resolves the generic architectural subType from explicit prop, visual type, or item category.
 */
export function resolveGenericArchitecturalSubType(
  item: FurnitureItem,
  subType?: GenericModelSubType
): GenericModelSubType {
  if (subType) {
    return subType;
  }

  if (item.visual) {
    switch (item.visual) {
      case 'generic-table':
        return 'table';
      case 'generic-seating':
        return 'seating';
      case 'generic-storage':
        return 'storage';
      case 'generic-bed':
        return 'bed';
      case 'box':
        return 'box';
      case 'dining-table':
      case 'coffee-table':
      case 'desk':
        return 'table';
      case 'sofa':
      case 'sectional-sofa':
        return 'seating';
      case 'wardrobe':
      case 'bookcase':
      case 'sideboard':
        return 'storage';
      case 'bed':
        return 'bed';
    }
  }

  switch (item.category) {
    case 'bedroom':
      return 'bed';
    case 'office':
      return 'table';
    case 'storage':
    case 'kitchen':
    case 'bathroom':
      return 'storage';
    case 'living':
      return item.heightCm <= 60 ? 'table' : 'seating';
    default:
      return 'box';
  }
}

/**
 * GenericArchitecturalModel
 * Parametric architectural approximation for generic furniture pieces (Entscheidung 6.1).
 * Replaces monolithic boxes with clean, proportionate architectural geometries
 * without unwanted visual clutter (zero fruit, zero monitors, zero random decor).
 */
export const GenericArchitecturalModel: React.FC<GenericArchitecturalModelProps> = React.memo(({
  item,
  subType,
  hasCollision = false,
}) => {
  const { widthCm: width, heightCm: height, depthCm: depth } = item;
  const effectiveSubType = resolveGenericArchitecturalSubType(item, subType);

  const fallbackColor = CATEGORY_DEFAULT_COLORS[item.category] || '#94a3b8';
  const displayColor = hasCollision
    ? '#ef4444'
    : sanitizeFurnitureColor(item.color, fallbackColor);

  const plinthColor = hasCollision ? '#dc2626' : '#1e293b';
  const mattressColor = hasCollision ? '#ef4444' : '#f8fafc';
  const legColor = hasCollision ? '#dc2626' : displayColor;

  return (
    <group name="generic-architectural-model">
      {effectiveSubType === 'table' && (
        <group name="generic-table-ensemble">
          {/* Tabletop at top */}
          {(() => {
            const topThickness = clamp(2.5, height * 0.06, 5);
            const legThickness = clamp(3, width * 0.04, 7);
            const legHeight = Math.max(1, height - topThickness);
            const insetX = width / 2 - legThickness / 2 - clamp(1, width * 0.03, 4);
            const insetZ = depth / 2 - legThickness / 2 - clamp(1, depth * 0.03, 4);

            return (
              <>
                <RoundedBox
                  name="generic-tabletop"
                  args={[width, topThickness, depth]}
                  radius={clamp(0.4, topThickness * 0.25, 1.2)}
                  smoothness={3}
                  position={[0, height / 2 - topThickness / 2, 0]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={displayColor}
                    roughness={0.45}
                    metalness={0.05}
                  />
                </RoundedBox>

                {/* 4 Corner Legs */}
                {[
                  [-insetX, -insetZ],
                  [insetX, -insetZ],
                  [-insetX, insetZ],
                  [insetX, insetZ],
                ].map(([lx, lz], i) => (
                  <RoundedBox
                    key={`table-leg-${i}`}
                    name="generic-table-leg"
                    args={[legThickness, legHeight, legThickness]}
                    radius={clamp(0.4, legThickness * 0.15, 0.8)}
                    smoothness={2}
                    position={[lx, -height / 2 + legHeight / 2, lz]}
                    castShadow
                    receiveShadow
                  >
                    <meshStandardMaterial
                      color={legColor}
                      roughness={0.5}
                      metalness={0.06}
                    />
                  </RoundedBox>
                ))}
              </>
            );
          })()}
        </group>
      )}

      {effectiveSubType === 'seating' && (
        <group name="generic-seating-ensemble">
          {(() => {
            const plinthH = clamp(3, height * 0.08, 8);
            const seatTargetH = clamp(35, height * 0.55, Math.min(50, height - 12));
            const cushionThickness = clamp(8, seatTargetH - plinthH, 18);
            const seatBaseH = Math.max(0, seatTargetH - plinthH - cushionThickness);

            const rawArmrestW = clamp(10, width * 0.12, 20);
            const armrestW = Math.min(rawArmrestW, Math.max(6, (width - 20) / 2));

            const rawBackrestD = clamp(12, depth * 0.2, 22);
            const backrestD = Math.min(rawBackrestD, Math.max(8, depth - 20));

            const seatW = Math.max(10, width - armrestW * 2);
            const seatD = Math.max(10, depth - backrestD);
            const seatZ = -depth / 2 + backrestD + seatD / 2;

            const backrestH = Math.max(10, height - seatTargetH);
            const armrestH = clamp(seatTargetH + 4, height * 0.75, height - 1);
            const armrestD = Math.max(10, depth - backrestD);
            const armrestZ = -depth / 2 + backrestD + armrestD / 2;

            return (
              <>
                {/* Plinth / Base at bottom */}
                <RoundedBox
                  name="generic-seating-plinth"
                  args={[Math.max(10, width * 0.94), plinthH, Math.max(10, depth * 0.92)]}
                  radius={clamp(0.4, plinthH * 0.2, 1.2)}
                  smoothness={2}
                  position={[0, -height / 2 + plinthH / 2, 0]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={plinthColor}
                    roughness={0.7}
                    metalness={0.1}
                  />
                </RoundedBox>

                {/* Sub-seat carcass base (eliminates floating air gap under seat) */}
                {seatBaseH > 0 && (
                  <RoundedBox
                    name="generic-seating-base"
                    args={[seatW, seatBaseH, seatD]}
                    radius={clamp(0.4, seatBaseH * 0.1, 1.5)}
                    smoothness={2}
                    position={[0, -height / 2 + plinthH + seatBaseH / 2, seatZ]}
                    castShadow
                    receiveShadow
                  >
                    <meshStandardMaterial
                      color={displayColor}
                      roughness={0.65}
                      metalness={0.03}
                    />
                  </RoundedBox>
                )}

                {/* Seat Cushion */}
                <RoundedBox
                  name="generic-seating-seat"
                  args={[seatW, cushionThickness, seatD]}
                  radius={clamp(1.2, cushionThickness * 0.22, 2.5)}
                  smoothness={3}
                  position={[0, -height / 2 + seatTargetH - cushionThickness / 2, seatZ]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={displayColor}
                    roughness={0.7}
                    metalness={0.02}
                  />
                </RoundedBox>

                {/* Backrest at negative Z */}
                <RoundedBox
                  name="generic-seating-backrest"
                  args={[width, backrestH, backrestD]}
                  radius={clamp(1.5, backrestD * 0.18, 3.0)}
                  smoothness={3}
                  position={[
                    0,
                    height / 2 - backrestH / 2,
                    -depth / 2 + backrestD / 2,
                  ]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={displayColor}
                    roughness={0.68}
                    metalness={0.02}
                  />
                </RoundedBox>

                {/* Left Armrest (in front of backrest to prevent Z-fighting) */}
                <RoundedBox
                  name="generic-seating-armrest-left"
                  args={[armrestW, armrestH, armrestD]}
                  radius={clamp(1.0, armrestW * 0.15, 2.5)}
                  smoothness={3}
                  position={[
                    -width / 2 + armrestW / 2,
                    -height / 2 + armrestH / 2,
                    armrestZ,
                  ]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={displayColor}
                    roughness={0.65}
                    metalness={0.02}
                  />
                </RoundedBox>

                {/* Right Armrest (in front of backrest to prevent Z-fighting) */}
                <RoundedBox
                  name="generic-seating-armrest-right"
                  args={[armrestW, armrestH, armrestD]}
                  radius={clamp(1.0, armrestW * 0.15, 2.5)}
                  smoothness={3}
                  position={[
                    width / 2 - armrestW / 2,
                    -height / 2 + armrestH / 2,
                    armrestZ,
                  ]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={displayColor}
                    roughness={0.65}
                    metalness={0.02}
                  />
                </RoundedBox>
              </>
            );
          })()}
        </group>
      )}

      {effectiveSubType === 'storage' && (
        <group name="generic-storage-ensemble">
          {(() => {
            const plinthH = clamp(4, height * 0.05, 10);
            const bodyH = Math.max(10, height - plinthH);
            const plinthW = Math.max(10, width - 4);
            const plinthD = Math.max(10, depth - 4);

            const numDividers = height >= 180 ? 4 : height >= 120 ? 3 : 2;

            return (
              <>
                {/* Base Plinth */}
                <RoundedBox
                  name="generic-storage-plinth"
                  args={[plinthW, plinthH, plinthD]}
                  radius={clamp(0.4, plinthH * 0.15, 1.0)}
                  smoothness={2}
                  position={[0, -height / 2 + plinthH / 2, 0]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={plinthColor}
                    roughness={0.7}
                    metalness={0.1}
                  />
                </RoundedBox>

                {/* Main Carcass Body */}
                <RoundedBox
                  name="generic-storage-body"
                  args={[width, bodyH, depth]}
                  radius={clamp(0.5, Math.min(width, depth, bodyH) * 0.03, 1.8)}
                  smoothness={3}
                  position={[0, -height / 2 + plinthH + bodyH / 2, 0]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={displayColor}
                    roughness={0.52}
                    metalness={0.05}
                  />
                </RoundedBox>

                {/* Horizontal Shelf Dividers / Front Division Lines */}
                {Array.from({ length: numDividers }).map((_, i) => {
                  const divY =
                    -height / 2 +
                    plinthH +
                    (bodyH / (numDividers + 1)) * (i + 1);
                  return (
                    <mesh
                      key={`storage-div-${i}`}
                      name="generic-storage-divider"
                      position={[0, divY, depth / 2 + 0.1]}
                    >
                      <boxGeometry args={[Math.max(2, width - 2), 0.7, 0.4]} />
                      <meshStandardMaterial
                        color={plinthColor}
                        roughness={0.65}
                      />
                    </mesh>
                  );
                })}

                {/* Vertical front division line for wider storage units */}
                {width >= 110 && (
                  <mesh
                    name="generic-storage-divider"
                    position={[0, -height / 2 + plinthH + bodyH / 2, depth / 2 + 0.1]}
                  >
                    <boxGeometry args={[0.7, Math.max(2, bodyH - 2), 0.4]} />
                    <meshStandardMaterial
                      color={plinthColor}
                      roughness={0.65}
                    />
                  </mesh>
                )}
              </>
            );
          })()}
        </group>
      )}

      {effectiveSubType === 'bed' && (
        <group name="generic-bed-ensemble">
          {(() => {
            const legBlockH = clamp(4, height * 0.15, 12);
            const legBlockSize = clamp(5, Math.min(width, depth) * 0.06, 12);
            const frameH = clamp(12, height * 0.35, Math.max(12, height - 10));
            const frameBodyH = Math.max(4, frameH - legBlockH);

            const mattressW = Math.max(10, width - 4);
            const mattressD = Math.max(10, depth - 4);
            const mattressH = Math.max(10, height - frameH);
            const mattressY = -height / 2 + frameH + mattressH / 2;

            const insetX = width / 2 - legBlockSize / 2;
            const insetZ = depth / 2 - legBlockSize / 2;

            return (
              <>
                {/* 4 Corner Leg Blocks */}
                {[
                  [-insetX, -insetZ],
                  [insetX, -insetZ],
                  [-insetX, insetZ],
                  [insetX, insetZ],
                ].map(([lx, lz], i) => (
                  <mesh
                    key={`bed-leg-${i}`}
                    name="generic-bed-leg"
                    position={[lx, -height / 2 + legBlockH / 2, lz]}
                    castShadow
                    receiveShadow
                  >
                    <boxGeometry args={[legBlockSize, legBlockH, legBlockSize]} />
                    <meshStandardMaterial
                      color={plinthColor}
                      roughness={0.6}
                      metalness={0.1}
                    />
                  </mesh>
                ))}

                {/* Bed Frame */}
                <RoundedBox
                  name="generic-bed-frame"
                  args={[width, frameBodyH, depth]}
                  radius={clamp(0.6, frameBodyH * 0.12, 1.8)}
                  smoothness={2}
                  position={[0, -height / 2 + legBlockH + frameBodyH / 2, 0]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={displayColor}
                    roughness={0.55}
                    metalness={0.05}
                  />
                </RoundedBox>

                {/* Inset Mattress on Top */}
                <RoundedBox
                  name="generic-bed-mattress"
                  args={[mattressW, mattressH, mattressD]}
                  radius={clamp(1.5, mattressH * 0.18, 3.2)}
                  smoothness={3}
                  position={[0, mattressY, 0]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={mattressColor}
                    roughness={0.85}
                    metalness={0.02}
                  />
                </RoundedBox>
              </>
            );
          })()}
        </group>
      )}

      {effectiveSubType === 'box' && (
        <group name="generic-box-ensemble">
          {(() => {
            const plinthH = Math.min(4, Math.max(1, height * 0.12));
            const mainH = Math.max(2, height - plinthH);
            const plinthW = Math.max(2, width - 6); // 3 cm inset each side
            const plinthD = Math.max(2, depth - 6);

            return (
              <>
                {/* Subtle Recessed Plinth (3 cm inset, 4 cm high) */}
                <RoundedBox
                  name="generic-box-plinth"
                  args={[plinthW, plinthH, plinthD]}
                  radius={clamp(0.2, plinthH * 0.15, 0.8)}
                  smoothness={2}
                  position={[0, -height / 2 + plinthH / 2, 0]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={plinthColor}
                    roughness={0.7}
                    metalness={0.1}
                  />
                </RoundedBox>

                {/* Rounded Architectural Main Box */}
                <RoundedBox
                  name="generic-box-main"
                  args={[width, mainH, depth]}
                  radius={clamp(0.5, Math.min(width, depth, mainH) * 0.04, 2.5)}
                  smoothness={3}
                  position={[0, -height / 2 + plinthH + mainH / 2, 0]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={displayColor}
                    roughness={0.55}
                    metalness={0.06}
                  />
                </RoundedBox>
              </>
            );
          })()}
        </group>
      )}
    </group>
  );
});

