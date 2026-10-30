import React, { useState, useMemo, useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { Corner, Wall, WallOpening } from '../../core/types';
import { getWallGeometry, shouldCutawayWall } from '../../core/wallMath';
import { interpolateMood } from '../../core/lighting/moodPresets';
import { DoorLeaf3D } from './DoorLeaf3D';
import { WindowFrame3D } from './WindowFrame3D';

export interface WallSubSegment {
  key: string;
  centerAlongCm: number;
  widthCm: number;
  centerYCm: number;
  heightCm: number;
}

/**
 * Splits a wall of `wallLengthCm` x `wallHeightCm` into exact rectangular box segments
 * around any doors or windows on the wall.
 */
export function computeWallSubSegments(
  wallLengthCm: number,
  wallHeightCm: number,
  openings: WallOpening[]
): WallSubSegment[] {
  if (openings.length === 0) {
    return [
      {
        key: 'full',
        centerAlongCm: wallLengthCm / 2,
        widthCm: wallLengthCm,
        centerYCm: wallHeightCm / 2,
        heightCm: wallHeightCm,
      },
    ];
  }

  const sorted = [...openings]
    .map((op) => ({
      ...op,
      start: Math.max(0, Math.min(wallLengthCm, op.offsetFromStartCm)),
      end: Math.max(
        0,
        Math.min(wallLengthCm, op.offsetFromStartCm + op.widthCm)
      ),
    }))
    .filter((op) => op.end - op.start > 1)
    .sort((a, b) => a.start - b.start);

  const segments: WallSubSegment[] = [];
  let cursor = 0;

  for (const op of sorted) {
    if (op.start > cursor + 0.5) {
      const segW = op.start - cursor;
      segments.push({
        key: `left-${op.id}`,
        centerAlongCm: cursor + segW / 2,
        widthCm: segW,
        centerYCm: wallHeightCm / 2,
        heightCm: wallHeightCm,
      });
    }

    const opW = op.end - op.start;
    const opCenterAlong = op.start + opW / 2;

    // Sill below opening (e.g. window sill)
    if (op.sillHeightCm > 0.5) {
      const sillH = Math.min(wallHeightCm, op.sillHeightCm);
      segments.push({
        key: `sill-${op.id}`,
        centerAlongCm: opCenterAlong,
        widthCm: opW,
        centerYCm: sillH / 2,
        heightCm: sillH,
      });
    }

    // Lintel above opening
    const opTop = op.sillHeightCm + op.heightCm;
    if (opTop < wallHeightCm - 0.5) {
      const lintelH = wallHeightCm - opTop;
      segments.push({
        key: `lintel-${op.id}`,
        centerAlongCm: opCenterAlong,
        widthCm: opW,
        centerYCm: opTop + lintelH / 2,
        heightCm: lintelH,
      });
    }

    cursor = Math.max(cursor, op.end);
  }

  if (cursor < wallLengthCm - 0.5) {
    const rightW = wallLengthCm - cursor;
    segments.push({
      key: 'right-end',
      centerAlongCm: cursor + rightW / 2,
      widthCm: rightW,
      centerYCm: wallHeightCm / 2,
      heightCm: wallHeightCm,
    });
  }

  return segments;
}

export interface WallMesh3DProps {
  wall: Wall;
  start: Corner;
  end: Corner;
  openings: WallOpening[];
  roomCenter: { x: number; z: number };
  cutawayEnabled: boolean;
  isSelected: boolean;
  onSelectWall: (wallId: string) => void;
  onSelectOpening: (openingId: string) => void;
  isCutaway?: boolean;
}

export const WALL_CAP_COLOR = '#2e2a26';
export const WALL_CAP_HEIGHT_CM = 1.5;
export const WALL_CAP_THICKNESS_OFFSET_CM = 0.4;
export const WALL_MATERIAL_COLOR = '#f1ece4';
export const WALL_MATERIAL_ROUGHNESS = 0.82;

export const SKIRTING_HEIGHT_CM = 8;
export const SKIRTING_THICKNESS_CM = 1.6;
/** Ein Ton unter der Wand `#f1ece4`, matt wie der Putz. */
export const SKIRTING_COLOR = '#e4ddd4';
export const SKIRTING_ROUGHNESS = WALL_MATERIAL_ROUGHNESS;

/** Warmes, mattes Glas im Ton der Wand. Eine Lage, ohne Spiegelung. */
export const WINDOW_GLASS_COLOR = WALL_MATERIAL_COLOR;
export const WINDOW_GLASS_OPACITY = 0.28;
export const WINDOW_GLASS_ROUGHNESS = WALL_MATERIAL_ROUGHNESS;
export const WINDOW_GLASS_METALNESS = 0;

export { DOOR_SWING_LINE_COLOR, DOOR_SWING_LINE_WIDTH_CM } from './DoorLeaf3D';

export interface SkirtingSegment {
  key: string;
  startCm: number;
  lengthCm: number;
}

/**
 * Computes skirting board (Fußleisten) segments along the bottom of the wall.
 * Skirting boards run at floor level and only break at floor-level openings (sillHeightCm < 5).
 * Windows with sill >= 5 cm do not break the skirting board.
 */
export function computeSkirtingSegments(
  wallLengthCm: number,
  openings: WallOpening[]
): SkirtingSegment[] {
  if (wallLengthCm <= 0) return [];

  const doorOpenings = openings
    .filter((op) => (op.sillHeightCm ?? 0) < 5)
    .map((op) => ({
      id: op.id,
      start: Math.max(0, Math.min(wallLengthCm, op.offsetFromStartCm)),
      end: Math.max(
        0,
        Math.min(wallLengthCm, op.offsetFromStartCm + op.widthCm)
      ),
    }))
    .filter((op) => op.end - op.start > 0.01)
    .sort((a, b) => a.start - b.start);

  if (doorOpenings.length === 0) {
    return [
      {
        key: 'skirting-full',
        startCm: 0,
        lengthCm: wallLengthCm,
      },
    ];
  }

  const segments: SkirtingSegment[] = [];
  let cursor = 0;
  let idx = 0;

  for (const op of doorOpenings) {
    if (op.start > cursor + 0.01) {
      segments.push({
        key: `skirting-${idx++}`,
        startCm: cursor,
        lengthCm: op.start - cursor,
      });
    }
    cursor = Math.max(cursor, op.end);
  }

  if (cursor < wallLengthCm - 0.01) {
    segments.push({
      key: `skirting-${idx++}`,
      startCm: cursor,
      lengthCm: wallLengthCm - cursor,
    });
  }

  return segments;
}

export interface WallCapSegment {
  key: string;
  widthCm: number;
  heightCm: number;
  thicknessCm: number;
  centerAlongCm: number;
  centerYCm: number;
  color: string;
}

export const CUTAWAY_HEIGHT_CM = 30;

/** Niedrige Schnittwand. Türöffnungen bleiben bis zum Boden frei. */
export function computeCutawayWallSegments(
  wallLengthCm: number,
  openings: WallOpening[],
  heightCm = CUTAWAY_HEIGHT_CM
): WallSubSegment[] {
  return computeSkirtingSegments(wallLengthCm, openings).map((segment) => ({
    key: `cutaway-${segment.key}`,
    centerAlongCm: segment.startCm + segment.lengthCm / 2,
    widthCm: segment.lengthCm,
    centerYCm: heightCm / 2,
    heightCm,
  }));
}

/** Kappe auf den oberen Wandstücken. */
export function computeWallCaps(
  wallHeightCm: number,
  wallThicknessCm: number,
  subSegments: WallSubSegment[]
): WallCapSegment[] {
  const capThickness = wallThicknessCm + WALL_CAP_THICKNESS_OFFSET_CM;
  const caps: WallCapSegment[] = [];
  for (const seg of subSegments) {
    const segTop = seg.centerYCm + seg.heightCm / 2;
    if (Math.abs(segTop - wallHeightCm) < 0.5) {
      caps.push({
        key: `cap-${seg.key}`,
        widthCm: seg.widthCm,
        heightCm: WALL_CAP_HEIGHT_CM,
        thicknessCm: capThickness,
        centerAlongCm: seg.centerAlongCm,
        centerYCm: wallHeightCm + WALL_CAP_HEIGHT_CM / 2,
        color: WALL_CAP_COLOR,
      });
    }
  }
  return caps;
}

/** Kappe auf der Schnittkante. Türen bleiben bis zum Boden frei. */
export function computeCutawayCaps(
  wallLengthCm: number,
  wallThicknessCm: number,
  openings: WallOpening[]
): WallCapSegment[] {
  const capThickness = wallThicknessCm + WALL_CAP_THICKNESS_OFFSET_CM;
  return computeSkirtingSegments(wallLengthCm, openings).map((segment) => ({
    key: `cutaway-cap-${segment.key}`,
    widthCm: segment.lengthCm,
    heightCm: WALL_CAP_HEIGHT_CM,
    thicknessCm: capThickness,
    centerAlongCm: segment.startCm + segment.lengthCm / 2,
    centerYCm: CUTAWAY_HEIGHT_CM + WALL_CAP_HEIGHT_CM / 2,
    color: WALL_CAP_COLOR,
  }));
}

export const WallMesh3D = React.memo<WallMesh3DProps>((props) => {
  const {
    wall,
    start,
    end,
    openings,
    roomCenter,
    cutawayEnabled,
    isSelected,
    onSelectWall,
    onSelectOpening,
  } = props;
  const [internalCutaway, setInternalCutaway] = useState(false);
  const isCutaway = props.isCutaway ?? internalCutaway;
  const renderTheme = useFloorplanStore((s) => s.renderTheme);
  const glowingWallCaps = useFloorplanStore((s) => s.glowingWallCaps);
  const timeOfDay = useFloorplanStore((s) => s.timeOfDay);
  const mood = useMemo(() => interpolateMood(timeOfDay), [timeOfDay]);
  const geom = useMemo(() => getWallGeometry(start, end), [start, end]);
  const lastCamRef = useRef({ x: NaN, y: NaN, z: NaN });

  useFrame(({ camera }) => {
    if (props.isCutaway !== undefined) return;
    if (!cutawayEnabled) {
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

    const nextCut = shouldCutawayWall(
      start,
      end,
      camera.position,
      roomCenter
    );
    if (nextCut !== internalCutaway) {
      setInternalCutaway(nextCut);
    }
  });

  const subSegments = useMemo(
    () => computeWallSubSegments(geom.lengthCm, wall.heightCm, openings),
    [geom.lengthCm, wall.heightCm, openings]
  );

  const activeCaps = useMemo(
    () =>
      isCutaway
        ? computeCutawayCaps(geom.lengthCm, wall.thicknessCm, openings)
        : computeWallCaps(wall.heightCm, wall.thicknessCm, subSegments),
    [geom.lengthCm, wall.heightCm, wall.thicknessCm, subSegments, openings, isCutaway]
  );

  const cutawaySegments = useMemo(
    () => computeCutawayWallSegments(geom.lengthCm, openings),
    [geom.lengthCm, openings]
  );

  const skirtingSegments = useMemo(
    () => computeSkirtingSegments(geom.lengthCm, openings),
    [geom.lengthCm, openings]
  );

  if (geom.lengthCm < 1) return null;

  const wallPlasterColor =
    renderTheme === 'blueprint' ? '#e2e8f0' : WALL_MATERIAL_COLOR;
  const wallColor = isSelected ? '#818cf8' : wallPlasterColor;
  const handleWallClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectWall(wall.id);
  };

  const renderSkirtingBoards = () =>
    skirtingSegments.map((seg) => {
      const segX = seg.startCm + seg.lengthCm / 2 - geom.lengthCm / 2;
      const segY = SKIRTING_HEIGHT_CM / 2;
      const frontZ = wall.thicknessCm / 2 + SKIRTING_THICKNESS_CM / 2;
      const backZ = -(wall.thicknessCm / 2 + SKIRTING_THICKNESS_CM / 2);

      return (
        <React.Fragment key={seg.key}>
          <mesh
            name="skirting-board"
            position={[segX, segY, frontZ]}
            onClick={handleWallClick}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[
                seg.lengthCm,
                SKIRTING_HEIGHT_CM,
                SKIRTING_THICKNESS_CM,
              ]}
            />
            <meshStandardMaterial
              color={SKIRTING_COLOR}
              roughness={SKIRTING_ROUGHNESS}
            />
          </mesh>
          <mesh
            name="skirting-board"
            position={[segX, segY, backZ]}
            onClick={handleWallClick}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[
                seg.lengthCm,
                SKIRTING_HEIGHT_CM,
                SKIRTING_THICKNESS_CM,
              ]}
            />
            <meshStandardMaterial
              color={SKIRTING_COLOR}
              roughness={SKIRTING_ROUGHNESS}
            />
          </mesh>
        </React.Fragment>
      );
    });

  const renderCaps = () =>
    activeCaps.map((cap) => (
      <React.Fragment key={cap.key}>
        <mesh
          name="wall-cap"
          position={[
            cap.centerAlongCm - geom.lengthCm / 2,
            cap.centerYCm,
            0,
          ]}
          onClick={handleWallClick}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[cap.widthCm, cap.heightCm, cap.thicknessCm]}
          />
          <meshStandardMaterial
            color={cap.color}
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>

        {glowingWallCaps && renderTheme === 'studio' && (
          <mesh
            name="wall-cap-glow"
            position={[
              cap.centerAlongCm - geom.lengthCm / 2,
              cap.centerYCm + cap.heightCm / 2 + 0.2,
              0,
            ]}
            onClick={handleWallClick}
          >
            <boxGeometry args={[cap.widthCm, 0.4, cap.thicknessCm + 0.05]} />
            <meshStandardMaterial
              color={mood.wallCapGlowColor}
              emissive={mood.wallCapGlowColor}
              emissiveIntensity={mood.wallCapGlowIntensity}
              toneMapped={false}
              roughness={0.2}
            />
          </mesh>
        )}
      </React.Fragment>
    ));

  return (
    <group
      position={[geom.centerX, 0, geom.centerZ]}
      rotation={[0, -geom.angleRad, 0]}
    >
      {isCutaway ? (
        cutawaySegments.map((seg) => (
          <mesh
            key={seg.key}
            name="wall-body"
            position={[seg.centerAlongCm - geom.lengthCm / 2, seg.centerYCm, 0]}
            onClick={handleWallClick}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[seg.widthCm, seg.heightCm, wall.thicknessCm]} />
            <meshStandardMaterial
              color={wallColor}
              transparent={false}
              opacity={1.0}
              roughness={WALL_MATERIAL_ROUGHNESS}
            />
          </mesh>
        ))
      ) : (
        subSegments.map((seg) => (
          <mesh
            key={seg.key}
            name="wall-body"
            position={[
              seg.centerAlongCm - geom.lengthCm / 2,
              seg.centerYCm,
              0,
            ]}
            onClick={handleWallClick}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[seg.widthCm, seg.heightCm, wall.thicknessCm]}
            />
            <meshStandardMaterial
              color={wallColor}
              roughness={WALL_MATERIAL_ROUGHNESS}
            />
          </mesh>
        ))
      )}

      {renderCaps()}
      {renderSkirtingBoards()}

      {/* Fenster nur an der vollen Wand. Das Türblatt bleibt auch im Schnitt stehen. */}
      {openings.map((op) => {
        if (op.type === 'window') {
          if (isCutaway) return null;
          return (
            <WindowFrame3D
              key={op.id}
              opening={op}
              wallLengthCm={geom.lengthCm}
              wallThicknessCm={wall.thicknessCm}
              onSelect={onSelectOpening}
            />
          );
        }

        return (
          <DoorLeaf3D
            key={op.id}
            opening={op}
            wallLengthCm={geom.lengthCm}
            wallThicknessCm={wall.thicknessCm}
            onSelect={onSelectOpening}
          />
        );
      })}
    </group>
  );
});
