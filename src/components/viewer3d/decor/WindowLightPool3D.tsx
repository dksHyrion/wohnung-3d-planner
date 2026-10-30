import React, { useMemo } from 'react';
import * as THREE from 'three';
import { WallOpening } from '../../../core/types';
import {
  windowLightPoolCenter,
  windowLightPoolOpacity,
  windowLightPoolRotation,
} from '../../../core/windowLight';

let cachedPoolTexture: THREE.CanvasTexture | null = null;

function getPoolTexture(): THREE.CanvasTexture | null {
  if (cachedPoolTexture) return cachedPoolTexture;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // Hell an der Fensterkante, zu den Seiten und in den Raum weich auslaufend.
  const fade = ctx.createRadialGradient(64, 0, 10, 64, 48, 168);
  fade.addColorStop(0, 'rgba(255,255,255,1)');
  fade.addColorStop(0.42, 'rgba(255,255,255,0.45)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 128, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cachedPoolTexture = texture;
  return cachedPoolTexture;
}

export interface WindowLightPool3DProps {
  opening: WallOpening;
  wallLengthCm: number;
  wallThicknessCm: number;
  inwardSign: 1 | -1;
  color: string;
  intensity: number;
}

/**
 * Weicher Fleck auf dem Boden. Die Farbe ist die Sonne, nicht das Himmelsblau im Fenster.
 * Hell an der Fensterwand, zu den Seiten und in den Raum auslaufend.
 */
export const WindowLightPool3D: React.FC<WindowLightPool3DProps> = ({
  opening,
  wallLengthCm,
  wallThicknessCm,
  inwardSign,
  color,
  intensity,
}) => {
  const opacity = windowLightPoolOpacity(intensity);
  const center = windowLightPoolCenter({
    offsetFromStartCm: opening.offsetFromStartCm,
    widthCm: opening.widthCm,
    wallLengthCm,
    wallThicknessCm,
    inwardSign,
  });
  const rotation = windowLightPoolRotation(inwardSign);
  const texture = useMemo(() => getPoolTexture(), []);

  if (opacity <= 0.01) return null;

  return (
    <mesh
      name="window-light-pool"
      position={[center.x, 1.2, center.z]}
      rotation={rotation}
      raycast={() => null}
    >
      <planeGeometry args={[center.widthCm, center.depthCm]} />
      <meshBasicMaterial
        color={color}
        map={texture ?? undefined}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
};
