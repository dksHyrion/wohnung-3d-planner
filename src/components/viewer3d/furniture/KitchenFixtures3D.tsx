import React from 'react';

export interface KitchenSinkWithFaucet3DProps {
  /** Total sink basin width in cm (default 50) */
  sinkWidthCm?: number;
  /** Total sink basin depth in cm (default 42) */
  sinkDepthCm?: number;
  /** Outer metal collar rim thickness in cm (default 1.6) */
  rimThicknessCm?: number;
  /** Depth of the sunken basin in cm (default 14) */
  basinDepthCm?: number;
  /** Basin wall thickness in cm (default 1.2) */
  wallThicknessCm?: number;
  /** Material color of outer sink collar (default '#334155') */
  sinkColor?: string;
  /** Material color of the faucet fixture (default '#0f172a') */
  faucetColor?: string;
  /** Basin inner color (default '#1e293b') */
  basinInnerColor?: string;
  /** Optional faucet style: high-arc swan neck (default) or gooseneck */
  faucetStyle?: 'swan-neck' | 'gooseneck';
  /** Optional group position */
  position?: [number, number, number];
  /** Optional group rotation */
  rotation?: [number, number, number];
}

/**
 * Reusable undermount sink with recessed basin, chrome drain, and faucet.
 * Includes polygonOffsetFactor={-2} on outer collar to eliminate Z-fighting.
 */
