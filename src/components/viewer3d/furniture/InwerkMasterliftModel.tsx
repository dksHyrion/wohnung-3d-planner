import React from 'react';
import { FurnitureModelProps } from './SofaModel';
import { sanitizeFurnitureColor } from './ArchitecturalFurniture3D';

/**
 * Inwerk Masterlift 2, weiße Platte 160 × 80 cm.
 * Die Platte ist 2,5 cm stark, der Verstellbereich laut Architonic 62,5 bis 127,5 cm.
 * Die gezeigte Höhe ist eine Sitzstellung in diesem Bereich, nicht eine gemessene Speicherposition.
 * Die Gestellfarbe steht im Wiki nicht. Das Modell zeigt das schwarze Gestell der Variante schwarz/weiß.
 */
export const InwerkMasterliftModel: React.FC<FurnitureModelProps> = React.memo(
  ({ item, hasCollision = false }) => {
    const width = item.widthCm || 160;
    const height = item.heightCm || 73;
    const depth = item.depthCm || 80;

    const tint = hasCollision ? '#ef4444' : undefined;
    const topColor = tint || sanitizeFurnitureColor(item.color, '#f7f6f2');
    const frameColor = tint || '#1c1c1c';

    const topT = 2.5;
    const footH = 4;
    const footD = Math.min(depth - 8, 70);
    const colW = 8;
    const colD = 5;
    const inset = Math.min(18, width * 0.12);
    const colX = width / 2 - inset;
    const colH = Math.max(8, height - topT - footH);
    const bottom = -height / 2;
    const beamH = 6;
    const beamY = height / 2 - topT - beamH / 2;

    const column = (x: number) => (
      <group key={x}>
        <mesh position={[x, bottom + footH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[colD, footH, footD]} />
          <meshStandardMaterial color={frameColor} roughness={0.45} metalness={0.35} />
        </mesh>
        <mesh position={[x, bottom + footH + colH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[colW, colH, colD]} />
          <meshStandardMaterial color={frameColor} roughness={0.45} metalness={0.35} />
        </mesh>
      </group>
    );

    return (
      <group name="inwerk-masterlift">
        <mesh position={[0, height / 2 - topT / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, topT, depth]} />
          <meshStandardMaterial color={topColor} roughness={0.62} metalness={0.02} />
        </mesh>
        <mesh position={[0, beamY, 0]} castShadow receiveShadow>
          <boxGeometry args={[colX * 2, beamH, colD]} />
          <meshStandardMaterial color={frameColor} roughness={0.45} metalness={0.35} />
        </mesh>
        {column(-colX)}
        {column(colX)}
        <mesh
          position={[width / 2 - 22, height / 2 - topT - 1.2, depth / 2 - 2]}
          castShadow
        >
          <boxGeometry args={[12, 2.2, 3.5]} />
          <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.2} />
        </mesh>
      </group>
    );
  }
);

InwerkMasterliftModel.displayName = 'InwerkMasterliftModel';
