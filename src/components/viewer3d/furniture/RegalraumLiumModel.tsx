import React from 'react';
import { FurnitureModelProps } from './SofaModel';

/**
 * Regalraum LIUM L-1x4 Steckregalsystem.
 * Außenmaß 57×36×140 cm, Glas klar, Profile schwarz.
 * Zusätzliche Böden in 54 und 86 cm sind optionale Systemteile.
 * +Z zeigt in den Raum.
 */
export const RegalraumLiumModel: React.FC<FurnitureModelProps> = React.memo(
  ({ item, hasCollision = false }) => {
    const width = item.widthCm || 57;
    const height = item.heightCm || 140;
    const depth = item.depthCm || 36;
    const bottom = -height / 2;
    const frame = hasCollision ? '#ef4444' : '#1a1a1a';
    const post = 1.6;
    const x = width / 2 - post / 2;
    const z = depth / 2 - post / 2;
    const glassW = Math.min(54, width - post * 2 - 0.4);
    const glassD = Math.min(33, depth - post * 2 - 0.4);
    const levels = 4;

    const upright = (px: number, pz: number) => (
      <mesh key={`${px}-${pz}`} position={[px, 0, pz]} castShadow receiveShadow>
        <boxGeometry args={[post, height, post]} />
        <meshStandardMaterial color={frame} roughness={0.42} metalness={0.45} />
      </mesh>
    );

    const shelves = Array.from({ length: levels }, (_, index) => {
      const y = bottom + 6 + ((height - 12) * index) / (levels - 1);
      return (
        <mesh key={index} position={[0, y, 0]} receiveShadow>
          <boxGeometry args={[glassW, 0.6, glassD]} />
          <meshStandardMaterial
            color={hasCollision ? '#ef4444' : '#d5dee6'}
            transparent
            opacity={0.38}
            roughness={0.06}
            metalness={0.04}
          />
        </mesh>
      );
    });

    return (
      <group name="regalraum-lium">
        {upright(-x, -z)}
        {upright(x, -z)}
        {upright(-x, z)}
        {upright(x, z)}
        {shelves}
      </group>
    );
  }
);

RegalraumLiumModel.displayName = 'RegalraumLiumModel';
