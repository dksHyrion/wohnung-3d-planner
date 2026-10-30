import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { FurnitureModelProps } from './SofaModel';
import { useFloorplanStore } from '../../../store/useFloorplanStore';
import { interpolateMood } from '../../../core/lighting/moodPresets';
import {
  KitchenSinkWithFaucet3D,
  InductionCooktop3D,
} from './KitchenFixtures3D';

export const KITCHEN_UNIT_DIMENSIONS = {
  counterHeightCm: 90,
  toeKickHeightCm: 10,
  toeKickDepthCm: 5,
  worktopThicknessCm: 3.8,
  sinkWidthCm: 55,
  sinkDepthCm: 42,
  hobWidthCm: 60,
  hobDepthCm: 52,
  upperCabinetDepthCm: 35,
  backsplashHeightCm: 55,
} as const;

/**
 * Minimalist White Kitchen Unit (Küchenzeile)
 * Contemporary architectural kitchen with handleless matte white fronts,
 * recessed toe-kick, undermount sink with high-arc swan-neck mixer tap,
 * flush induction cooktop, and upper wall cabinets with integrated warm LED task lighting.
 */
export const KitchenUnitModel = React.memo<FurnitureModelProps>(
  ({ item, hasCollision = false }) => {
    const timeOfDay = useFloorplanStore((s) => s.timeOfDay);
    const mood = useMemo(() => interpolateMood(timeOfDay), [timeOfDay]);

    const width = item.widthCm || 240;
    const height = item.heightCm || 215;
    const depth = item.depthCm || 60;

    const hasUpperCabinets = height >= 140;

    const tintColor = hasCollision ? '#ef4444' : undefined;
    const whiteFrontColor = tintColor || item.color || '#f8fafc';
    const worktopColor = tintColor || '#ffffff';
    const toeKickColor = tintColor || '#18181b';
    const grooveColor = tintColor || '#e2e8f0';
    const sinkColor = tintColor || '#475569';
    const faucetColor = tintColor || '#0f172a'; // Matte black or brushed stainless
    const hobColor = tintColor || '#09090b';

    const toeKickH = KITCHEN_UNIT_DIMENSIONS.toeKickHeightCm; // 10 cm
    const toeKickD = KITCHEN_UNIT_DIMENSIONS.toeKickDepthCm; // 5 cm
    const counterH = KITCHEN_UNIT_DIMENSIONS.counterHeightCm; // 90 cm
    const worktopH = KITCHEN_UNIT_DIMENSIONS.worktopThicknessCm; // 3.8 cm
    const baseCabinetH = counterH - toeKickH - worktopH; // ~76.2 cm

    // Origin (0,0,0) is at geometric center of bounding box:
    // Y: -height/2 to +height/2
    // Z: -depth/2 (wall side) to +depth/2 (room front)
    // X: -width/2 to +width/2

    const bottomY = -height / 2;
    const worktopY = bottomY + counterH - worktopH / 2;

    // Number of base cabinet modules (standard 60 cm kitchen modules)
    const numModules = Math.max(2, Math.round(width / 60));
    const moduleWidth = width / numModules;

    // Positioning of sink & cooktop along X axis
    // Usually sink on one side, cooktop on the other with prep space between
    const sinkX = -width / 2 + moduleWidth * 0.9;
    const hobX = width / 2 - moduleWidth * 1.1;

    // Upper cabinets geometry (when height >= 140)
    const upperDepth = Math.min(37, depth * 0.6);
    const upperBottomY = bottomY + counterH + KITCHEN_UNIT_DIMENSIONS.backsplashHeightCm;
    const upperH = Math.max(30, bottomY + height - upperBottomY);
    const upperCenterY = upperBottomY + upperH / 2;
    const upperZ = -depth / 2 + upperDepth / 2;

    return (
      <group>
        {/* 1. Recessed Toe-Kick (Sockelleiste) */}
        <mesh
          position={[
            0,
            bottomY + toeKickH / 2,
            -depth / 2 + (depth - toeKickD) / 2,
          ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[width - 0.5, toeKickH, depth - toeKickD]} />
          <meshStandardMaterial
            color={toeKickColor}
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>

        {/* 2. Base Cabinets Body (Unterschrank-Korpus) */}
        <mesh
          position={[0, bottomY + toeKickH + baseCabinetH / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[width, baseCabinetH, depth - 2]} />
          <meshStandardMaterial
            color={whiteFrontColor}
            roughness={0.4}
            metalness={0.05}
          />
        </mesh>

        {/* Front Doors & Horizontal Shadow Gap (Grifflose Griffrille) */}
        {/* Recessed Grip Rail Profile */}
        <mesh
          position={[
            0,
            bottomY + counterH - worktopH - 2,
            depth / 2 - 0.8,
          ]}
        >
          <boxGeometry args={[width, 3.5, 1.6]} />
          <meshStandardMaterial color={grooveColor} roughness={0.5} metalness={0.3} />
        </mesh>

        {/* Front Module Panels */}
        {Array.from({ length: numModules }).map((_, idx) => {
          const modX = -width / 2 + (idx + 0.5) * moduleWidth;
          return (
            <group key={`base-module-${idx}`} position={[modX, bottomY + toeKickH + (baseCabinetH - 4) / 2, depth / 2]}>
              <RoundedBox
                args={[moduleWidth - 0.4, baseCabinetH - 4, 1.8]}
                radius={0.3}
                smoothness={3}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial
                  color={whiteFrontColor}
                  roughness={0.35}
                  metalness={0.04}
                />
              </RoundedBox>
            </group>
          );
        })}

        {/* 3. Solid Surface Worktop (Arbeitsplatte) */}
        <RoundedBox
          args={[width, worktopH, depth]}
          radius={0.4}
          smoothness={3}
          position={[0, worktopY, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={worktopColor}
            roughness={0.25}
            metalness={0.06}
          />
        </RoundedBox>

        {/* 4. Undermount Sink (Spülbecken) */}
        <KitchenSinkWithFaucet3D
          position={[sinkX, worktopY + worktopH / 2, 0]}
          sinkWidthCm={KITCHEN_UNIT_DIMENSIONS.sinkWidthCm}
          sinkDepthCm={KITCHEN_UNIT_DIMENSIONS.sinkDepthCm}
          sinkColor={sinkColor}
          faucetColor={faucetColor}
          basinDepthCm={14}
          wallThicknessCm={1.2}
          rimThicknessCm={1.0}
        />

        {/* 5. Flush Induction Cooktop (Induktionskochfeld) */}
        <InductionCooktop3D
          position={[hobX, worktopY + worktopH / 2 + 0.25, 0]}
          widthCm={KITCHEN_UNIT_DIMENSIONS.hobWidthCm}
          depthCm={KITCHEN_UNIT_DIMENSIONS.hobDepthCm}
          cooktopColor={hobColor}
          zoneCount={4}
        />

        {/* 6. Upper Wall Cabinets & Integrated Task Lighting (when full height) */}
        {hasUpperCabinets && (
          <group>
            {/* Backsplash Panel (Nischenrückwand) */}
            <mesh
              position={[
                0,
                bottomY + counterH + KITCHEN_UNIT_DIMENSIONS.backsplashHeightCm / 2,
                -depth / 2 + 1,
              ]}
              receiveShadow
            >
              <boxGeometry
                args={[
                  width,
                  KITCHEN_UNIT_DIMENSIONS.backsplashHeightCm,
                  2,
                ]}
              />
              <meshStandardMaterial
                color="#f1f5f9"
                roughness={0.3}
                metalness={0.05}
              />
            </mesh>

            {/* Upper Wall Cabinets Body */}
            <mesh position={[0, upperCenterY, upperZ]} castShadow receiveShadow>
              <boxGeometry args={[width, upperH, upperDepth]} />
              <meshStandardMaterial
                color={whiteFrontColor}
                roughness={0.35}
                metalness={0.04}
              />
            </mesh>

            {/* Upper Cabinet Front Panels with Shadow Gaps */}
            {Array.from({ length: numModules }).map((_, idx) => {
              const modX = -width / 2 + (idx + 0.5) * moduleWidth;
              return (
                <RoundedBox
                  key={`upper-door-${idx}`}
                  args={[moduleWidth - 0.4, upperH - 0.8, 1.8]}
                  radius={0.3}
                  smoothness={3}
                  position={[modX, upperCenterY, upperZ + upperDepth / 2]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial
                    color={whiteFrontColor}
                    roughness={0.35}
                    metalness={0.04}
                  />
                </RoundedBox>
              );
            })}

            {/* Under-Cabinet LED Light Strip (Warme Nischenbeleuchtung) */}
            <mesh
              position={[0, upperBottomY - 0.5, upperZ]}
            >
              <boxGeometry args={[width - 6, 0.8, 2.5]} />
              <meshStandardMaterial
                color="#fffbeb"
                emissive={mood.lampColor}
                emissiveIntensity={mood.lampsActive ? mood.lampEmissiveIntensity * 0.8 : 0}
                toneMapped={false}
              />
            </mesh>

            {/* Downward Task Light onto Countertop */}
            <pointLight
              position={[0, upperBottomY - 4, -depth / 2 + depth * 0.45]}
              color={mood.lampColor}
              intensity={mood.lampsActive ? 1.2 : 0}
              distance={220}
              decay={2}
            />
          </group>
        )}
      </group>
    );
  }
);

KitchenUnitModel.displayName = 'KitchenUnitModel';
