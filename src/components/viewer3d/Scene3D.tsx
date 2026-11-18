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
import { WallMesh3D, SKIRTING_THICKNESS_CM, WALL_CAP_THICKNESS_OFFSET_CM } from './WallMesh3D';
import { RoofSlopeMesh3D } from './RoofSlopeMesh3D';
import { WallFixtureMesh3D } from './WallFixtureMesh3D';
import { resolveRoofSlopePlanes } from '../../core/roofSlopeMath';
import { computeWallFixtureBoxes } from '../../core/mepFixtures';
import { computeWallMiterMap, type WallMiterExtents } from '../../core/wallMiter';
import { computeEffectiveSunLight } from '../../core/windowLight';
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
import {
  DEFAULT_WALK_SPEED_CM_PER_SEC,
  stepFirstPersonWalk,
} from '../../core/walkAndSightlines';
import {
  exportSceneToGlb,
  exportSceneToUsdz,
} from '../../core/export/scene3dExport';
import { computeVariantDiff } from '../../core/layoutVariants';
import { computeGroupCentroidXZ } from '../../core/groupTransformMath';

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

const DemandRenderController: React.FC = () => {
  const { invalidate, controls } = useThree();

  useEffect(() => {
    invalidate();
    const raf = requestAnimationFrame(() => invalidate());
    const unsub = useFloorplanStore.subscribe(() => invalidate());
    return () => {
      cancelAnimationFrame(raf);
      unsub();
    };
  }, [invalidate]);

  useEffect(() => {
    if (!controls || !('addEventListener' in controls)) return;
    const orbit = controls as unknown as OrbitControlsLike;
    const onChange = () => invalidate();
    orbit.addEventListener('change', onChange);
    return () => {
      orbit.removeEventListener('change', onChange);
    };
  }, [controls, invalidate]);

  return null;
};

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

const Export3DBridge: React.FC<{
  exportRootRef: React.RefObject<THREE.Group | null>;
}> = ({ exportRootRef }) => {
  useEffect(() => {
    const handleExport3d = (e: Event) => {
      const root = exportRootRef.current;
      if (!root) return;
      const detail = (
        e as CustomEvent<{ format?: 'glb' | 'usdz'; filename?: string } | undefined>
      ).detail;
      const format = detail?.format ?? 'glb';
      const filename =
        detail?.filename ?? (format === 'usdz' ? 'wohnung.usdz' : 'wohnung.glb');

      void (async () => {
        try {
          const blob =
            format === 'usdz'
              ? new Blob([new Uint8Array(await exportSceneToUsdz(root))], {
                  type: 'model/vnd.usdz+zip',
                })
              : new Blob([await exportSceneToGlb(root)], {
                  type: 'model/gltf-binary',
                });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          if (document.body) {
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } else {
            a.click();
          }
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
          console.error('Failed to export 3D model:', err);
        }
      })();
    };

    window.addEventListener('wohnung-export-3d', handleExport3d);
    return () => {
      window.removeEventListener('wohnung-export-3d', handleExport3d);
    };
  }, [exportRootRef]);

  return null;
};

