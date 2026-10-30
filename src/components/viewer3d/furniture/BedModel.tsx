import React, { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { FurnitureModelProps } from './SofaModel';
import {
  bedHeadboardDepthCm,
  bedLayout,
  NIGHTSTAND_HEIGHT_CM,
} from '../../../core/furnitureShapes';
import {
  getLinenTexture,
  getOakFurnitureTexture,
} from '../../../core/materials/proceduralTextures';
import { useFloorplanStore } from '../../../store/useFloorplanStore';

/**
 * Scandinavian Hotel-Luxury Double Bed & Integrated Nightstands
 * - Natural linen upholstered tufted headboard with PBR texture
 * - Layered duvet with natural fold-over turn-down
 * - Dual pairs of propped sleeping and accent pillows
 * - Light oak platform frame and cantilevered nightstands with ambient lamps
 */
export const BedModel: React.FC<FurnitureModelProps> = ({
  item,
  hasCollision = false,
  isSelected = false,
}) => {
  const showDecor = useFloorplanStore((s) => s.showDecor);
  const { widthCm: width, heightCm: height, depthCm: depth } = item;

  const linenTexture = useMemo(() => {
    try {
      return getLinenTexture();
    } catch {
      return null;
    }
  }, []);

  const oakTexture = useMemo(() => {
    try {
      return getOakFurnitureTexture();
    } catch {
      return null;
    }
  }, []);

  const tintColor = hasCollision ? '#ef4444' : undefined;
  const frameColor = tintColor || '#334155';
  const headboardColor = tintColor || item.color || '#e2d8ce'; // warm linen beige
  const mattressColor = tintColor || '#faf8f5';
  const duvetColor = tintColor || '#f1ebe4';
  const accentTurnDownColor = tintColor || '#94a3b8'; // subtle contrast runner
  const pillowColor = tintColor || '#f8fafc';
  const woodColor = tintColor || '#e8dbc8'; // natural light oak

  const headboardD = bedHeadboardDepthCm(depth);
  const headboardH = height;
  const frameH = 16;
  const legT = 5;

  const layout = bedLayout(item);
  const bedCoreW = width;
  const bedCoreD = depth - headboardD;

  const mattressH = Math.max(16, (height - frameH) * 0.42);
  const duvetD = bedCoreD * 0.65;

  const numChannels = 6;
  const channelW = width / numChannels;

  return (
    <group>
      {/* 1. Channel Tufted Upholstered Headboard with Linen PBR */}
      {Array.from({ length: numChannels }).map((_, i) => {
        const cx = -width / 2 + (i + 0.5) * channelW;
        return (
          <RoundedBox
            key={`hb-channel-${i}`}
            name="bed-headboard-channel"
            args={[channelW - 0.8, headboardH, headboardD]}
            radius={2.4}
            smoothness={3}
            position={[
              cx,
              0,
              -depth / 2 + headboardD / 2,
            ]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={headboardColor}
              map={linenTexture}
              roughness={0.9}
              metalness={0.02}
            />
          </RoundedBox>
        );
      })}

      {/* 2. Bettgestell auf Beinen, ohne Sockelpodest */}
      <RoundedBox
        name="bed-platform-frame"
        args={[bedCoreW, 3, bedCoreD - 2]}
        radius={0.4}
        smoothness={2}
        position={[
          0,
          -height / 2 + frameH - 1.5,
          -depth / 2 + headboardD + bedCoreD / 2,
        ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={woodColor}
          map={oakTexture}
          roughness={0.52}
          metalness={0.04}
        />
      </RoundedBox>
      {[
        [-bedCoreW / 2 + legT, -bedCoreD / 2 + legT],
        [bedCoreW / 2 - legT, -bedCoreD / 2 + legT],
        [-bedCoreW / 2 + legT, bedCoreD / 2 - legT],
        [bedCoreW / 2 - legT, bedCoreD / 2 - legT],
      ].map(([lx, lz], index) => (
        <mesh
          key={`bed-leg-${index}`}
          name="bed-leg"
          position={[
            lx,
            -height / 2 + (frameH - 3) / 2,
            -depth / 2 + headboardD + bedCoreD / 2 + lz,
          ]}
          castShadow
        >
          <boxGeometry args={[legT, frameH - 3, legT]} />
          <meshStandardMaterial
            color={woodColor}
            map={oakTexture}
            roughness={0.52}
            metalness={0.04}
          />
        </mesh>
      ))}

      {/* 3. Thick Comfort Mattress with Linen Weave */}
      <RoundedBox
        name="bed-mattress"
        args={[bedCoreW - 4, mattressH, bedCoreD - 6]}
        radius={2.8}
        smoothness={3}
        position={[
          0,
          -height / 2 + frameH + mattressH / 2,
          -depth / 2 + headboardD + bedCoreD / 2,
        ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={mattressColor}
          map={linenTexture}
          roughness={0.92}
          metalness={0.02}
        />
      </RoundedBox>

      {/* 4. Draped Layered Duvet with Turnover Fold */}
      <RoundedBox
        args={[bedCoreW - 2, mattressH * 0.48, duvetD]}
        radius={2.4}
        smoothness={3}
        position={[
          0,
          -height / 2 + frameH + mattressH + (mattressH * 0.48) / 2 - 2,
          -depth / 2 + headboardD + (bedCoreD - duvetD) + duvetD / 2,
        ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={duvetColor}
          map={linenTexture}
          roughness={0.92}
          metalness={0.02}
        />
      </RoundedBox>

      {/* Folded Duvet Accent Turn-Down */}
      {showDecor && (
        <RoundedBox
          args={[bedCoreW - 3, mattressH * 0.38, 22]}
          radius={2.0}
          smoothness={3}
          position={[
            0,
            -height / 2 + frameH + mattressH + (mattressH * 0.38) / 2 - 1,
            -depth / 2 + headboardD + (bedCoreD - duvetD) + 11,
          ]}
          receiveShadow
        >
          <meshStandardMaterial
            color={accentTurnDownColor}
            map={linenTexture}
            roughness={0.9}
            metalness={0.02}
          />
        </RoundedBox>
      )}

      {/* 5. Sleeping & Accent Pillows (tilted 15 degrees) */}
      {[-bedCoreW * 0.24, bedCoreW * 0.24].map((px, idx) => (
        <group key={`pillow-pair-${idx}`} position={[px, 0, 0]}>
          {/* Back Pillows */}
          <RoundedBox
            args={[Math.min(52, bedCoreW * 0.42), 24, 14]}
            radius={3.2}
            smoothness={3}
            position={[
              0,
              -height / 2 + frameH + mattressH + 11,
              -depth / 2 + headboardD + 13,
            ]}
            rotation={[-0.24, 0, 0]}
            receiveShadow
          >
            <meshStandardMaterial
              color={pillowColor}
              map={linenTexture}
              roughness={0.9}
              metalness={0.02}
            />
          </RoundedBox>
          {/* Front Pillows */}
          <RoundedBox
            args={[Math.min(46, bedCoreW * 0.38), 20, 12]}
            radius={3.0}
            smoothness={3}
            position={[
              0,
              -height / 2 + frameH + mattressH + 7,
              -depth / 2 + headboardD + 27,
            ]}
            rotation={[-0.16, 0, 0]}
            receiveShadow
          >
            <meshStandardMaterial
              color={accentTurnDownColor}
              map={linenTexture}
              roughness={0.9}
              metalness={0.02}
            />
          </RoundedBox>
        </group>
      ))}

      {/* 6. Nachtkästen. Außenmaß und Mitte sind dieselben Kästen wie in der Kollision. */}
      {layout.nightstands.map((stand) => (
        <group key={stand.id} position={[stand.cx, stand.cy, stand.cz]}>
          <RoundedBox
            name="bed-nightstand"
            args={[stand.widthCm, stand.heightCm, stand.depthCm]}
            radius={1.5}
            smoothness={3}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={woodColor}
              map={oakTexture}
              roughness={0.52}
              metalness={0.04}
            />
          </RoundedBox>
          {showDecor && (
            <mesh position={[0, NIGHTSTAND_HEIGHT_CM / 2 + 8, 0]} castShadow>
              <cylinderGeometry args={[4, 6, 16, 16]} />
              <meshStandardMaterial
                color="#fffbeb"
                emissive="#fef08a"
                emissiveIntensity={1.2}
                roughness={0.3}
                metalness={0.1}
                toneMapped={false}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
};
