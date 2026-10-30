import React from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { FurnitureModelProps } from './SofaModel';

export const VITSOE_606_DIMENSIONS = {
  defaultWidthCm: 91.2,
  defaultHeightCm: 170,
  defaultDepthCm: 22,
  shelfCount: 5,
  shelfPitchCm: 32,
  eTrackWidthCm: 3.5,
  eTrackDepthCm: 1.8,
  eTrackHeightCm: 170,
} as const;

const ARCH_BOOKS = [
  { w: 3.2, h: 24, c: '#1e293b' }, // Charcoal
  { w: 2.8, h: 22, c: '#f8fafc' }, // Offwhite
  { w: 3.5, h: 25, c: '#65a30d' }, // Muted Olive
  { w: 3.0, h: 23, c: '#b45309' }, // Terracotta
  { w: 3.6, h: 24.5, c: '#0369a1' }, // Deep Blue
  { w: 2.6, h: 21, c: '#475569' }, // Slate
  { w: 3.4, h: 23.5, c: '#d97706' }, // Amber
  { w: 3.0, h: 22.5, c: '#713f12' }, // Leather brown
] as const;

const MAGAZINES = [
  { w: 2.2, h: 26, d: 18, c: '#334155' },
  { w: 2.0, h: 25.5, d: 18, c: '#64748b' },
  { w: 2.4, h: 26, d: 18, c: '#94a3b8' },
  { w: 2.1, h: 25, d: 18, c: '#cbd5e1' },
  { w: 2.5, h: 26.5, d: 18, c: '#0f172a' },
  { w: 2.2, h: 25, d: 18, c: '#e2e8f0' },
] as const;

/**
 * Vitsœ 606 Universal Shelving System (Dieter Rams, 1960)
 * Architectural reproduction with 5 shelves, extruded anodized aluminium E-tracks,
 * integrated side bookend flaps, and curated smart-staging:
 * - Tablar 1 (oben): Minimalistisches Keramik-Objekt / Donut-Vase und Freiraum
 * - Tablar 2: Kompakte Reihe von 8 Architekturbänden mit 1 angelehntem Buch
 * - Tablar 3: 2 liegende Bildbände + kleine rankende Efeupflanze mit überhängenden Blättern
 * - Tablar 4: Magazin-/Buchreihe mit minimalistischen Monografien
 * - Tablar 5 (unten): Aufgeräumter Freiraum mit Archiv-/Dokumentenbox
 */
