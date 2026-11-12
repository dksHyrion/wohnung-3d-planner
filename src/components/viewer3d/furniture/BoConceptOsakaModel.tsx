import React from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { FurnitureModelProps } from './SofaModel';
import { isOsakaOpen, osakaSofaBedLayout } from '../../../core/furnitureShapes';

export const OSAKA_DIMENSIONS = {
  defaultWidthCm: 190,
  defaultHeightCm: 90,
  defaultDepthCm: 95,
  legHeightCm: 15,
  chassisHeightCm: 15,
  seatHeightCm: 45,
  armrestHeightCm: 65,
  armThicknessCm: 12,
  seatCushionWidthCm: 83,
} as const;

/**
 * BoConcept Osaka Schlafcouch, zugeklappt.
 * Außenmaß: rund 190 cm breit, 95 cm tief, 90 cm hoch.
 * Ausgeklappte Liegefläche: 170 × 200 cm.
 * Beine 15 cm, Sitzhöhe 45 cm, Armlehnen 65 cm hoch und 12 cm stark.
 */
export const BoConceptOsakaModel = React.memo<FurnitureModelProps>(
  ({ item, hasCollision = false }) => {
  const width = item.widthCm || OSAKA_DIMENSIONS.defaultWidthCm;
  const height = item.heightCm || OSAKA_DIMENSIONS.defaultHeightCm;
  const depth = item.depthCm || OSAKA_DIMENSIONS.defaultDepthCm;

  const tintColor = hasCollision ? '#ef4444' : undefined;
  const fabricColor = tintColor || item.color || '#78716c';
  const cushionColor = tintColor || (item.color ? item.color : '#837b75');
  const pillowColor = tintColor || item.color || '#b5a999';
  const legColor = tintColor || '#c5c8cc';

  const legH = OSAKA_DIMENSIONS.legHeightCm; // 15 cm
  const chassisH = OSAKA_DIMENSIONS.chassisHeightCm; // 15 cm (from 15 to 30)
  const seatH = OSAKA_DIMENSIONS.seatHeightCm; // 45 cm total from bottom
  const armH = OSAKA_DIMENSIONS.armrestHeightCm; // 65 cm total from bottom
  const armW = OSAKA_DIMENSIONS.armThicknessCm; // 12 cm
  const seatingW = Math.max(10, width - 2 * armW); // 146 cm
  const cushionW = seatingW / 2; // 73 cm each

  const backThickness = Math.max(12, Math.min(20, Math.min(depth, OSAKA_DIMENSIONS.defaultDepthCm) * 0.22)); // ~18 cm
  const isOpen = isOsakaOpen(item);
  // Ausgeklappt lesen Körper und Matratze dieselben Kästen wie 2D und Kollision.
  const openLayout = isOpen ? osakaSofaBedLayout({ ...item, widthCm: width, heightCm: height, depthCm: depth }) : null;
  const sofaBodyDepth = openLayout ? openLayout.body.depthCm : depth;
  const sofaCenterZ = -depth / 2 + sofaBodyDepth / 2;
  const seatingD = Math.max(10, sofaBodyDepth - backThickness);
  const cushionThickness = seatH - (legH + chassisH); // 45 - 30 = 15 cm
  const armBodyH = armH - legH; // 65 - 15 = 50 cm
  const backrestH = height - seatH; // 77 - 45 = 32 cm
  const openMattressDepth = openLayout ? openLayout.mattress.depthCm : 0;
  const openMattressCenterZ = openLayout ? openLayout.mattress.cz : 0;
  const openMattressWidth = openLayout ? openLayout.mattress.widthCm : 0;

  // Splay angle for legs: ~5 degrees (~0.087 rad)
  const splayRad = 0.087;

  return (
    <group>
      {/* 1. Four Slender Angled Scandi/Metal Legs (15 cm tall, splayed outward ~5°) */}
      {/* Front Left (of sofa chassis) */}
      <mesh
        position={[-width / 2 + 10, -height / 2 + legH / 2, -depth / 2 + sofaBodyDepth - 10]}
        rotation={[splayRad, 0, -splayRad]}
        receiveShadow
      >
        <cylinderGeometry args={[0.9, 1.4, legH, 16]} />
        <meshStandardMaterial color={legColor} roughness={0.35} metalness={0.85} />
      </mesh>

      {/* Front Right (of sofa chassis) */}
      <mesh
        position={[width / 2 - 10, -height / 2 + legH / 2, -depth / 2 + sofaBodyDepth - 10]}
        rotation={[splayRad, 0, splayRad]}
        receiveShadow
      >
        <cylinderGeometry args={[0.9, 1.4, legH, 16]} />
        <meshStandardMaterial color={legColor} roughness={0.35} metalness={0.85} />
      </mesh>

      {/* Rear Left */}
      <mesh
        position={[-width / 2 + 10, -height / 2 + legH / 2, -depth / 2 + 10]}
        rotation={[-splayRad, 0, -splayRad]}
        receiveShadow
      >
        <cylinderGeometry args={[0.9, 1.4, legH, 16]} />
        <meshStandardMaterial color={legColor} roughness={0.35} metalness={0.85} />
      </mesh>

      {/* Rear Right */}
      <mesh
        position={[width / 2 - 10, -height / 2 + legH / 2, -depth / 2 + 10]}
        rotation={[-splayRad, 0, splayRad]}
        receiveShadow
      >
        <cylinderGeometry args={[0.9, 1.4, legH, 16]} />
        <meshStandardMaterial color={legColor} roughness={0.35} metalness={0.85} />
      </mesh>

      {/* 2. Slim Lower Chassis Base (from Y=15 to Y=30 -> height 15cm) */}
      <RoundedBox
        args={[width, chassisH, sofaBodyDepth]}
        radius={1.5}
        smoothness={2}
        position={[0, -height / 2 + legH + chassisH / 2, sofaCenterZ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={fabricColor} roughness={0.92} metalness={0.05} />
      </RoundedBox>

      {/* 3. Backrest Frame Support (from Y=30 to Y=77) */}
      <RoundedBox
        args={[seatingW, height - (legH + chassisH), backThickness]}
        radius={2.0}
        smoothness={2}
        position={[
          0,
          -height / 2 + legH + chassisH + (height - (legH + chassisH)) / 2,
          -depth / 2 + backThickness / 2,
        ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={fabricColor} roughness={0.92} metalness={0.05} />
      </RoundedBox>

      {/* 4. Distinctive Slim Osaka Armrests (Height 65 cm from bottom, width 12 cm, depth 95 cm) */}
      {/* Left Armrest */}
      <group position={[-width / 2 + armW / 2, -height / 2 + legH + armBodyH / 2, sofaCenterZ]}>
        <RoundedBox
          args={[armW, armBodyH, sofaBodyDepth]}
          radius={1.8}
          smoothness={2}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={fabricColor} roughness={0.92} metalness={0.05} />
        </RoundedBox>
        {/* Danish decorative top piping seam */}
        <mesh position={[0, armBodyH / 2 + 0.1, 0]}>
          <boxGeometry args={[armW - 0.4, 0.4, sofaBodyDepth - 0.8]} />
          <meshStandardMaterial color={cushionColor} roughness={0.88} />
        </mesh>
      </group>

      {/* Right Armrest */}
      <group position={[width / 2 - armW / 2, -height / 2 + legH + armBodyH / 2, sofaCenterZ]}>
        <RoundedBox
          args={[armW, armBodyH, sofaBodyDepth]}
          radius={1.8}
          smoothness={2}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={fabricColor} roughness={0.92} metalness={0.05} />
        </RoundedBox>
        {/* Danish decorative top piping seam */}
        <mesh position={[0, armBodyH / 2 + 0.1, 0]}>
          <boxGeometry args={[armW - 0.4, 0.4, sofaBodyDepth - 0.8]} />
          <meshStandardMaterial color={cushionColor} roughness={0.88} />
        </mesh>
      </group>

      {/* 5. Unfolded Sleeper Mattress & Support Frame when pose === 'open', else Two Seat Cushions */}
      {isOpen ? (
        <group name="osaka-unfolded-bed">
          {/* Metal fold-out bed frame */}
          <RoundedBox
            args={[openMattressWidth, 4, openMattressDepth]}
            radius={0.8}
            smoothness={2}
            position={[0, -height / 2 + legH + chassisH - 2, openMattressCenterZ]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={legColor} roughness={0.4} metalness={0.8} />
          </RoundedBox>
          {/* Fold-out front support legs */}
          <mesh
            position={[-seatingW / 2 + 8, -height / 2 + (legH + chassisH - 4) / 2, depth / 2 - 10]}
            receiveShadow
          >
            <cylinderGeometry args={[0.9, 0.9, legH + chassisH - 4, 12]} />
            <meshStandardMaterial color={legColor} roughness={0.35} metalness={0.85} />
          </mesh>
          <mesh
            position={[seatingW / 2 - 8, -height / 2 + (legH + chassisH - 4) / 2, depth / 2 - 10]}
            receiveShadow
          >
            <cylinderGeometry args={[0.9, 0.9, legH + chassisH - 4, 12]} />
            <meshStandardMaterial color={legColor} roughness={0.35} metalness={0.85} />
          </mesh>
          {/* Unfolded sleeping mattress */}
          <RoundedBox
            args={[openMattressWidth, cushionThickness, openMattressDepth]}
            radius={2.2}
            smoothness={2}
            position={[
              0,
              -height / 2 + legH + chassisH + cushionThickness / 2,
              openMattressCenterZ,
            ]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={tintColor || '#edeae2'}
              roughness={0.88}
              metalness={0.02}
            />
          </RoundedBox>
        </group>
      ) : (
        <>
          {/* Left Seat Cushion */}
          <RoundedBox
            args={[cushionW - 0.8, cushionThickness, seatingD - 1]}
            radius={2.0}
            smoothness={2}
            position={[
              -cushionW / 2,
              -height / 2 + legH + chassisH + cushionThickness / 2,
              -depth / 2 + backThickness + seatingD / 2,
            ]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={cushionColor} roughness={0.92} metalness={0.05} />
          </RoundedBox>

          {/* Right Seat Cushion */}
          <RoundedBox
            args={[cushionW - 0.8, cushionThickness, seatingD - 1]}
            radius={2.0}
            smoothness={2}
            position={[
              cushionW / 2,
              -height / 2 + legH + chassisH + cushionThickness / 2,
              -depth / 2 + backThickness + seatingD / 2,
            ]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={cushionColor} roughness={0.92} metalness={0.05} />
          </RoundedBox>
        </>
      )}

      {/* 6. Two Tailored Backrest Cushions (Reaching total height 77 cm, tilted back ~8°) */}
      {/* Left Back Cushion */}
      <RoundedBox
        args={[cushionW - 1.2, backrestH - 1, backThickness * 0.75]}
        radius={2.2}
        smoothness={2}
        position={[
          -cushionW / 2,
          -height / 2 + seatH + backrestH / 2,
          -depth / 2 + backThickness * 0.5 + 2,
        ]}
        rotation={[-0.14, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={cushionColor} roughness={0.92} metalness={0.05} />
      </RoundedBox>

      {/* Right Back Cushion */}
      <RoundedBox
        args={[cushionW - 1.2, backrestH - 1, backThickness * 0.75]}
        radius={2.2}
        smoothness={2}
        position={[
          cushionW / 2,
          -height / 2 + seatH + backrestH / 2,
          -depth / 2 + backThickness * 0.5 + 2,
        ]}
        rotation={[-0.14, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={cushionColor} roughness={0.92} metalness={0.05} />
      </RoundedBox>

      {/* 7. Two Cozy Throw Pillows (propped against inner armrests) */}
      {/* Left Pillow */}
      <RoundedBox
        args={[28, 28, 9]}
        radius={2.5}
        smoothness={4}
        position={[
          -width / 2 + armW + 10,
          -height / 2 + seatH + 10,
          -depth / 2 + sofaBodyDepth - 28,
        ]}
        rotation={[0.15, 0.45, -0.2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={pillowColor} roughness={0.85} metalness={0.05} />
      </RoundedBox>

      {/* Right Pillow */}
      <RoundedBox
        args={[28, 28, 9]}
        radius={2.5}
        smoothness={4}
        position={[
          width / 2 - armW - 10,
          -height / 2 + seatH + 10,
          -depth / 2 + sofaBodyDepth - 28,
        ]}
        rotation={[0.15, -0.45, 0.2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={pillowColor} roughness={0.85} metalness={0.05} />
      </RoundedBox>
    </group>
  );
});
