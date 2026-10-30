import React from 'react';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { WallOpening } from '../../core/types';
import {
  DOOR_LEAF_THICKNESS_CM,
  doorLeafPose,
  doorSwingFloorSegments,
} from '../../core/doorLeaf';

/** Ruhige Bodenlinie der offenen Tür, kein zweites Farbfeld. */
export const DOOR_SWING_LINE_COLOR = '#c9bfb2';
export const DOOR_SWING_LINE_WIDTH_CM = 1.2;

export const DoorLeaf3D: React.FC<{
  opening: WallOpening;
  wallLengthCm: number;
  wallThicknessCm: number;
  onSelect: (openingId: string) => void;
}> = ({ opening, wallLengthCm, wallThicknessCm, onSelect }) => {
  const selected = useFloorplanStore(
    (s) => s.selectedType === 'opening' && s.selectedId === opening.id
  );
  const pose = doorLeafPose(opening, wallLengthCm);
  const swingLine = doorSwingFloorSegments(opening, wallLengthCm);
  const openingStart = -wallLengthCm / 2 + opening.offsetFromStartCm;
  const centerX = openingStart + opening.widthCm / 2;
  const leafColor = selected ? '#f6e2a8' : '#efe4d4';
  const frameColor = selected ? '#e7d3a1' : '#e6dfd4';
  const handleX = pose.leafCenterX > 0
    ? pose.leafWidthCm - 8
    : -(pose.leafWidthCm - 8);
  const handleY = Math.max(
    -pose.leafHeightCm / 2 + 10,
    Math.min(pose.leafHeightCm / 2 - 10, 105 - pose.leafCenterY)
  );
  const panelW = Math.max(8, pose.leafWidthCm - 16);
  const panelH = Math.max(8, pose.leafHeightCm - 20);
  const jambW = 4;
  const headH = 4;

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect(opening.id);
      }}
    >
      <mesh
        name="door-frame"
        position={[openingStart + jambW / 2, pose.leafCenterY, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[jambW, opening.heightCm, wallThicknessCm]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} />
      </mesh>
      <mesh
        name="door-frame"
        position={[openingStart + opening.widthCm - jambW / 2, pose.leafCenterY, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[jambW, opening.heightCm, wallThicknessCm]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} />
      </mesh>
      <mesh
        name="door-frame"
        position={[centerX, opening.sillHeightCm + opening.heightCm - headH / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[opening.widthCm, headH, wallThicknessCm]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} />
      </mesh>

      {opening.type === 'passage' ? null : opening.type === 'sliding-door' ? (
        (() => {
          const swingSign =
            opening.swingDirection === 'out-left' ||
            opening.swingDirection === 'out-right'
              ? -1
              : 1;
          const slideRight =
            opening.swingDirection === 'in-right' ||
            opening.swingDirection === 'out-right';
          const trackZ = swingSign * (wallThicknessCm / 2 + DOOR_LEAF_THICKNESS_CM);
          const leafShiftX =
            (slideRight ? 1 : -1) * Math.max(12, opening.widthCm * 0.35);
          return (
            <group position={[centerX, pose.leafCenterY, trackZ]}>
              <mesh
                name="sliding-door-track"
                position={[0, pose.leafHeightCm / 2 + 1.5, 0]}
                castShadow
              >
                <boxGeometry
                  args={[
                    opening.widthCm * 1.45,
                    3,
                    DOOR_LEAF_THICKNESS_CM + 1.4,
                  ]}
                />
                <meshStandardMaterial
                  color="#475569"
                  metalness={0.5}
                  roughness={0.35}
                />
              </mesh>
              <mesh
                name="door-leaf"
                position={[leafShiftX, 0, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry
                  args={[
                    pose.leafWidthCm,
                    pose.leafHeightCm,
                    DOOR_LEAF_THICKNESS_CM,
                  ]}
                />
                <meshStandardMaterial color={leafColor} roughness={0.58} />
              </mesh>
            </group>
          );
        })()
      ) : (
        <>
          <group
            position={[pose.hingeX, pose.leafCenterY, 0]}
            rotation={[0, pose.rotationYRad, 0]}
          >
            <mesh
              name="door-leaf"
              position={[pose.leafCenterX, 0, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry
                args={[
                  pose.leafWidthCm,
                  pose.leafHeightCm,
                  DOOR_LEAF_THICKNESS_CM,
                ]}
              />
              <meshStandardMaterial color={leafColor} roughness={0.58} />
            </mesh>
            <mesh
              name="door-panel"
              position={[pose.leafCenterX, 0, DOOR_LEAF_THICKNESS_CM / 2 + 0.15]}
              castShadow={opening.type !== 'balcony-door'}
            >
              <boxGeometry args={[panelW, panelH, 0.3]} />
              {opening.type === 'balcony-door' ? (
                <meshPhysicalMaterial
                  color="#bae6fd"
                  transparent
                  opacity={0.42}
                  roughness={0.12}
                  metalness={0.1}
                />
              ) : (
                <meshStandardMaterial
                  color={selected ? '#f3d48a' : '#e4d5c0'}
                  roughness={0.62}
                />
              )}
            </mesh>
            <mesh
              name="door-handle"
              position={[handleX, handleY, DOOR_LEAF_THICKNESS_CM / 2 + 1.1]}
              castShadow
            >
              <boxGeometry args={[2.2, 14, 2.2]} />
              <meshStandardMaterial
                color="#3f3a36"
                metalness={0.35}
                roughness={0.4}
              />
            </mesh>
          </group>

          {swingLine.map((segment, index) => (
            <mesh
              key={`swing-line-${index}`}
              name="door-swing-line"
              position={[segment.x, 1.15, segment.z]}
              rotation={[0, segment.rotationYRad, 0]}
              raycast={() => null}
            >
              <boxGeometry
                args={[segment.lengthCm, 0.35, DOOR_SWING_LINE_WIDTH_CM]}
              />
              <meshStandardMaterial
                color={DOOR_SWING_LINE_COLOR}
                roughness={0.9}
                metalness={0}
              />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
};
