import React from 'react';
import { RoundedBox } from '@react-three/drei';
import { FurnitureModelProps } from './SofaModel';
import { sanitizeFurnitureColor } from './ArchitecturalFurniture3D';
import { useFloorplanStore } from '../../../store/useFloorplanStore';

/**
 * Architectural Home-Office / Executive Desk Ensemble (Schreibtisch)
 * Features:
 * - Beveled natural oak tabletop (3.4 cm thick)
 * - Matte-black powder-coated steel sled frame legs + rear modesty beam
 * - Integrated 3-drawer under-desk pedestal cabinet (Rollcontainer) on the right
 * - Dark anthracite wool-felt desk pad, widescreen aluminum monitor, keyboard & mouse
 * - Contoured ergonomic swivel office chair tucked neatly at the front edge
 */
export const DeskModel: React.FC<FurnitureModelProps> = React.memo(
  ({ item, hasCollision = false }) => {
    const showDecor = useFloorplanStore((s) => s.showDecor);
    const width = item.widthCm || 150;
    const height = item.heightCm || 75;
    const depth = item.depthCm || 75;

    const tintColor = hasCollision ? '#ef4444' : undefined;
    const rawColor = sanitizeFurnitureColor(item.color, '#d6c5b3');
    const desktopColor = tintColor || rawColor;
    const metalFrameColor = tintColor || '#1e1e22';
    const cabinetColor = tintColor || '#f4f1ea';
    const feltPadColor = tintColor || '#27272a';
    const monitorColor = tintColor || '#0f172a';
    const aluminumColor = tintColor || '#cbd5e1';
    const chairColor = tintColor || '#3f3f46';

    const topH = 3.4;
    const legH = height - topH;
    const bottomY = -height / 2;
    const topSurfaceY = height / 2;
    const legW = 2.8;
    const frameDepth = Math.max(24, depth - 10);

    // Drawer pedestal on the right side
    const pedW = Math.min(38, width * 0.26);
    const pedH = legH - 4;
    const pedD = Math.max(24, depth - 14);
    const pedX = width / 2 - pedW / 2 - 6;

    // Ergonomic chair positioned on the left/center seating zone
    const chairX = -width * 0.12;
    const chairZ = depth / 2 - 12;
    const seatY = bottomY + 45;

    return (
      <group>
        {/* 1. Beveled Oak Tabletop */}
        <RoundedBox
          name="desk-tabletop"
          args={[width, topH, depth]}
          radius={0.8}
          smoothness={4}
          position={[0, topSurfaceY - topH / 2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={desktopColor}
            roughness={0.45}
            metalness={0.04}
          />
        </RoundedBox>

        {/* 2. Left Steel Sled Frame Leg (U-Profile) */}
        <group position={[-width / 2 + 6, bottomY + legH / 2, 0]}>
          {/* Front vertical post */}
          <mesh position={[0, 0, frameDepth / 2 - legW / 2]} castShadow>
            <boxGeometry args={[legW, legH, legW]} />
            <meshStandardMaterial
              color={metalFrameColor}
              roughness={0.35}
              metalness={0.8}
            />
          </mesh>
          {/* Rear vertical post */}
          <mesh position={[0, 0, -frameDepth / 2 + legW / 2]} castShadow>
            <boxGeometry args={[legW, legH, legW]} />
            <meshStandardMaterial
              color={metalFrameColor}
              roughness={0.35}
              metalness={0.8}
            />
          </mesh>
          {/* Bottom sled runner */}
          <mesh position={[0, -legH / 2 + legW / 2, 0]} castShadow>
            <boxGeometry args={[legW, legW, frameDepth]} />
            <meshStandardMaterial
              color={metalFrameColor}
              roughness={0.35}
              metalness={0.8}
            />
          </mesh>
        </group>

        {/* Rear structural cross-beam */}
        <mesh
          position={[0, topSurfaceY - topH - 8, -depth / 2 + 12]}
          castShadow
        >
          <boxGeometry args={[width - 14, 6, 2]} />
          <meshStandardMaterial
            color={metalFrameColor}
            roughness={0.4}
            metalness={0.75}
          />
        </mesh>

        {/* 3. Integrated 3-Drawer Pedestal Cabinet (Right Side) */}
        <group position={[pedX, bottomY + pedH / 2 + 2, -2]}>
          <RoundedBox
            args={[pedW, pedH, pedD]}
            radius={0.8}
            smoothness={3}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={cabinetColor}
              roughness={0.42}
              metalness={0.05}
            />
          </RoundedBox>
          {/* 3 Drawer Pull Seams */}
          {[-pedH * 0.28, 0, pedH * 0.28].map((dy, i) => (
            <mesh key={`drawer-${i}`} position={[0, dy + 6, pedD / 2 + 0.2]}>
              <boxGeometry args={[pedW - 6, 0.8, 0.5]} />
              <meshStandardMaterial color={metalFrameColor} roughness={0.5} />
            </mesh>
          ))}
        </group>

        {/* 4. Desktop Staging: Wool-Felt Pad, Ultrawide Monitor, Keyboard & Mouse */}
        {showDecor && (
          <group name="desk-monitor">
            {/* Felt Desk Pad */}
            <mesh
              position={[chairX, topSurfaceY + 0.15, 6]}
              receiveShadow
            >
              <boxGeometry args={[Math.min(72, width * 0.48), 0.3, Math.min(34, depth * 0.45)]} />
              <meshStandardMaterial color={feltPadColor} roughness={0.92} />
            </mesh>

            {/* Widescreen Monitor + Aluminum Stand */}
            <group position={[chairX, topSurfaceY, -depth / 2 + 16]}>
              {/* Monitor Base Plate */}
              <mesh position={[0, 0.4, 0]} castShadow>
                <boxGeometry args={[18, 0.8, 12]} />
                <meshStandardMaterial
                  color={aluminumColor}
                  roughness={0.25}
                  metalness={0.85}
                />
              </mesh>
              {/* Stand Neck */}
              <mesh position={[0, 8, -2]} rotation={[-0.12, 0, 0]} castShadow>
                <boxGeometry args={[3.5, 16, 1.2]} />
                <meshStandardMaterial
                  color={aluminumColor}
                  roughness={0.25}
                  metalness={0.85}
                />
              </mesh>
              {/* Ultra-thin Display Panel */}
              <RoundedBox
                args={[Math.min(62, width * 0.42), 28, 1.4]}
                radius={0.4}
                smoothness={3}
                position={[0, 22, 0]}
                castShadow
              >
                <meshStandardMaterial
                  color={monitorColor}
                  roughness={0.15}
                  metalness={0.4}
                />
              </RoundedBox>
            </group>

            {/* Compact Low-Profile Keyboard & Mouse */}
            <mesh position={[chairX - 3, topSurfaceY + 0.6, 8]}>
              <boxGeometry args={[28, 0.8, 10]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.2} />
            </mesh>
            <RoundedBox
              args={[5.5, 1.2, 9]}
              radius={0.5}
              smoothness={2}
              position={[chairX + 18, topSurfaceY + 0.7, 8]}
            >
              <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.2} />
            </RoundedBox>
          </group>
        )}

        {/* 5. Contoured Ergonomic Office Swivel Chair */}
        <group name="desk-office-chair" position={[chairX, 0, chairZ]}>
          {/* Contoured Seat Cushion */}
          <RoundedBox
            args={[42, 4, 38]}
            radius={1.5}
            smoothness={2}
            position={[0, seatY, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={chairColor}
              roughness={0.75}
              metalness={0.08}
            />
          </RoundedBox>

          {/* Ribbed Ergonomic Backrest */}
          <RoundedBox
            args={[38, 38, 3.2]}
            radius={1.5}
            smoothness={2}
            position={[0, seatY + 20, 17]}
            rotation={[-0.1, 0, 0]}
            receiveShadow
          >
            <meshStandardMaterial
              color={chairColor}
              roughness={0.75}
              metalness={0.08}
            />
          </RoundedBox>

          {/* Left & Right Loop Armrests */}
          {[-20, 20].map((ax, i) => (
            <mesh key={`arm-${i}`} position={[ax, seatY + 11, 2]}>
              <boxGeometry args={[2.2, 1.8, 22]} />
              <meshStandardMaterial
                color={metalFrameColor}
                roughness={0.3}
                metalness={0.8}
              />
            </mesh>
          ))}

          {/* Pneumatic Center Column */}
          <mesh position={[0, bottomY + 22, 0]} castShadow>
            <cylinderGeometry args={[2.0, 2.2, 42, 12]} />
            <meshStandardMaterial
              color={metalFrameColor}
              roughness={0.25}
              metalness={0.85}
            />
          </mesh>

          {/* 5-Star Base Spokes */}
          {[0, 72, 144, 216, 288].map((deg, idx) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <mesh
                key={`spoke-${idx}`}
                position={[Math.sin(rad) * 11, bottomY + 3, Math.cos(rad) * 11]}
                rotation={[0, rad, 0]}
                castShadow
              >
                <boxGeometry args={[2.2, 2.2, 22]} />
                <meshStandardMaterial
                  color={metalFrameColor}
                  roughness={0.25}
                  metalness={0.85}
                />
              </mesh>
            );
          })}
        </group>
      </group>
    );
  }
);

DeskModel.displayName = 'DeskModel';
