import React from 'react';
import { RoundedBox } from '@react-three/drei';
import { FurnitureModelProps } from './SofaModel';
import { sanitizeFurnitureColor } from './ArchitecturalFurniture3D';

/**
 * Architectural PAX / Fitted Wardrobe Model (Kleiderschrank)
 * Features:
 * - Recessed dark shadow-gap toe-kick plinth (7 cm)
 * - Outer carcass frame with visible top crown reveal for isometric clarity
 * - Modular full-height hinged doors (~50 cm module width) with 0.6 cm shadow gaps
 * - Vertical architectural bar handles (90 cm) paired symmetrically across door modules
 */
export const WardrobeModel: React.FC<FurnitureModelProps> = React.memo(
  ({ item, hasCollision = false }) => {
    const width = item.widthCm || 200;
    const height = item.heightCm || 236;
    const depth = item.depthCm || 60;

    const tintColor = hasCollision ? '#ef4444' : undefined;
    const rawColor = sanitizeFurnitureColor(item.color, '#f4f1ea');
    const bodyColor = tintColor || rawColor;
    const doorColor = tintColor || '#faf8f5';
    const plinthColor = tintColor || '#272522';
    const shadowGapColor = tintColor || '#3f3b36';
    const handleColor = tintColor || '#2e2a26';

    const plinthH = 7;
    const topRevealH = 2.2;
    const doorThickness = 2.2;
    const carcassD = Math.max(10, depth - doorThickness);
    const carcassH = height - plinthH;
    const doorH = carcassH - topRevealH - 0.8;

    const numDoors = Math.max(2, Math.round(width / 50));
    const doorModuleW = (width - 2.4) / numDoors;
    const bottomY = -height / 2;

    return (
      <group>
        {/* 1. Recessed Plinth Base (Sockelleiste) */}
        <mesh
          name="wardrobe-plinth"
          position={[0, bottomY + plinthH / 2, -1.5]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[width - 1.2, plinthH, carcassD - 3]} />
          <meshStandardMaterial
            color={plinthColor}
            roughness={0.75}
            metalness={0.15}
          />
        </mesh>

        {/* 2. Main Carcass Body & Shadow Reveal Backing */}
        <RoundedBox
          args={[width, carcassH, carcassD]}
          radius={0.6}
          smoothness={3}
          position={[
            0,
            bottomY + plinthH + carcassH / 2,
            -depth / 2 + carcassD / 2,
          ]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={bodyColor}
            roughness={0.48}
            metalness={0.04}
          />
        </RoundedBox>

        {/* Dark shadow gap backing strip behind door seams */}
        <mesh
          position={[
            0,
            bottomY + plinthH + doorH / 2 + 0.4,
            depth / 2 - doorThickness - 0.1,
          ]}
        >
          <boxGeometry args={[width - 2, doorH, 0.4]} />
          <meshStandardMaterial color={shadowGapColor} roughness={0.9} />
        </mesh>

        {/* 3. Modular Full-Height Hinged Doors + Vertical Bar Handles */}
        {Array.from({ length: numDoors }).map((_, idx) => {
          const doorX = -width / 2 + 1.2 + (idx + 0.5) * doorModuleW;
          const doorY = bottomY + plinthH + 0.4 + doorH / 2;
          const doorZ = depth / 2 - doorThickness / 2;

          // Pair handles on meeting stiles of double doors
          const isLeftOfPair = idx % 2 === 0;
          const handleOffsetX = isLeftOfPair
            ? doorModuleW / 2 - 4.2
            : -doorModuleW / 2 + 4.2;
          const handleH = Math.min(85, doorH * 0.4);
          const handleY = bottomY + Math.min(height * 0.48, plinthH + doorH * 0.5);

          return (
            <group key={`wardrobe-door-${idx}`}>
              <RoundedBox
                name="wardrobe-door"
                args={[doorModuleW - 0.7, doorH, doorThickness]}
                radius={0.4}
                smoothness={3}
                position={[doorX, doorY, doorZ]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial
                  color={doorColor}
                  roughness={0.38}
                  metalness={0.05}
                />
              </RoundedBox>

              {/* Subtle vertical frame groove on door face for isometric depth */}
              <mesh
                position={[
                  doorX + (isLeftOfPair ? 1 : -1) * (doorModuleW * 0.35),
                  doorY,
                  depth / 2 + 0.08,
                ]}
              >
                <boxGeometry args={[0.4, doorH - 12, 0.2]} />
                <meshStandardMaterial color={bodyColor} roughness={0.5} />
              </mesh>

              {/* Slender Vertical Architectural Bar Handle */}
              <mesh
                name="wardrobe-handle"
                position={[
                  doorX + handleOffsetX,
                  handleY,
                  depth / 2 + 0.9,
                ]}
                castShadow
              >
                <boxGeometry args={[0.9, handleH, 1.6]} />
                <meshStandardMaterial
                  color={handleColor}
                  roughness={0.25}
                  metalness={0.85}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }
);

WardrobeModel.displayName = 'WardrobeModel';
