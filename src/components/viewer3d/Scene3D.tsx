import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import {
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
  Grid,
  Text,
  Line,
} from '@react-three/drei';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { useTranslation } from '../../i18n/useTranslation';
import { computeEffectiveSunLight } from '../../core/windowLight';
import { StudioStage3D } from './StudioStage3D';
import { ArchitecturalDimensionLines3D } from './ArchitecturalDimensionLines3D';
import { PassageClearance3D } from './PassageClearance3D';
import {
  getMicrocementTexture,
  getParquetTexture,
  getStoneTileTexture,
  getMicrocementBumpTexture,
  getParquetBumpTexture,
  getStoneTileBumpTexture,
} from '../../core/materials/proceduralTextures';
import {
  AreaRug,
  Corner,
  FurnitureItem,
  RoofSlope,
  RoomLabel,
  Staircase,
  Wall,
  WallFixture,
  WallOpening,
} from '../../core/types';
import { getEntityLevelId } from '../../core/levels';
import { computeLevelSlabs } from '../../core/slabMath';
import { createFrameThrottle } from '../../core/frameThrottle';
import { applyRoomLabels, computeFloorPolygons } from '../../core/wallMath';
import { PostFX3D } from './PostFX3D';
import { interpolateMood } from '../../core/lighting/moodPresets';
import { computeGroupCentroidXZ } from '../../core/groupTransformMath';
import {
  CANVAS_GL_CONFIG,
  DemandRenderController,
  Export3DBridge,
  GhostVariantOverlay3D,
  RendererConfigController,
  getFloorMaterialProps,
} from './SceneControllers3D';
import {
  CameraController,
  computeFirstPersonViewpoint,
  type FirstPersonViewpoint,
} from './CameraController3D';
import {
  LevelGroup3D,
  LevelSlabMesh3D,
  WallGroup3D,
  computeRoomFloorShapes,
  type WallGroup3DProps,
} from './LevelGroup3D';

export {
  CANVAS_GL_CONFIG,
  getFloorMaterialProps,
  CameraController,
  computeFirstPersonViewpoint,
  WallGroup3D,
};
export type { FirstPersonViewpoint, WallGroup3DProps };

const EMPTY_ARRAY: readonly never[] = Object.freeze([]);
const EMPTY_CORNERS: Corner[] = [];
const EMPTY_WALLS: Wall[] = [];
const EMPTY_ROOM_LABELS: RoomLabel[] = [];
const EMPTY_OPENINGS: WallOpening[] = [];
const EMPTY_ROOF_SLOPES: RoofSlope[] = [];
const EMPTY_FIXTURES: WallFixture[] = [];
const EMPTY_FURNITURE: FurnitureItem[] = [];
const EMPTY_RUGS: AreaRug[] = [];
const EMPTY_STAIRS: Staircase[] = [];

