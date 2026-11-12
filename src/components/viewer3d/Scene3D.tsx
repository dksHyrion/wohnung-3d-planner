import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, ThreeEvent, useThree, useFrame } from '@react-three/fiber';
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
import { WallMesh3D } from './WallMesh3D';
import { FurnitureMesh3D } from './FurnitureMesh3D';
import { StudioStage3D } from './StudioStage3D';
import { RugMesh3D } from './RugMesh3D';
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
import { AreaRug, Corner, FurnitureItem, FlooringType, Wall, WallOpening } from '../../core/types';
import { openingIsWalkthrough, openingLetsLightThrough } from '../../core/doorLeaf';
import { createFrameThrottle } from '../../core/frameThrottle';
import {
  applyRoomLabels,
  computeFloorPolygons,
  getInteriorWallIds,
  getWallGeometry,
  shouldCutawayWall,
} from '../../core/wallMath';
import { ProceduralCurtain3D } from './decor/ProceduralCurtain3D';
import { WindowLightPool3D } from './decor/WindowLightPool3D';
import { PostFX3D } from './PostFX3D';
import { interpolateMood } from '../../core/lighting/moodPresets';

declare global {
  interface Window {
    __DEBUG_THREE__?: {
      gl: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.Camera;
    };
  }
}

const EMPTY_ARRAY: readonly never[] = Object.freeze([]);
const EMPTY_OPENINGS: WallOpening[] = [];

