import React from 'react';
import * as THREE from 'three';
import { FurnitureModelProps } from './SofaModel';

export const BathtubModel: React.FC<FurnitureModelProps> = ({
  item,
  hasCollision = false,
  isSelected = false,
}) => {
  const { widthCm: width, heightCm: height, depthCm: depth } = item;

  const tintColor = hasCollision ? '#ef4444' : undefined;
  const porcelainColor = tintColor || '#f8fafc';
  const chromeColor = tintColor || '#e2e8f0';
  const waterColor = tintColor || '#38bdf8';

  const tubH = height * 0.88;
  // Leave margin for the freestanding floor-mounted faucet outside the tub rim
  const scaleX = Math.max(2, (width - 20) / 2);
  const scaleZ = Math.max(2, (depth - 6) / 2);
  const faucetX = scaleX + 6;

  return (
    <group>
      {/* 1. Freestanding Oval Tub Body */}
      <group scale={[scaleX, 1, scaleZ]} position={[-2, -height / 2 + tubH / 2, 0]}>
        {/* Outer Tub Shell */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[1, 0.82, tubH, 48]} />
          <meshStandardMaterial
            color={porcelainColor}
            roughness={0.12}
            metalness={0.05}
          />
        </mesh>

        {/* Rounded Rolled Rim */}
        <mesh position={[0, tubH / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.98, 0.05, 16, 48]} />
          <meshStandardMaterial
            color={porcelainColor}
            roughness={0.12}
            metalness={0.05}
          />
        </mesh>

        {/* Water Surface inside Tub */}
        <mesh
          position={[0, tubH * 0.28, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.88, 36]} />
          <meshStandardMaterial
            color={waterColor}
            roughness={0.05}
            metalness={0.1}
            transparent
            opacity={0.65}
          />
        </mesh>

        {/* Chrome Bottom Drain */}
        <mesh
          position={[0, -tubH / 2 + 1, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.08, 16]} />
          <meshStandardMaterial
            color={chromeColor}
            roughness={0.1}
            metalness={0.95}
          />
        </mesh>
      </group>

      {/* 2. Freestanding Floor-Mounted Tub Filler / Faucet (Outside Tub Rim) */}
      <group position={[faucetX, 0, 0]}>
        {/* Floor Flange Base on floor */}
        <mesh
          position={[0, -height / 2 + 1, 0]}
          castShadow
        >
          <cylinderGeometry args={[3.5, 4, 2, 24]} />
          <meshStandardMaterial
            color={chromeColor}
            roughness={0.15}
            metalness={0.95}
          />
        </mesh>

        {/* Vertical Standpipe */}
        <mesh
          position={[0, -height / 2 + (tubH + 18) / 2, 0]}
          castShadow
        >
          <cylinderGeometry args={[1.3, 1.3, tubH + 18, 16]} />
          <meshStandardMaterial
            color={chromeColor}
            roughness={0.15}
            metalness={0.95}
          />
        </mesh>

        {/* Horizontal Gooseneck Spout (arching inward over the tub rim) */}
        <mesh
          position={[-7.5, -height / 2 + tubH + 18, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[1.1, 1.1, 15, 16]} />
          <meshStandardMaterial
            color={chromeColor}
            roughness={0.15}
            metalness={0.95}
          />
        </mesh>

        {/* Downward Spout Nozzle over tub cavity */}
        <mesh
          position={[-14.5, -height / 2 + tubH + 15, 0]}
          castShadow
        >
          <cylinderGeometry args={[1, 0.8, 6, 16]} />
          <meshStandardMaterial
            color={chromeColor}
            roughness={0.15}
            metalness={0.95}
          />
        </mesh>

        {/* Sleek Mixer Lever Handle */}
        <mesh
          position={[0, -height / 2 + tubH + 12, 2.8]}
          rotation={[0.35, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.5, 0.5, 7, 12]} />
          <meshStandardMaterial
            color={chromeColor}
            roughness={0.15}
            metalness={0.95}
          />
        </mesh>
      </group>
    </group>
  );
};
