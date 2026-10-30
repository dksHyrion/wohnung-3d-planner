import React from 'react';
import { FurnitureModelProps } from './SofaModel';

/**
 * Rahmen und Bildfläche. Die Bildfarbe kommt aus dem Möbel.
 * Die Rückseite liegt auf -Z, also an der Wand, wenn das Stück eingerastet ist.
 */
export const WallPictureModel: React.FC<FurnitureModelProps> = ({
  item,
  hasCollision = false,
  isSelected = false,
}) => {
  const width = item.widthCm;
  const height = item.heightCm;
  const depth = Math.max(2, item.depthCm);
  const canvasDepth = Math.min(1.2, depth * 0.35);
  const frameDepth = Math.max(0.8, depth - canvasDepth);
  const back = -depth / 2;
  const front = depth / 2;
  const inset = Math.min(5, width * 0.07, height * 0.07);
  const frameColor = hasCollision ? '#ef4444' : isSelected ? '#f6e7c1' : '#f4f1ea';
  const canvasColor = hasCollision ? '#fecaca' : item.color;

  return (
    <group>
      <mesh
        name="picture-frame"
        position={[0, 0, back + frameDepth / 2]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, height, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.55} />
      </mesh>
      <mesh
        name="picture-canvas"
        position={[0, 0, front - canvasDepth / 2]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[Math.max(4, width - inset * 2), Math.max(4, height - inset * 2), canvasDepth]}
        />
        <meshStandardMaterial color={canvasColor} roughness={0.82} />
      </mesh>
      <mesh position={[0, 0, front + 0.05]} raycast={() => null}>
        <boxGeometry
          args={[
            Math.max(2, width - inset * 4),
            Math.max(1.5, (height - inset * 2) * 0.22),
            0.15,
          ]}
        />
        <meshStandardMaterial
          color="#1c1917"
          transparent
          opacity={0.18}
          roughness={1}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

/** Dünne Leiste. Bilder sind eigene Stücke und hängen darunter. */
export const PictureRailModel: React.FC<FurnitureModelProps> = ({
  item,
  hasCollision = false,
  isSelected = false,
}) => {
  const color = hasCollision ? '#ef4444' : isSelected ? '#f6e7c1' : '#cfc6ba';
  return (
    <mesh name="picture-rail" castShadow receiveShadow>
      <boxGeometry args={[item.widthCm, item.heightCm, item.depthCm]} />
      <meshStandardMaterial color={color} metalness={0.35} roughness={0.42} />
    </mesh>
  );
};
