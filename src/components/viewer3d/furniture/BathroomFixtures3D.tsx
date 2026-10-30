import React from 'react';
import * as THREE from 'three';
import { FurnitureModelProps } from './SofaModel';

/**
 * Standard bathroom fixtures. The bounding box is the collision body.
 * Local +Z is the room side, local −Z is the wall side.
 * Origin sits at the center of that box.
 */

export const ShowerModel: React.FC<FurnitureModelProps> = ({
  item,
  hasCollision = false,
}) => {
  const width = item.widthCm;
  const height = item.heightCm;
  const depth = item.depthCm;
  const tint = hasCollision ? '#ef4444' : undefined;
  const trayColor = tint || '#e7e5e4';
  const frameColor = tint || '#d6d3d1';
  const glassColor = tint || '#dbeafe';
  const metalColor = tint || '#a1a1aa';

  const bottom = -height / 2;
  const trayH = Math.min(8, Math.max(4, height * 0.035));
  const glassH = Math.max(20, height - trayH - 2);
  const glassY = bottom + trayH + glassH / 2;
  const glassT = 0.8;
  const post = 3;

  return (
    <group name="shower-cabin">
      <mesh position={[0, bottom + trayH / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[width - 1, trayH, depth - 1]} />
        <meshStandardMaterial color={trayColor} roughness={0.45} metalness={0.04} />
      </mesh>
      <mesh
        position={[0, bottom + trayH + 0.15, depth * 0.08]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[4.2, 20]} />
        <meshStandardMaterial color={tint || '#71717a'} roughness={0.35} metalness={0.5} />
      </mesh>

      {/* Back, left and right glass. The front is the door. */}
      <mesh position={[0, glassY, -depth / 2 + glassT]}>
        <boxGeometry args={[width - post, glassH, glassT]} />
        <meshStandardMaterial
          color={glassColor}
          roughness={0.05}
          metalness={0.08}
          transparent
          opacity={0.22}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[-width / 2 + glassT, glassY, 0]}>
        <boxGeometry args={[glassT, glassH, depth - post]} />
        <meshStandardMaterial
          color={glassColor}
          roughness={0.05}
          metalness={0.08}
          transparent
          opacity={0.22}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[width / 2 - glassT, glassY, 0]}>
        <boxGeometry args={[glassT, glassH, depth - post]} />
        <meshStandardMaterial
          color={glassColor}
          roughness={0.05}
          metalness={0.08}
          transparent
          opacity={0.22}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[-width * 0.22, glassY, depth / 2 - glassT]}>
        <boxGeometry args={[width * 0.46, glassH, glassT]} />
        <meshStandardMaterial
          color={glassColor}
          roughness={0.05}
          metalness={0.08}
          transparent
          opacity={0.28}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[width * 0.24, glassY, depth / 2 - glassT]}>
        <boxGeometry args={[width * 0.42, glassH, glassT]} />
        <meshStandardMaterial
          color={glassColor}
          roughness={0.05}
          metalness={0.08}
          transparent
          opacity={0.18}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[width * 0.05, glassY, depth / 2 - 1.2]}>
        <boxGeometry args={[1.2, 18, 1.4]} />
        <meshStandardMaterial color={metalColor} roughness={0.3} metalness={0.7} />
      </mesh>

      {(
        [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ] as const
      ).map(([sx, sz]) => (
        <mesh
          key={`${sx}${sz}`}
          position={[sx * (width / 2 - post / 2), bottom + height / 2, sz * (depth / 2 - post / 2)]}
          castShadow
        >
          <boxGeometry args={[post, height - 1, post]} />
          <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.2} />
        </mesh>
      ))}

      <mesh
        position={[width * 0.22, bottom + height * 0.72, -depth / 2 + 6]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[1.1, 1.1, 16, 12]} />
        <meshStandardMaterial color={metalColor} roughness={0.25} metalness={0.75} />
      </mesh>
      <mesh position={[width * 0.22, bottom + height * 0.72 - 1.5, -depth / 2 + 14]}>
        <sphereGeometry args={[3.2, 16, 12]} />
        <meshStandardMaterial color={metalColor} roughness={0.25} metalness={0.7} />
      </mesh>
    </group>
  );
};

