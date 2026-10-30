import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  Environment,
  Lightformer,
  ContactShadows,
  RoundedBox,
} from '@react-three/drei';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { interpolateMood } from '../../core/lighting/moodPresets';
import { Corner, Wall, WallOpening } from '../../core/types';
import { getWallGeometry } from '../../core/wallMath';
import { openingLetsLightThrough } from '../../core/doorLeaf';

export const STUDIO_HEMISPHERE_SKY = '#e0f2fe';
export const STUDIO_HEMISPHERE_GROUND = '#f0e6d8';
export const STUDIO_HEMISPHERE_INTENSITY = 0.35;

export const BLUEPRINT_HEMISPHERE_SKY = '#64748b';
export const BLUEPRINT_HEMISPHERE_GROUND = '#1e293b';
export const BLUEPRINT_HEMISPHERE_INTENSITY = 0.45;

export const STUDIO_SUN_INTENSITY = 2.2;
export const BLUEPRINT_SUN_INTENSITY = 1.4;
export const STUDIO_SUN_COLOR = '#fff5ea';
export const BLUEPRINT_SUN_COLOR = '#ffffff';

export const FILL_LIGHT_INTENSITY = 0.25;
export const SUN_SHADOW_BIAS = -0.0004;
export const SUN_SHADOW_NORMAL_BIAS_CM = 1.2;
export const PLINTH_TOP_OFFSET_CM = -0.5;

export interface RoomBounds {
  cx: number;
  cz: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PlinthBounds {
  widthCm: number;
  depthCm: number;
  heightCm: number;
  centerX: number;
  centerYCm: number;
  centerZ: number;
}

export function computePlinthBounds(bounds: RoomBounds): PlinthBounds {
  const marginCm = 60;
  const widthCm = Math.max(600, bounds.maxX - bounds.minX + marginCm * 2);
  const depthCm = Math.max(600, bounds.maxZ - bounds.minZ + marginCm * 2);
  const heightCm = 20;
  return {
    widthCm,
    depthCm,
    heightCm,
    centerX: bounds.cx,
    centerYCm: -heightCm / 2 + PLINTH_TOP_OFFSET_CM,
    centerZ: bounds.cz,
  };
}

export interface WindowLightOrientation {
  hasWindows: boolean;
  sunPosition: [number, number, number];
  dominantNormal: { x: number; z: number };
  windowCount: number;
}

export function computeDominantWindowDirection(
  corners: Corner[],
  walls: Wall[],
  openings: WallOpening[],
  roomBounds: RoomBounds,
  elevationDeg: number = 45,
  sunDistance: number = 1800
): WindowLightOrientation {
  const windowOpenings = openings.filter((o) => openingLetsLightThrough(o.type));
  if (windowOpenings.length === 0) {
    return {
      hasWindows: false,
      sunPosition: [0, 0, 0],
      dominantNormal: { x: 0, z: 0 },
      windowCount: 0,
    };
  }

  const cornerMap = new Map<string, Corner>(corners.map((c) => [c.id, c]));
  const wallMap = new Map<string, Wall>(walls.map((w) => [w.id, w]));

  let totalNx = 0;
  let totalNz = 0;

  for (const op of windowOpenings) {
    const wall = wallMap.get(op.wallId);
    if (!wall) continue;
    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) continue;

    const geom = getWallGeometry(start, end);
    const toCenterX = roomBounds.cx - geom.centerX;
    const toCenterZ = roomBounds.cz - geom.centerZ;
    const inwardSign =
      toCenterX * geom.normal.x + toCenterZ * geom.normal.z >= 0 ? 1 : -1;
    const inwardNx = geom.normal.x * inwardSign;
    const inwardNz = geom.normal.z * inwardSign;

    totalNx += inwardNx * op.widthCm;
    totalNz += inwardNz * op.widthCm;
  }

  const len = Math.hypot(totalNx, totalNz) || 1;
  const domInwardX = totalNx / len;
  const domInwardZ = totalNz / len;

  const elevRad = (Math.max(10, elevationDeg) * Math.PI) / 180;
  const horizDist = sunDistance * Math.cos(elevRad);
  const sunY = Math.max(20, sunDistance * Math.sin(elevRad));
  const sunX = roomBounds.cx - domInwardX * horizDist;
  const sunZ = roomBounds.cz - domInwardZ * horizDist;

  return {
    hasWindows: true,
    sunPosition: [sunX, sunY, sunZ],
    dominantNormal: { x: domInwardX, z: domInwardZ },
    windowCount: windowOpenings.length,
  };
}

export interface StudioStage3DProps {
  roomBounds: RoomBounds;
  theme?: 'studio' | 'blueprint';
}