export const Vitsoe606Model = React.memo<FurnitureModelProps>(
  ({ item, hasCollision = false }) => {
  const width = item.widthCm || VITSOE_606_DIMENSIONS.defaultWidthCm;
  const height = item.heightCm || VITSOE_606_DIMENSIONS.defaultHeightCm;
  const depth = item.depthCm || VITSOE_606_DIMENSIONS.defaultDepthCm;

  const tintColor = hasCollision ? '#ef4444' : undefined;
  const shelfColor = tintColor || (item.color && item.color !== '#94a3b8' ? item.color : '#f4f3ef');
  const aluminiumColor = tintColor || '#cbd5e1';
  const slotColor = tintColor || '#64748b';

  const numShelves = VITSOE_606_DIMENSIONS.shelfCount; // 5
  const pitch = VITSOE_606_DIMENSIONS.shelfPitchCm; // 32 cm
  const bottomOffset = 21; // 21, 53, 85, 117, 149 cm

  const trackW = VITSOE_606_DIMENSIONS.eTrackWidthCm; // 3.5 cm
  const trackD = VITSOE_606_DIMENSIONS.eTrackDepthCm; // 1.8 cm
  const trackH = height; // 170 cm

  // Distance of tracks from center: standard Rams 90 cm track center-to-center
  const trackX = Math.min(width / 2 - trackW / 2 - 0.5, 45);
  // Mount against wall at back (-depth / 2)
  const trackZ = -depth / 2 + trackD / 2;

  // Shelf dimensions
  const shelfPlateH = 1.0;
  const shelfPlateD = depth - 0.6;
  const shelfFlangeH = 11.5;
  const shelfFlangeThickness = 0.35;
  const shelfZ = -depth / 2 + shelfPlateD / 2;

  // Heights for the 5 shelves from bottom (-height / 2)
  const shelfYPositions = Array.from({ length: numShelves }).map(
    (_, i) => -height / 2 + bottomOffset + i * pitch
  );

  // Decorative slots along the E-tracks
  const slotSteps = 10;
  const slotSpacing = height / (slotSteps + 1);

  return (
    <group>
      {/* 1. Two Vertical Extruded Aluminium E-Tracks (Wandschienen) */}
      {/* Left E-Track */}
      <group position={[-trackX, 0, trackZ]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[trackW, trackH, trackD]} />
          <meshStandardMaterial
            color={aluminiumColor}
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
        {/* Notch cutout slots */}
        {Array.from({ length: slotSteps }).map((_, idx) => (
          <mesh
            key={`l-slot-${idx}`}
            position={[0, -height / 2 + (idx + 1) * slotSpacing, trackD / 2 + 0.05]}
          >
            <boxGeometry args={[0.5, 1.8, 0.1]} />
            <meshStandardMaterial color={slotColor} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* Right E-Track */}
      <group position={[trackX, 0, trackZ]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[trackW, trackH, trackD]} />
          <meshStandardMaterial
            color={aluminiumColor}
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
        {/* Notch cutout slots */}
        {Array.from({ length: slotSteps }).map((_, idx) => (
          <mesh
            key={`r-slot-${idx}`}
            position={[0, -height / 2 + (idx + 1) * slotSpacing, trackD / 2 + 0.05]}
          >
            <boxGeometry args={[0.5, 1.8, 0.1]} />
            <meshStandardMaterial color={slotColor} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* 2. Five Powder-Coated Metal Shelves (Tablare) with Integrated Flanges */}
      {shelfYPositions.map((yPos, i) => (
        <group key={`shelf-${i}`}>
          {/* Main Horizontal Shelf Plate */}
          <RoundedBox
            args={[width, shelfPlateH, shelfPlateD]}
            radius={0.2}
            smoothness={2}
            position={[0, yPos + shelfPlateH / 2, shelfZ]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={shelfColor}
              roughness={0.38}
              metalness={0.15}
            />
          </RoundedBox>

          {/* Left Bookend Flange (abgewinkelter Seitenflansch) */}
          <RoundedBox
            args={[shelfFlangeThickness, shelfFlangeH, shelfPlateD]}
            radius={0.15}
            smoothness={2}
            position={[
              -width / 2 + shelfFlangeThickness / 2,
              yPos + shelfFlangeH / 2,
              shelfZ,
            ]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={shelfColor}
              roughness={0.38}
              metalness={0.15}
            />
          </RoundedBox>

          {/* Right Bookend Flange (abgewinkelter Seitenflansch) */}
          <RoundedBox
            args={[shelfFlangeThickness, shelfFlangeH, shelfPlateD]}
            radius={0.15}
            smoothness={2}
            position={[
              width / 2 - shelfFlangeThickness / 2,
              yPos + shelfFlangeH / 2,
              shelfZ,
            ]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={shelfColor}
              roughness={0.38}
              metalness={0.15}
            />
          </RoundedBox>
        </group>
      ))}

      {/* 3. Deterministisches Smart-Staging der 5 Tablare */}

      {/* --- TABLAR 1 (oben, index 4): Donut-Vase / Keramik-Objekt + Freiraum --- */}
      <group position={[-16, shelfYPositions[4] + shelfPlateH, shelfZ]}>
        {/* Ceramic Donut Vase standing upright */}
        <mesh
          position={[0, 9.5, 0]}
          rotation={[0, 0.35, 0]}
          castShadow
          receiveShadow
        >
          <torusGeometry args={[7, 2.6, 16, 32]} />
          <meshStandardMaterial
            color="#e7e3dc"
            roughness={0.88}
            metalness={0.04}
          />
        </mesh>
        {/* Small organic pebble bowl */}
        <mesh
          position={[28, 2.0, 3]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[4.2, 3.2, 3.8, 16]} />
          <meshStandardMaterial
            color="#dcd7cd"
            roughness={0.9}
            metalness={0.02}
          />
        </mesh>
      </group>

      {/* --- TABLAR 2 (index 3): Kompakte Reihe von 8 Architekturbänden + 1 angelehntes Buch --- */}
      <group position={[-width / 2 + 3, shelfYPositions[3] + shelfPlateH, shelfZ]}>
        {ARCH_BOOKS.reduce(
          (acc, book, bIdx) => {
            const currentX = acc.totalX + book.w / 2;
            acc.elements.push(
              <RoundedBox
                key={`arch-book-${bIdx}`}
                args={[book.w - 0.2, book.h, 16.5]}
                radius={0.3}
                smoothness={2}
                position={[currentX, book.h / 2, 0]}
                receiveShadow
              >
                <meshStandardMaterial
                  color={book.c}
                  roughness={0.75}
                  metalness={0.05}
                />
              </RoundedBox>
            );
            acc.totalX += book.w;
            return acc;
          },
          {
            totalX: 1.0,
            elements: [] as React.ReactNode[],
          }
        ).elements}

        {/* Leaning book against the 8-book stack */}
        <group position={[28, 10.5, 0]} rotation={[0, 0, -0.24]}>
          <RoundedBox
            args={[2.8, 23, 16]}
            radius={0.3}
            smoothness={2}
            receiveShadow
          >
            <meshStandardMaterial
              color="#e2e8f0"
              roughness={0.72}
              metalness={0.06}
            />
          </RoundedBox>
        </group>
      </group>

      {/* --- TABLAR 3 (mitte, index 2): 2 liegende Bildbände + Efeupflanze mit überhängenden Blättern --- */}
      <group position={[0, shelfYPositions[2] + shelfPlateH, shelfZ]}>
        {/* 2 Stacking Coffee Table Books on left side */}
        <group position={[-16, 0, 0]}>
          {/* Bottom Volume */}
          <RoundedBox
            args={[22, 3.2, 18]}
            radius={0.4}
            smoothness={2}
            position={[0, 1.6, 0]}
            receiveShadow
          >
            <meshStandardMaterial color="#1e293b" roughness={0.7} />
          </RoundedBox>
          {/* Top Volume */}
          <RoundedBox
            args={[19, 2.6, 16]}
            radius={0.3}
            smoothness={2}
            position={[1, 3.2 + 1.3, -0.5]}
            receiveShadow
          >
            <meshStandardMaterial color="#f1f5f9" roughness={0.65} />
          </RoundedBox>
        </group>

        {/* Trailing Ivy Plant in stoneware ceramic pot on right side */}
        <group position={[18, 0, 1]}>
          {/* Ceramic Pot */}
          <mesh position={[0, 3.8, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[4.2, 3.2, 7.6, 18]} />
            <meshStandardMaterial
              color="#e2ded7"
              roughness={0.85}
              metalness={0.05}
            />
          </mesh>
          {/* Soil */}
          <mesh position={[0, 7.2, 0]}>
            <cylinderGeometry args={[3.8, 3.8, 0.4, 18]} />
            <meshStandardMaterial color="#3f2e1e" roughness={0.95} />
          </mesh>
          {/* Green Foliage Crown */}
          <mesh position={[0, 8.5, 0]}>
            <sphereGeometry args={[4.6, 14, 14]} />
            <meshStandardMaterial color="#15803d" roughness={0.88} />
          </mesh>
          {/* Hanging trailing ivy leaves over front edge */}
          <mesh position={[1.5, 1.5, 7.2]} rotation={[0.4, 0.2, 0.1]}>
            <boxGeometry args={[3.2, 8.5, 1.2]} />
            <meshStandardMaterial color="#166534" roughness={0.85} />
          </mesh>
          <mesh position={[-1.2, -1.8, 8.0]} rotation={[0.2, -0.3, -0.15]}>
            <boxGeometry args={[2.6, 7.0, 1.0]} />
            <meshStandardMaterial color="#15803d" roughness={0.85} />
          </mesh>
        </group>
      </group>

      {/* --- TABLAR 4 (index 1): Magazin-/Buchreihe mit Monografien --- */}
      <group position={[-width / 2 + 6, shelfYPositions[1] + shelfPlateH, shelfZ]}>
        {MAGAZINES.reduce(
          (acc, mag, mIdx) => {
            const currentX = acc.totalX + mag.w / 2;
            acc.elements.push(
              <RoundedBox
                key={`mag-${mIdx}`}
                args={[mag.w - 0.2, mag.h, mag.d]}
                radius={0.2}
                smoothness={2}
                position={[currentX, mag.h / 2, 0]}
                receiveShadow
              >
                <meshStandardMaterial
                  color={mag.c}
                  roughness={0.65}
                  metalness={0.05}
                />
              </RoundedBox>
            );
            acc.totalX += mag.w;
            return acc;
          },
          {
            totalX: 0,
            elements: [] as React.ReactNode[],
          }
        ).elements}

        {/* Minimalist metal divider/bookend */}
        <mesh position={[15, 6, 0]}>
          <boxGeometry args={[0.3, 12, 16]} />
          <meshStandardMaterial
            color={aluminiumColor}
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* --- TABLAR 5 (unten, index 0): Archiv-/Dokumentenbox + Aufgeräumter Freiraum --- */}
      <group position={[-12, shelfYPositions[0] + shelfPlateH, shelfZ]}>
        {/* High-end Scandinavian archival storage box */}
        <RoundedBox
          args={[32, 17, 18]}
          radius={0.5}
          smoothness={3}
          position={[0, 8.5, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#d6cebe"
            roughness={0.86}
            metalness={0.04}
          />
        </RoundedBox>
        {/* Box Lid rim */}
        <RoundedBox
          args={[32.6, 2.5, 18.6]}
          radius={0.4}
          smoothness={3}
          position={[0, 16.5, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color="#c8bead"
            roughness={0.84}
            metalness={0.04}
          />
        </RoundedBox>
        {/* Front metal pull handle / label frame */}
        <mesh position={[0, 9.5, 9.2]}>
          <boxGeometry args={[4.2, 1.8, 0.4]} />
          <meshStandardMaterial
            color="#cbd5e1"
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
      </group>
    </group>
  );
});
