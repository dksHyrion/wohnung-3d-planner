import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { openingIsWalkthrough } from '../../core/doorLeaf';
import {
  applyRoomLabels,
  computeFloorPolygons,
  getWallGeometry,
} from '../../core/wallMath';
import {
  DEFAULT_WALK_SPEED_CM_PER_SEC,
  stepFirstPersonWalk,
} from '../../core/walkAndSightlines';
import type { Corner, Wall, WallOpening } from '../../core/types';
import type { OrbitControlsLike } from './SceneControllers3D';

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
