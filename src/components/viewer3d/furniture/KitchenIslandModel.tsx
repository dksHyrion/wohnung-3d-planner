import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { FurnitureModelProps } from './SofaModel';
import {
  getMarbleQuartzTexture,
  getLinenTexture,
} from '../../../core/materials/proceduralTextures';
import {
  KitchenSinkWithFaucet3D,
  InductionCooktop3D,
} from './KitchenFixtures3D';
import { useFloorplanStore } from '../../../store/useFloorplanStore';

/**
 * Contemporary Luxury Waterfall Quartz Kitchen Island & Barstools
 * Inspired by high-end architectural renderings (as in Bild 1):
 * - Seamless Calacatta Quartz waterfall countertop on left, right and top
 * - High-end clearcoat specular sheen and soft vein PBR texturing
 * - Undermount composite sink with gooseneck arch faucet
 * - Contemporary Scandinavian barstools with curved seats and footrest ring
 * - Decorative ceramic fruit bowl with fresh green apples on the island
 */
export const KitchenIslandModel: React.FC<FurnitureModelProps> = ({
  item,
  hasCollision = false,
  isSelected = false,
}) => {
  const showDecor = useFloorplanStore((s) => s.showDecor);
  const { widthCm: width, heightCm: height, depthCm: depth } = item;

  const quartzTexture = useMemo(() => {
    try {
      return getMarbleQuartzTexture();
    } catch {
      return null;
    }
  }, []);

  const linenTexture = useMemo(() => {
    try {
      return getLinenTexture();
    } catch {
      return null;
    }
  }, []);

  const tintColor = hasCollision ? '#ef4444' : undefined;
  const marbleColor = tintColor || '#f8fafc';
  const cabinetColor = tintColor || item.color || '#1e293b';
  const cooktopColor = tintColor || '#09090b';
  const sinkColor = tintColor || '#334155';
  const faucetColor = tintColor || '#0f172a';
  const stoolSeatColor = tintColor || '#e2d3bf'; // Scandinavian light oak / warm linen
  const metalColor = tintColor || '#18181b';
  const bowlColor = tintColor || '#ffffff';
  const appleColor = tintColor || '#65a30d';

  const stoneThickness = 4.8;
  const cabinetH = height - stoneThickness;
  const cabinetW = width - stoneThickness * 2;
  const overhangD = Math.max(18, Math.min(28, depth * 0.3));
  const cabinetD = depth - overhangD;

  const numStools = width >= 210 ? 3 : 2;
  const stoolSpacing = cabinetW / numStools;
  const stoolH = 65;

  return (
    <group>
      {/* 1. Waterfall Calacatta Quartz Countertop */}
      {/* Top Slab */}
      <RoundedBox
        args={[width, stoneThickness, depth]}
        radius={1.2}
        smoothness={3}
        position={[0, height / 2 - stoneThickness / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={marbleColor}
          map={quartzTexture}
          roughness={0.22}
          metalness={0.05}
        />
      </RoundedBox>

      {/* Left Waterfall Slab */}
      <RoundedBox
        args={[stoneThickness, cabinetH, depth]}
        radius={1.2}
        smoothness={3}
        position={[-width / 2 + stoneThickness / 2, -height / 2 + cabinetH / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={marbleColor}
          map={quartzTexture}
          roughness={0.22}
          metalness={0.05}
        />
      </RoundedBox>

      {/* Right Waterfall Slab */}
      <RoundedBox
        args={[stoneThickness, cabinetH, depth]}
        radius={1.2}
        smoothness={3}
        position={[width / 2 - stoneThickness / 2, -height / 2 + cabinetH / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={marbleColor}
          map={quartzTexture}
          roughness={0.22}
          metalness={0.05}
        />
      </RoundedBox>

      {/* 2. Recessed Cabinet Base with Drawers */}
      <mesh
        position={[
          0,
          -height / 2 + cabinetH / 2,
          -depth / 2 + cabinetD / 2,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[cabinetW - 1, cabinetH - 2, cabinetD]} />
        <meshStandardMaterial
          color={cabinetColor}
          roughness={0.65}
          metalness={0.1}
        />
      </mesh>

      {/* Drawer Seams Detail */}
      {[-cabinetW * 0.25, cabinetW * 0.25].map((dx, i) => (
        <mesh
          key={`drawer-line-${i}`}
          position={[
            dx,
            -height / 2 + cabinetH * 0.5,
            -depth / 2 + cabinetD + 0.2,
          ]}
        >
          <boxGeometry args={[1, cabinetH * 0.7, 0.4]} />
          <meshStandardMaterial color={metalColor} />
        </mesh>
      ))}

      {/* 3. Flush Induction Cooktop (Left side) */}
      <InductionCooktop3D
        position={[-width * 0.22, height / 2 + 0.25, -depth * 0.08]}
        widthCm={Math.min(60, width * 0.28)}
        depthCm={Math.min(50, depth * 0.55)}
        cooktopColor={cooktopColor}
        zoneCount={2}
      />

      {/* 4. Undermount Sink & Minimalist Faucet (Right side) */}
      <KitchenSinkWithFaucet3D
        position={[width * 0.22, height / 2, -depth * 0.08]}
        sinkWidthCm={Math.min(52, width * 0.25)}
        sinkDepthCm={Math.min(42, depth * 0.48)}
        rimThicknessCm={1.6}
        basinDepthCm={14}
        wallThicknessCm={1.2}
        sinkColor={sinkColor}
        faucetColor={faucetColor}
        faucetStyle="gooseneck"
      />

      {/* 5. Center Fruit Bowl on Island Countertop (as in Bild 1) */}
      {showDecor && (
        <group position={[0, height / 2 + stoneThickness / 2, -depth * 0.08]}>
          <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[9, 5, 3.8, 24]} />
            <meshStandardMaterial color={bowlColor} roughness={0.2} metalness={0.05} />
          </mesh>
          {/* Fresh Green Apples in Bowl */}
          {[
            [-2.2, 4.0, -1.5],
            [2.2, 4.0, -1.0],
            [0, 4.2, 2.5],
          ].map(([ax, ay, az], appleIdx) => (
            <mesh key={`island-apple-${appleIdx}`} position={[ax, ay, az]} castShadow>
              <sphereGeometry args={[1.9, 16, 16]} />
              <meshStandardMaterial color={appleColor} roughness={0.3} />
            </mesh>
          ))}
        </group>
      )}

      {/* 6. Designer Barstools along the seating overhang */}
      {Array.from({ length: numStools }).map((_, i) => {
        const sx = -cabinetW / 2 + (i + 0.5) * stoolSpacing;
        const sz = depth / 2 - overhangD / 2;

        return (
          <group key={`stool-${i}`} name="island-barstool" position={[sx, 0, sz]}>
            {/* Contoured Wooden/Linen Stool Seat */}
            <RoundedBox
              args={[34, 4.2, 32]}
              radius={1.4}
              smoothness={2}
              position={[0, -height / 2 + stoolH, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={stoolSeatColor}
                map={linenTexture}
                roughness={0.88}
                metalness={0.04}
              />
            </RoundedBox>

            {/* Low Supportive Stool Backrest Lip */}
            <RoundedBox
              args={[30, 8, 3]}
              radius={1.2}
              smoothness={2}
              position={[0, -height / 2 + stoolH + 5, -13]}
              receiveShadow
            >
              <meshStandardMaterial
                color={stoolSeatColor}
                map={linenTexture}
                roughness={0.88}
                metalness={0.04}
              />
            </RoundedBox>

            {/* 4 Tapered Metal Legs */}
            {[
              [-12, -12],
              [12, -12],
              [-12, 12],
              [12, 12],
            ].map(([lx, lz], legI) => (
              <mesh
                key={`leg-${legI}`}
                position={[lx * 0.75, -height / 2 + stoolH / 2, lz * 0.75]}
                castShadow
              >
                <cylinderGeometry args={[0.75, 1.1, stoolH, 12]} />
                <meshStandardMaterial
                  color={metalColor}
                  roughness={0.4}
                  metalness={0.8}
                />
              </mesh>
            ))}

            {/* Architectural Stool Footrest Ring */}
            <mesh
              position={[0, -height / 2 + 22, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[11, 0.75, 8, 24]} />
              <meshStandardMaterial
                color={metalColor}
                roughness={0.4}
                metalness={0.8}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
