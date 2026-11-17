import React, { useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import type { ResolvedWallFixtureBox } from '../../core/mepFixtures';

export const WallFixtureMesh3D: React.FC<{
  box: ResolvedWallFixtureBox;
  isSelected: boolean;
  onSelect: (fixtureId: string) => void;
}> = ({ box, isSelected, onSelect }) => {
  const dirSign = box.side === 'neg' ? -1 : 1;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(box.fixtureId);
  };

  const radiatorFinPositions = useMemo(() => {
    if (box.type !== 'radiator') return [];
    const count = Math.max(4, Math.floor((box.widthCm - 8) / 6));
    const step = (box.widthCm - 8) / Math.max(1, count - 1);
    return Array.from({ length: count }, (_, idx) => -box.widthCm / 2 + 4 + idx * step);
  }, [box.type, box.widthCm]);

  if (box.type === 'shaft') {
    return (
      <group
        name={`fixture-${box.fixtureId}`}
        position={[box.center.x, box.center.y, box.center.z]}
        rotation={[0, -box.angleRad, 0]}
        onClick={handleClick}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[box.widthCm, box.heightCm, box.depthCm]} />
          <meshStandardMaterial
            color={isSelected ? '#38bdf8' : '#cbd5e1'}
            roughness={0.85}
          />
        </mesh>
      </group>
    );
  }

  if (box.type === 'radiator') {
    return (
      <group
        name={`fixture-${box.fixtureId}`}
        position={[box.center.x, box.center.y, box.center.z]}
        rotation={[0, -box.angleRad, 0]}
        onClick={handleClick}
      >
        {/* Main radiator panel */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[box.widthCm, box.heightCm, box.depthCm * 0.72]} />
          <meshStandardMaterial
            color={isSelected ? '#38bdf8' : '#f1f5f9'}
            roughness={0.38}
            metalness={0.25}
          />
        </mesh>
        {/* Vertical convection fins */}
        {radiatorFinPositions.map((fx, idx) => (
          <mesh
            key={`fin-${idx}`}
            position={[fx, 0, dirSign * (box.depthCm * 0.14)]}
            castShadow
          >
            <boxGeometry args={[1.6, box.heightCm - 4, box.depthCm * 0.35]} />
            <meshStandardMaterial
              color={isSelected ? '#7dd3fc' : '#e2e8f0'}
              roughness={0.42}
              metalness={0.2}
            />
          </mesh>
        ))}
        {/* Thermostat valve */}
        <mesh
          position={[box.widthCm / 2 + 2.5, -box.heightCm / 2 + 6, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[2.2, 2.2, 5, 10]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.25} />
        </mesh>
      </group>
    );
  }

  if (box.type === 'water-outlet') {
    return (
      <group
        name={`fixture-${box.fixtureId}`}
        position={[box.center.x, box.center.y, box.center.z]}
        rotation={[0, -box.angleRad, 0]}
        onClick={handleClick}
      >
        <mesh castShadow>
          <boxGeometry args={[box.widthCm, box.heightCm, box.depthCm]} />
          <meshStandardMaterial
            color={isSelected ? '#38bdf8' : '#94a3b8'}
            roughness={0.5}
          />
        </mesh>
        {[-4, 4].map((xOff, i) => (
          <mesh
            key={`valve-${i}`}
            position={[xOff, 3, dirSign * (box.depthCm / 2 + 2)]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[1.8, 1.8, 4, 10]} />
            <meshStandardMaterial
              color={i === 0 ? '#ef4444' : '#0284c7'}
              metalness={0.6}
              roughness={0.3}
            />
          </mesh>
        ))}
      </group>
    );
  }

  // Socket / Switch / Data outlet wall plate
  const accentColor =
    box.type === 'switch'
      ? '#f59e0b'
      : box.type === 'data-outlet'
      ? '#06b6d4'
      : '#f8fafc';

  return (
    <group
      name={`fixture-${box.fixtureId}`}
      position={[box.center.x, box.center.y, box.center.z]}
      rotation={[0, -box.angleRad, 0]}
      onClick={handleClick}
    >
      <mesh castShadow>
        <boxGeometry args={[box.widthCm, box.heightCm, box.depthCm]} />
        <meshStandardMaterial
          color={isSelected ? '#38bdf8' : '#f8fafc'}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 0, dirSign * (box.depthCm / 2 + 0.3)]}>
        <boxGeometry args={[box.widthCm * 0.55, box.heightCm * 0.55, 0.8]} />
        <meshStandardMaterial color={accentColor} roughness={0.45} />
      </mesh>
    </group>
  );
};