export const KitchenSinkWithFaucet3D: React.FC<KitchenSinkWithFaucet3DProps> = ({
  sinkWidthCm = 50,
  sinkDepthCm = 42,
  rimThicknessCm = 1.6,
  basinDepthCm = 14,
  wallThicknessCm = 1.2,
  sinkColor = '#334155',
  faucetColor = '#0f172a',
  basinInnerColor = '#1e293b',
  faucetStyle = 'swan-neck',
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) => {
  const innerW = Math.max(10, sinkWidthCm - wallThicknessCm * 2);
  const innerD = Math.max(10, sinkDepthCm - wallThicknessCm * 2);

  return (
    <group position={position} rotation={rotation}>
      {/* 1. Outer Sink Metal Rim / Collar (Raised 0.25cm above countertop to prevent Z-fighting) */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry
          args={[
            sinkWidthCm + rimThicknessCm * 2,
            0.5,
            sinkDepthCm + rimThicknessCm * 2,
          ]}
        />
        <meshStandardMaterial
          color={sinkColor}
          metalness={0.82}
          roughness={0.25}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* 2. Sunken Basin Floor */}
      <mesh position={[0, -basinDepthCm, 0]} receiveShadow>
        <boxGeometry args={[innerW, 0.8, innerD]} />
        <meshStandardMaterial
          color={basinInnerColor}
          metalness={0.85}
          roughness={0.3}
        />
      </mesh>

      {/* 3. Sunken Basin Walls */}
      {/* Left Wall */}
      <mesh
        position={[-sinkWidthCm / 2 + wallThicknessCm / 2, -basinDepthCm / 2, 0]}
        receiveShadow
      >
        <boxGeometry args={[wallThicknessCm, basinDepthCm, innerD]} />
        <meshStandardMaterial
          color={basinInnerColor}
          metalness={0.85}
          roughness={0.3}
        />
      </mesh>
      {/* Right Wall */}
      <mesh
        position={[sinkWidthCm / 2 - wallThicknessCm / 2, -basinDepthCm / 2, 0]}
        receiveShadow
      >
        <boxGeometry args={[wallThicknessCm, basinDepthCm, innerD]} />
        <meshStandardMaterial
          color={basinInnerColor}
          metalness={0.85}
          roughness={0.3}
        />
      </mesh>
      {/* Front Wall */}
      <mesh
        position={[0, -basinDepthCm / 2, sinkDepthCm / 2 - wallThicknessCm / 2]}
        receiveShadow
      >
        <boxGeometry args={[innerW, basinDepthCm, wallThicknessCm]} />
        <meshStandardMaterial
          color={basinInnerColor}
          metalness={0.85}
          roughness={0.3}
        />
      </mesh>
      {/* Back Wall */}
      <mesh
        position={[0, -basinDepthCm / 2, -sinkDepthCm / 2 + wallThicknessCm / 2]}
        receiveShadow
      >
        <boxGeometry args={[innerW, basinDepthCm, wallThicknessCm]} />
        <meshStandardMaterial
          color={basinInnerColor}
          metalness={0.85}
          roughness={0.3}
        />
      </mesh>

      {/* 4. Chrome Drain & Ring */}
      <mesh position={[0, -basinDepthCm + 0.45, 0]}>
        <cylinderGeometry args={[3.2, 3.2, 0.2, 24]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
      </mesh>
      <mesh
        position={[0, -basinDepthCm + 0.58, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[1.2, 2.2, 16]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>

      {/* 5. Faucet Fixture */}
      {faucetStyle === 'swan-neck' ? (
        <group position={[0, 0, -sinkDepthCm / 2 + 4]}>
          {/* Base Pillar */}
          <mesh position={[0, 9, 0]} castShadow>
            <cylinderGeometry args={[1.2, 1.4, 18, 16]} />
            <meshStandardMaterial
              color={faucetColor}
              metalness={0.9}
              roughness={0.15}
            />
          </mesh>
          {/* Swan-Neck Curved Spout */}
          <mesh position={[0, 21, 6]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <torusGeometry args={[6, 1.0, 12, 24, Math.PI]} />
            <meshStandardMaterial
              color={faucetColor}
              metalness={0.9}
              roughness={0.15}
            />
          </mesh>
          {/* Nozzle Tip */}
          <mesh position={[0, 15, 12]} castShadow>
            <cylinderGeometry args={[0.9, 0.9, 4, 12]} />
            <meshStandardMaterial
              color={faucetColor}
              metalness={0.9}
              roughness={0.15}
            />
          </mesh>
          {/* Single Lever Control */}
          <mesh position={[2.5, 8, 0]} rotation={[0, 0, -0.4]} castShadow>
            <cylinderGeometry args={[0.5, 0.5, 6, 8]} />
            <meshStandardMaterial
              color={faucetColor}
              metalness={0.9}
              roughness={0.15}
            />
          </mesh>
        </group>
      ) : (
        <group position={[0, 0, -sinkDepthCm / 2 - 2.5]}>
          {/* Vertical Standpipe */}
          <mesh position={[0, 11, 0]} castShadow>
            <cylinderGeometry args={[1.2, 1.4, 22, 16]} />
            <meshStandardMaterial
              color={faucetColor}
              roughness={0.15}
              metalness={0.9}
            />
          </mesh>
          {/* Curved Gooseneck Spout Horizontal Arm */}
          <mesh
            position={[0, 21, 6]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[1, 1, 12, 16]} />
            <meshStandardMaterial
              color={faucetColor}
              roughness={0.15}
              metalness={0.9}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};

export interface InductionCooktop3DProps {
  /** Width in cm (default 59) */
  widthCm?: number;
  /** Depth in cm (default 52) */
  depthCm?: number;
  /** Surface color of the ceramic glass (default '#18181b') */
  cooktopColor?: string;
  /** Number of circular induction cooking zones: 2 or 4 (default 4) */
  zoneCount?: 2 | 4;
  /** Optional group position */
  position?: [number, number, number];
  /** Optional group rotation */
  rotation?: [number, number, number];
}

/**
 * Reusable flush induction cooktop with glass ceramic plate and cooking zone rings.
 * Includes polygonOffsetFactor={-2} to prevent coplanar countertop Z-fighting.
 */
export const InductionCooktop3D: React.FC<InductionCooktop3DProps> = ({
  widthCm = 59,
  depthCm = 52,
  cooktopColor = '#18181b',
  zoneCount = 4,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) => {
  const zones: Array<{ x: number; z: number; radius: number }> =
    zoneCount === 2
      ? [
          { x: -widthCm * 0.22, z: 0, radius: 8 },
          { x: widthCm * 0.22, z: 0, radius: 8 },
        ]
      : [
          { x: -widthCm * 0.27, z: -depthCm * 0.23, radius: 8.5 },
          { x: widthCm * 0.27, z: -depthCm * 0.23, radius: 10.5 },
          { x: -widthCm * 0.27, z: depthCm * 0.23, radius: 9.5 },
          { x: widthCm * 0.27, z: depthCm * 0.23, radius: 7.5 },
        ];

  return (
    <group position={position} rotation={rotation}>
      {/* 1. Glass Ceramic Plate */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[widthCm, 0.5, depthCm]} />
        <meshStandardMaterial
          color={cooktopColor}
          roughness={0.1}
          metalness={0.25}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* 2. Induction Cooking Zone Rings */}
      {zones.map((zone, idx) => (
        <mesh
          key={`hob-ring-${idx}`}
          position={[zone.x, 0.28, zone.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[zone.radius - 0.4, zone.radius, 32]} />
          <meshBasicMaterial color="#52525b" />
        </mesh>
      ))}

      {/* 3. Touch Control Bar */}
      <mesh position={[0, 0.28, depthCm / 2 - 4]}>
        <boxGeometry args={[Math.min(24, widthCm * 0.45), 0.05, 1.8]} />
        <meshBasicMaterial color="#71717a" />
      </mesh>
    </group>
  );
};
