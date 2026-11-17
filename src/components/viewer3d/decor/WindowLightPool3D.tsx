import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { WallOpening } from '../../../core/types';
import {
  computeWindowSunPolygon,
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
  wallAngleRad?: number;
  sunDirToRoom?: { x: number; y: number; z: number };
}

/**
 * Projiziertes Sonnenlicht-Trapez am Boden (y = 1.2 cm) abhängig von Tageszeit
 * und Sonnenvektor; fällt ohne Sonnenvektor auf den weichen Standard-Fleck zurück.
 */
export const WindowLightPool3D: React.FC<WindowLightPool3DProps> = ({
  opening,
  wallLengthCm,
  wallThicknessCm,
  inwardSign,
  color,
  intensity,
  wallAngleRad,
  sunDirToRoom,
}) => {
  const opacity = windowLightPoolOpacity(intensity);
  const texture = useMemo(() => getPoolTexture(), []);

  const sunPolygon = useMemo(() => {
    if (wallAngleRad === undefined || !sunDirToRoom) return undefined;
    return computeWindowSunPolygon({
      offsetFromStartCm: opening.offsetFromStartCm,
      widthCm: opening.widthCm,
      sillHeightCm: opening.sillHeightCm,
      heightCm: opening.heightCm,
      wallLengthCm,
      wallThicknessCm,
      inwardSign,
      wallAngleRad,
      sunDirToRoom,
    });
  }, [
    opening.offsetFromStartCm,
    opening.widthCm,
    opening.sillHeightCm,
    opening.heightCm,
    wallLengthCm,
    wallThicknessCm,
    inwardSign,
    wallAngleRad,
    sunDirToRoom,
  ]);

  const sunQuadGeom = useMemo(() => {
    if (!sunPolygon) return null;
    const { nearLeft, nearRight, farRight, farLeft } = sunPolygon;
    // Double-sided flat floor quad at y = 0 in local space (mesh placed at y = 1.2)
    const positions = new Float32Array([
      nearLeft.x, 0, nearLeft.z,
      nearRight.x, 0, nearRight.z,
      farRight.x, 0, farRight.z,
      nearLeft.x, 0, nearLeft.z,
      farRight.x, 0, farRight.z,
      farLeft.x, 0, farLeft.z,
    ]);
    // UV v=1 at near (sill) edge -> bright texture top; v=0 at far edge -> soft fade
    const uvs = new Float32Array([
      0, 1,
      1, 1,
      1, 0,
      0, 1,
      1, 0,
      0, 0,
    ]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.computeVertexNormals();
    return geom;
  }, [sunPolygon]);

  useEffect(() => {
    return () => {
      sunQuadGeom?.dispose();
    };
  }, [sunQuadGeom]);

  if (opacity <= 0.01) return null;

  // When sun direction is known and window faces away from sun, skip direct sunlight patch
  if (sunPolygon === null) return null;

  if (sunQuadGeom) {
    return (
      <mesh
        name="window-light-pool"
        position={[0, 1.2, 0]}
        raycast={() => null}
      >
        <primitive object={sunQuadGeom} attach="geometry" />
        <meshBasicMaterial
          color={color}
          map={texture ?? undefined}
          transparent
          opacity={opacity}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }

  const center = windowLightPoolCenter({
    offsetFromStartCm: opening.offsetFromStartCm,
    widthCm: opening.widthCm,
    wallLengthCm,
    wallThicknessCm,
    inwardSign,
  });
  const rotation = windowLightPoolRotation(inwardSign);

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