/** Minimal structural view of drei's OrbitControls instance (exposed as an EventDispatcher by useThree). */
interface OrbitControlsLike {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export const CANVAS_GL_CONFIG = {
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance',
  toneMapping: THREE.NoToneMapping,
} as const;

export const getFloorMaterialProps = (
  flooringType: FlooringType,
  isStudio: boolean,
  texture: THREE.Texture | null,
  isBeauty: boolean = true,
  bumpMap: THREE.Texture | null = null
) => ({
  map: texture,
  bumpMap: isStudio ? bumpMap : null,
  bumpScale:
    isStudio && bumpMap
      ? flooringType === 'tile'
        ? 0.35
        : flooringType === 'parquet'
        ? 0.22
        : 0.08
      : 0,
  color: isStudio ? '#ffffff' : '#334155',
  roughness: flooringType === 'microcement' ? 0.85 : 0.38,
  metalness: 0.05,
  clearcoat: isStudio && isBeauty ? 0.18 : 0,
  clearcoatRoughness: 0.25,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});

const RendererConfigController: React.FC<{
  isBeauty: boolean;
  exposure: number;
}> = ({ isBeauty, exposure }) => {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    gl.toneMapping = isBeauty ? THREE.NoToneMapping : THREE.AgXToneMapping;
    gl.toneMappingExposure = exposure;
    if (typeof window !== 'undefined') {
      window.__DEBUG_THREE__ = { gl, scene, camera };
    }

    const handleSnapshotRequest = (e: Event) => {
      try {
        gl.render(scene, camera);
        const detail = (e as CustomEvent<{ prefix?: string } | undefined>).detail;
        const prefix = detail?.prefix ?? 'wohnung-3d';
        const dataUrl = gl.domElement.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.png`;
        if (document.body) {
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          a.click();
        }
      } catch (err) {
        console.error('Failed to capture snapshot in render listener:', err);
      }
    };

    window.addEventListener('wohnung-capture-snapshot', handleSnapshotRequest);
    return () => {
      window.removeEventListener('wohnung-capture-snapshot', handleSnapshotRequest);
    };
  }, [gl, scene, camera, isBeauty, exposure]);
  return null;
};

export interface FirstPersonViewpoint {
  cameraPosition: [number, number, number];
  targetPosition: [number, number, number];
}

export function computeFirstPersonViewpoint(
  corners: Corner[],
  walls: Wall[],
  openings: WallOpening[],
  roomBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    cx: number;
    cz: number;
  },
  eyeLevelCm: number = 170,
  focusPoint?: { x: number; z: number } | null
): FirstPersonViewpoint {
  const targetCenter = focusPoint ?? { x: roomBounds.cx, z: roomBounds.cz };
  const doors = openings.filter((o) => openingIsWalkthrough(o.type));
  const cornerMap = new Map<string, Corner>(corners.map((c) => [c.id, c]));
  const wallMap = new Map<string, Wall>(walls.map((w) => [w.id, w]));

  const doorCandidates: {
    standX: number;
    standZ: number;
    distToTarget: number;
  }[] = [];

  for (const door of doors) {
    const wall = wallMap.get(door.wallId);
    if (!wall) continue;
    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) continue;
    const geom = getWallGeometry(start, end);
    if (geom.lengthCm < 1) continue;

    const doorCenterAlongWall = door.offsetFromStartCm + door.widthCm / 2;
    const ratio = Math.max(0, Math.min(1, doorCenterAlongWall / geom.lengthCm));
    const doorX = start.x + (end.x - start.x) * ratio;
    const doorZ = start.z + (end.z - start.z) * ratio;

    const toCenterX = targetCenter.x - doorX;
    const toCenterZ = targetCenter.z - doorZ;
    const inwardSign =
      toCenterX * geom.normal.x + toCenterZ * geom.normal.z >= 0 ? 1 : -1;
    const inwardNx = geom.normal.x * inwardSign;
    const inwardNz = geom.normal.z * inwardSign;

    const standX = doorX + inwardNx * 80;
    const standZ = doorZ + inwardNz * 80;

    if (!focusPoint) {
      return {
        cameraPosition: [standX, eyeLevelCm, standZ],
        targetPosition: [roomBounds.cx, eyeLevelCm, roomBounds.cz],
      };
    }

    doorCandidates.push({
      standX,
      standZ,
      distToTarget: Math.hypot(standX - targetCenter.x, standZ - targetCenter.z),
    });
  }

  if (focusPoint && doorCandidates.length > 0) {
    doorCandidates.sort((a, b) => a.distToTarget - b.distToTarget);
    const best = doorCandidates[0];
    return {
      cameraPosition: [best.standX, eyeLevelCm, best.standZ],
      targetPosition: [targetCenter.x, eyeLevelCm, targetCenter.z],
    };
  }

  // Fallback if no doors exist
  const standX = focusPoint ? targetCenter.x - 140 : roomBounds.minX + 80;
  const standZ = targetCenter.z;
  return {
    cameraPosition: [standX, eyeLevelCm, standZ],
    targetPosition: [targetCenter.x, eyeLevelCm, targetCenter.z],
  };
}

export const CameraController: React.FC<{
  roomBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    cx: number;
    cz: number;
  };
}> = ({ roomBounds }) => {
  const { camera, controls } = useThree();
  const cameraPreset = useFloorplanStore((s) => s.cameraPreset);
  const cameraPresetNonce = useFloorplanStore((s) => s.cameraPresetNonce);
  const cameraEyeLevelCm = useFloorplanStore((s) => s.cameraEyeLevelCm);
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const roomLabels = useFloorplanStore((s) => s.roomLabels);
  const openings = useFloorplanStore((s) => s.openings);
  const furniture = useFloorplanStore((s) => s.furniture);
  const selectedId = useFloorplanStore((s) => s.selectedId);
  const selectedType = useFloorplanStore((s) => s.selectedType);
  const viewMode = useFloorplanStore((s) => s.viewMode);
  const setViewMode = useFloorplanStore((s) => s.setViewMode);
  const lastNonceRef = useRef(0);
  const lastEyeLevelRef = useRef(cameraEyeLevelCm);
  const transitionRef = useRef<{
    active: boolean;
    goalPos: THREE.Vector3;
    goalTarget: THREE.Vector3;
  }>({
    active: false,
    goalPos: new THREE.Vector3(),
    goalTarget: new THREE.Vector3(),
  });

  useEffect(() => {
    if (!controls || !('addEventListener' in controls)) return;
    const orbit = controls as unknown as OrbitControlsLike;
    const cancelTransition = () => {
      transitionRef.current.active = false;
    };
    orbit.addEventListener('start', cancelTransition);
    return () => {
      orbit.removeEventListener('start', cancelTransition);
    };
  }, [controls]);

  useFrame((_, delta) => {
    if (!transitionRef.current.active) return;
    const alpha = 1 - Math.exp(-9 * Math.min(delta, 0.1));
    camera.position.lerp(transitionRef.current.goalPos, alpha);
    if (controls && 'target' in controls) {
      const orbit = controls as unknown as OrbitControlsLike;
      orbit.target.lerp(transitionRef.current.goalTarget, alpha);
      orbit.update();
    } else {
      camera.lookAt(transitionRef.current.goalTarget);
    }
    camera.updateProjectionMatrix();

    const distPos = camera.position.distanceTo(transitionRef.current.goalPos);
    if (distPos < 0.8) {
      camera.position.copy(transitionRef.current.goalPos);
      if (controls && 'target' in controls) {
        const orbit = controls as unknown as OrbitControlsLike;
        orbit.target.copy(transitionRef.current.goalTarget);
        orbit.update();
      } else {
        camera.lookAt(transitionRef.current.goalTarget);
      }
      camera.updateProjectionMatrix();
      transitionRef.current.active = false;
    }
  });

  useEffect(() => {
    const isFirstPerson = cameraPreset === 'first-person';
    const nonceChanged =
      cameraPresetNonce !== 0 && cameraPresetNonce !== lastNonceRef.current;
    const eyeLevelChanged =
      isFirstPerson && cameraEyeLevelCm !== lastEyeLevelRef.current;

    if (!nonceChanged && !eyeLevelChanged) return;
    lastNonceRef.current = cameraPresetNonce;
    lastEyeLevelRef.current = cameraEyeLevelCm;

    if (isFirstPerson && viewMode !== '3d-persp') {
      setViewMode('3d-persp');
    }

    const span = Math.max(
      roomBounds.maxX - roomBounds.minX,
      roomBounds.maxZ - roomBounds.minZ,
      400
    );
    let targetX = roomBounds.cx;
    let targetY = 35;
    let targetZ = roomBounds.cz;
    let goalX = camera.position.x;
    let goalY = camera.position.y;
    let goalZ = camera.position.z;

    if (cameraPreset === 'axonometric') {
      const dHoriz = span * 0.95;
      const angleRad = (65 * Math.PI) / 180;
      const dy = dHoriz * Math.tan(angleRad);
      const dx = dHoriz * 0.7071;
      const dz = dHoriz * 0.7071;
      goalX = targetX + dx;
      goalY = dy;
      goalZ = targetZ + dz;
    } else if (cameraPreset === 'isometric') {
      const dHoriz = span * 1.1;
      const angleRad = (45 * Math.PI) / 180;
      const dy = dHoriz * Math.tan(angleRad);
      const dx = dHoriz * 0.7071;
      const dz = dHoriz * 0.7071;
      goalX = targetX + dx;
      goalY = dy;
      goalZ = targetZ + dz;
    } else if (cameraPreset === 'top-down') {
      const dy = span * 1.6;
      goalX = targetX;
      goalY = dy;
      goalZ = targetZ + 0.1;
    } else if (cameraPreset === 'first-person') {
      let focusPoint: { x: number; z: number } | null = null;
      if (selectedType === 'room' && selectedId) {
        const rooms = applyRoomLabels(
          computeFloorPolygons(corners, walls),
          roomLabels
        );
        const selRoom = rooms.find((r) => r.id === selectedId);
        if (selRoom) {
          focusPoint = { x: selRoom.centroid.x, z: selRoom.centroid.z };
        }
      } else if (selectedType === 'furniture' && selectedId) {
        const selFurn = furniture.find((f) => f.id === selectedId);
        if (selFurn) {
          focusPoint = { x: selFurn.x, z: selFurn.z };
        }
      }

      const vp = computeFirstPersonViewpoint(
        corners,
        walls,
        openings,
        roomBounds,
        cameraEyeLevelCm,
        focusPoint
      );
      goalX = vp.cameraPosition[0];
      goalY = vp.cameraPosition[1];
      goalZ = vp.cameraPosition[2];
      targetX = vp.targetPosition[0];
      targetY = vp.targetPosition[1];
      targetZ = vp.targetPosition[2];
    }

    transitionRef.current.goalPos.set(goalX, goalY, goalZ);
    transitionRef.current.goalTarget.set(targetX, targetY, targetZ);
    transitionRef.current.active = true;
  }, [
    cameraPreset,
    cameraPresetNonce,
    cameraEyeLevelCm,
    corners,
    walls,
    roomLabels,
    openings,
    furniture,
    selectedId,
    selectedType,
    viewMode,
    setViewMode,
    camera,
    controls,
    roomBounds,
  ]);

  return null;
};

export interface WallGroup3DProps {
  wall: Wall;
  start: Corner;
  end: Corner;
  openings: WallOpening[];
  roomCenter: { x: number; z: number };
  cutawayEnabled: boolean;
  isSelected: boolean;
  showDecor?: boolean;
  onSelectWall: (wallId: string) => void;
  onSelectOpening: (openingId: string) => void;
}

/**
 * Manages cutaway state and colocates WallMesh3D with its window ProceduralCurtain3D decor.
 * Deduplicates per-frame useFrame camera checks across the wall and all of its curtains.
 */
export const WallGroup3D = React.memo<WallGroup3DProps>(({
  wall,
  start,
  end,
  openings,
  roomCenter,
  cutawayEnabled,
  isSelected,
  showDecor,
  onSelectWall,
  onSelectOpening,
}) => {
  const storeShowDecor = useFloorplanStore((s) => s.showDecor);
  const effectiveShowDecor = showDecor ?? storeShowDecor;
  const [isCutaway, setIsCutaway] = useState(false);
  const lastCamRef = useRef({ x: NaN, y: NaN, z: NaN });

  useFrame(({ camera }) => {
    if (!cutawayEnabled) {
      if (isCutaway) setIsCutaway(false);
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

export const Scene3D: React.FC = () => {
  const { t, language } = useTranslation();
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const roomLabels = useFloorplanStore((s) => s.roomLabels);
  const openings = useFloorplanStore((s) => s.openings);
  const furniture = useFloorplanStore((s) => s.furniture);
  const rugs =
    useFloorplanStore((s) => s.rugs) ?? (EMPTY_ARRAY as unknown as AreaRug[]);
  const collisionReports = useFloorplanStore((s) => s.collisionReports);
  const viewMode = useFloorplanStore((s) => s.viewMode);
  const cameraPreset = useFloorplanStore((s) => s.cameraPreset);
  const showDecor = useFloorplanStore((s) => s.showDecor);
  const cutawayEnabled = useFloorplanStore((s) => s.cutawayEnabled);
  const renderTheme = useFloorplanStore((s) => s.renderTheme);
  const showDimensions3D = useFloorplanStore((s) => s.showDimensions3D);
  const selectedId = useFloorplanStore((s) => s.selectedId);
  const selectedType = useFloorplanStore((s) => s.selectedType);
  const timeOfDay = useFloorplanStore((s) => s.timeOfDay);
  const qualityMode = useFloorplanStore((s) => s.qualityMode);

  const mood = useMemo(() => interpolateMood(timeOfDay), [timeOfDay]);
  const isBeauty = qualityMode === 'beauty' && renderTheme === 'studio';

  const selectEntity = useFloorplanStore((s) => s.selectEntity);
  const moveFurniture = useFloorplanStore((s) => s.moveFurniture);
  const moveRug = useFloorplanStore((s) => s.moveRug);
  const activeAlignmentGuides =
    useFloorplanStore((s) => s.activeAlignmentGuides) ?? EMPTY_ARRAY;
  const clearAlignmentGuides = useFloorplanStore(
    (s) => s.clearAlignmentGuides
  );
  const pushUndoSnapshot = useFloorplanStore((s) => s.pushUndoSnapshot);

  const [draggingFurniture, setDraggingFurniture] = useState<{
    kind: 'furniture' | 'rug';
    id: string;
    offsetX: number;
    offsetZ: number;
  } | null>(null);
  const dragHasMovedRef = useRef<boolean>(false);

  const cornerMap = useMemo(
    () => new Map<string, Corner>(corners.map((c) => [c.id, c])),
    [corners]
  );

  // Compute room bounding box and centroid in cm
  const roomBounds = useMemo(() => {
    if (corners.length === 0) {
      return { minX: 0, maxX: 500, minZ: 0, maxZ: 400, cx: 250, cz: 200 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const c of corners) {
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
  }, [corners]);

  const roomCenter = useMemo(
    () => ({ x: roomBounds.cx, z: roomBounds.cz }),
    [roomBounds.cx, roomBounds.cz]
  );

  // Extract closed 2D floor polygons for all rooms on the XZ plane (computed once per layout change)
  const rooms = useMemo(
    () => applyRoomLabels(computeFloorPolygons(corners, walls), roomLabels),
    [corners, walls, roomLabels]
  );

  const roomFloorShapes = useMemo(() => {
    return rooms.map((room, idx) => {
      const shape = new THREE.Shape();
      shape.moveTo(room.corners[0].x, -room.corners[0].z);
      for (let i = 1; i < room.corners.length; i++) {
        shape.lineTo(room.corners[i].x, -room.corners[i].z);
      }
      shape.closePath();
      return {
        id: room.id,
        shape,
        idx,
        centroid: room.centroid,
        areaSqM: room.netAreaSqM > 0 ? room.netAreaSqM : room.areaSqM,
        name: room.name,
        flooringType: room.flooringType ?? 'microcement',
      };
    });
  }, [rooms]);

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

  const interiorWallIds = useMemo(
    () => getInteriorWallIds(corners, walls, rooms),
    [corners, walls, rooms]
  );

  // Stable per-wall opening arrays and handlers keep WallGroup3D's memo effective
  // while furniture is dragged.
  const openingsByWall = useMemo(() => {
    const map = new Map<string, WallOpening[]>();
    for (const o of openings) {
      const list = map.get(o.wallId);
      if (list) list.push(o);
      else map.set(o.wallId, [o]);
    }
    return map;
  }, [openings]);
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
    hitPoint: THREE.Vector3
  ) => {
    selectEntity(item.id, 'furniture');
    dragHasMovedRef.current = false;
    setDraggingFurniture({
      kind: 'furniture',
      id: item.id,
      offsetX: hitPoint.x - item.x,
      offsetZ: hitPoint.z - item.z,
    });
  };

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

  // One store commit per animation frame while dragging; pointer up flushes the last position.
  const dragFrame = useRef(createFrameThrottle()).current;

  const handleDragPlaneMove = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingFurniture) return;
    e.stopPropagation();
    if (!dragHasMovedRef.current) {
      pushUndoSnapshot();
      dragHasMovedRef.current = true;
    }
    const targetX = e.point.x - draggingFurniture.offsetX;
    const targetZ = e.point.z - draggingFurniture.offsetZ;
    const { kind, id } = draggingFurniture;
    dragFrame.schedule(() => {
      if (kind === 'rug') {
        moveRug(id, targetX, targetZ, { recordHistory: false });
      } else {
        moveFurniture(id, targetX, targetZ, { recordHistory: false });
      }
    });
  };

  const handleDragPlaneUp = () => {
    dragFrame.flush();
    if (draggingFurniture) {
      setDraggingFurniture(null);
      dragHasMovedRef.current = false;
      clearAlignmentGuides();
    }
  };

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onPointerUp={handleDragPlaneUp}
      onPointerCancel={handleDragPlaneUp}
    >
      <div className="viewport-badge">
        <span>
          {usePerspective
            ? t('viewer3d.perspectiveBadge')
            : t('viewer3d.isometricBadge')}
        </span>
      </div>

      <Canvas
        shadows="soft"
        dpr={qualityMode === 'performance' ? 1 : [1, 1.5]}
        gl={CANVAS_GL_CONFIG}
        onPointerMissed={() => {
          setDraggingFurniture(null);
          selectEntity(null, null);
        }}
      >
        <RendererConfigController isBeauty={isBeauty} exposure={mood.exposure} />
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
          enabled={!draggingFurniture}
          target={[roomBounds.cx, 80, roomBounds.cz]}
          maxPolarAngle={Math.PI / 2 - 0.04}
          minDistance={cameraPreset === 'first-person' ? 10 : 120}
          maxDistance={3500}
        />

        {/* Architectural Studio Stage, Lighting & Contact Shadows */}
        <StudioStage3D roomBounds={roomBounds} />

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

        {/* Room Hardwood/Tile/Microcement Floor Meshes */}
        {roomFloorShapes.map(({ id, shape, idx, flooringType }) => {
          const isStudio = renderTheme === 'studio';
          const texture = isStudio ? floorTextures[flooringType] : null;
          const bumpTexture = isStudio
            ? floorTextures.bump[flooringType]
            : null;

          return (
            <mesh
              key={id}
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

        {/* Textured Architectural Area Rugs */}
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
            onStartDrag={(pt) => handleStartRugDrag(rug, pt)}
          />
        ))}

        {/* Floor-stamped architectural room text */}
        {roomFloorShapes.map(({ id, centroid, areaSqM, idx, name }) => {
          const areaFormatted =
            language === 'en'
              ? areaSqM.toFixed(1)
              : areaSqM.toFixed(1).replace('.', ',');
          const defaultName = language === 'en' ? `Room ${idx + 1}` : `Raum ${idx + 1}`;
          const title = (name ?? defaultName).toUpperCase();
          return (
            <Text
              key={`label-${id}`}
              position={[centroid.x, 1.2, centroid.z]}
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

        {/* Invisible XZ Drag Plane when dragging furniture in 3D */}
        {draggingFurniture && (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[roomBounds.cx, 0.5, roomBounds.cz]}
            onPointerMove={handleDragPlaneMove}
            onPointerUp={handleDragPlaneUp}
            onPointerCancel={handleDragPlaneUp}
          >
            <planeGeometry args={[8000, 8000]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}

        {/* 3D Walls with Cutaway, Openings & Window Curtains */}
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
              roomCenter={roomCenter}
              cutawayEnabled={cutawayEnabled && !interiorWallIds.has(wall.id)}
              isSelected={selectedType === 'wall' && selectedId === wall.id}
              showDecor={showDecor}
              onSelectWall={handleSelectWall}
              onSelectOpening={handleSelectOpening}
            />
          );
        })}

        {/* 3D Furniture Items */}

        {furniture.map((item) => (
          <FurnitureMesh3D
            key={item.id}
            item={item}
            report={collisionReports[item.id]}
            isSelected={selectedType === 'furniture' && selectedId === item.id}
            onStartDrag={handleStartFurnitureDrag}
          />
        ))}

        {/* Smart Alignment Guides in 3D (Paket 3C) */}
        {activeAlignmentGuides.map((g, idx) => (
          <Line
            key={`guide-3d-${idx}`}
            points={[
              [g.start.x, 2.2, g.start.z],
              [g.end.x, 2.2, g.end.z],
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
          <ArchitecturalDimensionLines3D
            corners={corners}
            walls={walls}
            roomBounds={roomBounds}
            theme={renderTheme}
          />
        )}

        {/* Ergonomics & Passage Clearance Heatmap Overlay */}
        <PassageClearance3D />

        {/* Cinematic Archviz Post-Processing Pipeline */}
        <PostFX3D />
      </Canvas>
    </div>
  );
};