export const ToiletModel: React.FC<FurnitureModelProps> = ({
  item,
  hasCollision = false,
}) => {
  const width = item.widthCm;
  const height = item.heightCm;
  const depth = item.depthCm;
  const tint = hasCollision ? '#ef4444' : undefined;
  const ceramic = tint || '#f7f7f5';
  const seatColor = tint || '#f4f4f5';
  const metal = tint || '#d6d3d1';

  const bottom = -height / 2;
  const bowlW = width * 0.9;
  const bowlD = depth * 0.7;
  const bowlH = height * 0.42;
  const bowlY = bottom + height * 0.58;
  const bowlZ = depth * 0.02;
  const ringR = Math.min(bowlW, bowlD) * 0.33;

  return (
    <group name="toilet-wall-hung">
      <mesh position={[0, bowlY, -depth / 2 + depth * 0.18]} castShadow>
        <boxGeometry args={[bowlW * 0.5, bowlH * 0.62, depth * 0.2]} />
        <meshStandardMaterial color={ceramic} roughness={0.16} metalness={0.05} />
      </mesh>
      <mesh
        position={[0, bowlY, bowlZ]}
        scale={[bowlW / 2, bowlH / 2, bowlD / 2]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[1, 32, 24]} />
        <meshStandardMaterial color={ceramic} roughness={0.12} metalness={0.06} />
      </mesh>
      <mesh
        position={[0, bowlY + bowlH * 0.46, bowlZ]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <torusGeometry args={[ringR, 1.35, 10, 28]} />
        <meshStandardMaterial color={seatColor} roughness={0.38} metalness={0.03} />
      </mesh>
      <mesh
        position={[0, bowlY + bowlH * 0.62, bowlZ - depth * 0.1]}
        rotation={[-0.85, 0, 0]}
        scale={[ringR, 1.3, ringR * 0.92]}
        castShadow
      >
        <sphereGeometry args={[1, 22, 14]} />
        <meshStandardMaterial color={seatColor} roughness={0.34} metalness={0.03} />
      </mesh>
      <mesh position={[0, bottom + height * 0.78, -depth / 2 + 0.6]}>
        <boxGeometry args={[Math.min(12, width * 0.32), Math.min(16, height * 0.28), 0.8]} />
        <meshStandardMaterial color={metal} roughness={0.32} metalness={0.3} />
      </mesh>
    </group>
  );
};

export const WashingMachineModel: React.FC<FurnitureModelProps> = ({
  item,
  hasCollision = false,
}) => {
  const width = item.widthCm;
  const height = item.heightCm;
  const depth = item.depthCm;
  const tint = hasCollision ? '#ef4444' : undefined;
  const body = tint || item.color || '#f4f4f5';
  const door = tint || '#27272a';
  const rim = tint || '#e4e4e7';
  const panel = tint || '#fafafa';

  const bottom = -height / 2;
  const plinth = Math.min(6, height * 0.06);
  const bodyH = height - plinth;
  const doorR = Math.min(width, height) * 0.28;

  return (
    <group name="washing-machine">
      <mesh position={[0, bottom + plinth / 2, 0]}>
        <boxGeometry args={[width - 2, plinth, depth - 3]} />
        <meshStandardMaterial color={tint || '#18181b'} roughness={0.8} />
      </mesh>
      <mesh position={[0, bottom + plinth + bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width - 1, bodyH - 1, depth - 1]} />
        <meshStandardMaterial color={body} roughness={0.42} metalness={0.04} />
      </mesh>
      <mesh position={[0, bottom + height - 8, depth / 2 - 0.4]}>
        <boxGeometry args={[width - 6, 10, 0.8]} />
        <meshStandardMaterial color={panel} roughness={0.35} metalness={0.05} />
      </mesh>
      <mesh position={[0, bottom + height * 0.42, depth / 2 - 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[doorR + 1.6, doorR + 1.6, 1.4, 28]} />
        <meshStandardMaterial color={rim} roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0, bottom + height * 0.42, depth / 2 + 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[doorR, doorR, 1.2, 28]} />
        <meshStandardMaterial color={door} roughness={0.15} metalness={0.35} />
      </mesh>
    </group>
  );
};
