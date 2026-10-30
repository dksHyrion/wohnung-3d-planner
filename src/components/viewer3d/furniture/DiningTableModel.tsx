import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { FurnitureModelProps } from './SofaModel';
import { diningTableLayout } from '../../../core/furnitureShapes';
import {
  getOakFurnitureTexture,
  getLinenTexture,
} from '../../../core/materials/proceduralTextures';
import { useFloorplanStore } from '../../../store/useFloorplanStore';

/**
 * Scandinavian Light Oak Dining Table & Bentwood Wishbone Chairs
 * Architectural dining ensemble inspired by iconic Danish/Nordic design (Carl Hansen CH24, Muuto):
 * - Solid beveled light oak tabletop with continuous wood grain PBR
 * - Contoured bentwood curved backrest rail with woven linen/cord seats
 * - Slender tapered wooden legs with subtle architectural splay
 * - Curated ceramic centerpiece bowl with green decorative apples (as in Bild 1)
 */
export const DiningTableModel: React.FC<FurnitureModelProps> = ({
  item,
  hasCollision = false,
  isSelected = false,
}) => {
  const showDecor = useFloorplanStore((s) => s.showDecor);
  const { widthCm: width, heightCm: height, depthCm: depth } = item;

  const oakTexture = useMemo(() => {
    try {
      return getOakFurnitureTexture();
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
  // Natural Scandinavian Oak tone
  const woodColor = tintColor || item.color || '#e8dbc8';
  const chairWoodColor = tintColor || (item.color ? item.color : '#e2d3bf');
  const chairSeatColor = tintColor || '#faf8f5';
  const bowlColor = tintColor || '#f8fafc';
  const appleColor = tintColor || '#65a30d'; // vibrant Granny Smith green

  const topH = 3.8;
  const legH = height - topH;
  const legInsetX = Math.min(22, width * 0.12);
  const legInsetZ = Math.min(18, depth * 0.15);
  const tableLayout = diningTableLayout(item);
  const chairSeatH = 44; // standard European seat height
  const chairSeatSize = tableLayout.chairs[0]?.seatSizeCm ?? 40;

  return (
    <group>
      {/* 1. Solid Natural Oak Tabletop with Swiss Bevel (Chamfered edge) */}
      <RoundedBox
        name="dining-tabletop"
        args={[width, topH, depth]}
        radius={1.4}
        smoothness={3}
        position={[0, height / 2 - topH / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={woodColor}
          map={oakTexture}
          roughness={0.48}
          metalness={0.04}
        />
      </RoundedBox>

      {/* 2. Four Solid Tapered Oak Legs */}
      {[
        [-width / 2 + legInsetX, -depth / 2 + legInsetZ],
        [width / 2 - legInsetX, -depth / 2 + legInsetZ],
        [-width / 2 + legInsetX, depth / 2 - legInsetZ],
        [width / 2 - legInsetX, depth / 2 - legInsetZ],
      ].map(([lx, lz], i) => (
        <mesh
          key={`table-leg-${i}`}
          position={[lx, -height / 2 + legH / 2, lz]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[2.4, 1.6, legH, 16]} />
          <meshStandardMaterial
            color={woodColor}
            map={oakTexture}
            roughness={0.52}
            metalness={0.04}
          />
        </mesh>
      ))}

      {/* 3. Centerpiece Ceramic Fruit Bowl with Green Apples (as in Bild 1) */}
      {showDecor && (
        <group name="fruit-bowl" position={[0, height / 2 + topH / 2, 0]}>
          {/* Ceramic Footed Fruit Bowl */}
          <mesh position={[0, 3, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[11, 6, 4.5, 24]} />
            <meshStandardMaterial
              color={bowlColor}
              roughness={0.25}
              metalness={0.06}
            />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[5, 5.5, 1.2, 20]} />
            <meshStandardMaterial color={bowlColor} roughness={0.3} />
          </mesh>

          {/* 4 Decorative Fresh Green Apples */}
          {[
            [-3, 4.8, -2],
            [3, 4.8, -1.5],
            [0, 5.0, 3.5],
            [0.5, 7.2, 0.5],
          ].map(([ax, ay, az], appleIdx) => (
            <mesh key={`apple-${appleIdx}`} position={[ax, ay, az]} castShadow>
              <sphereGeometry args={[2.2, 16, 16]} />
              <meshStandardMaterial
                color={appleColor}
                roughness={0.28}
                metalness={0.05}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* 4. Surrounding Bentwood Scandinavian Chairs */}
      {tableLayout.chairs.map((chair) => {
          const seatY = -height / 2 + chairSeatH - chair.cy;

          return (
            <group
              key={chair.id}
              name="dining-chair"
              position={[chair.cx, chair.cy, chair.cz]}
              rotation={[0, chair.cz < 0 ? 0 : Math.PI, 0]}
            >
              {/* Contoured Paper Cord / Woven Linen Seat Cushion */}
              <RoundedBox
                args={[chairSeatSize, 3.2, chairSeatSize * 0.95]}
                radius={1.5}
                smoothness={3}
                position={[0, seatY, 0]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial
                  color={chairSeatColor}
                  map={linenTexture}
                  roughness={0.9}
                  metalness={0.02}
                />
              </RoundedBox>

              {/* Curved Bentwood Horseshoe Backrest Rail */}
              <group position={[0, seatY + 16, -chairSeatSize * 0.12]}>
                {/* Horizontal Curved Horseshoe Top Rail */}
                <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <torusGeometry args={[chairSeatSize * 0.44, 1.2, 12, 24, Math.PI]} />
                  <meshStandardMaterial
                    color={chairWoodColor}
                    map={oakTexture}
                    roughness={0.5}
                  />
                </mesh>

                {/* Left & Right Arm Riser Posts */}
                {[-chairSeatSize * 0.44, chairSeatSize * 0.44].map((rx, rIdx) => (
                  <mesh
                    key={`riser-${rIdx}`}
                    position={[rx, -8, 0]}
                    castShadow
                  >
                    <cylinderGeometry args={[0.9, 0.9, 16, 12]} />
                    <meshStandardMaterial
                      color={chairWoodColor}
                      map={oakTexture}
                      roughness={0.5}
                    />
                  </mesh>
                ))}

                {/* Wishbone / Y-shaped Central Back Splat */}
                <mesh position={[0, -7, -chairSeatSize * 0.44]} castShadow>
                  <boxGeometry args={[2.5, 14, 0.8]} />
                  <meshStandardMaterial
                    color={chairWoodColor}
                    map={oakTexture}
                    roughness={0.5}
                  />
                </mesh>
              </group>

              {/* 4 Slender Splayed Tapered Wooden Chair Legs */}
              {[
                [-chairSeatSize * 0.38, -chairSeatSize * 0.36, -0.06, -0.06],
                [chairSeatSize * 0.38, -chairSeatSize * 0.36, -0.06, 0.06],
                [-chairSeatSize * 0.38, chairSeatSize * 0.36, 0.06, -0.06],
                [chairSeatSize * 0.38, chairSeatSize * 0.36, 0.06, 0.06],
              ].map(([clx, clz, rotX, rotZ], legIdx) => (
                <mesh
                  key={`chair-leg-${legIdx}`}
                  position={[clx, -height / 2 + chairSeatH / 2 - chair.cy, clz]}
                  rotation={[rotX, 0, rotZ]}
                  castShadow
                  receiveShadow
                >
                  <cylinderGeometry args={[1.0, 0.65, chairSeatH, 12]} />
                  <meshStandardMaterial
                    color={chairWoodColor}
                    map={oakTexture}
                    roughness={0.52}
                    metalness={0.04}
                  />
                </mesh>
              ))}
            </group>
          );
        })}
    </group>
  );
};