/**
 * Architectural studio stage environment:
 * - 20cm beveled plinth slab under the apartment
 * - Self-hosted environment with 3 parametric Lightformers (no external HTTP CDN calls)
 * - Directional sunlight vector computed from mood elevation and azimuth
 * - SoftShadows in beauty mode
 * - Seamless ground plane and ContactShadows beneath the plinth at Y = -20.1
 * - Blueprint theme compatibility with dark CAD stage and ambient fill
 */
export const StudioStage3D: React.FC<StudioStage3DProps> = ({
  roomBounds,
  theme,
}) => {
  const storeTheme = useFloorplanStore((s) => s.renderTheme);
  const timeOfDay = useFloorplanStore((s) => s.timeOfDay);
  const qualityMode = useFloorplanStore((s) => s.qualityMode);
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const openings = useFloorplanStore((s) => s.openings);
  const alignSunWithWindows = useFloorplanStore((s) => s.alignSunWithWindows);
  const activeTheme = theme ?? storeTheme;
  const isStudio = activeTheme === 'studio';
  const isBeauty = qualityMode === 'beauty' && isStudio;

  const mood = useMemo(() => interpolateMood(timeOfDay), [timeOfDay]);
  const plinth = useMemo(() => computePlinthBounds(roomBounds), [roomBounds]);

  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const sunTargetRef = useRef<THREE.Object3D>(null);

  // Compute shadow camera bounding box so high-res PCF shadows span the entire building
  const spanX = Math.max(600, roomBounds.maxX - roomBounds.minX);
  const spanZ = Math.max(600, roomBounds.maxZ - roomBounds.minZ);
  const shadowHalfSize = Math.max(spanX, spanZ) * 0.65 + 120;
  const shadowMapRes = isBeauty ? 2048 : 1024;
  const sunCastsShadow = !isStudio || mood.sunIntensity > 0.05;

  // Quantize contactScale in chunks of 200 to prevent WebGL render-target reallocations
  const rawContactScale = Math.max(1600, shadowHalfSize * 2);
  const contactScale = Math.ceil(rawContactScale / 200) * 200;

  // Calculate sun position vector from elevation and azimuth angles
  const elevationRad = (mood.sunElevationDeg * Math.PI) / 180;
  const azimuthRad = (mood.sunAzimuthDeg * Math.PI) / 180;
  const sunDist = 1800;
  const sunX = roomBounds.cx + sunDist * Math.cos(elevationRad) * Math.sin(azimuthRad);
  const sunY = Math.max(20, sunDist * Math.sin(elevationRad));
  const sunZ = roomBounds.cz + sunDist * Math.cos(elevationRad) * Math.cos(azimuthRad);

  const windowLighting = useMemo(
    () =>
      computeDominantWindowDirection(
        corners,
        walls,
        openings,
        roomBounds,
        mood.sunElevationDeg,
        sunDist
      ),
    [corners, walls, openings, roomBounds, mood.sunElevationDeg, sunDist]
  );

  const effectiveSunPosition: [number, number, number] =
    isStudio && alignSunWithWindows && windowLighting.hasWindows
      ? windowLighting.sunPosition
      : isStudio
      ? [sunX, sunY, sunZ]
      : [roomBounds.cx + 500, 750, roomBounds.cz + 400];

  useEffect(() => {
    if (sunLightRef.current) {
      if (sunTargetRef.current) {
        sunLightRef.current.target = sunTargetRef.current;
        sunTargetRef.current.updateMatrixWorld();
        sunLightRef.current.updateMatrixWorld();
      }
      sunLightRef.current.shadow.camera.updateProjectionMatrix();
      sunLightRef.current.shadow.needsUpdate = true;
    }
  }, [
    roomBounds.cx,
    roomBounds.cz,
    shadowHalfSize,
    effectiveSunPosition[0],
    effectiveSunPosition[1],
    effectiveSunPosition[2],
  ]);

  // Memoize Lightformer children so geometry changes don't re-trigger cube camera bakes unless colors change
  const lightformers = useMemo(
    () => (
      <>
        {/* Ceiling soft sky glow */}
        <Lightformer
          form="rect"
          intensity={2.5}
          color={mood.hemiSkyColor}
          position={[0, 600, 0]}
          rotation-x={Math.PI / 2}
          scale={[1200, 1200, 1]}
        />
        {/* Window-side directional lightformer */}
        <Lightformer
          form="rect"
          intensity={3.5}
          color={mood.sunColor}
          position={[-700, 300, 0]}
          rotation-y={Math.PI / 2}
          scale={[800, 400, 1]}
        />
        {/* Opposing fill bounce */}
        <Lightformer
          form="rect"
          intensity={1.2}
          color={mood.hemiGroundColor}
          position={[700, 200, 0]}
          rotation-y={-Math.PI / 2}
          scale={[600, 300, 1]}
        />
      </>
    ),
    [mood.hemiSkyColor, mood.sunColor, mood.hemiGroundColor]
  );

  return (
    <group name="studio-stage">
      {/* Target object for the sun directional light */}
      <object3D
        ref={sunTargetRef}
        position={[roomBounds.cx, 0, roomBounds.cz]}
      />

      {/* 1. Self-hosted IBL with parametric Lightformers */}
      {isStudio && (
        <Environment resolution={isBeauty ? 512 : 256} frames={1} environmentIntensity={mood.environmentIntensity}>
          {lightformers}
        </Environment>
      )}

      {/* Physical sky/ground hemisphere ambient light connected to dynamic mood in Studio mode */}
      <hemisphereLight
        color={isStudio ? mood.hemiSkyColor : BLUEPRINT_HEMISPHERE_SKY}
        groundColor={
          isStudio ? mood.hemiGroundColor : BLUEPRINT_HEMISPHERE_GROUND
        }
        intensity={
          isStudio ? mood.hemiIntensity : BLUEPRINT_HEMISPHERE_INTENSITY
        }
      />

      {/* Main architectural sunlight / key light with PCF shadows */}
      <directionalLight
        ref={sunLightRef}
        position={effectiveSunPosition}
        color={isStudio ? mood.sunColor : BLUEPRINT_SUN_COLOR}
        intensity={isStudio ? mood.sunIntensity : BLUEPRINT_SUN_INTENSITY}
        castShadow={sunCastsShadow}
        shadow-mapSize-width={shadowMapRes}
        shadow-mapSize-height={shadowMapRes}
        shadow-camera-left={-shadowHalfSize}
        shadow-camera-right={shadowHalfSize}
        shadow-camera-top={shadowHalfSize}
        shadow-camera-bottom={-shadowHalfSize}
        shadow-camera-near={100}
        shadow-camera-far={3500}
        shadow-bias={SUN_SHADOW_BIAS}
        shadow-normalBias={SUN_SHADOW_NORMAL_BIAS_CM}
        shadow-radius={isBeauty ? 2 : 3}
      />

      {/* Soft warm floor bounce light / secondary fill */}
      <directionalLight
        position={
          isStudio
            ? [roomBounds.cx + 500, 450, roomBounds.cz + 500]
            : [roomBounds.cx - 400, 500, roomBounds.cz - 300]
        }
        color={isStudio ? '#fffbeb' : '#ffffff'}
        intensity={FILL_LIGHT_INTENSITY}
      />

      {/* Simulated Radiosity / Upward Floor Bounce Light (Oak Floor Reflection) */}
      {isStudio && (
        <directionalLight
          name="floor-bounce-light"
          position={[roomBounds.cx - 200, 10, roomBounds.cz - 200]}
          target={sunTargetRef.current || undefined}
          color="#fed7aa"
          intensity={0.32}
        />
      )}

      {/* Floor-Level Contact Shadows directly under furniture on the apartment floor (Y = 0.05cm) */}
      {isStudio && (
        <ContactShadows
          name="floor-contact-shadows"
          position={[roomBounds.cx, 0.05, roomBounds.cz]}
          scale={[spanX + 160, spanZ + 160]}
          resolution={isBeauty ? 1024 : 512}
          far={isBeauty ? 100 : 80}
          blur={isBeauty ? 2.4 : 3.2}
          opacity={isBeauty ? 0.68 : 0.42}
          color="#292019"
          frames={1}
        />
      )}

      {/* 3. Beveled Architectural Plinth Slab (top surface at Y = -0.5cm to avoid z-fighting with Y=0 floor) */}
      {isStudio && (
        <group position={[plinth.centerX, plinth.centerYCm, plinth.centerZ]}>
          <RoundedBox
            args={[plinth.widthCm, plinth.heightCm, plinth.depthCm]}
            radius={1.5}
            smoothness={4}
            receiveShadow
          >
            <meshStandardMaterial
              color={mood.plinthColor}
              roughness={0.88}
              metalness={0.02}
            />
          </RoundedBox>
        </group>
      )}

      {/* Seamless studio ground plane at Y = -21.0 (Studio mode only) */}
      {isStudio && (
        <mesh
          name="studio-ground-plane"
          position={[roomBounds.cx, -21.0, roomBounds.cz]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[12000, 12000]} />
          <meshStandardMaterial
            color={mood.stageGradientBottom}
            roughness={0.95}
          />
        </mesh>
      )}

      {/* Soft architectural contact shadows & ambient occlusion beneath the plinth */}
      {isStudio && (
        <ContactShadows
          position={[roomBounds.cx, -20.6, roomBounds.cz]}
          opacity={isBeauty ? 0.55 : 0.32}
          blur={isBeauty ? 1.8 : 2.2}
          scale={contactScale}
          far={300}
          resolution={isBeauty ? 512 : 256}
          color="#1e293b"
          frames={1}
        />
      )}
    </group>
  );
};
