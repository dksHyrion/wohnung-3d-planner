import React from 'react';
import { RoundedBox } from '@react-three/drei';
import { FurnitureModelProps } from './SofaModel';
import { sanitizeFurnitureColor } from './ArchitecturalFurniture3D';

/**
 * Musterring Sorrent, 200 cm, zwei Schwebetüren.
 * Maße aus dem Inventar: 200 breit, 67 tief, 217 hoch.
 * Die rechte Tür ist der Spiegel. Welche Seite der Spiegel hat, steht im Wiki nicht.
 * Schiebetüren haben keinen Auszug vor dem Korpus.
 */
export const MusterringSorrentModel: React.FC<FurnitureModelProps> = React.memo(
  ({ item, hasCollision = false }) => {
    const width = item.widthCm || 200;
    const height = item.heightCm || 217;
    const depth = item.depthCm || 67;

    const tint = hasCollision ? '#ef4444' : undefined;
    const bodyColor = tint || sanitizeFurnitureColor(item.color, '#f3efe8');
    const panelColor = tint || '#f7f4ee';
    const trackColor = tint || '#2c2a28';
    const frameColor = tint || '#3a3834';

    const bottomY = -height / 2;
    const trackH = 2.4;
    const doorT = 1.6;
    const trackGap = 0.5;
    const sideFrame = 1.4;
    const overlap = Math.min(8, width * 0.04);
    const doorW = width / 2 + overlap / 2;
    const doorH = height - trackH * 2 - 0.6;
    const doorY = bottomY + trackH + doorH / 2;

    const frontZ = depth / 2 - doorT / 2;
    const rearZ = frontZ - doorT - trackGap;
    const leftX = -width / 2 + doorW / 2;
    const rightX = width / 2 - doorW / 2;

    const carcassD = Math.max(8, depth - doorT * 2 - trackGap - 1.2);
    const carcassZ = -depth / 2 + carcassD / 2;

    return (
      <group>
        <RoundedBox
          name="sorrent-carcass"
          args={[width - 0.4, height - 0.4, carcassD]}
          radius={0.3}
          smoothness={2}
          position={[0, 0, carcassZ]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={bodyColor} roughness={0.72} metalness={0.02} />
        </RoundedBox>

        {[-1, 1].map((side) => (
          <mesh
            key={`sorrent-stile-${side}`}
            position={[side * (width / 2 - sideFrame / 2), 0, depth / 2 - doorT - 0.2]}
            castShadow
          >
            <boxGeometry args={[sideFrame, height, doorT + 0.4]} />
            <meshStandardMaterial color={frameColor} roughness={0.55} metalness={0.08} />
          </mesh>
        ))}

        {[bottomY + trackH / 2, bottomY + height - trackH / 2].map((y, index) => (
          <mesh key={`sorrent-track-${index}`} position={[0, y, frontZ - doorT / 2]}>
            <boxGeometry args={[width - sideFrame * 2, trackH, doorT * 2 + trackGap]} />
            <meshStandardMaterial color={trackColor} roughness={0.4} metalness={0.35} />
          </mesh>
        ))}

        <RoundedBox
          name="sorrent-door-panel"
          args={[doorW - 0.4, doorH, doorT]}
          radius={0.15}
          smoothness={2}
          position={[leftX, doorY, rearZ]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={panelColor} roughness={0.62} metalness={0.03} />
        </RoundedBox>

        <RoundedBox
          name="sorrent-door-mirror-frame"
          args={[doorW - 0.4, doorH, doorT]}
          radius={0.15}
          smoothness={2}
          position={[rightX, doorY, frontZ]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={frameColor} roughness={0.45} metalness={0.2} />
        </RoundedBox>
        <mesh
          name="sorrent-mirror"
          position={[rightX, doorY, frontZ + doorT / 2 + 0.05]}
          castShadow
        >
          <boxGeometry args={[doorW - 3.2, doorH - 3.2, 0.15]} />
          <meshStandardMaterial
            color={tint || '#d5dbe3'}
            roughness={0.08}
            metalness={0.92}
          />
        </mesh>
      </group>
    );
  }
);

MusterringSorrentModel.displayName = 'MusterringSorrentModel';
