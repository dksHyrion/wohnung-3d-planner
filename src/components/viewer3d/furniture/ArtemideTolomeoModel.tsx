import React, { useMemo } from 'react';
import * as THREE from 'three';
import { FurnitureModelProps } from './SofaModel';
import { useFloorplanStore } from '../../../store/useFloorplanStore';
import { interpolateMood } from '../../../core/lighting/moodPresets';

export const TOLOMEO_DIMENSIONS = {
  diffuserDiameterCm: 36,
  diffuserHeightCm: 21,
  canopyDiameterCm: 18,
  canopyHeightCm: 4,
  armThicknessCm: 1.6,
  cableThicknessCm: 0.25,
} as const;

/**
 * Artemide Tolomeo Sospensione Decentrata
 * Iconic Italian suspension light designed by Michele De Lucchi & Giancarlo Fassina (1987).
 *
 * Architectural detailing:
 * - Ceiling canopy in brushed aluminium
 * - Articulated double cantilever arm in extruded polished aluminium
 * - High-tensile stainless steel tension wires and joint rings
 * - Conical diffuser shade in translucent parchment paper (warm ivory tone)
 * - Concentric top opening ring with heat-dissipating grip
 * - Warm 2700K downward point light casting soft glow onto dining table
 */
export const ArtemideTolomeoModel = React.memo<FurnitureModelProps>(
  ({ item, hasCollision = false }) => {
    const timeOfDay = useFloorplanStore((s) => s.timeOfDay);
    const roomLightsActive = useFloorplanStore((s) => s.roomLightsActive);
    const mood = useMemo(() => interpolateMood(timeOfDay), [timeOfDay]);
    const isLightOn = roomLightsActive || mood.lampsActive;

    const width = item.widthCm || 45;
    const height = item.heightCm || 90;
    const depth = item.depthCm || 150;

    const tintColor = hasCollision ? '#ef4444' : undefined;
    const aluminiumColor = tintColor || '#cbd5e1';
    const cableColor = tintColor || '#64748b';
    const jointColor = tintColor || '#94a3b8';
    const shadeColor = tintColor || '#fdfbf7'; // Warm Italian parchment

    const diffR = TOLOMEO_DIMENSIONS.diffuserDiameterCm / 2; // 18 cm
    const diffH = TOLOMEO_DIMENSIONS.diffuserHeightCm; // 21 cm
    const canopyR = TOLOMEO_DIMENSIONS.canopyDiameterCm / 2; // 9 cm
    const canopyH = TOLOMEO_DIMENSIONS.canopyHeightCm; // 4 cm

    // Lamp coordinates relative to center (0, 0, 0):
    // Top ceiling mount is at Y = +height / 2
    // Bottom of the diffuser shade is at Y = -height / 2
    // Cantilever extends along Z axis from canopy (Z = -depth / 2 + 15) to shade (Z = depth / 2 - 25)

    const canopyZ = -depth / 2 + 15;
    const shadeZ = depth / 2 - 25;
    const armMidZ = (canopyZ + shadeZ) * 0.45;
    const armMidY = height * 0.15;

    return (
      <group>
        {/* 1. Ceiling Canopy Mount (Rosette) */}
        <mesh
          position={[0, height / 2 - canopyH / 2, canopyZ]}
          castShadow
        >
          <cylinderGeometry args={[canopyR, canopyR + 0.5, canopyH, 24]} />
          <meshStandardMaterial
            color={aluminiumColor}
            metalness={0.88}
            roughness={0.22}
          />
        </mesh>

        {/* 2. Vertical Drop Rod from Canopy to First Articulation Joint */}
        <mesh
          position={[0, height / 2 - canopyH - 6, canopyZ]}
          castShadow
        >
          <cylinderGeometry args={[0.8, 0.8, 12, 16]} />
          <meshStandardMaterial
            color={aluminiumColor}
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>

        {/* Joint 1: Ceiling Pivot Ring */}
        <mesh
          position={[0, height / 2 - canopyH - 12, canopyZ]}
          castShadow
        >
          <cylinderGeometry args={[2.2, 2.2, 2.4, 16]} />
          <meshStandardMaterial
            color={jointColor}
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>

        {/* 3. Primary Cantilever Arm (Angles forward and slightly downward) */}
        {/* Computes angled cylinder between Joint 1 and Joint 2 */}
        <group position={[0, height / 2 - canopyH - 12, canopyZ]}>
          <lineSegments>
            <bufferGeometry />
          </lineSegments>
        </group>

        {/* Arm Segment 1: Joint 1 -> Elbow */}
        {(() => {
          const dy = armMidY - (height / 2 - canopyH - 12);
          const dz = armMidZ - canopyZ;
          const len = Math.hypot(dy, dz);
          const angle = Math.atan2(dz, dy);
          return (
            <mesh
              position={[
                0,
                (height / 2 - canopyH - 12 + armMidY) / 2,
                (canopyZ + armMidZ) / 2,
              ]}
              rotation={[angle, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.7, 0.7, len, 12]} />
              <meshStandardMaterial
                color={aluminiumColor}
                metalness={0.85}
                roughness={0.22}
              />
            </mesh>
          );
        })()}

        {/* Tension Cable 1: Stainless steel wire offset along Arm 1 */}
        {(() => {
          const dy = armMidY - (height / 2 - canopyH - 12);
          const dz = armMidZ - canopyZ;
          const len = Math.hypot(dy, dz);
          const angle = Math.atan2(dz, dy);
          return (
            <mesh
              position={[
                0,
                (height / 2 - canopyH - 12 + armMidY) / 2 + 1.8,
                (canopyZ + armMidZ) / 2,
              ]}
              rotation={[angle, 0, 0]}
            >
              <cylinderGeometry args={[0.15, 0.15, len * 0.95, 8]} />
              <meshStandardMaterial
                color={cableColor}
                metalness={0.95}
                roughness={0.15}
              />
            </mesh>
          );
        })()}

        {/* Joint 2: Articulated Elbow with Tension Disc */}
        <group position={[0, armMidY, armMidZ]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[2.0, 2.0, 2.6, 16]} />
            <meshStandardMaterial
              color={jointColor}
              metalness={0.92}
              roughness={0.18}
            />
          </mesh>
          {/* Tension wire pulley disc */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[2.5, 0.25, 8, 24]} />
            <meshStandardMaterial
              color={cableColor}
              metalness={0.95}
              roughness={0.1}
            />
          </mesh>
        </group>

        {/* Arm Segment 2: Elbow -> Shade Joint */}
        {(() => {
          const targetY = -height / 2 + diffH + 12;
          const dy = targetY - armMidY;
          const dz = shadeZ - armMidZ;
          const len = Math.hypot(dy, dz);
          const angle = Math.atan2(dz, dy);
          return (
            <mesh
              position={[0, (armMidY + targetY) / 2, (armMidZ + shadeZ) / 2]}
              rotation={[angle, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[0.65, 0.65, len, 12]} />
              <meshStandardMaterial
                color={aluminiumColor}
                metalness={0.85}
                roughness={0.22}
              />
            </mesh>
          );
        })()}

        {/* Tension Cable 2 along Arm 2 */}
        {(() => {
          const targetY = -height / 2 + diffH + 12;
          const dy = targetY - armMidY;
          const dz = shadeZ - armMidZ;
          const len = Math.hypot(dy, dz);
          const angle = Math.atan2(dz, dy);
          return (
            <mesh
              position={[
                0,
                (armMidY + targetY) / 2 + 1.6,
                (armMidZ + shadeZ) / 2,
              ]}
              rotation={[angle, 0, 0]}
            >
              <cylinderGeometry args={[0.15, 0.15, len * 0.95, 8]} />
              <meshStandardMaterial
                color={cableColor}
                metalness={0.95}
                roughness={0.15}
              />
            </mesh>
          );
        })()}

        {/* Joint 3: Swivel Head Joint over Lamp Shade */}
        <group position={[0, -height / 2 + diffH + 10, shadeZ]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[1.6, 1.6, 2.2, 16]} />
            <meshStandardMaterial
              color={jointColor}
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
          {/* Characteristic Tolomeo shade adjuster rod / handle */}
          <mesh position={[0, -2.5, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 5, 8]} />
            <meshStandardMaterial
              color={aluminiumColor}
              metalness={0.88}
              roughness={0.2}
            />
          </mesh>
        </group>

        {/* 4. Conical Diffuser Shade (Parchment Paper / Satinstoff) */}
        {/* Open top ring */}
        <mesh position={[0, -height / 2 + diffH, shadeZ]} castShadow>
          <torusGeometry args={[diffR * 0.38, 0.5, 12, 32]} />
          <meshStandardMaterial
            color={aluminiumColor}
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>

        {/* Main Translucent Parchment Cone */}
        <mesh
          position={[0, -height / 2 + diffH / 2, shadeZ]}
          castShadow
          receiveShadow
        >
          {/* Cylinder with top radius smaller than bottom radius creates classic Tolomeo cone */}
          <cylinderGeometry
            args={[diffR * 0.38, diffR, diffH, 32, 1, true]}
          />
          <meshStandardMaterial
            color={shadeColor}
            roughness={0.65}
            metalness={0.02}
            side={THREE.DoubleSide}
            emissive={mood.lampColor}
            emissiveIntensity={isLightOn ? Math.max(1.2, mood.lampEmissiveIntensity) : 0}
            toneMapped={false}
          />
        </mesh>

        {/* Inner bulb emission surface */}
        <mesh position={[0, -height / 2 + diffH * 0.65, shadeZ]}>
          <sphereGeometry args={[4.2, 16, 16]} />
          <meshBasicMaterial color="#fffbeb" />
        </mesh>

        {/* 5. Realistic Warm Downward Point Light onto Dining Table (without expensive 6-pass cubemap shadow map) */}
        <pointLight
          position={[0, -height / 2 + 5, shadeZ]}
          color={mood.lampColor}
          intensity={isLightOn ? 1.6 : 0.05}
          distance={320}
          decay={2}
        />
      </group>
    );
  }
);

ArtemideTolomeoModel.displayName = 'ArtemideTolomeoModel';
