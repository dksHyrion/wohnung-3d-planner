import React, { useMemo, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Corner } from '../../../core/types';
import { shouldCutawayWall } from '../../../core/wallMath';
import { getLinenTexture } from '../../../core/materials/proceduralTextures';
import { useFloorplanStore } from '../../../store/useFloorplanStore';

export interface WindowCurtainPlacement {
  key: string;
  leftPanel: { offsetCm: number; widthCm: number };
  rightPanel: { offsetCm: number; widthCm: number };
  railLengthCm: number;
  railOffsetCm: number;
  heightCm: number;
  elevationCm: number;
}

/**
 * Creates a closed 2D sinusoidal profile along X, with front line
 * z = sin((x / lambda) * 2 * PI) * A and back line with fabric thickness 0.35 cm.
 */
export function createCurtainWaveShape(
  widthCm: number,
  amplitudeCm: number = 3.2,
  waveLengthCm: number = 12
): THREE.Shape {
  const shape = new THREE.Shape();
  if (widthCm <= 0) return shape;

  const fabricThickness = 0.35;
  const step = 0.5;
  const numSteps = Math.ceil(widthCm / step);

  // Front line: z = sin((x / waveLengthCm) * 2 * PI) * amplitudeCm
  for (let i = 0; i <= numSteps; i++) {
    const x = Math.min(widthCm, i * step);
    const y = Math.sin((x / waveLengthCm) * 2 * Math.PI) * amplitudeCm;
    if (i === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  }

  // Back line with fabric thickness 0.35 cm
  for (let i = numSteps; i >= 0; i--) {
    const x = Math.min(widthCm, i * step);
    const y = Math.sin((x / waveLengthCm) * 2 * Math.PI) * amplitudeCm - fabricThickness;
    shape.lineTo(x, y);
  }

  shape.closePath();
  return shape;
}

/**
 * Curtain placement helper for window openings.
 * Computes flanking panel dimensions and rail offsets with full-height and cutaway adaptation.
 */
export function computeWindowCurtainPlacement(
  wallLengthCm: number,
  opening: {
    offsetFromStartCm: number;
    widthCm: number;
    heightCm: number;
    sillHeightCm: number;
    id?: string;
  },
  wallHeightCm: number,
  isCutaway: boolean = false
): WindowCurtainPlacement {
  const panelWidthCm = 45;
  const overlapCm = 15;
  const cutawayHeightCm = 30;

  // In full height mode: Curtain spans floor-to-ceiling (from floor level Y = 0 to top of wall Y = wallHeightCm - 3 cm, rail at Y = wallHeightCm - 2 cm).
  // In cutaway mode (isCutaway === true): height adapts down to cutaway height (~30 cm) with rail at top, avoiding floating in empty space.
  const effectiveTopY = isCutaway
    ? Math.min(wallHeightCm, cutawayHeightCm)
    : wallHeightCm;

  const heightCm = Math.max(10, effectiveTopY - 3);
  const elevationCm = 0;

  // Flanking panels
  // Left panel: right edge overlaps window left edge by 15 cm
  const targetLeftRightEdge = opening.offsetFromStartCm + overlapCm;
  const rawLeftOffset = targetLeftRightEdge - panelWidthCm;
  const leftOffsetCm = Math.max(0, Math.min(rawLeftOffset, wallLengthCm - 10));
  const leftWidthCm = Math.min(panelWidthCm, targetLeftRightEdge - leftOffsetCm);

  // Right panel: left edge overlaps window right edge by 15 cm
  const rightOffsetCm = Math.max(
    0,
    Math.min(
      opening.offsetFromStartCm + opening.widthCm - overlapCm,
      wallLengthCm - 10
    )
  );
  const rightWidthCm = Math.min(
    panelWidthCm,
    Math.max(10, wallLengthCm - rightOffsetCm)
  );

  const railOffsetCm = Math.max(0, leftOffsetCm);
  const railEndCm = Math.min(
    wallLengthCm,
    Math.max(railOffsetCm + 20, rightOffsetCm + rightWidthCm)
  );
  const railLengthCm = Math.max(10, railEndCm - railOffsetCm);

  return {
    key: `curtain-${opening.id ?? opening.offsetFromStartCm}`,
    leftPanel: {
      offsetCm: Number(leftOffsetCm.toFixed(1)),
      widthCm: Number(leftWidthCm.toFixed(1)),
    },
    rightPanel: {
      offsetCm: Number(rightOffsetCm.toFixed(1)),
      widthCm: Number(rightWidthCm.toFixed(1)),
    },
    railLengthCm: Number(railLengthCm.toFixed(1)),
    railOffsetCm: Number(railOffsetCm.toFixed(1)),
    heightCm: Number(heightCm.toFixed(1)),
    elevationCm,
  };
}

export interface ProceduralCurtain3DProps {
  placement?: WindowCurtainPlacement;
  wallLengthCm?: number;
  opening?: {
    offsetFromStartCm: number;
    widthCm: number;
    heightCm: number;
    sillHeightCm: number;
    id?: string;
  };
  wallHeightCm?: number;
  isCutaway?: boolean;
  cutawayEnabled?: boolean;
  start?: Corner;
  end?: Corner;
  roomCenter?: { x: number; z: number };
}

/**
 * Procedural Linen S-Fold Curtain with Anthracite Track Rail.
 */
export const ProceduralCurtain3D = React.memo<ProceduralCurtain3DProps>(({
  placement: propPlacement,
  wallLengthCm = 300,
  opening,
  wallHeightCm = 250,
  isCutaway: propIsCutaway,
  cutawayEnabled = false,
  start,
  end,
  roomCenter,
}) => {
  const showDecor = useFloorplanStore((s) => s.showDecor);
  const [internalCutaway, setInternalCutaway] = useState(false);
  const isCutaway = propIsCutaway ?? internalCutaway;
  const lastCamRef = useRef({ x: NaN, y: NaN, z: NaN });

  useFrame(({ camera }) => {
    if (propIsCutaway !== undefined) return;
    if (!cutawayEnabled || !start || !end || !roomCenter) {
      if (internalCutaway) setInternalCutaway(false);
      return;
    }
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    const dx = cx - lastCamRef.current.x;
    const dy = cy - lastCamRef.current.y;
    const dz = cz - lastCamRef.current.z;
    if (dx * dx + dy * dy + dz * dz < 1) return;
    lastCamRef.current.x = cx;
    lastCamRef.current.y = cy;
    lastCamRef.current.z = cz;

    const nextCut = shouldCutawayWall(start, end, camera.position, roomCenter);
    if (nextCut !== internalCutaway) {
      setInternalCutaway(nextCut);
    }
  });

  if (!showDecor) return null;

  const placement = useMemo(() => {
    if (propPlacement) return propPlacement;
    if (opening) {
      return computeWindowCurtainPlacement(
        wallLengthCm,
        opening,
        wallHeightCm,
        isCutaway
      );
    }
    return computeWindowCurtainPlacement(
      wallLengthCm,
      { offsetFromStartCm: 50, widthCm: 100, heightCm: 120, sillHeightCm: 80 },
      wallHeightCm,
      isCutaway
    );
  }, [propPlacement, wallLengthCm, opening, wallHeightCm, isCutaway]);

  const leftWaveShape = useMemo(
    () => createCurtainWaveShape(placement.leftPanel.widthCm),
    [placement.leftPanel.widthCm]
  );

  const rightWaveShape = useMemo(
    () => createCurtainWaveShape(placement.rightPanel.widthCm),
    [placement.rightPanel.widthCm]
  );

  const linenTexture = useMemo(() => {
    const tex = getLinenTexture().clone();
    tex.repeat.set(1 / 40, 1 / 40);
    return tex;
  }, []);

  useEffect(() => {
    return () => {
      linenTexture.dispose();
    };
  }, [linenTexture]);

  const extrudeOptions = useMemo(
    () => ({ depth: placement.heightCm, bevelEnabled: false }),
    [placement.heightCm]
  );

  const railY = placement.elevationCm + placement.heightCm + 1;
  const railRadius = 0.9; // 1.8 cm diameter

  if (!showDecor) {
    return null;
  }

  return (
    <group key={placement.key}>
      {/* Top Rail (Decken-Gleitschiene) */}
      <mesh
        position={[
          placement.railOffsetCm + placement.railLengthCm / 2,
          railY,
          0,
        ]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry
          args={[railRadius, railRadius, placement.railLengthCm, 16]}
        />
        <meshStandardMaterial
          color="#262626"
          roughness={0.35}
          metalness={0.7}
        />
      </mesh>

      {/* Left Drape Panel */}
      <mesh
        position={[placement.leftPanel.offsetCm, placement.elevationCm, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <extrudeGeometry args={[leftWaveShape, extrudeOptions]} />
        <meshStandardMaterial
          color="#f6f4ee"
          map={linenTexture}
          roughness={0.96}
          metalness={0.02}
          opacity={0.88}
          transparent={true}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Right Drape Panel */}
      <mesh
        position={[placement.rightPanel.offsetCm, placement.elevationCm, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <extrudeGeometry args={[rightWaveShape, extrudeOptions]} />
        <meshStandardMaterial
          color="#f6f4ee"
          map={linenTexture}
          roughness={0.96}
          metalness={0.02}
          opacity={0.88}
          transparent={true}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
});
