import React from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { WallOpening } from '../../core/types';
import {
  WINDOW_GLASS_COLOR,
  WINDOW_GLASS_METALNESS,
  WINDOW_GLASS_OPACITY,
  WINDOW_GLASS_ROUGHNESS,
} from './WallMesh3D';

export const WINDOW_FRAME_COLOR = '#d8d0c5';
export const WINDOW_FRAME_ROUGHNESS = 0.65;
export const WINDOW_SILL_COLOR = '#e4ddd4';
export const WINDOW_HANDLE_COLOR = '#94a3b8';
export const WINDOW_FRAME_THICKNESS_CM = 4.5;
export const WINDOW_SILL_HEIGHT_CM = 2.2;
export const WINDOW_SILL_OVERHANG_CM = 3.5;

export interface WindowFrame3DProps {
  opening: WallOpening;
  wallLengthCm: number;
  wallThicknessCm: number;
  onSelect: (openingId: string) => void;
}

export const WindowFrame3D: React.FC<WindowFrame3DProps> = ({
  opening,
  wallLengthCm,
  wallThicknessCm,
  onSelect,
}) => {
  const localX =
    opening.offsetFromStartCm + opening.widthCm / 2 - wallLengthCm / 2;
  const localY = opening.sillHeightCm + opening.heightCm / 2;

  const w = Math.max(20, opening.widthCm);
  const h = Math.max(20, opening.heightCm);
  const frameT = Math.min(WINDOW_FRAME_THICKNESS_CM, w * 0.15, h * 0.15);
  const frameDepth = Math.max(4, Math.min(wallThicknessCm * 0.55, 10));
  const glassDepth = Math.max(2, wallThicknessCm * 0.22);
  const innerW = Math.max(4, w - frameT * 2);
  const innerH = Math.max(4, h - frameT * 2);
  const hasCenterMullion = w >= 90;
  const mullionW = 3.4;

  const sillW = w + 4;
  const sillDepth = wallThicknessCm + WINDOW_SILL_OVERHANG_CM * 2;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(opening.id);
  };

  return (
    <group position={[localX, localY, 0]} onClick={handleClick}>
      {/* Top Frame Rail */}
      <mesh
        name="window-frame"
        position={[0, h / 2 - frameT / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w, frameT, frameDepth]} />
        <meshStandardMaterial
          color={WINDOW_FRAME_COLOR}
          roughness={WINDOW_FRAME_ROUGHNESS}
        />
      </mesh>

      {/* Bottom Frame Rail */}
      <mesh
        name="window-frame"
        position={[0, -h / 2 + frameT / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[w, frameT, frameDepth]} />
        <meshStandardMaterial
          color={WINDOW_FRAME_COLOR}
          roughness={WINDOW_FRAME_ROUGHNESS}
        />
      </mesh>

      {/* Left Frame Jamb */}
      <mesh
        name="window-frame"
        position={[-w / 2 + frameT / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[frameT, innerH, frameDepth]} />
        <meshStandardMaterial
          color={WINDOW_FRAME_COLOR}
          roughness={WINDOW_FRAME_ROUGHNESS}
        />
      </mesh>

      {/* Right Frame Jamb */}
      <mesh
        name="window-frame"
        position={[w / 2 - frameT / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[frameT, innerH, frameDepth]} />
        <meshStandardMaterial
          color={WINDOW_FRAME_COLOR}
          roughness={WINDOW_FRAME_ROUGHNESS}
        />
      </mesh>

      {/* Center Vertical Mullion & Handle for double-casement windows (>= 110 cm) */}
      {hasCenterMullion && (
        <>
          <mesh
            name="window-mullion"
            position={[0, 0, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[mullionW, innerH, frameDepth * 0.92]} />
            <meshStandardMaterial
              color={WINDOW_FRAME_COLOR}
              roughness={WINDOW_FRAME_ROUGHNESS}
            />
          </mesh>
          <mesh
            name="window-handle"
            position={[mullionW * 0.45, -4, frameDepth / 2 + 0.8]}
          >
            <boxGeometry args={[1.2, 8, 1.4]} />
            <meshStandardMaterial
              color={WINDOW_HANDLE_COLOR}
              roughness={0.35}
              metalness={0.75}
            />
          </mesh>
        </>
      )}

      {/* Projecting Window Sill (Fensterbank) */}
      <mesh
        name="window-sill"
        position={[0, -h / 2 - WINDOW_SILL_HEIGHT_CM / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[sillW, WINDOW_SILL_HEIGHT_CM, sillDepth]} />
        <meshStandardMaterial
          color={WINDOW_SILL_COLOR}
          roughness={0.72}
        />
      </mesh>

      {/* Single-pass Architectural Window Glass */}
      <mesh name="window-glass" position={[0, 0, 0]}>
        <boxGeometry args={[innerW, innerH, glassDepth]} />
        <meshStandardMaterial
          color={WINDOW_GLASS_COLOR}
          transparent
          opacity={WINDOW_GLASS_OPACITY}
          roughness={WINDOW_GLASS_ROUGHNESS}
          metalness={WINDOW_GLASS_METALNESS}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
