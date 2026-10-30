import React from 'react';
import { RoundedBox } from '@react-three/drei';
import { FurnitureModelProps } from './SofaModel';
import { sanitizeFurnitureColor } from './ArchitecturalFurniture3D';
import { useFloorplanStore } from '../../../store/useFloorplanStore';

export interface CoffeeTableModelProps extends FurnitureModelProps {
  variant?: 'coffee-table' | 'sideboard' | 'vanity';
}

/**
 * Architectural Coffee Table, Sideboard & Bathroom Vanity Model
 * - 'coffee-table': Filigree matte-black steel frame, beveled marble/travertine top slab,
 *   lower oak shelf, and curated coffee-table architecture books + ceramic bowl.
 * - 'sideboard': Tapered legs, warm oak credenza body with modular doors/drawers & ceramic decor.
 * - 'vanity': Bathroom vanity cabinet with stone top, ceramic washbasin(s) & matte-black mixer tap.
 */
export const CoffeeTableModel: React.FC<CoffeeTableModelProps> = React.memo(
  ({ item, hasCollision = false, variant = 'coffee-table' }) => {
    const showDecor = useFloorplanStore((s) => s.showDecor);
    const width = item.widthCm || 120;
    const height = item.heightCm || 42;
    const depth = item.depthCm || 70;

    const tintColor = hasCollision ? '#ef4444' : undefined;
    const fallbackColor = variant === 'sideboard' ? '#c7b299' : '#f8fafc';
    const rawColor = sanitizeFurnitureColor(item.color, fallbackColor);

    const stoneColor = tintColor || rawColor;
    const oakColor = tintColor || '#d6c5b3';
    const frameColor = tintColor || '#1e1e22';
    const bookCoverColor = tintColor || '#334155';
    const bookPagesColor = tintColor || '#f1ece4';
    const bowlColor = tintColor || '#d4cdc3';
    const bottomY = -height / 2;
    const topY = height / 2;

    if (variant === 'vanity') {
      const counterH = 4;
      const plinthH = 10;
      const bodyH = Math.max(20, height - counterH - plinthH);
      const isDouble = width >= 120;
      const basinOffsets = isDouble ? [-width * 0.24, width * 0.24] : [0];

      return (
        <group>
          {/* Floating/Recessed Vanity Body */}
          <RoundedBox
            args={[width, bodyH, depth - 1]}
            radius={0.8}
            smoothness={3}
            position={[0, bottomY + plinthH + bodyH / 2, -0.5]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={oakColor}
              roughness={0.5}
              metalness={0.04}
            />
          </RoundedBox>

          {/* Stone Countertop */}
          <RoundedBox
            name="coffee-table-top"
            args={[width, counterH, depth]}
            radius={0.6}
            smoothness={3}
            position={[0, topY - counterH / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={stoneColor}
              roughness={0.22}
              metalness={0.06}
            />
          </RoundedBox>

          {/* Ceramic Washbasin(s) & Mixer Tap */}
          {basinOffsets.map((bx, idx) => (
            <group key={`basin-${idx}`} position={[bx, topY, 0]}>
              <mesh position={[0, 4.5, 2]} castShadow receiveShadow>
                <cylinderGeometry args={[18, 15, 9, 24]} />
                <meshStandardMaterial
                  color="#ffffff"
                  roughness={0.15}
                  metalness={0.05}
                />
              </mesh>
              <mesh position={[0, 8, -14]} castShadow>
                <cylinderGeometry args={[1.1, 1.3, 16, 12]} />
                <meshStandardMaterial
                  color={frameColor}
                  roughness={0.2}
                  metalness={0.9}
                />
              </mesh>
            </group>
          ))}
        </group>
      );
    }

    if (variant === 'sideboard') {
      const legH = Math.min(18, height * 0.22);
      const topSlabH = 2.6;
      const bodyH = Math.max(20, height - legH - topSlabH);
      const numDoors = Math.max(2, Math.round(width / 50));
      const doorW = (width - 3) / numDoors;

      return (
        <group>
          {/* 4 Tapered Legs */}
          {[
            [-width / 2 + 8, -depth / 2 + 6],
            [width / 2 - 8, -depth / 2 + 6],
            [-width / 2 + 8, depth / 2 - 6],
            [width / 2 - 8, depth / 2 - 6],
          ].map(([lx, lz], i) => (
            <mesh
              key={`sb-leg-${i}`}
              position={[lx, bottomY + legH / 2, lz]}
              castShadow
            >
              <cylinderGeometry args={[1.4, 0.9, legH, 12]} />
              <meshStandardMaterial
                color={frameColor}
                roughness={0.35}
                metalness={0.8}
              />
            </mesh>
          ))}

          {/* Credenza Carcass */}
          <RoundedBox
            args={[width, bodyH, depth - 1.6]}
            radius={0.8}
            smoothness={3}
            position={[0, bottomY + legH + bodyH / 2, -0.8]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={stoneColor}
              roughness={0.5}
              metalness={0.05}
            />
          </RoundedBox>

          {/* Modular Front Doors with Shadow Gaps */}
          {Array.from({ length: numDoors }).map((_, idx) => {
            const dx = -width / 2 + 1.5 + (idx + 0.5) * doorW;
            return (
              <RoundedBox
                key={`sb-door-${idx}`}
                args={[doorW - 0.8, bodyH - 2.4, 1.6]}
                radius={0.4}
                smoothness={3}
                position={[dx, bottomY + legH + bodyH / 2, depth / 2 - 0.8]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial
                  color={stoneColor}
                  roughness={0.42}
                  metalness={0.05}
                />
              </RoundedBox>
            );
          })}

          {/* Top Overhang Slab */}
          <RoundedBox
            name="coffee-table-top"
            args={[width + 0.6, topSlabH, depth]}
            radius={0.5}
            smoothness={3}
            position={[0, topY - topSlabH / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color="#f8fafc"
              roughness={0.28}
              metalness={0.06}
            />
          </RoundedBox>

          {/* Decorative Ceramic Vase on Top */}
          {showDecor && (
            <mesh
              name="coffee-table-decor"
              position={[-width * 0.22, topY + 7, 0]}
              castShadow
            >
              <cylinderGeometry args={[3.5, 5, 14, 20]} />
              <meshStandardMaterial color={bowlColor} roughness={0.75} />
            </mesh>
          )}
        </group>
      );
    }

    // Default 'coffee-table' (Marmor Couchtisch / Beistelltisch)
    const topSlabH = 3.2;
    const frameH = height - topSlabH;
    const barSize = 1.8;
    const insetX = 3;
    const insetZ = 3;
    const shelfY = bottomY + Math.max(10, height * 0.32);

    return (
      <group>
        {/* 1. Beveled Carrara Marble / Travertine Top Slab */}
        <RoundedBox
          name="coffee-table-top"
          args={[width, topSlabH, depth]}
          radius={1.0}
          smoothness={4}
          position={[0, topY - topSlabH / 2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={stoneColor}
            roughness={0.22}
            metalness={0.06}
          />
        </RoundedBox>

        {/* 2. Filigree Matte-Black Steel Frame (4 Corner Legs + Stretchers) */}
        {[
          [-width / 2 + insetX, -depth / 2 + insetZ],
          [width / 2 - insetX, -depth / 2 + insetZ],
          [-width / 2 + insetX, depth / 2 - insetZ],
          [width / 2 - insetX, depth / 2 - insetZ],
        ].map(([lx, lz], i) => (
          <mesh
            key={`ct-leg-${i}`}
            position={[lx, bottomY + frameH / 2, lz]}
            castShadow
          >
            <boxGeometry args={[barSize, frameH, barSize]} />
            <meshStandardMaterial
              color={frameColor}
              roughness={0.35}
              metalness={0.85}
            />
          </mesh>
        ))}

        {/* Longitudinal Side Rails under Tabletop */}
        {[-depth / 2 + insetZ, depth / 2 - insetZ].map((rz, i) => (
          <mesh
            key={`ct-rail-long-${i}`}
            position={[0, topY - topSlabH - barSize / 2, rz]}
            castShadow
          >
            <boxGeometry args={[width - insetX * 2, barSize, barSize]} />
            <meshStandardMaterial
              color={frameColor}
              roughness={0.35}
              metalness={0.85}
            />
          </mesh>
        ))}

        {/* 3. Lower Oak Magazine Shelf */}
        <RoundedBox
          args={[width - insetX * 2 - 1, 1.8, depth - insetZ * 2 - 1]}
          radius={0.4}
          smoothness={3}
          position={[0, shelfY, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={oakColor}
            roughness={0.55}
            metalness={0.04}
          />
        </RoundedBox>

        {/* 4. Curated Coffee-Table Architecture Book Stack & Sculptural Ceramic Bowl */}
        {showDecor && (
          <group name="coffee-table-decor" position={[0, topY, 0]}>
            {/* Large Hardcover Architecture Monograph */}
            <group
              position={[-width * 0.16, 1.4, 2]}
              rotation={[0, 0.14, 0]}
            >
              <RoundedBox
                args={[Math.min(28, width * 0.26), 2.8, Math.min(22, depth * 0.34)]}
                radius={0.3}
                smoothness={2}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial color={bookCoverColor} roughness={0.65} />
              </RoundedBox>
              {/* Smaller Book on Top */}
              <RoundedBox
                args={[Math.min(22, width * 0.2), 2.0, Math.min(17, depth * 0.26)]}
                radius={0.3}
                smoothness={2}
                position={[0.5, 2.4, -0.5]}
                rotation={[0, -0.22, 0]}
                castShadow
              >
                <meshStandardMaterial color={bookPagesColor} roughness={0.75} />
              </RoundedBox>
            </group>

            {/* Sculptural Shallow Ceramic Bowl */}
            <mesh
              position={[width * 0.18, 2.2, -3]}
              castShadow
              receiveShadow
            >
              <cylinderGeometry
                args={[
                  Math.min(11, depth * 0.16),
                  Math.min(7, depth * 0.1),
                  4.2,
                  24,
                ]}
              />
              <meshStandardMaterial
                color={bowlColor}
                roughness={0.6}
                metalness={0.04}
              />
            </mesh>
          </group>
        )}
      </group>
    );
  }
);

CoffeeTableModel.displayName = 'CoffeeTableModel';
