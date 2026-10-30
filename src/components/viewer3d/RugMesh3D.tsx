import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { RoundedBox, Edges } from '@react-three/drei';
import { getWovenRugTexture } from '../../core/materials/proceduralTextures';

export interface RugMesh3DProps {
  widthCm: number;
  depthCm: number;
  x: number;
  z: number;
  rotationYDeg?: number;
  color?: string;
  isSelected?: boolean;
  onStartDrag?: (hitPoint: THREE.Vector3) => void;
}

export const RUG_HEIGHT_CM = 0.8;
export const RUG_ELEVATION_Y_CM = 0.2;

export const RugMesh3D: React.FC<RugMesh3DProps> = ({
  widthCm,
  depthCm,
  x,
  z,
  rotationYDeg = 0,
  color = '#edece8',
  isSelected = false,
  onStartDrag,
}) => {
  const rugTexture = useMemo(() => {
    const baseTex = getWovenRugTexture();
    const tex = baseTex.clone();
    // Architectural scale: repeat woven pattern approximately every 25 cm
    const repeatScale = 25;
    tex.repeat.set(
      Math.max(1, widthCm / repeatScale),
      Math.max(1, depthCm / repeatScale)
    );
    return tex;
  }, [widthCm, depthCm]);

  useEffect(() => {
    return () => {
      rugTexture.dispose();
    };
  }, [rugTexture]);

  // The bevel radius is also the vertical thickness. Above half the rug height
  // the mesh swells into a slab.
  const cornerRadius = Math.min(
    RUG_HEIGHT_CM / 2 - 0.05,
    Math.max(0.05, Math.min(widthCm, depthCm) * 0.02)
  );
  const rotYRad = (rotationYDeg * Math.PI) / 180;
  const centerY = RUG_ELEVATION_Y_CM + RUG_HEIGHT_CM / 2;

  return (
    <group
      position={[x, centerY, z]}
      rotation={[0, rotYRad, 0]}
      onPointerDown={
        onStartDrag
          ? (e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              onStartDrag(e.point);
            }
          : undefined
      }
    >
      <RoundedBox
        args={[widthCm, RUG_HEIGHT_CM, depthCm]}
        radius={cornerRadius}
        smoothness={4}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          map={rugTexture}
          color={color}
          roughness={0.95}
          metalness={0.02}
        />
        {isSelected && <Edges scale={1.005} threshold={15} color="#38bdf8" />}
      </RoundedBox>
    </group>
  );
};
