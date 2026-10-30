import React from 'react';
import { FurnitureModelProps } from './SofaModel';
import { sanitizeFurnitureColor } from './ArchitecturalFurniture3D';

/**
 * Steelcase Gesture mit Kopfstütze.
 * Bodenkasten ist der Fußkreuz-Durchmesser 66 cm. Der Korpus ist laut Steelcase
 * 62,5 cm tief und mit Kopfstütze 107 cm hoch. Die Sitzhöhe 46 cm liegt im
 * genannten Bereich 41,5 bis 51,8 cm und ist keine gemessene Stellung.
 * Die Bezugsfarbe steht im Wiki nicht.
 * +Z ist die Sitzrichtung, zur Tischkante hin.
 */
export const SteelcaseGestureModel: React.FC<FurnitureModelProps> = React.memo(
  ({ item, hasCollision = false }) => {
    const width = item.widthCm || 66;
    const height = item.heightCm || 107;
    const depth = item.depthCm || 66;
    const bottom = -height / 2;

    const tint = hasCollision ? '#ef4444' : undefined;
    const fabric = tint || sanitizeFurnitureColor(item.color, '#8a8680');
    const frame = tint || '#1c1c1c';

    const baseR = Math.min(width, depth) / 2 - 1.2;
    const seatTop = bottom + height * (46 / 107);
    const seatH = 7;
    const seatW = Math.min(51, width - 12);
    const seatD = Math.min(47, depth - 18);
    const seatZ = depth / 2 - 7 - seatD / 2;
    const backT = 5.5;
    const backZ = -depth / 2 + backT / 2 + 2;
    const headH = 12;
    const headW = Math.min(26, seatW * 0.62);
    const backTop = height / 2 - headH - 3;
    const backBottom = seatTop - 8;
    const backH = Math.max(24, backTop - backBottom);
    const backY = (backTop + backBottom) / 2;
    const armW = 6;
    const armX = Math.min(width / 2 - armW / 2 - 0.6, seatW / 2 + armW / 2);
    const armTop = seatTop + 16;
    const armZ = seatZ + 2;

    const spoke = (deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return (
        <group key={deg} rotation={[0, rad, 0]}>
          <mesh position={[0, bottom + 4.2, baseR * 0.46]} castShadow receiveShadow>
            <boxGeometry args={[3.2, 2.2, baseR * 0.9]} />
            <meshStandardMaterial color={frame} roughness={0.45} metalness={0.35} />
          </mesh>
          <mesh position={[0, bottom + 2.1, baseR - 1.2]} castShadow>
            <sphereGeometry args={[1.7, 12, 8]} />
            <meshStandardMaterial color={frame} roughness={0.55} metalness={0.2} />
          </mesh>
        </group>
      );
    };

    const arm = (x: number) => (
      <group key={x}>
        <mesh position={[x, (seatTop + armTop) / 2 - 1, armZ - 4]} castShadow>
          <boxGeometry args={[1.6, armTop - seatTop, 3]} />
          <meshStandardMaterial color={frame} roughness={0.45} metalness={0.3} />
        </mesh>
        <mesh position={[x, armTop, armZ]} castShadow receiveShadow>
          <boxGeometry args={[armW, 2.4, seatD * 0.72]} />
          <meshStandardMaterial color={fabric} roughness={0.82} metalness={0.02} />
        </mesh>
      </group>
    );

    return (
      <group name="steelcase-gesture">
        <mesh position={[0, bottom + 4.6, 0]} castShadow>
          <cylinderGeometry args={[4.2, 4.2, 2.4, 16]} />
          <meshStandardMaterial color={frame} roughness={0.4} metalness={0.4} />
        </mesh>
        {[0, 72, 144, 216, 288].map(spoke)}
        <mesh position={[0, (bottom + 6 + seatTop - seatH) / 2, seatZ - 2]} castShadow>
          <cylinderGeometry args={[2.4, 3.2, seatTop - seatH - bottom - 6, 12]} />
          <meshStandardMaterial color={frame} roughness={0.4} metalness={0.45} />
        </mesh>
        <mesh position={[0, seatTop - seatH / 2, seatZ]} castShadow receiveShadow>
          <boxGeometry args={[seatW, seatH, seatD]} />
          <meshStandardMaterial color={fabric} roughness={0.84} metalness={0.02} />
        </mesh>
        <mesh position={[0, backY, backZ]} castShadow receiveShadow>
          <boxGeometry args={[Math.min(43, seatW - 4), backH, backT]} />
          <meshStandardMaterial color={fabric} roughness={0.84} metalness={0.02} />
        </mesh>
        <mesh position={[0, height / 2 - headH / 2 - 0.4, backZ + 1.2]} castShadow>
          <boxGeometry args={[headW, headH, 7]} />
          <meshStandardMaterial color={fabric} roughness={0.84} metalness={0.02} />
        </mesh>
        {arm(-armX)}
        {arm(armX)}
      </group>
    );
  }
);

SteelcaseGestureModel.displayName = 'SteelcaseGestureModel';
