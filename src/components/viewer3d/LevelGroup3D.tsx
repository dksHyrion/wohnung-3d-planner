import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import {
  WallMesh3D,
  SKIRTING_THICKNESS_CM,
  WALL_CAP_THICKNESS_OFFSET_CM,
} from './WallMesh3D';
import { RoofSlopeMesh3D } from './RoofSlopeMesh3D';
import { WallFixtureMesh3D } from './WallFixtureMesh3D';
import { FurnitureMesh3D } from './FurnitureMesh3D';
import { StaircaseMesh3D } from './StaircaseMesh3D';
import { RugMesh3D } from './RugMesh3D';
import { ProceduralCurtain3D } from './decor/ProceduralCurtain3D';
import { WindowLightPool3D } from './decor/WindowLightPool3D';
import { resolveRoofSlopePlanes } from '../../core/roofSlopeMath';
import { computeWallFixtureBoxes } from '../../core/mepFixtures';
import { computeWallMiterMap, type WallMiterExtents } from '../../core/wallMiter';
import { pointInPolygonXZ } from '../../core/geometry2d';
import { type LevelSlab } from '../../core/slabMath';
import { computeStairGeometry } from '../../core/stairsMath';
import { openingLetsLightThrough } from '../../core/doorLeaf';
import {
  applyRoomLabels,
  computeFloorPolygons,
  getInteriorWallIds,
  getWallGeometry,
  shouldCutawayWall,
} from '../../core/wallMath';
import { interpolateMood } from '../../core/lighting/moodPresets';
import type {
  AreaRug,
  BuildingLevel,
  Corner,
  FlooringType,
  FurnitureCollisionReport,
  FurnitureItem,
  RoofSlope,
  RoomLabel,
  Staircase,
  Wall,
  WallFixture,
  WallOpening,
} from '../../core/types';
import { getFloorMaterialProps } from './SceneControllers3D';

const EMPTY_OPENINGS: WallOpening[] = [];

export interface WallGroup3DProps {
  wall: Wall;
  start: Corner;
  end: Corner;
  openings: WallOpening[];
  roomCenter: { x: number; z: number };
  cutawayEnabled: boolean;
  isSelected: boolean;
  showDecor?: boolean;
  miter?: WallMiterExtents;
  capMiter?: WallMiterExtents;
  skirtingMiter?: WallMiterExtents;
  sunDirToRoom?: { x: number; y: number; z: number };
  onSelectWall: (wallId: string) => void;
  onSelectOpening: (openingId: string) => void;
}