export const Scene3D: React.FC = () => {
  const { t, language } = useTranslation();
  const levels = useFloorplanStore((s) => s.levels);
  const activeLevelId = useFloorplanStore((s) => s.activeLevelId);
  const levelViewMode = useFloorplanStore((s) => s.levelViewMode);
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const roomLabels = useFloorplanStore((s) => s.roomLabels);
  const openings = useFloorplanStore((s) => s.openings);
  const roofSlopes = useFloorplanStore((s) => s.roofSlopes);
  const fixtures = useFloorplanStore((s) => s.fixtures);
  const furniture = useFloorplanStore((s) => s.furniture);
  const rugs =
    useFloorplanStore((s) => s.rugs) ?? (EMPTY_ARRAY as unknown as AreaRug[]);
  const stairs = useFloorplanStore((s) => s.stairs);
  const collisionReports = useFloorplanStore((s) => s.collisionReports);
  const viewMode = useFloorplanStore((s) => s.viewMode);
  const cameraPreset = useFloorplanStore((s) => s.cameraPreset);
  const showDecor = useFloorplanStore((s) => s.showDecor);
  const cutawayEnabled = useFloorplanStore((s) => s.cutawayEnabled);
  const renderTheme = useFloorplanStore((s) => s.renderTheme);
  const showDimensions3D = useFloorplanStore((s) => s.showDimensions3D);
  const selectedId = useFloorplanStore((s) => s.selectedId);
  const selectedIds = useFloorplanStore((s) => s.selectedIds);
  const selectedType = useFloorplanStore((s) => s.selectedType);
  const timeOfDay = useFloorplanStore((s) => s.timeOfDay);
  const qualityMode = useFloorplanStore((s) => s.qualityMode);
  const alignSunWithWindows = useFloorplanStore((s) => s.alignSunWithWindows);

  const mood = useMemo(() => interpolateMood(timeOfDay), [timeOfDay]);
  const isBeauty = qualityMode === 'beauty' && renderTheme === 'studio';

  const selectEntity = useFloorplanStore((s) => s.selectEntity);
  const toggleSelectFurniture = useFloorplanStore((s) => s.toggleSelectFurniture);
  const moveFurniture = useFloorplanStore((s) => s.moveFurniture);
  const moveSelectedFurniture = useFloorplanStore((s) => s.moveSelectedFurniture);
  const rotateSelectedFurniture = useFloorplanStore((s) => s.rotateSelectedFurniture);
  const updateFurniture = useFloorplanStore((s) => s.updateFurniture);
  const moveRug = useFloorplanStore((s) => s.moveRug);
  const moveStair = useFloorplanStore((s) => s.moveStair);
  const activeAlignmentGuides =
    useFloorplanStore((s) => s.activeAlignmentGuides) ?? EMPTY_ARRAY;
  const clearAlignmentGuides = useFloorplanStore(
    (s) => s.clearAlignmentGuides
  );
  const pushUndoSnapshot = useFloorplanStore((s) => s.pushUndoSnapshot);

  const [draggingFurniture, setDraggingFurniture] = useState<{
    kind: 'furniture' | 'furniture-group' | 'rug' | 'stair';
    id: string;
    offsetX: number;
    offsetZ: number;
    anchorStartX?: number;
    anchorStartZ?: number;
  } | null>(null);
  const [draggingGizmo, setDraggingGizmo] = useState<
    | {
        kind: 'rotate';
        pivotX: number;
        pivotZ: number;
        startPointerAngleDeg: number;
        singleItemId: string | null;
        startItemRotDeg: number;
      }
    | {
        kind: 'elevation';
        itemId: string;
        startClientY: number;
        startElevationCm: number;
      }
    | null
  >(null);
  const dragHasMovedRef = useRef<boolean>(false);
  const groupDragCommittedDeltaRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const gizmoRotateCommittedDeltaRef = useRef<number>(0);
  const exportRootRef = useRef<THREE.Group | null>(null);

  const activeLevel = useMemo(
    () => levels.find((l) => l.id === activeLevelId) ?? levels[0] ?? { id: 'level-0', name: 'EG', index: 0, elevationCm: 0, ceilingHeightCm: 250, slabThicknessCm: 22 },
    [levels, activeLevelId]
  );

  const visibleLevels = useMemo(() => {
    if (levelViewMode === 'active-only') {
      return [activeLevel];
    }
    if (levelViewMode === 'ghost-below') {
      const below = levels.find((l) => l.index === activeLevel.index - 1);
      return below ? [below, activeLevel] : [activeLevel];
    }
    return [...levels].sort((a, b) => a.index - b.index);
  }, [levels, activeLevel, levelViewMode]);

  const entitiesByLevel = useMemo(() => {
    const groupBy = <T extends { levelId?: string }>(items: T[]) => {
      const map = new Map<string, T[]>();
      for (const item of items) {
        const lid = getEntityLevelId(item);
        const list = map.get(lid);
        if (list) list.push(item);
        else map.set(lid, [item]);
      }
      return map;
    };
    const stairsFrom = new Map<string, Staircase[]>();
    const stairsTo = new Map<string, Staircase[]>();
    for (const st of stairs) {
      const fromList = stairsFrom.get(st.fromLevelId);
      if (fromList) fromList.push(st);
      else stairsFrom.set(st.fromLevelId, [st]);
      const toList = stairsTo.get(st.toLevelId);
      if (toList) toList.push(st);
      else stairsTo.set(st.toLevelId, [st]);
    }
    return {
      corners: groupBy(corners),
      walls: groupBy(walls),
      roomLabels: groupBy(roomLabels),
      openings: groupBy(openings),
      roofSlopes: groupBy(roofSlopes),
      fixtures: groupBy(fixtures),
      furniture: groupBy(furniture),
      rugs: groupBy(rugs),
      stairsFrom,
      stairsTo,
    };
  }, [corners, walls, roomLabels, openings, roofSlopes, fixtures, furniture, rugs, stairs]);

  const activeCorners = useMemo(
    () => entitiesByLevel.corners.get(activeLevel.id) ?? EMPTY_CORNERS,
    [entitiesByLevel.corners, activeLevel.id]
  );
  const activeWalls = useMemo(
    () => entitiesByLevel.walls.get(activeLevel.id) ?? EMPTY_WALLS,
    [entitiesByLevel.walls, activeLevel.id]
  );
  const activeRoomLabels = useMemo(
    () => entitiesByLevel.roomLabels.get(activeLevel.id) ?? EMPTY_ROOM_LABELS,
    [entitiesByLevel.roomLabels, activeLevel.id]
  );
  const activeRooms = useMemo(
    () => applyRoomLabels(computeFloorPolygons(activeCorners, activeWalls), activeRoomLabels),
    [activeCorners, activeWalls, activeRoomLabels]
  );
  const activeRoomFloorShapes = useMemo(
    () => computeRoomFloorShapes(activeRooms),
    [activeRooms]
  );

  // Compute room bounding box and centroid in cm (using active level or fallback all corners)
  const roomBounds = useMemo(() => {
    const boundCorners = activeCorners.length > 0 ? activeCorners : corners;
    if (boundCorners.length === 0) {
      return { minX: 0, maxX: 500, minZ: 0, maxZ: 400, cx: 250, cz: 200 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const c of boundCorners) {
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.z < minZ) minZ = c.z;
      if (c.z > maxZ) maxZ = c.z;
    }
    return {
      minX,
      maxX,
      minZ,
      maxZ,
      cx: (minX + maxX) / 2,
      cz: (minZ + maxZ) / 2,
    };
  }, [activeCorners, corners]);

  const effectiveSun = useMemo(
    () =>
      computeEffectiveSunLight({
        corners: activeCorners,
        walls: activeWalls,
        openings,
        roomCenter: { cx: roomBounds.cx, cz: roomBounds.cz },
        sunElevationDeg: mood.sunElevationDeg,
        sunAzimuthDeg: mood.sunAzimuthDeg,
        alignSunWithWindows: renderTheme === 'studio' && alignSunWithWindows,
      }),
    [
      activeCorners,
      activeWalls,
      openings,
      roomBounds.cx,
      roomBounds.cz,
      mood.sunElevationDeg,
      mood.sunAzimuthDeg,
      renderTheme,
      alignSunWithWindows,
    ]
  );

  const floorTextures = useMemo(() => {
    // Architectural scale: repeats mapped in centimeter space
    const microcement = getMicrocementTexture().clone();
    microcement.repeat.set(1 / 150, 1 / 150);

    const parquet = getParquetTexture().clone();
    parquet.repeat.set(1 / 120, 1 / 120);

    const tile = getStoneTileTexture().clone();
    tile.repeat.set(1 / 120, 1 / 120);

    const microcementBump = getMicrocementBumpTexture().clone();
    microcementBump.repeat.set(1 / 150, 1 / 150);

    const parquetBump = getParquetBumpTexture().clone();
    parquetBump.repeat.set(1 / 120, 1 / 120);

    const tileBump = getStoneTileBumpTexture().clone();
    tileBump.repeat.set(1 / 120, 1 / 120);

    return {
      microcement,
      parquet,
      tile,
      bump: {
        microcement: microcementBump,
        parquet: parquetBump,
        tile: tileBump,
      },
    };
  }, []);

  useEffect(() => {
    return () => {
      floorTextures.microcement.dispose();
      floorTextures.parquet.dispose();
      floorTextures.tile.dispose();
      floorTextures.bump.microcement.dispose();
      floorTextures.bump.parquet.dispose();
      floorTextures.bump.tile.dispose();
    };
  }, [floorTextures]);

  const handleSelectFixture = useCallback(
    (id: string) => selectEntity(id, 'fixture'),
    [selectEntity]
  );
  const handleSelectWall = useCallback(
    (wallId: string) => selectEntity(wallId, 'wall'),
    [selectEntity]
  );
  const handleSelectOpening = useCallback(
    (openingId: string) => selectEntity(openingId, 'opening'),
    [selectEntity]
  );

  const usePerspective =
    viewMode === '3d-persp' || cameraPreset === 'first-person';

  const handleStartFurnitureDrag = (
    item: FurnitureItem,
    hitPoint: THREE.Vector3,
    e?: ThreeEvent<PointerEvent>
  ) => {
    if (e?.shiftKey) {
      toggleSelectFurniture(item.id);
      return;
    }
    const isGroup =
      selectedType === 'furniture' &&
      selectedIds.length > 1 &&
      selectedIds.includes(item.id);
    if (!isGroup) {
      selectEntity(item.id, 'furniture');
    }
    dragHasMovedRef.current = false;
    groupDragCommittedDeltaRef.current = { x: 0, z: 0 };
    setDraggingFurniture({
      kind: isGroup ? 'furniture-group' : 'furniture',
      id: item.id,
      offsetX: hitPoint.x - item.x,
      offsetZ: hitPoint.z - item.z,
      anchorStartX: item.x,
      anchorStartZ: item.z,
    });
  };

  const levelSlabs = useMemo(
    () =>
      computeLevelSlabs({
        levels,
        corners,
        walls,
        stairs,
      }),
    [levels, corners, walls, stairs]
  );

  const visibleLevelIds = useMemo(
    () => new Set(visibleLevels.map((l) => l.id)),
    [visibleLevels]
  );

  const visibleSlabs = useMemo(
    () => levelSlabs.filter((slab) => visibleLevelIds.has(slab.levelId)),
    [levelSlabs, visibleLevelIds]
  );

  const handleStartRugDrag = (rug: AreaRug, hitPoint: THREE.Vector3) => {
    selectEntity(rug.id, 'rug');
    dragHasMovedRef.current = false;
    setDraggingFurniture({
      kind: 'rug',
      id: rug.id,
      offsetX: hitPoint.x - rug.x,
      offsetZ: hitPoint.z - rug.z,
    });
  };

  const handleStartStairDrag = (stair: Staircase, hitPoint: THREE.Vector3) => {
    selectEntity(stair.id, 'stair');
    dragHasMovedRef.current = false;
    setDraggingFurniture({
      kind: 'stair',
      id: stair.id,
      offsetX: hitPoint.x - stair.x,
      offsetZ: hitPoint.z - stair.z,
    });
  };

  // One store commit per animation frame while dragging; pointer up flushes the last position.
  const dragFrame = useRef(createFrameThrottle()).current;

  const handleDragPlaneMove = (e: ThreeEvent<PointerEvent>) => {
    if (draggingGizmo?.kind === 'rotate') {
      e.stopPropagation();
      const angleDeg =
        (Math.atan2(
          e.point.x - draggingGizmo.pivotX,
          e.point.z - draggingGizmo.pivotZ
        ) *
          180) /
        Math.PI;
      let rawDelta = angleDeg - draggingGizmo.startPointerAngleDeg;
      if (e.shiftKey) {
        rawDelta = Math.round(rawDelta / 15) * 15;
      }
      if (draggingGizmo.singleItemId) {
        const nextRot =
          ((((draggingGizmo.startItemRotDeg + rawDelta) % 360) + 360) % 360);
        const itemId = draggingGizmo.singleItemId;
        dragFrame.schedule(() => {
          updateFurniture(
            itemId,
            { rotationYDeg: Number(nextRot.toFixed(1)) },
            { recordHistory: false }
          );
        });
      } else {
        const idsSnapshot = selectedIds;
        const targetRawDelta = rawDelta;
        dragFrame.schedule(() => {
          const stepDelta = targetRawDelta - gizmoRotateCommittedDeltaRef.current;
          if (Math.abs(stepDelta) >= 0.25) {
            gizmoRotateCommittedDeltaRef.current = targetRawDelta;
            rotateSelectedFurniture(idsSnapshot, stepDelta, {
              recordHistory: false,
            });
          }
        });
      }
      return;
    }

    if (!draggingFurniture) return;
    e.stopPropagation();
    if (!dragHasMovedRef.current) {
      pushUndoSnapshot();
      dragHasMovedRef.current = true;
    }
    const targetX = e.point.x - draggingFurniture.offsetX;
    const targetZ = e.point.z - draggingFurniture.offsetZ;
    const { kind, id, anchorStartX, anchorStartZ } = draggingFurniture;
    dragFrame.schedule(() => {
      if (kind === 'rug') {
        moveRug(id, targetX, targetZ, { recordHistory: false });
      } else if (kind === 'stair') {
        moveStair(id, targetX, targetZ, { recordHistory: false });
      } else if (
        kind === 'furniture-group' &&
        anchorStartX !== undefined &&
        anchorStartZ !== undefined
      ) {
        const totalDx = targetX - anchorStartX;
        const totalDz = targetZ - anchorStartZ;
        const stepDx = totalDx - groupDragCommittedDeltaRef.current.x;
        const stepDz = totalDz - groupDragCommittedDeltaRef.current.z;
        groupDragCommittedDeltaRef.current = { x: totalDx, z: totalDz };
        moveSelectedFurniture(selectedIds, stepDx, stepDz, {
          recordHistory: false,
        });
      } else {
        moveFurniture(id, targetX, targetZ, { recordHistory: false });
      }
    });
  };

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingGizmo?.kind !== 'elevation') return;
    const dyPx = draggingGizmo.startClientY - e.clientY;
    const nextElev = Math.max(
      0,
      Math.round((draggingGizmo.startElevationCm + dyPx * 0.75) * 2) / 2
    );
    const { itemId } = draggingGizmo;
    dragFrame.schedule(() => {
      updateFurniture(itemId, { elevationCm: nextElev }, { recordHistory: false });
    });
  };

  const handleDragPlaneUp = () => {
    dragFrame.flush();
    if (draggingFurniture) {
      setDraggingFurniture(null);
      dragHasMovedRef.current = false;
      groupDragCommittedDeltaRef.current = { x: 0, z: 0 };
      clearAlignmentGuides();
    }
    if (draggingGizmo) {
      setDraggingGizmo(null);
    }
  };

  const selectedFurnitureItems = useMemo(
    () =>
      selectedType === 'furniture'
        ? furniture.filter((f) => selectedIds.includes(f.id))
        : [],
    [furniture, selectedIds, selectedType]
  );

  const gizmoData = useMemo(() => {
    if (
      selectedFurnitureItems.length === 0 ||
      cameraPreset === 'first-person'
    ) {
      return null;
    }
    const single =
      selectedFurnitureItems.length === 1 ? selectedFurnitureItems[0] : null;
    const pivot = single
      ? { x: single.x, z: single.z }
      : computeGroupCentroidXZ(selectedFurnitureItems);
    let maxDist = 45;
    for (const item of selectedFurnitureItems) {
      const halfDiag = Math.hypot(item.widthCm / 2, item.depthCm / 2);
      const dist = Math.hypot(item.x - pivot.x, item.z - pivot.z) + halfDiag;
      if (dist > maxDist) maxDist = dist;
    }
    return {
      single,
      pivot,
      ringRadius: Math.min(240, maxDist + 22),
    };
  }, [selectedFurnitureItems, cameraPreset]);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleDragPlaneUp}
      onPointerCancel={handleDragPlaneUp}
    >
      <div className="viewport-badge">
        <span>
          {usePerspective
            ? t('viewer3d.perspectiveBadge')
            : t('viewer3d.isometricBadge')}
          {cameraPreset === 'first-person' ? ` • ${t('viewer3d.wasdHint')}` : ''}
        </span>
      </div>

      <Canvas
        frameloop="demand"
        shadows="soft"
        dpr={qualityMode === 'performance' ? 1 : [1, 1.5]}
        gl={CANVAS_GL_CONFIG}
        onPointerMissed={() => {
          setDraggingFurniture(null);
          selectEntity(null, null);
        }}
      >
        <DemandRenderController />
        <RendererConfigController isBeauty={isBeauty} exposure={mood.exposure} />
        <Export3DBridge exportRootRef={exportRootRef} />
        <CameraController roomBounds={roomBounds} />
        <color
          attach="background"
          args={[
            renderTheme === 'studio' ? mood.stageGradientBottom : '#0b1120',
          ]}
        />

        {usePerspective ? (
          <PerspectiveCamera
            makeDefault
            position={[
              roomBounds.cx + 550,
              620,
              roomBounds.cz + 650,
            ]}
            fov={cameraPreset === 'first-person' ? 55 : 42}
            near={5}
            far={12000}
          />
        ) : (
          <OrthographicCamera
            makeDefault
            position={[
              roomBounds.cx + 650,
              720,
              roomBounds.cz + 650,
            ]}
            zoom={1.0}
            near={10}
            far={5000}
          />
        )}

        <OrbitControls
          makeDefault
          enabled={!draggingFurniture && !draggingGizmo}
          target={[roomBounds.cx, 80, roomBounds.cz]}
          maxPolarAngle={Math.PI / 2 - 0.04}
          minDistance={cameraPreset === 'first-person' ? 10 : 120}
          maxDistance={3500}
        />

        {/* Architectural Studio Stage, Lighting & Contact Shadows */}
        <StudioStage3D roomBounds={roomBounds} elevationCm={activeLevel.elevationCm} />

        {/* Centimeter Floor Grid (10 cm cell / 100 cm section) */}
        <Grid
          position={[
            roomBounds.cx,
            renderTheme === 'studio' ? -20.8 : -0.3,
            roomBounds.cz,
          ]}
          args={[3000, 3000]}
          cellSize={10}
          cellThickness={0.5}
          cellColor={renderTheme === 'studio' ? '#e2e8f0' : '#1e293b'}
          sectionSize={100}
          sectionThickness={1.2}
          sectionColor={renderTheme === 'studio' ? '#cbd5e1' : '#334155'}
          fadeDistance={2600}
        />

        {/* Exportable Architecture & Furniture Root (scaled cm -> m on GLB/USDZ export) */}
        <group ref={exportRootRef} name="exportable-architecture-root">
          {visibleSlabs.map((slab) => (
            <LevelSlabMesh3D
              key={slab.id}
              slab={slab}
              isStudio={renderTheme === 'studio'}
            />
          ))}
          {visibleLevels.map((lvl) => (
            <LevelGroup3D
              key={lvl.id}
              level={lvl}
              allLevels={levels}
              corners={entitiesByLevel.corners.get(lvl.id) ?? EMPTY_CORNERS}
              walls={entitiesByLevel.walls.get(lvl.id) ?? EMPTY_WALLS}
              roomLabels={entitiesByLevel.roomLabels.get(lvl.id) ?? EMPTY_ROOM_LABELS}
              openings={entitiesByLevel.openings.get(lvl.id) ?? EMPTY_OPENINGS}
              roofSlopes={entitiesByLevel.roofSlopes.get(lvl.id) ?? EMPTY_ROOF_SLOPES}
              fixtures={entitiesByLevel.fixtures.get(lvl.id) ?? EMPTY_FIXTURES}
              furniture={entitiesByLevel.furniture.get(lvl.id) ?? EMPTY_FURNITURE}
              rugs={entitiesByLevel.rugs.get(lvl.id) ?? EMPTY_RUGS}
              levelStairs={entitiesByLevel.stairsFrom.get(lvl.id) ?? EMPTY_STAIRS}
              arrivingStairs={entitiesByLevel.stairsTo.get(lvl.id) ?? EMPTY_STAIRS}
              collisionReports={collisionReports}
              floorTextures={floorTextures}
              renderTheme={renderTheme}
              isBeauty={isBeauty}
              cutawayEnabled={cutawayEnabled}
              showDecor={showDecor}
              selectedId={selectedId}
              selectedIds={selectedIds}
              selectedType={selectedType}
              sunDirToRoom={renderTheme === 'studio' ? effectiveSun.dirToRoom : undefined}
              onSelectWall={handleSelectWall}
              onSelectOpening={handleSelectOpening}
              onSelectFixture={handleSelectFixture}
              onStartFurnitureDrag={handleStartFurnitureDrag}
              onStartRugDrag={handleStartRugDrag}
              onStartStairDrag={handleStartStairDrag}
            />
          ))}
        </group>

        {/* Floor-stamped architectural room text (active level) */}
        {activeRoomFloorShapes.map(({ id, centroid, areaSqM, idx, name }) => {
          const areaFormatted =
            language === 'en'
              ? areaSqM.toFixed(1)
              : areaSqM.toFixed(1).replace('.', ',');
          const defaultName = language === 'en' ? `Room ${idx + 1}` : `Raum ${idx + 1}`;
          const title = (name ?? defaultName).toUpperCase();
          return (
            <Text
              key={`label-${activeLevel.id}-${id}`}
              position={[centroid.x, activeLevel.elevationCm + 1.2, centroid.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              color={renderTheme === 'studio' ? '#64748b' : '#94a3b8'}
              fontSize={18}
              letterSpacing={0.1}
              anchorX="center"
              anchorY="middle"
            >
              {`${title} · ${areaFormatted} m²`}
            </Text>
          );
        })}

        {/* Invisible XZ Drag Plane when dragging furniture or rotation gizmo in 3D */}
        {(draggingFurniture || draggingGizmo?.kind === 'rotate') && (
          <mesh
            userData={{ exportIgnore: true }}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[roomBounds.cx, activeLevel.elevationCm + 0.5, roomBounds.cz]}
            onPointerMove={handleDragPlaneMove}
            onPointerUp={handleDragPlaneUp}
            onPointerCancel={handleDragPlaneUp}
          >
            <planeGeometry args={[8000, 8000]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}

        {/* 3D Interactive Transform Gizmos (Rotation Ring + Elevation Handle) */}
        {gizmoData && (
          <group name="furniture-transform-gizmo-3d" userData={{ exportIgnore: true }}>
            <mesh
              position={[gizmoData.pivot.x, activeLevel.elevationCm + 2.5, gizmoData.pivot.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              onPointerDown={(e) => {
                e.stopPropagation();
                pushUndoSnapshot();
                const startAngleDeg =
                  (Math.atan2(
                    e.point.x - gizmoData.pivot.x,
                    e.point.z - gizmoData.pivot.z
                  ) *
                    180) /
                  Math.PI;
                gizmoRotateCommittedDeltaRef.current = 0;
                setDraggingGizmo({
                  kind: 'rotate',
                  pivotX: gizmoData.pivot.x,
                  pivotZ: gizmoData.pivot.z,
                  startPointerAngleDeg: startAngleDeg,
                  singleItemId: gizmoData.single?.id ?? null,
                  startItemRotDeg: gizmoData.single?.rotationYDeg ?? 0,
                });
              }}
            >
              <torusGeometry args={[gizmoData.ringRadius, 2.5, 10, 64]} />
              <meshBasicMaterial
                color="#38bdf8"
                transparent
                opacity={0.78}
                depthWrite={false}
              />
            </mesh>

            {gizmoData.single && (
              <group
                position={[
                  gizmoData.single.x,
                  activeLevel.elevationCm +
                    gizmoData.single.elevationCm +
                    gizmoData.single.heightCm +
                    18,
                  gizmoData.single.z,
                ]}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  pushUndoSnapshot();
                  setDraggingGizmo({
                    kind: 'elevation',
                    itemId: gizmoData.single!.id,
                    startClientY: e.clientY,
                    startElevationCm: gizmoData.single!.elevationCm,
                  });
                }}
              >
                <mesh position={[0, -6, 0]}>
                  <cylinderGeometry args={[1.6, 1.6, 14, 10]} />
                  <meshBasicMaterial color="#f59e0b" />
                </mesh>
                <mesh position={[0, 5, 0]}>
                  <coneGeometry args={[5.5, 11, 14]} />
                  <meshBasicMaterial color="#f59e0b" />
                </mesh>
              </group>
            )}
          </group>
        )}

        {/* Smart Alignment Guides in 3D (Paket 3C) */}
        {activeAlignmentGuides.map((g, idx) => (
          <Line
            key={`guide-3d-${idx}`}
            points={[
              [g.start.x, activeLevel.elevationCm + 2.2, g.start.z],
              [g.end.x, activeLevel.elevationCm + 2.2, g.end.z],
            ]}
            color={g.kind === 'flush' ? '#ec4899' : '#06b6d4'}
            lineWidth={2.5}
            dashed
            dashSize={6}
            gapSize={4}
          />
        ))}

        {/* Exterior Architectural Perimeter Dimension Lines */}
        {showDimensions3D && (
          <group position={[0, activeLevel.elevationCm, 0]}>
            <ArchitecturalDimensionLines3D
              corners={activeCorners}
              walls={activeWalls}
              roomBounds={roomBounds}
              theme={renderTheme}
            />
          </group>
        )}

        {/* Ergonomics & Passage Clearance Heatmap Overlay */}
        <PassageClearance3D />

        {/* Variant Ghost-Diff 3D Overlay */}
        <GhostVariantOverlay3D />

        {/* Cinematic Archviz Post-Processing Pipeline */}
        <PostFX3D />
      </Canvas>
    </div>
  );
};
