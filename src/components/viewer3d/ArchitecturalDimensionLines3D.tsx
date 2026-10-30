import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { Corner, Wall } from '../../core/types';
import {
  DIMENSION_LINE_COLOR,
  DIMENSION_LINE_THICKNESS_CM,
  DIMENSION_ELEVATION_Y_CM,
  DIMENSION_TICK_LENGTH_CM,
  DIMENSION_TICK_THICKNESS_CM,
  formatDimension,
  computeExteriorDimensionChains,
  DimensionSegment,
  DimensionTick,
  DimensionExtensionLine,
  DimensionSideChain,
  ExteriorDimensionChains,
  ComputeDimensionOptions,
} from '../../core/dimensionMath';

export {
  DIMENSION_LINE_COLOR,
  DIMENSION_LINE_THICKNESS_CM,
  DIMENSION_ELEVATION_Y_CM,
  DIMENSION_TICK_LENGTH_CM,
  DIMENSION_TICK_THICKNESS_CM,
  formatDimension,
  computeExteriorDimensionChains,
};
export type {
  DimensionSegment,
  DimensionTick,
  DimensionExtensionLine,
  DimensionSideChain,
  ExteriorDimensionChains,
  ComputeDimensionOptions,
};

export interface ArchitecturalDimensionLines3DProps {
  corners: Corner[];
  walls: Wall[];
  roomBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    cx: number;
    cz: number;
  };
  offsetCm?: number;
  unit?: 'cm' | 'm';
  theme?: 'studio' | 'blueprint';
}

export const ArchitecturalDimensionLines3D: React.FC<
  ArchitecturalDimensionLines3DProps
> = ({
  corners,
  walls,
  roomBounds,
  offsetCm = 60,
  unit = 'cm',
  theme = 'studio',
}) => {
  const { chains } = useMemo(
    () =>
      computeExteriorDimensionChains(corners, walls, roomBounds, {
        offsetCm,
        unit,
      }),
    [corners, roomBounds, offsetCm, unit]
  );

  const lineColor = DIMENSION_LINE_COLOR;
  const extColor = theme === 'studio' ? '#cbd5e1' : '#475569';
  const textColor = theme === 'studio' ? '#475569' : '#94a3b8';

  return (
    <group name="architectural-dimension-lines-3d">
      {chains.map((chain) => (
        <group key={`chain-${chain.side}`}>
          {/* Extension witness lines */}
          {chain.extensionLines.map((ext) => {
            const isVert = ext.isVertical;
            const midX = (ext.start.x + ext.end.x) / 2;
            const midZ = (ext.start.z + ext.end.z) / 2;
            const len = isVert
              ? Math.abs(ext.end.z - ext.start.z)
              : Math.abs(ext.end.x - ext.start.x);

            return (
              <mesh
                key={ext.id}
                position={[midX, DIMENSION_ELEVATION_Y_CM - 0.01, midZ]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry
                  args={[
                    isVert ? 0.35 : len,
                    isVert ? len : 0.35,
                  ]}
                />
                <meshBasicMaterial
                  color={extColor}
                  transparent
                  opacity={0.65}
                  side={THREE.DoubleSide}
                />
              </mesh>
            );
          })}

          {/* Dimension continuous hairline segments */}
          {chain.segments.map((seg) => {
            const isVert = seg.isVertical;
            const midX = (seg.start.x + seg.end.x) / 2;
            const midZ = (seg.start.z + seg.end.z) / 2;
            const len = seg.lengthCm;

            return (
              <React.Fragment key={seg.id}>
                <mesh
                  position={[midX, DIMENSION_ELEVATION_Y_CM, midZ]}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <planeGeometry
                    args={[
                      isVert ? DIMENSION_LINE_THICKNESS_CM : len,
                      isVert ? len : DIMENSION_LINE_THICKNESS_CM,
                    ]}
                  />
                  <meshBasicMaterial
                    color={lineColor}
                    side={THREE.DoubleSide}
                  />
                </mesh>

                {/* Dimension measurement text */}
                <Text
                  position={[
                    seg.textPosition.x,
                    DIMENSION_ELEVATION_Y_CM + 0.02,
                    seg.textPosition.z,
                  ]}
                  rotation={[-Math.PI / 2, 0, seg.textRotation]}
                  fontSize={16}
                  color={textColor}
                  letterSpacing={0.05}
                  anchorX="center"
                  anchorY="middle"
                >
                  {seg.formattedLength}
                </Text>
              </React.Fragment>
            );
          })}

          {/* 45° diagonal slash ticks at projection endpoints */}
          {chain.ticks.map((tick) => (
            <mesh
              key={tick.id}
              position={[
                tick.position.x,
                DIMENSION_ELEVATION_Y_CM + 0.01,
                tick.position.z,
              ]}
              rotation={[-Math.PI / 2, 0, tick.rotationY]}
            >
              <planeGeometry
                args={[tick.lengthCm, DIMENSION_TICK_THICKNESS_CM]}
              />
              <meshBasicMaterial color={lineColor} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};