export const WallGroup3D = React.memo<WallGroup3DProps>(({
  wall,
  start,
  end,
  openings,
  roomCenter,
  cutawayEnabled,
  isSelected,
  showDecor,
  miter,
  capMiter,
  skirtingMiter,
  sunDirToRoom,
  onSelectWall,
  onSelectOpening,
}) => {
  const storeShowDecor = useFloorplanStore((s) => s.showDecor);
  const effectiveShowDecor = showDecor ?? storeShowDecor;
  const [isCutaway, setIsCutaway] = useState(false);
  const lastCamRef = useRef({ x: NaN, y: NaN, z: NaN });

  useFrame(({ camera, invalidate }) => {
    if (!cutawayEnabled) {
      if (isCutaway) {
        setIsCutaway(false);
        invalidate();
      }
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
    if (nextCut !== isCutaway) {
      setIsCutaway(nextCut);
      invalidate();
    }
  });

  const timeOfDay = useFloorplanStore((s) => s.timeOfDay);
  const mood = useMemo(() => interpolateMood(timeOfDay), [timeOfDay]);
  const geom = useMemo(() => getWallGeometry(start, end), [start, end]);
  const windowOpenings = useMemo(
    () => openings.filter((o) => o.type === 'window'),
    [openings]
  );
  const lightOpenings = useMemo(
    () => openings.filter((o) => openingLetsLightThrough(o.type)),
    [openings]
  );
  const inward = useMemo(() => {
    if (geom.lengthCm < 1) return { sign: 1 as const, curtainZ: 0 };
    const toCenterX = roomCenter.x - geom.centerX;
    const toCenterZ = roomCenter.z - geom.centerZ;
    const sign = (
      toCenterX * geom.normal.x + toCenterZ * geom.normal.z >= 0 ? 1 : -1
    ) as 1 | -1;
    return { sign, curtainZ: sign * (wall.thicknessCm / 2 + 5.5) };
  }, [roomCenter.x, roomCenter.z, geom, wall.thicknessCm]);

  if (geom.lengthCm < 1) return null;

  return (
    <group>
      <WallMesh3D
        wall={wall}
        start={start}
        end={end}
        openings={openings}
        roomCenter={roomCenter}
        cutawayEnabled={cutawayEnabled}
        isCutaway={isCutaway}
        isSelected={isSelected}
        miter={miter}
        capMiter={capMiter}
        skirtingMiter={skirtingMiter}
        onSelectWall={onSelectWall}
        onSelectOpening={onSelectOpening}
      />

      {lightOpenings.length > 0 && (
        <group
          position={[geom.centerX, 0, geom.centerZ]}
          rotation={[0, -geom.angleRad, 0]}
        >
          {lightOpenings.map((op) => (
            <WindowLightPool3D
              key={`pool-${op.id}`}
              opening={op}
              wallLengthCm={geom.lengthCm}
              wallThicknessCm={wall.thicknessCm}
              inwardSign={inward.sign}
              color={mood.sunColor}
              intensity={mood.sunIntensity}
              wallAngleRad={geom.angleRad}
              sunDirToRoom={sunDirToRoom}
            />
          ))}
          {effectiveShowDecor && windowOpenings.length > 0 && (
            <group position={[-geom.lengthCm / 2, 0, inward.curtainZ]}>
              {windowOpenings.map((op) => (
                <ProceduralCurtain3D
                  key={`curtain-${op.id}`}
                  wallLengthCm={geom.lengthCm}
                  opening={op}
                  wallHeightCm={wall.heightCm}
                  cutawayEnabled={cutawayEnabled}
                  isCutaway={isCutaway}
                  start={start}
                  end={end}
                  roomCenter={roomCenter}
                  showDecor={effectiveShowDecor}
                />
              ))}
            </group>
          )}
        </group>
      )}
    </group>
  );
});

export interface FloorTexturesBundle {
  microcement: THREE.Texture;
  parquet: THREE.Texture;
  tile: THREE.Texture;
  bump: {
    microcement: THREE.Texture;
    parquet: THREE.Texture;
    tile: THREE.Texture;
  };
}

function holeOverlapsRoomPolygon(
  hole: { x: number; z: number }[],
  poly: { x: number; z: number }[]
): boolean {
  if (hole.length < 3 || poly.length < 3) return false;
  let cx = 0;
  let cz = 0;
  for (const p of hole) {
    cx += p.x;
    cz += p.z;
    if (pointInPolygonXZ(p.x, p.z, poly)) return true;
  }
  return pointInPolygonXZ(cx / hole.length, cz / hole.length, poly);
}

export function computeRoomFloorShapes(
  rooms: ReturnType<typeof applyRoomLabels>,
  arrivingStairHoles: { x: number; z: number }[][] = []
) {
  return rooms.map((room, idx) => {
    const poly = room.netCorners.length >= 3 ? room.netCorners : room.corners;
    const shape = new THREE.Shape();
    shape.moveTo(poly[0].x, -poly[0].z);
    for (let i = 1; i < poly.length; i++) {
      shape.lineTo(poly[i].x, -poly[i].z);
    }
    shape.closePath();
    const roomHoles = room.netHoles ?? room.holes;
    const overlappingStairHoles = arrivingStairHoles.filter((h) =>
      holeOverlapsRoomPolygon(h, poly)
    );
    const combinedHoles = [...(roomHoles ?? []), ...overlappingStairHoles];
    for (const hole of combinedHoles) {
      if (hole.length < 3) continue;
      const holePath = new THREE.Path();
      holePath.moveTo(hole[0].x, -hole[0].z);
      for (let i = 1; i < hole.length; i++) {
        holePath.lineTo(hole[i].x, -hole[i].z);
      }
      holePath.closePath();
      shape.holes.push(holePath);
    }
    return {
      id: room.id,
      shape,
      idx,
      centroid: room.centroid,
      areaSqM: room.netAreaSqM > 0 ? room.netAreaSqM : room.areaSqM,
      name: room.name,
      flooringType: (room.flooringType ?? 'microcement') as FlooringType,
    };
  });
}

export const LevelSlabMesh3D: React.FC<{ slab: LevelSlab; isStudio: boolean }> =
  React.memo(function LevelSlabMesh3D({ slab, isStudio }) {
    const geometry = useMemo(() => {
      if (slab.outerPolygon.length < 3) return null;
      const shape = new THREE.Shape();
      shape.moveTo(slab.outerPolygon[0].x, -slab.outerPolygon[0].z);
      for (let i = 1; i < slab.outerPolygon.length; i++) {
        shape.lineTo(slab.outerPolygon[i].x, -slab.outerPolygon[i].z);
      }
      shape.closePath();
      for (const hole of slab.holes) {
        if (hole.length < 3) continue;
        const holePath = new THREE.Path();
        holePath.moveTo(hole[0].x, -hole[0].z);
        for (let i = 1; i < hole.length; i++) {
          holePath.lineTo(hole[i].x, -hole[i].z);
        }
        holePath.closePath();
        shape.holes.push(holePath);
      }
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(2, slab.thicknessCm),
        bevelEnabled: false,
      });
      geo.rotateX(-Math.PI / 2);
      return geo;
    }, [slab]);

    useEffect(() => {
      return () => {
        geometry?.dispose();
      };
    }, [geometry]);

    if (!geometry) return null;

    return (
      <mesh
        geometry={geometry}
        position={[0, slab.elevationCm - slab.thicknessCm, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          color={isStudio ? '#e2e8f0' : '#1e293b'}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>
    );
  });

export const LevelGroup3D: React.FC<{
  level: BuildingLevel;
  allLevels: BuildingLevel[];
  corners: Corner[];
  walls: Wall[];
  roomLabels: RoomLabel[];
  openings: WallOpening[];
  roofSlopes: RoofSlope[];
  fixtures: WallFixture[];
  furniture: FurnitureItem[];
  rugs: AreaRug[];
  levelStairs: Staircase[];
  arrivingStairs: Staircase[];
  collisionReports: Record<string, FurnitureCollisionReport>;
  floorTextures: FloorTexturesBundle;
  renderTheme: 'studio' | 'blueprint';
  isBeauty: boolean;
  cutawayEnabled: boolean;
  showDecor: boolean;
  selectedId: string | null;
  selectedIds: string[];
  selectedType: string | null;
  sunDirToRoom?: { x: number; y: number; z: number };
  onSelectWall: (id: string) => void;
  onSelectOpening: (id: string) => void;
  onSelectFixture: (id: string) => void;
  onStartFurnitureDrag: (item: FurnitureItem, hitPoint: THREE.Vector3) => void;
  onStartRugDrag: (rug: AreaRug, hitPoint: THREE.Vector3) => void;
  onStartStairDrag: (stair: Staircase, hitPoint: THREE.Vector3) => void;
}> = React.memo(function LevelGroup3D({
  level,
  allLevels,
  corners,
  walls,
  roomLabels,
  openings,
  roofSlopes,
  fixtures,
  furniture,
  rugs,
  levelStairs,
  arrivingStairs,
  collisionReports,
  floorTextures,
  renderTheme,
  isBeauty,
  cutawayEnabled,
  showDecor,
  selectedId,
  selectedIds,
  selectedType,
  sunDirToRoom,
  onSelectWall,
  onSelectOpening,
  onSelectFixture,
  onStartFurnitureDrag,
  onStartRugDrag,
  onStartStairDrag,
}) {
  const cornerMap = useMemo(
    () => new Map<string, Corner>(corners.map((c) => [c.id, c])),
    [corners]
  );

  const levelCenter = useMemo(() => {
    if (corners.length === 0) return { x: 250, z: 200 };
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const c of corners) {
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.z < minZ) minZ = c.z;
      if (c.z > maxZ) maxZ = c.z;
    }
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  }, [corners]);

  const rooms = useMemo(
    () => applyRoomLabels(computeFloorPolygons(corners, walls), roomLabels),
    [corners, walls, roomLabels]
  );
  const levelMap = useMemo(
    () => new Map(allLevels.map((l) => [l.id, l])),
    [allLevels]
  );
  const arrivingHoles = useMemo(
    () =>
      arrivingStairs.map(
        (s) =>
          computeStairGeometry(
            s,
            levelMap.get(s.fromLevelId),
            levelMap.get(s.toLevelId)
          ).openingPolygonXZ
      ),
    [arrivingStairs, levelMap]
  );
  const roomFloorShapes = useMemo(
    () => computeRoomFloorShapes(rooms, arrivingHoles),
    [rooms, arrivingHoles]
  );
  const wallMiterMap = useMemo(() => computeWallMiterMap(corners, walls), [corners, walls]);
  const roofSlopePlanes = useMemo(
    () => resolveRoofSlopePlanes(corners, walls, roofSlopes, rooms),
    [corners, walls, roofSlopes, rooms]
  );
  const fixtureBoxes = useMemo(
    () => computeWallFixtureBoxes(corners, walls, fixtures, rooms),
    [corners, walls, fixtures, rooms]
  );
  const maxCeilingCm = useMemo(
    () =>
      walls.length > 0
        ? Math.max(level.ceilingHeightCm, ...walls.map((w) => w.heightCm))
        : level.ceilingHeightCm,
    [walls, level.ceilingHeightCm]
  );
  const capMiterMap = useMemo(
    () =>
      computeWallMiterMap(
        corners,
        walls.map((w) => ({
          ...w,
          thicknessCm: w.thicknessCm + WALL_CAP_THICKNESS_OFFSET_CM,
        }))
      ),
    [corners, walls]
  );
  const skirtingMiterMap = useMemo(
    () =>
      computeWallMiterMap(
        corners,
        walls.map((w) => ({
          ...w,
          thicknessCm: w.thicknessCm + SKIRTING_THICKNESS_CM * 2,
        }))
      ),
    [corners, walls]
  );
  const interiorWallIds = useMemo(
    () => getInteriorWallIds(corners, walls, rooms),
    [corners, walls, rooms]
  );
  const openingsByWall = useMemo(() => {
    const map = new Map<string, WallOpening[]>();
    for (const o of openings) {
      const list = map.get(o.wallId);
      if (list) list.push(o);
      else map.set(o.wallId, [o]);
    }
    return map;
  }, [openings]);

  return (
    <group name={`building-level-${level.id}`} position={[0, level.elevationCm, 0]}>
      {roomFloorShapes.map(({ id, shape, flooringType }) => {
        const isStudio = renderTheme === 'studio';
        const texture = isStudio ? floorTextures[flooringType] : null;
        const bumpTexture = isStudio ? floorTextures.bump[flooringType] : null;
        return (
          <mesh
            key={`${level.id}-${id}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            receiveShadow
          >
            <shapeGeometry args={[shape]} />
            <meshPhysicalMaterial
              {...getFloorMaterialProps(
                flooringType,
                isStudio,
                texture,
                isBeauty,
                bumpTexture
              )}
            />
          </mesh>
        );
      })}

      {rugs.map((rug) => (
        <RugMesh3D
          key={rug.id}
          widthCm={rug.widthCm}
          depthCm={rug.depthCm}
          x={rug.x}
          z={rug.z}
          rotationYDeg={rug.rotationYDeg ?? 0}
          color={renderTheme === 'studio' ? rug.color : '#1e293b'}
          isSelected={selectedType === 'rug' && selectedId === rug.id}
          onStartDrag={(pt) => onStartRugDrag(rug, pt)}
        />
      ))}

      {walls.map((wall) => {
        const start = cornerMap.get(wall.startCornerId);
        const end = cornerMap.get(wall.endCornerId);
        if (!start || !end) return null;
        return (
          <WallGroup3D
            key={wall.id}
            wall={wall}
            start={start}
            end={end}
            openings={openingsByWall.get(wall.id) ?? EMPTY_OPENINGS}
            roomCenter={levelCenter}
            cutawayEnabled={cutawayEnabled && !interiorWallIds.has(wall.id)}
            isSelected={selectedType === 'wall' && selectedId === wall.id}
            showDecor={showDecor}
            miter={wallMiterMap.get(wall.id)}
            capMiter={capMiterMap.get(wall.id)}
            skirtingMiter={skirtingMiterMap.get(wall.id)}
            sunDirToRoom={sunDirToRoom}
            onSelectWall={onSelectWall}
            onSelectOpening={onSelectOpening}
          />
        );
      })}

      {roofSlopePlanes.map((plane) => (
        <RoofSlopeMesh3D
          key={plane.slopeId}
          plane={plane}
          maxCeilingCm={maxCeilingCm}
          theme={renderTheme}
        />
      ))}

      {fixtureBoxes.map((box) => (
        <WallFixtureMesh3D
          key={box.fixtureId}
          box={box}
          isSelected={selectedType === 'fixture' && selectedId === box.fixtureId}
          onSelect={onSelectFixture}
        />
      ))}

      {furniture.map((item) => (
        <FurnitureMesh3D
          key={item.id}
          item={item}
          report={collisionReports[item.id]}
          isSelected={
            selectedType === 'furniture' &&
            (selectedIds.includes(item.id) || selectedId === item.id)
          }
          onStartDrag={onStartFurnitureDrag}
        />
      ))}

      {levelStairs.map((stair) => (
        <StaircaseMesh3D
          key={stair.id}
          stair={stair}
          fromLevel={levelMap.get(stair.fromLevelId)}
          toLevel={levelMap.get(stair.toLevelId)}
          isSelected={selectedType === 'stair' && selectedId === stair.id}
          onStartDrag={onStartStairDrag}
        />
      ))}
    </group>
  );
});
