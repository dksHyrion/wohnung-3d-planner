import React from 'react';
import * as THREE from 'three';
import { FurnitureModelProps } from './SofaModel';

interface LeafConfig {
  angle: number;
  yRatio: number;
  tilt: number;
  scale: number;
  isAccent?: boolean;
}

// 8 organic leaves in a spiraling crown (static configuration defined outside component)
const LEAF_DEFINITIONS: LeafConfig[] = [
  { angle: 0, yRatio: 0.55, tilt: 0.35, scale: 0.9 },
  { angle: 48, yRatio: 0.72, tilt: 0.28, scale: 1.05, isAccent: true },
  { angle: 95, yRatio: 0.48, tilt: 0.42, scale: 0.85 },
  { angle: 142, yRatio: 0.85, tilt: 0.22, scale: 1.1, isAccent: true },
  { angle: 190, yRatio: 0.62, tilt: 0.38, scale: 0.95 },
  { angle: 235, yRatio: 0.92, tilt: 0.18, scale: 0.8, isAccent: true },
  { angle: 280, yRatio: 0.52, tilt: 0.44, scale: 1.0 },
  { angle: 325, yRatio: 0.78, tilt: 0.25, scale: 0.9, isAccent: true },
];

export const PlantModel: React.FC<FurnitureModelProps> = ({
  item,
  hasCollision = false,
  isSelected = false,
}) => {
  const { widthCm: width, heightCm: height, depthCm: depth } = item;

  const tintColor = hasCollision ? '#ef4444' : undefined;
  const potColor = tintColor || '#f4f4f5';
  const soilColor = tintColor || '#27221f';
  const primaryLeafColor = tintColor || '#15803d';
  const accentLeafColor = tintColor || '#166534';
  const stemColor = tintColor || '#365314';

  const potH = Math.max(15, Math.min(42, height * 0.38));
  const potR = Math.max(8, Math.min(width, depth) * 0.28);
  const foliageH = height - potH;

  return (
    <group>
      {/* 1. Ceramic Cylindrical Pot */}
      <mesh
        position={[0, -height / 2 + potH / 2, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[potR, potR * 0.86, potH, 32]} />
        <meshStandardMaterial
          color={potColor}
          roughness={0.35}
          metalness={0.06}
        />
      </mesh>

      {/* Decorative Ceramic Rim Collar */}
      <mesh position={[0, -height / 2 + potH - 1, 0]}>
        <torusGeometry args={[potR, 1.2, 12, 32]} />
        <meshStandardMaterial
          color={potColor}
          roughness={0.35}
          metalness={0.06}
        />
      </mesh>

      {/* 2. Potting Soil */}
      <mesh
        position={[0, -height / 2 + potH - 1.5, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[potR - 1.2, 24]} />
        <meshStandardMaterial
          color={soilColor}
          roughness={0.95}
          metalness={0.02}
        />
      </mesh>

      {/* 3. Central Stems & Radial Leaves */}
      {LEAF_DEFINITIONS.map((l, idx) => {
        const rad = THREE.MathUtils.degToRad(l.angle);
        const leafY = -height / 2 + potH + foliageH * l.yRatio;
        const stemLen = foliageH * l.yRatio;
        const leafRadius = Math.min(width, depth) * 0.36 * l.scale;
        const currentLeafColor = l.isAccent ? accentLeafColor : primaryLeafColor;

        return (
          <group key={`leaf-${idx}`}>
            {/* Slender Woody Stem */}
            <mesh
              position={[
                (Math.cos(rad) * potR * 0.4) / 2,
                -height / 2 + potH + stemLen / 2,
                (Math.sin(rad) * potR * 0.4) / 2,
              ]}
              rotation={[Math.sin(rad) * 0.15, 0, -Math.cos(rad) * 0.15]}
            >
              <cylinderGeometry args={[0.5, 0.8, stemLen, 8]} />
              <meshStandardMaterial
                color={stemColor}
                roughness={0.8}
                metalness={0.05}
              />
            </mesh>

            {/* Lush Broad Leaf Fan */}
            <group
              position={[
                Math.cos(rad) * (potR * 0.5 + leafRadius * 0.4),
                leafY,
                Math.sin(rad) * (potR * 0.5 + leafRadius * 0.4),
              ]}
              rotation={[
                Math.sin(rad) * l.tilt,
                rad + Math.PI / 2,
                Math.cos(rad) * l.tilt,
              ]}
            >
              <mesh receiveShadow>
                {/* Scaled flattened geometry representing broad Monstera/Ficus leaf */}
                <cylinderGeometry
                  args={[leafRadius * 0.45, leafRadius * 0.55, 0.3, 16]}
                />
                <meshStandardMaterial
                  color={currentLeafColor}
                  roughness={0.45}
                  metalness={0.04}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
};
