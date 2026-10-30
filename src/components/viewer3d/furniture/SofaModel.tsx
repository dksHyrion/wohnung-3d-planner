import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { FurnitureItem } from '../../../core/types';
import { sectionalSofaLayout } from '../../../core/furnitureShapes';
import { getLinenTexture } from '../../../core/materials/proceduralTextures';

export interface FurnitureModelProps {
  item: FurnitureItem;
  hasCollision?: boolean;
  isSelected?: boolean;
}

/**
 * Contemporary Low-Profile Scandinavian Sofa & Sectional with Chaise
 * Inspired by architectural magazine renderings (e.g. Muuto Connect, Hay Mags):
 * - Seamless PBR linen fabric texture with soft matte light diffusion
 * - Deep, plush seat cushions with generous 3.2cm rounded bevels
 * - Seamless support for L-chaise sectionals when designated or deep (W >= 210cm, D >= 130cm)
 * - Tilted backrest cushions with natural ergonomic slant
 * - Casual accent throw pillows with organic rotation
 */
export const SofaModel: React.FC<FurnitureModelProps> = ({
  item,
  hasCollision = false,
  isSelected = false,
}) => {
  const { widthCm: width, heightCm: height, depthCm: depth } = item;

  const linenTexture = useMemo(() => {
    try {
      return getLinenTexture();
    } catch {
      return null;
    }
  }, []);

  const sofaLayout = sectionalSofaLayout(item);
  const isSectional = sofaLayout.isSectional;

  const tintColor = hasCollision ? '#ef4444' : undefined;
  // Warm stone/beige architectural palette default (similar to Bild 1)
  const mainFabricColor = tintColor || item.color || '#e7e5e4';
  const cushionColor = tintColor || (item.color ? item.color : '#f5f5f4');
  const accentPillowColor = tintColor || '#b45309'; // warm amber/terracotta accent
  const secondPillowColor = tintColor || '#78716c'; // subtle taupe

  const plinthH = 0;
  const backDepth = Math.max(14, Math.min(24, (isSectional ? 95 : depth) * 0.22));
  const backH = height - plinthH;
  const armWidth = Math.max(14, Math.min(22, width * 0.08));
  const armH = (height - plinthH) * 0.68;

  // Regular sofa vs. Sectional chaise partition. Maße kommen aus furnitureShapes.
  const regularDepth = sofaLayout.regularDepth;
  const chaiseDepth = depth;
  const chaiseWidth = sofaLayout.chaiseWidth;
  const regularWidth = sofaLayout.regularWidth;

  const seatingW = Math.max(10, regularWidth - armWidth);
  const regularSeatingD = Math.max(10, regularDepth - backDepth);
  const chaiseSeatingD = Math.max(10, chaiseDepth - backDepth);
  const seatH = Math.max(12, (height - plinthH) * 0.42);

  const numRegularCushions = regularWidth >= 160 ? 2 : 1;
  const regCushionW = seatingW / numRegularCushions;

  return (
    <group>
      {/* 2. Main Backrest Frame (Continuous behind seating and chaise) */}
      <RoundedBox
        args={[width, backH, backDepth]}
        radius={2.4}
        smoothness={2}
        position={[
          0,
          -height / 2 + plinthH + backH / 2,
          -depth / 2 + backDepth / 2,
        ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={mainFabricColor}
          map={linenTexture}
          roughness={0.92}
          metalness={0.02}
        />
      </RoundedBox>

      {/* 3. Outer Left Armrest */}
      <RoundedBox
        args={[armWidth, armH, regularSeatingD]}
        radius={2.6}
        smoothness={2}
        position={[
          -width / 2 + armWidth / 2,
          -height / 2 + plinthH + armH / 2,
          -depth / 2 + backDepth + regularSeatingD / 2,
        ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={mainFabricColor}
          map={linenTexture}
          roughness={0.92}
          metalness={0.02}
        />
      </RoundedBox>

      {/* 4. Outer Right Armrest (Only if not full-width chaise or open end) */}
      {!isSectional && (
        <RoundedBox
          args={[armWidth, armH, regularSeatingD]}
          radius={2.6}
          smoothness={2}
          position={[
            width / 2 - armWidth / 2,
            -height / 2 + plinthH + armH / 2,
            -depth / 2 + backDepth + regularSeatingD / 2,
          ]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={mainFabricColor}
            map={linenTexture}
            roughness={0.92}
            metalness={0.02}
          />
        </RoundedBox>
      )}

      {/* 5. Regular Seat Cushions (with Linen PBR & 3.2cm rounded bevels) */}
      {Array.from({ length: numRegularCushions }).map((_, i) => {
        const cx = -width / 2 + armWidth + (i + 0.5) * regCushionW;
        return (
          <RoundedBox
            key={`reg-seat-${i}`}
            name="sofa-seat-cushion"
            args={[regCushionW - 1.2, seatH, regularSeatingD - 1]}
            radius={3.2}
            smoothness={3}
            position={[
              cx,
              -height / 2 + plinthH + seatH / 2,
              -depth / 2 + backDepth + regularSeatingD / 2,
            ]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={cushionColor}
              map={linenTexture}
              roughness={0.92}
              metalness={0.02}
            />
          </RoundedBox>
        );
      })}

      {/* 6. Regular Back Cushions (tilted ergonomically at 8 degrees) */}
      {Array.from({ length: numRegularCushions }).map((_, i) => {
        const cx = -width / 2 + armWidth + (i + 0.5) * regCushionW;
        const backCushionH = (height - plinthH - seatH) * 0.96;
        const backCushionD = Math.max(10, backDepth * 0.85);
        return (
          <RoundedBox
            key={`reg-back-${i}`}
            args={[regCushionW - 2, backCushionH, backCushionD]}
            radius={3.0}
            smoothness={3}
            position={[
              cx,
              -height / 2 + plinthH + seatH + backCushionH / 2,
              -depth / 2 + backDepth + backCushionD / 2 - 1,
            ]}
            rotation={[-0.12, 0, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={cushionColor}
              map={linenTexture}
              roughness={0.92}
              metalness={0.02}
            />
          </RoundedBox>
        );
      })}

      {/* 7. Sectional Chaise Lounge Module (Right side) */}
      {isSectional && (
        <group>
          {/* Extended Chaise Base Seat Cushion */}
          <RoundedBox
            name="sofa-chaise-cushion"
            args={[chaiseWidth - 1.5, seatH, chaiseSeatingD - 1]}
            radius={3.2}
            smoothness={3}
            position={[
              width / 2 - chaiseWidth / 2,
              -height / 2 + plinthH + seatH / 2,
              -depth / 2 + backDepth + chaiseSeatingD / 2,
            ]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={cushionColor}
              map={linenTexture}
              roughness={0.92}
              metalness={0.02}
            />
          </RoundedBox>

          {/* Chaise Back Cushion */}
          {(() => {
            const backCushionH = (height - plinthH - seatH) * 0.96;
            const backCushionD = Math.max(10, backDepth * 0.85);
            return (
              <RoundedBox
                args={[chaiseWidth - 3, backCushionH, backCushionD]}
                radius={3.0}
                smoothness={3}
                position={[
                  width / 2 - chaiseWidth / 2,
                  -height / 2 + plinthH + seatH + backCushionH / 2,
                  -depth / 2 + backDepth + backCushionD / 2 - 1,
                ]}
                rotation={[-0.12, 0, 0]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial
                  color={cushionColor}
                  map={linenTexture}
                  roughness={0.92}
                  metalness={0.02}
                />
              </RoundedBox>
            );
          })()}

          {/* Low End Chaise Cushion Roll / Bumper */}
          <RoundedBox
            args={[chaiseWidth - 4, 8, 14]}
            radius={2.5}
            smoothness={2}
            position={[
              width / 2 - chaiseWidth / 2,
              -height / 2 + plinthH + seatH + 4,
              depth / 2 - 10,
            ]}
            receiveShadow
          >
            <meshStandardMaterial
              color={mainFabricColor}
              map={linenTexture}
              roughness={0.92}
            />
          </RoundedBox>
        </group>
      )}

      {/* 8. Relaxed Accent Throw Pillows */}
      <RoundedBox
        args={[32, 32, 10]}
        radius={2.8}
        smoothness={2}
        position={[
          -width / 2 + armWidth + 16,
          -height / 2 + plinthH + seatH + 13,
          -depth / 2 + backDepth + 14,
        ]}
        rotation={[0.1, 0.45, -0.15]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={accentPillowColor}
          roughness={0.88}
          metalness={0.02}
        />
      </RoundedBox>

      <RoundedBox
        args={[28, 28, 9]}
        radius={2.6}
        smoothness={2}
        position={[
          isSectional ? width / 2 - chaiseWidth * 0.35 : width / 2 - armWidth - 14,
          -height / 2 + plinthH + seatH + 11,
          -depth / 2 + backDepth + 14,
        ]}
        rotation={[0.12, -0.38, 0.14]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={secondPillowColor}
          roughness={0.88}
          metalness={0.02}
        />
      </RoundedBox>
    </group>
  );
};
