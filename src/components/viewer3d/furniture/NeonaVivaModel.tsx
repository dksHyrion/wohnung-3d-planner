import React, { useMemo } from 'react';
import { FurnitureModelProps } from './SofaModel';
import { useFloorplanStore } from '../../../store/useFloorplanStore';
import { interpolateMood } from '../../../core/lighting/moodPresets';

/**
 * Neona Viva.
 * Shopmaß neona.store, nicht am Stück gemessen: 140 cm hoch,
 * Fuß 26,5×14 cm, drei Kugeln ø12 cm.
 * Die Farbe steht im Wiki nicht. Das Modell ist schwarz.
 * +Z ist die schmale Seite.
 */
export const NeonaVivaModel: React.FC<FurnitureModelProps> = React.memo(
  ({ item, hasCollision = false }) => {
    const timeOfDay = useFloorplanStore((s) => s.timeOfDay);
    const roomLightsActive = useFloorplanStore((s) => s.roomLightsActive);
    const mood = useMemo(() => interpolateMood(timeOfDay), [timeOfDay]);
    const isLightOn = roomLightsActive || mood.lampsActive;

    const width = item.widthCm || 26.5;
    const height = item.heightCm || 140;
    const depth = item.depthCm || 14;
    const bottom = -height / 2;
    const metal = hasCollision ? '#ef4444' : '#1a1a1a';
    const glass = hasCollision ? '#ef4444' : '#f3f6f8';
    const glow = isLightOn ? 0.55 : 0.04;

    const sphereR = Math.min(6, depth / 2 - 0.4, width / 2 - 1);
    const spheres: Array<[number, number, number]> = [
      [width * 0.22, bottom + 68, 0],
      [-width * 0.22, bottom + 96, 0],
      [width * 0.12, bottom + height - sphereR - 1.5, 0],
    ];
    const stemBottom = bottom + 2.6;
    const stemTop = spheres[2][1];
    const stemH = Math.max(8, stemTop - stemBottom);

    return (
      <group name="neona-viva">
        <mesh position={[0, bottom + 1.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 2.6, depth]} />
          <meshStandardMaterial color={metal} roughness={0.38} metalness={0.55} />
        </mesh>
        <mesh position={[0, stemBottom + stemH / 2, 0]} castShadow>
          <cylinderGeometry args={[0.7, 0.9, stemH, 12]} />
          <meshStandardMaterial color={metal} roughness={0.32} metalness={0.6} />
        </mesh>
        {spheres.map(([x, y], index) => (
          <group key={index} position={[x, y, 0]}>
            <mesh position={[-x / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.35, 0.35, Math.abs(x), 8]} />
              <meshStandardMaterial color={metal} roughness={0.32} metalness={0.6} />
            </mesh>
            <mesh castShadow>
              <sphereGeometry args={[sphereR, 20, 16]} />
              <meshPhysicalMaterial
                color={glass}
                roughness={0.08}
                metalness={0}
                transmission={0.82}
                thickness={1.5}
                emissive={isLightOn ? '#ffd7a8' : '#000000'}
                emissiveIntensity={glow}
              />
            </mesh>
            {isLightOn && index === 2 && (
              <pointLight color="#ffd2a0" intensity={0.35} distance={160} decay={2} />
            )}
          </group>
        ))}
      </group>
    );
  }
);

NeonaVivaModel.displayName = 'NeonaVivaModel';
