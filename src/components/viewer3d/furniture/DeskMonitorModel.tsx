import React from 'react';
import { FurnitureModelProps } from './SofaModel';
import { sanitizeFurnitureColor } from './ArchitecturalFurniture3D';

/**
 * Ein Monitor auf der Tischplatte.
 * 27 Zoll, 16:9, ist ein Standardmaß. Diagonale, Marke und Stückzahl
 * stehen im Wiki nicht. Der Kasten 62×50×22 enthält Panel und Fuß.
 * +Z ist die Bildseite, zum Stuhl hin.
 */
export const DeskMonitorModel: React.FC<FurnitureModelProps> = React.memo(
  ({ item, hasCollision = false }) => {
    const width = item.widthCm || 62;
    const height = item.heightCm || 50;
    const depth = item.depthCm || 22;
    const bottom = -height / 2;

    const tint = hasCollision ? '#ef4444' : undefined;
    const bezel = tint || sanitizeFurnitureColor(item.color, '#1c1c1c');
    const stand = tint || '#3d3d3d';
    const screen = tint || '#14181c';

    const panelH = Math.min(36, height - 12);
    const panelT = 2.4;
    const panelZ = depth / 2 - panelT / 2 - 1.2;
    const panelY = bottom + height - panelH / 2 - 1;
    const footW = Math.min(24, width * 0.4);
    const footD = depth - 3;
    const neckH = Math.max(6, panelY - panelH / 2 - (bottom + 2.2));

    return (
      <group name="desk-monitor">
        <mesh position={[0, bottom + 1.1, -1]} castShadow receiveShadow>
          <boxGeometry args={[footW, 2.2, footD]} />
          <meshStandardMaterial color={stand} roughness={0.45} metalness={0.35} />
        </mesh>
        <mesh position={[0, bottom + 2.2 + neckH / 2, panelZ - 1]} castShadow>
          <boxGeometry args={[4.5, neckH, 3]} />
          <meshStandardMaterial color={stand} roughness={0.45} metalness={0.35} />
        </mesh>
        <mesh position={[0, panelY, panelZ]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.6, panelH, panelT]} />
          <meshStandardMaterial color={bezel} roughness={0.4} metalness={0.25} />
        </mesh>
        <mesh position={[0, panelY, panelZ + panelT / 2 + 0.05]}>
          <boxGeometry args={[width - 3.2, panelH - 2.4, 0.15]} />
          <meshStandardMaterial color={screen} roughness={0.25} metalness={0.15} />
        </mesh>
      </group>
    );
  }
);

DeskMonitorModel.displayName = 'DeskMonitorModel';