const GhostVariantOverlay3D: React.FC = () => {
  const ghostVariantId = useFloorplanStore((s) => s.ghostVariantId);
  const layoutVariants = useFloorplanStore((s) => s.layoutVariants);
  const furniture = useFloorplanStore((s) => s.furniture);
  const rugs =
    useFloorplanStore((s) => s.rugs) ?? (EMPTY_ARRAY as unknown as AreaRug[]);

  const ghostVariant = useMemo(
    () =>
      ghostVariantId
        ? layoutVariants.find((v) => v.id === ghostVariantId)
        : undefined,
    [ghostVariantId, layoutVariants]
  );

  const diff = useMemo(
    () => (ghostVariant ? computeVariantDiff({ furniture, rugs }, ghostVariant) : null),
    [ghostVariant, furniture, rugs]
  );

  if (!diff) return null;

  const ghostItems = [
    ...diff.ghostOnlyFurniture,
    ...diff.movedFurniture.map((m) => m.ghost),
  ];

  return (
    <group name="variant-ghost-overlay-3d" userData={{ exportIgnore: true }}>
      {ghostItems.map((item) => (
        <mesh
          key={`ghost-3d-${item.id}`}
          position={[item.x, item.elevationCm + item.heightCm / 2, item.z]}
          rotation={[0, (item.rotationYDeg * Math.PI) / 180, 0]}
          raycast={() => null}
        >
          <boxGeometry args={[item.widthCm, item.heightCm, item.depthCm]} />
          <meshBasicMaterial
            color="#a855f7"
            transparent
            opacity={0.24}
            depthWrite={false}
            wireframe={false}
          />
        </mesh>
      ))}
      {diff.movedFurniture.map(({ ghost, active }) => (
        <Line
          key={`ghost-3d-line-${ghost.id}`}
          points={[
            [ghost.x, 4, ghost.z],
            [active.x, 4, active.z],
          ]}
          color="#c084fc"
          lineWidth={2}
          dashed
          dashSize={8}
          gapSize={5}
        />
      ))}
    </group>
  );
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
  const { camera, controls, invalidate } = useThree();
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
  const pressedKeysRef = useRef<Set<string>>(new Set());
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
    if (cameraPreset !== 'first-person') {
      pressedKeysRef.current.clear();
      return;
    }

    const WALK_KEYS = new Set([
      'w',
      'a',
      's',
      'd',
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
    ]);

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.tagName === 'INPUT' ||
          targetEl.tagName === 'TEXTAREA' ||
          targetEl.tagName === 'SELECT')
      ) {
        return;
      }
      const k = e.key.toLowerCase();
      if (!WALK_KEYS.has(k)) return;
      if (k.startsWith('arrow')) e.preventDefault();
      pressedKeysRef.current.add(k);
      transitionRef.current.active = false;
      invalidate();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeysRef.current.delete(e.key.toLowerCase());
    };

    const handleBlur = () => {
      pressedKeysRef.current.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [cameraPreset, invalidate]);

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
    if (cameraPreset === 'first-person' && pressedKeysRef.current.size > 0) {
      const keys = pressedKeysRef.current;
      const forwardInput =
        (keys.has('w') || keys.has('arrowup') ? 1 : 0) -
        (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const strafeInput =
        (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
        (keys.has('a') || keys.has('arrowleft') ? 1 : 0);

      if (forwardInput !== 0 || strafeInput !== 0) {
        const orbit =
          controls && 'target' in controls
            ? (controls as unknown as OrbitControlsLike)
            : null;
        const currentTarget = orbit
          ? { x: orbit.target.x, y: orbit.target.y, z: orbit.target.z }
          : { x: roomBounds.cx, y: cameraEyeLevelCm, z: roomBounds.cz };
        const stepCm = DEFAULT_WALK_SPEED_CM_PER_SEC * Math.min(delta, 0.1);
        const res = stepFirstPersonWalk({
          pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          target: currentTarget,
          forwardInput,
          strafeInput,
          stepCm,
          eyeLevelCm: cameraEyeLevelCm,
          corners,
          walls,
          openings,
        });
        camera.position.set(res.pos.x, res.pos.y, res.pos.z);
        if (orbit) {
          orbit.target.set(res.target.x, res.target.y, res.target.z);
          orbit.update();
        } else {
          camera.lookAt(res.target.x, res.target.y, res.target.z);
        }
        camera.updateProjectionMatrix();
        invalidate();
      }
    }

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
    invalidate();
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
    invalidate();
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
    invalidate,
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
  miter?: WallMiterExtents;
  capMiter?: WallMiterExtents;
  skirtingMiter?: WallMiterExtents;
  sunDirToRoom?: { x: number; y: number; z: number };
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

export const Scene3D: React.FC = () => {
  const { t, language } = useTranslation();
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const roomLabels = useFloorplanStore((s) => s.roomLabels);
  const openings = useFloorplanStore((s) => s.openings);
  const roofSlopes = useFloorplanStore((s) => s.roofSlopes);
  const fixtures = useFloorplanStore((s) => s.fixtures);
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
  const activeAlignmentGuides =
    useFloorplanStore((s) => s.activeAlignmentGuides) ?? EMPTY_ARRAY;
  const clearAlignmentGuides = useFloorplanStore(
    (s) => s.clearAlignmentGuides
  );
  const pushUndoSnapshot = useFloorplanStore((s) => s.pushUndoSnapshot);

  const [draggingFurniture, setDraggingFurniture] = useState<{
    kind: 'furniture' | 'furniture-group' | 'rug';
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
        lastAppliedDeltaDeg: number;
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
  const exportRootRef = useRef<THREE.Group | null>(null);

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
      const poly = room.netCorners.length >= 3 ? room.netCorners : room.corners;
      const shape = new THREE.Shape();
      shape.moveTo(poly[0].x, -poly[0].z);
      for (let i = 1; i < poly.length; i++) {
        shape.lineTo(poly[i].x, -poly[i].z);
      }
      shape.closePath();
      const roomHoles = room.netHoles ?? room.holes;
      if (roomHoles) {
        for (const hole of roomHoles) {
          if (hole.length < 3) continue;
          const holePath = new THREE.Path();
          holePath.moveTo(hole[0].x, -hole[0].z);
          for (let i = 1; i < hole.length; i++) {
            holePath.lineTo(hole[i].x, -hole[i].z);
          }
          holePath.closePath();
          shape.holes.push(holePath);
        }
      }
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

  const wallMiterMap = useMemo(
    () => computeWallMiterMap(corners, walls),
    [corners, walls]
  );
  const roofSlopePlanes = useMemo(
    () => resolveRoofSlopePlanes(corners, walls, roofSlopes, rooms),
    [corners, walls, roofSlopes, rooms]
  );
  const fixtureBoxes = useMemo(
    () => computeWallFixtureBoxes(corners, walls, fixtures, rooms),
    [corners, walls, fixtures, rooms]
  );
  const maxCeilingCm = useMemo(
    () => (walls.length > 0 ? Math.max(250, ...walls.map((w) => w.heightCm)) : 250),
    [walls]
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
  const effectiveSun = useMemo(
    () =>
      computeEffectiveSunLight({
        corners,
        walls,
        openings,
        roomCenter: { cx: roomBounds.cx, cz: roomBounds.cz },
        sunElevationDeg: mood.sunElevationDeg,
        sunAzimuthDeg: mood.sunAzimuthDeg,
        alignSunWithWindows: renderTheme === 'studio' && alignSunWithWindows,
      }),
    [
      corners,
      walls,
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
        const stepDelta = rawDelta - draggingGizmo.lastAppliedDeltaDeg;
        if (Math.abs(stepDelta) >= 0.25) {
          draggingGizmo.lastAppliedDeltaDeg = rawDelta;
          const idsSnapshot = selectedIds;
          dragFrame.schedule(() => {
            rotateSelectedFurniture(idsSnapshot, stepDelta, {
              recordHistory: false,
            });
          });
        }
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

        {/* Exportable Architecture & Furniture Root (scaled cm -> m on GLB/USDZ export) */}
        <group ref={exportRootRef} name="exportable-architecture-root">
          {/* Room Hardwood/Tile/Microcement Floor Meshes */}
          {roomFloorShapes.map(({ id, shape, flooringType }) => {
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
                miter={wallMiterMap.get(wall.id)}
                capMiter={capMiterMap.get(wall.id)}
                skirtingMiter={skirtingMiterMap.get(wall.id)}
                sunDirToRoom={renderTheme === 'studio' ? effectiveSun.dirToRoom : undefined}
                onSelectWall={handleSelectWall}
                onSelectOpening={handleSelectOpening}
              />
            );
          })}

          {/* 3D Roof Slopes (Dachschrägen) */}
          {roofSlopePlanes.map((plane) => (
            <RoofSlopeMesh3D
              key={plane.slopeId}
              plane={plane}
              maxCeilingCm={maxCeilingCm}
              theme={renderTheme}
            />
          ))}

          {/* 3D Wall MEP Fixtures (Radiators, Sockets, Switches, Data, Water, Shafts) */}
          {fixtureBoxes.map((box) => (
            <WallFixtureMesh3D
              key={box.fixtureId}
              box={box}
              isSelected={selectedType === 'fixture' && selectedId === box.fixtureId}
              onSelect={(id) => selectEntity(id, 'fixture')}
            />
          ))}

          {/* 3D Furniture Items */}
          {furniture.map((item) => (
            <FurnitureMesh3D
              key={item.id}
              item={item}
              report={collisionReports[item.id]}
              isSelected={
                selectedType === 'furniture' &&
                (selectedIds.includes(item.id) || selectedId === item.id)
              }
              onStartDrag={handleStartFurnitureDrag}
            />
          ))}
        </group>

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

        {/* Invisible XZ Drag Plane when dragging furniture or rotation gizmo in 3D */}
        {(draggingFurniture || draggingGizmo?.kind === 'rotate') && (
          <mesh
            userData={{ exportIgnore: true }}
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

        {/* 3D Interactive Transform Gizmos (Rotation Ring + Elevation Handle) */}
        {gizmoData && (
          <group name="furniture-transform-gizmo-3d" userData={{ exportIgnore: true }}>
            <mesh
              position={[gizmoData.pivot.x, 2.5, gizmoData.pivot.z]}
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
                setDraggingGizmo({
                  kind: 'rotate',
                  pivotX: gizmoData.pivot.x,
                  pivotZ: gizmoData.pivot.z,
                  startPointerAngleDeg: startAngleDeg,
                  singleItemId: gizmoData.single?.id ?? null,
                  startItemRotDeg: gizmoData.single?.rotationYDeg ?? 0,
                  lastAppliedDeltaDeg: 0,
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
                  gizmoData.single.elevationCm + gizmoData.single.heightCm + 18,
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

        {/* Variant Ghost-Diff 3D Overlay */}
        <GhostVariantOverlay3D />

        {/* Cinematic Archviz Post-Processing Pipeline */}
        <PostFX3D />
      </Canvas>
    </div>
  );
};
