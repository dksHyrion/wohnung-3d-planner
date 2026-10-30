import { evaluatePassageClearances } from '../core/ergonomicsEngine';
import { computeFurnitureAlignment } from '../core/alignmentMath';
import { PRESET_FLOORPLANS } from '../core/presets';
import type {
  AlignmentGuide,
  AreaRug,
  Corner,
  FurnitureItem,
  RoomLabel,
  Wall,
  WallOpening,
} from '../core/types';
import {
  applyRoomLabels,
  computeFloorPolygons,
  findWallSnap,
  getWallGeometry,
  pointInPolygon,
  setWallLengthCm,
  splitWallsAtCorner,
} from '../core/wallMath';
import type { StoreDeps } from './deps';
import type { FloorplanState } from './state';

type GeometryActions = Pick<
  FloorplanState,
  | 'setShowPassageHeatmap'
  | 'updateWallLengthCm'
  | 'updateWallProps'
  | 'addWallWithCorners'
  | 'removeWall'
  | 'moveCorner'
  | 'removeCorner'
  | 'updateRoom'
  | 'addOpening'
  | 'updateOpening'
  | 'removeOpening'
  | 'addFurniture'
  | 'updateFurniture'
  | 'moveFurniture'
  | 'removeFurniture'
  | 'toggleFurnitureRealStatus'
  | 'setFurnitureRealStatus'
  | 'resetFurnitureToCatalogDimensions'
  | 'addRug'
  | 'updateRug'
  | 'moveRug'
  | 'removeRug'
  | 'loadPreset'
>;

export function propagateAttachedChildren(
  beforeList: FurnitureItem[],
  afterList: FurnitureItem[],
  parentId: string
): FurnitureItem[] {
  let currentAfter = afterList;
  const queue = [parentId];
  const visited = new Set<string>([parentId]);

  while (queue.length > 0) {
    const currentParentId = queue.shift()!;
    const parentBefore = beforeList.find((f) => f.id === currentParentId);
    const parentAfter = currentAfter.find((f) => f.id === currentParentId);
    if (!parentBefore || !parentAfter) continue;

    const dx = parentAfter.x - parentBefore.x;
    const dz = parentAfter.z - parentBefore.z;
    const dRotDeg = parentAfter.rotationYDeg - parentBefore.rotationYDeg;
    const topBefore = parentBefore.elevationCm + parentBefore.heightCm;
    const topAfter = parentAfter.elevationCm + parentAfter.heightCm;
    const dTop = topAfter - topBefore;

    if (
      Math.abs(dx) < 1e-6 &&
      Math.abs(dz) < 1e-6 &&
      Math.abs(dRotDeg) < 1e-6 &&
      Math.abs(dTop) < 1e-6
    ) {
      continue;
    }

    const dRad = (dRotDeg * Math.PI) / 180;
    const cos = Math.cos(dRad);
    const sin = Math.sin(dRad);

    currentAfter = currentAfter.map((item) => {
      if (item.id === currentParentId || item.attachedToId !== currentParentId) {
        return item;
      }
      if (!visited.has(item.id)) {
        visited.add(item.id);
        queue.push(item.id);
      }
      const relX = item.x - parentBefore.x;
      const relZ = item.z - parentBefore.z;
      const rotRelX = relX * cos + relZ * sin;
      const rotRelZ = -relX * sin + relZ * cos;

      const newX = Number((parentAfter.x + rotRelX).toFixed(2));
      const newZ = Number((parentAfter.z + rotRelZ).toFixed(2));
      const newRot = Number(
        ((((item.rotationYDeg + dRotDeg) % 360) + 360) % 360).toFixed(1)
      );
      const newElevation = Math.max(
        0,
        Number((item.elevationCm + dTop).toFixed(2))
      );

      return {
        ...item,
        x: newX,
        z: newZ,
        rotationYDeg: newRot,
        elevationCm: newElevation,
      };
    });
  }

  return currentAfter;
}

export function createGeometryActions(deps: StoreDeps): GeometryActions {
  const { set, get, setWithCollisions, generateId, cloneFloorplanData } = deps;
  return {
  setShowPassageHeatmap: (show) => {
    const enabled = Boolean(show);
    const state = get();
    set({
      showPassageHeatmap: enabled,
      passageReport: enabled
        ? evaluatePassageClearances(state.furniture, state.walls, state.corners)
        : null,
    });
  },

  updateWallLengthCm: (wallId, lengthCm) => {
    const safeLength = Number.isFinite(lengthCm) ? Math.max(10, lengthCm) : 10;
    const state = get();
    const wall = state.walls.find((w) => w.id === wallId);
    if (!wall) return;

    const start = state.corners.find((c) => c.id === wall.startCornerId);
    const end = state.corners.find((c) => c.id === wall.endCornerId);
    if (!start || !end) return;

    const newEndPos = setWallLengthCm(start, end, safeLength);
    const updatedCorners = state.corners.map((c) =>
      c.id === end.id ? { ...c, x: newEndPos.x, z: newEndPos.z } : c
    );
    const cornerMap = new Map(updatedCorners.map((c) => [c.id, c]));

    // Find all affected walls that connect to end.id (as startCornerId or endCornerId)
    const affectedWalls = state.walls.filter(
      (w) => w.startCornerId === end.id || w.endCornerId === end.id
    );
    const affectedWallMap = new Map(affectedWalls.map((w) => [w.id, w]));

    // Clamp or filter openings on all affected walls
    const updatedOpenings = state.openings
      .map((op) => {
        if (!affectedWallMap.has(op.wallId)) {
          return op;
        }
        const affectedWall = affectedWallMap.get(op.wallId)!;
        const wStart = cornerMap.get(affectedWall.startCornerId);
        const wEnd = cornerMap.get(affectedWall.endCornerId);
        if (!wStart || !wEnd) return null;

        const geom = getWallGeometry(wStart, wEnd);
        const wallLength = geom.lengthCm;
        const sanitizedOffset = Math.max(0, op.offsetFromStartCm);
        const remaining = wallLength - sanitizedOffset;
        if (remaining < 1) {
          return null;
        }
        const widthCm = Math.min(op.widthCm, remaining);
        if (widthCm < 1) {
          return null;
        }
        return {
          ...op,
          offsetFromStartCm: sanitizedOffset,
          widthCm: Number(widthCm.toFixed(2)),
        };
      })
      .filter((op): op is WallOpening => op !== null);

    // Re-align any furniture item having snappedWallId matching an affected wall
    const movedCarrierIds: string[] = [];
    let updatedFurniture = state.furniture.map((item) => {
      if (!item.snappedWallId || !affectedWallMap.has(item.snappedWallId)) {
        return item;
      }
      const affectedWall = affectedWallMap.get(item.snappedWallId)!;
      const wStart = cornerMap.get(affectedWall.startCornerId);
      const wEnd = cornerMap.get(affectedWall.endCornerId);
      if (!wStart || !wEnd) return item;

      // Preserve wall face side from original wall geometry before the move
      const oldStart = state.corners.find((c) => c.id === affectedWall.startCornerId);
      const oldEnd = state.corners.find((c) => c.id === affectedWall.endCornerId);
      let side = 1;
      if (oldStart && oldEnd) {
        const oldGeom = getWallGeometry(oldStart, oldEnd);
        const oldRelX = item.x - oldStart.x;
        const oldRelZ = item.z - oldStart.z;
        side = (oldRelX * oldGeom.normal.x + oldRelZ * oldGeom.normal.z) >= 0 ? 1 : -1;
      }

      // Direct projection and clamping along the updated wall line
      const geom = getWallGeometry(wStart, wEnd);
      const relX = item.x - wStart.x;
      const relZ = item.z - wStart.z;
      const alongWall = relX * geom.tangent.x + relZ * geom.tangent.z;
      const halfW = item.widthCm / 2;
      const clampedAlong =
        geom.lengthCm >= item.widthCm
          ? Math.max(halfW, Math.min(geom.lengthCm - halfW, alongWall))
          : geom.lengthCm / 2;

      const targetCenterOffset = affectedWall.thicknessCm / 2 + item.depthCm / 2;
      const newX = Number(
        (wStart.x + geom.tangent.x * clampedAlong + geom.normal.x * side * targetCenterOffset).toFixed(2)
      );
      const newZ = Number(
        (wStart.z + geom.tangent.z * clampedAlong + geom.normal.z * side * targetCenterOffset).toFixed(2)
      );
      const wallDeg = (-geom.angleRad * 180) / Math.PI;
      const rawRot = side >= 0 ? wallDeg : wallDeg + 180;
      const rotationYDeg = Number((((rawRot % 360) + 360) % 360).toFixed(1));

      movedCarrierIds.push(item.id);
      return {
        ...item,
        x: newX,
        z: newZ,
        rotationYDeg,
      };
    });

    for (const carrierId of movedCarrierIds) {
      updatedFurniture = propagateAttachedChildren(
        state.furniture,
        updatedFurniture,
        carrierId
      );
    }

    const updatedOpeningIds = new Set(updatedOpenings.map((o) => o.id));
    const isSelectedOpeningDiscarded =
      state.selectedType === 'opening' &&
      state.selectedId !== null &&
      !updatedOpeningIds.has(state.selectedId);

    setWithCollisions({
      corners: updatedCorners,
      openings: updatedOpenings,
      furniture: updatedFurniture,
      ...(isSelectedOpeningDiscarded ? { selectedId: null, selectedType: null } : {}),
    });
  },

  updateWallProps: (wallId, patch) => {
    const state = get();
    const walls = state.walls.map((w) => {
      if (w.id !== wallId) return w;
      return {
        ...w,
        thicknessCm:
          patch.thicknessCm !== undefined
            ? Math.max(5, patch.thicknessCm)
            : w.thicknessCm,
        heightCm:
          patch.heightCm !== undefined
            ? Math.max(50, patch.heightCm)
            : w.heightCm,
      };
    });

    setWithCollisions({ walls });
  },

  addWallWithCorners: (start, end) => {
    const state = get();
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const dist = Math.hypot(dx, dz);

    const normalizedEnd =
      dist < 10
        ? {
            x: Number((start.x + (dist > 1e-6 ? (dx / dist) * 10 : 10)).toFixed(2)),
            z: Number((start.z + (dist > 1e-6 ? (dz / dist) * 10 : 0)).toFixed(2)),
          }
        : {
            x: Number(end.x.toFixed(2)),
            z: Number(end.z.toFixed(2)),
          };

    const normalizedStart = {
      x: Number(start.x.toFixed(2)),
      z: Number(start.z.toFixed(2)),
    };

    const existingStart = state.corners.find(
      (c) =>
        Math.hypot(c.x - normalizedStart.x, c.z - normalizedStart.z) < 0.1
    );
    const startCorner: Corner = existingStart ?? {
      id: generateId('c'),
      x: normalizedStart.x,
      z: normalizedStart.z,
    };

    const existingEnd = state.corners.find(
      (c) =>
        c.id !== startCorner.id &&
        Math.hypot(c.x - normalizedEnd.x, c.z - normalizedEnd.z) < 0.1
    );
    const endCorner: Corner = existingEnd ?? {
      id: generateId('c'),
      x: normalizedEnd.x,
      z: normalizedEnd.z,
    };

    const corners = [...state.corners];
    if (!existingStart) corners.push(startCorner);
    if (!existingEnd) corners.push(endCorner);

    // Split existing walls at startCorner or endCorner if landing mid-span (T-junction)
    let walls = [...state.walls];
    let openings = [...state.openings];

    const splitStart = splitWallsAtCorner(corners, walls, openings, startCorner);
    walls = splitStart.walls;
    openings = splitStart.openings;

    const splitEnd = splitWallsAtCorner(corners, walls, openings, endCorner);
    walls = splitEnd.walls;
    openings = splitEnd.openings;

    const newWall: Wall = {
      id: generateId('w'),
      startCornerId: startCorner.id,
      endCornerId: endCorner.id,
      thicknessCm: 15,
      heightCm: 250,
    };

    walls.push(newWall);
    setWithCollisions({
      corners,
      walls,
      openings,
      selectedId: newWall.id,
      selectedType: 'wall',
    });

    return newWall.id;
  },

  moveCorner: (cornerId, x, z, options) => {
    const recordHistory = options?.recordHistory ?? true;
    const state = get();
    const candidatePos = {
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
    };

    // Ensure no connected wall becomes shorter than 10 cm
    for (const wall of state.walls) {
      if (wall.startCornerId === cornerId || wall.endCornerId === cornerId) {
        const otherId =
          wall.startCornerId === cornerId ? wall.endCornerId : wall.startCornerId;
        const otherCorner = state.corners.find((c) => c.id === otherId);
        if (otherCorner) {
          const geom = getWallGeometry(
            { id: cornerId, x: candidatePos.x, z: candidatePos.z },
            otherCorner
          );
          if (geom.lengthCm < 10) {
            return;
          }
        }
      }
    }

    const corners = state.corners.map((c) =>
      c.id === cornerId ? { ...c, x: candidatePos.x, z: candidatePos.z } : c
    );

    setWithCollisions({ corners }, recordHistory);
  },

  removeWall: (wallId) => {
    const state = get();
    const wallExists = state.walls.some((w) => w.id === wallId);
    if (!wallExists) return;

    const walls = state.walls.filter((w) => w.id !== wallId);
    const openings = state.openings.filter((o) => o.wallId !== wallId);
    const usedCornerIds = new Set<string>();
    for (const w of walls) {
      usedCornerIds.add(w.startCornerId);
      usedCornerIds.add(w.endCornerId);
    }
    const corners = state.corners.filter((c) => usedCornerIds.has(c.id));
    const furniture = state.furniture.map((f) =>
      f.snappedWallId === wallId ? { ...f, snappedWallId: null } : f
    );

    const shouldClearSelection =
      state.selectedId === wallId ||
      (state.selectedType === 'opening' &&
        state.selectedId !== null &&
        !openings.some((o) => o.id === state.selectedId)) ||
      (state.selectedType === 'corner' &&
        state.selectedId !== null &&
        !corners.some((c) => c.id === state.selectedId));

    setWithCollisions({
      corners,
      walls,
      openings,
      furniture,
      ...(shouldClearSelection
        ? { selectedId: null, selectedType: null, selectedRoomId: null }
        : {}),
    });
  },

  removeCorner: (cornerId) => {
    const state = get();
    const cornerExists = state.corners.some((c) => c.id === cornerId);
    if (!cornerExists) return;

    const connectedWalls = state.walls.filter(
      (w) => w.startCornerId === cornerId || w.endCornerId === cornerId
    );

    let walls: Wall[];
    let openings: WallOpening[];
    let removedWallIds: Set<string>;

    if (connectedWalls.length === 2) {
      const [w1, w2] = connectedWalls;
      const n1 = w1.startCornerId === cornerId ? w1.endCornerId : w1.startCornerId;
      const n2 = w2.startCornerId === cornerId ? w2.endCornerId : w2.startCornerId;
      const directWallExists = state.walls.some(
        (w) =>
          w.id !== w1.id &&
          w.id !== w2.id &&
          ((w.startCornerId === n1 && w.endCornerId === n2) ||
            (w.startCornerId === n2 && w.endCornerId === n1))
      );

      if (n1 !== n2 && !directWallExists) {
        const mergedWall: Wall = {
          ...w1,
          startCornerId: n1,
          endCornerId: n2,
        };
        walls = state.walls
          .filter((w) => w.id !== w2.id)
          .map((w) => (w.id === w1.id ? mergedWall : w));
        removedWallIds = new Set([w1.id, w2.id]);
        openings = state.openings.filter((o) => !removedWallIds.has(o.wallId));
      } else {
        removedWallIds = new Set([w1.id, w2.id]);
        walls = state.walls.filter((w) => !removedWallIds.has(w.id));
        openings = state.openings.filter((o) => !removedWallIds.has(o.wallId));
      }
    } else {
      removedWallIds = new Set(connectedWalls.map((w) => w.id));
      walls = state.walls.filter((w) => !removedWallIds.has(w.id));
      openings = state.openings.filter((o) => !removedWallIds.has(o.wallId));
    }

    const usedCornerIds = new Set<string>();
    for (const w of walls) {
      usedCornerIds.add(w.startCornerId);
      usedCornerIds.add(w.endCornerId);
    }
    const corners = state.corners.filter(
      (c) => c.id !== cornerId && usedCornerIds.has(c.id)
    );
    const furniture = state.furniture.map((f) =>
      f.snappedWallId && removedWallIds.has(f.snappedWallId)
        ? { ...f, snappedWallId: null }
        : f
    );

    const shouldClearSelection =
      state.selectedId === cornerId ||
      (state.selectedType === 'wall' &&
        state.selectedId !== null &&
        removedWallIds.has(state.selectedId)) ||
      (state.selectedType === 'opening' &&
        state.selectedId !== null &&
        !openings.some((o) => o.id === state.selectedId));

    setWithCollisions({
      corners,
      walls,
      openings,
      furniture,
      ...(shouldClearSelection
        ? { selectedId: null, selectedType: null, selectedRoomId: null }
        : {}),
    });
  },

  updateRoom: (roomId, patch) => {
    const state = get();
    const rawRooms = applyRoomLabels(
      computeFloorPolygons(state.corners, state.walls),
      state.roomLabels
    );
    const targetRoom = rawRooms.find((r) => r.id === roomId);
    if (!targetRoom) return;

    const existingIdx = state.roomLabels.findIndex((entry) =>
      pointInPolygon(entry.x, entry.z, targetRoom.corners)
    );

    let nextRoomLabels: RoomLabel[];
    if (existingIdx >= 0) {
      nextRoomLabels = state.roomLabels.map((entry, idx) => {
        if (idx !== existingIdx) return entry;
        return {
          ...entry,
          name:
            patch.name !== undefined && patch.name.trim().length > 0
              ? patch.name
              : entry.name,
          flooringType:
            patch.flooringType !== undefined
              ? patch.flooringType
              : entry.flooringType,
        };
      });
    } else {
      let anchorX = targetRoom.centroid.x;
      let anchorZ = targetRoom.centroid.z;
      if (!pointInPolygon(anchorX, anchorZ, targetRoom.corners)) {
        const n = targetRoom.corners.length;
        for (let i = 0; i < n; i++) {
          const a = targetRoom.corners[i];
          const b = targetRoom.corners[(i + 1) % n];
          const c = targetRoom.corners[(i + 2) % n];
          const mx = Number(((a.x + b.x + c.x) / 3).toFixed(1));
          const mz = Number(((a.z + b.z + c.z) / 3).toFixed(1));
          if (pointInPolygon(mx, mz, targetRoom.corners)) {
            anchorX = mx;
            anchorZ = mz;
            break;
          }
        }
      }
      const roomNumber = roomId.replace('room-', '');
      const fallbackName = targetRoom.name ?? `Raum ${roomNumber}`;
      nextRoomLabels = [
        ...state.roomLabels,
        {
          name:
            patch.name !== undefined && patch.name.trim().length > 0
              ? patch.name
              : fallbackName,
          x: anchorX,
          z: anchorZ,
          flooringType: patch.flooringType ?? targetRoom.flooringType,
        },
      ];
    }

    setWithCollisions({ roomLabels: nextRoomLabels });
  },

  addOpening: (opening) => {
    const state = get();
    const wall = state.walls.find((w) => w.id === opening.wallId);
    const sanitizedOffset = Math.max(0, opening.offsetFromStartCm);
    let offsetFromStartCm = sanitizedOffset;
    let widthCm = Math.max(1, opening.widthCm);

    if (wall) {
      const start = state.corners.find((c) => c.id === wall.startCornerId);
      const end = state.corners.find((c) => c.id === wall.endCornerId);
      if (start && end) {
        const geom = getWallGeometry(start, end);
        if (geom.lengthCm < 1 || geom.lengthCm - sanitizedOffset < 1) {
          return '';
        }
        offsetFromStartCm = Math.max(
          0,
          Math.min(geom.lengthCm - 1, sanitizedOffset)
        );
        widthCm = Math.min(geom.lengthCm - offsetFromStartCm, widthCm);
        if (widthCm < 1) {
          return '';
        }
      }
    }

    const newOpening: WallOpening = {
      ...opening,
      id: generateId('op'),
      widthCm,
      heightCm: Math.max(1, opening.heightCm),
      offsetFromStartCm,
      sillHeightCm: Math.max(0, opening.sillHeightCm),
    };

    const openings = [...state.openings, newOpening];
    setWithCollisions({
      openings,
      selectedId: newOpening.id,
      selectedType: 'opening',
    });

    return newOpening.id;
  },

  updateOpening: (openingId, patch) => {
    const state = get();
    const existing = state.openings.find((o) => o.id === openingId);
    if (!existing) return;

    const wallId = patch.wallId ?? existing.wallId;
    const wall = state.walls.find((w) => w.id === wallId);
    const start = wall
      ? state.corners.find((c) => c.id === wall.startCornerId)
      : null;
    const end = wall
      ? state.corners.find((c) => c.id === wall.endCornerId)
      : null;

    let offsetFromStartCm =
      patch.offsetFromStartCm !== undefined
        ? Math.max(0, patch.offsetFromStartCm)
        : existing.offsetFromStartCm;
    let widthCm =
      patch.widthCm !== undefined
        ? Math.max(1, patch.widthCm)
        : existing.widthCm;

    if (wall && start && end) {
      const geom = getWallGeometry(start, end);
      const rawOffset =
        patch.offsetFromStartCm !== undefined
          ? patch.offsetFromStartCm
          : existing.offsetFromStartCm;
      if (geom.lengthCm >= 1) {
        offsetFromStartCm = Math.max(
          0,
          Math.min(geom.lengthCm - 1, Math.max(0, rawOffset))
        );
        widthCm = Math.max(
          1,
          Math.min(geom.lengthCm - offsetFromStartCm, widthCm)
        );
      }
    }

    const openings = state.openings.map((o) => {
      if (o.id !== openingId) return o;
      return {
        ...o,
        ...patch,
        widthCm,
        heightCm:
          patch.heightCm !== undefined
            ? Math.max(1, patch.heightCm)
            : o.heightCm,
        offsetFromStartCm,
        sillHeightCm:
          patch.sillHeightCm !== undefined
            ? Math.max(0, patch.sillHeightCm)
            : o.sillHeightCm,
      };
    });

    setWithCollisions({ openings });
  },

  removeOpening: (openingId) => {
    const state = get();
    const openings = state.openings.filter((o) => o.id !== openingId);
    setWithCollisions({
      openings,
      selectedId: state.selectedId === openingId ? null : state.selectedId,
      selectedType: state.selectedId === openingId ? null : state.selectedType,
    });
  },

  addFurniture: (item) => {
    const state = get();
    const newFurniture: FurnitureItem = {
      ...item,
      id: generateId('f'),
      widthCm: Math.max(1, item.widthCm),
      heightCm: Math.max(1, item.heightCm),
      depthCm: Math.max(1, item.depthCm),
      elevationCm: Math.max(0, item.elevationCm),
      isRealFurniture: item.isRealFurniture ?? false,
      brand: item.brand,
      modelName: item.modelName,
      articleNumber: item.articleNumber,
      notes: item.notes,
      visual: item.visual,
      catalogWidthCm: item.catalogWidthCm,
      catalogHeightCm: item.catalogHeightCm,
      catalogDepthCm: item.catalogDepthCm,
      clearanceZoneCm: item.clearanceZoneCm,
      hasNightstands: item.hasNightstands,
      attachedToId: item.attachedToId,
    };

    const furniture = [...state.furniture, newFurniture];
    setWithCollisions({
      furniture,
      selectedId: newFurniture.id,
      selectedType: 'furniture',
    });

    return newFurniture.id;
  },

  updateFurniture: (furnitureId, patch) => {
    const state = get();
    const updatedList = state.furniture.map((f) => {
      if (f.id !== furnitureId) return f;
      let nextElevation =
        patch.elevationCm !== undefined
          ? Math.max(0, patch.elevationCm)
          : f.elevationCm;

      if (
        patch.attachedToId !== undefined &&
        patch.attachedToId !== null &&
        patch.attachedToId !== f.attachedToId &&
        patch.elevationCm === undefined
      ) {
        const parent = state.furniture.find((p) => p.id === patch.attachedToId);
        if (parent) {
          nextElevation = Number((parent.elevationCm + parent.heightCm).toFixed(2));
        }
      }

      const updated: FurnitureItem = {
        ...f,
        ...patch,
        widthCm:
          patch.widthCm !== undefined ? Math.max(1, patch.widthCm) : f.widthCm,
        heightCm:
          patch.heightCm !== undefined
            ? Math.max(1, patch.heightCm)
            : f.heightCm,
        depthCm:
          patch.depthCm !== undefined ? Math.max(1, patch.depthCm) : f.depthCm,
        elevationCm: nextElevation,
      };

      if (
        (patch.x !== undefined ||
          patch.z !== undefined ||
          patch.rotationYDeg !== undefined) &&
        patch.snappedWallId === undefined
      ) {
        if (
          patch.rotationYDeg === undefined &&
          state.snapToWallEnabled &&
          !updated.attachedToId
        ) {
          const snap = findWallSnap(updated, state.corners, state.walls);
          updated.snappedWallId = snap ? snap.snappedWallId : null;
        } else {
          updated.snappedWallId = null;
        }
      }

      return updated;
    });

    const furniture = propagateAttachedChildren(
      state.furniture,
      updatedList,
      furnitureId
    );

    setWithCollisions({ furniture });
  },

  moveFurniture: (furnitureId, x, z, options) => {
    const recordHistory = options?.recordHistory ?? true;
    const state = get();
    let nextGuides: AlignmentGuide[] = [];
    const movedList = state.furniture.map((f) => {
      if (f.id !== furnitureId) return f;
      const candidate: FurnitureItem = {
        ...f,
        x: Number(x.toFixed(2)),
        z: Number(z.toFixed(2)),
      };

      if (state.snapToWallEnabled && !f.attachedToId) {
        const snap = findWallSnap(candidate, state.corners, state.walls);
        const wallSnapped: FurnitureItem = snap
          ? {
              ...candidate,
              x: snap.x,
              z: snap.z,
              rotationYDeg: snap.rotationYDeg,
              snappedWallId: snap.snappedWallId,
            }
          : {
              ...candidate,
              snappedWallId: null,
            };

        const align = computeFurnitureAlignment(
          wallSnapped,
          state.furniture,
          state.corners,
          state.walls
        );
        nextGuides = align.guides;
        return {
          ...wallSnapped,
          x: align.x,
          z: align.z,
        };
      }

      return {
        ...candidate,
        snappedWallId: null,
      };
    });

    const furniture = propagateAttachedChildren(
      state.furniture,
      movedList,
      furnitureId
    );

    setWithCollisions(
      { furniture, activeAlignmentGuides: nextGuides },
      recordHistory
    );
  },

  removeFurniture: (furnitureId) => {
    const state = get();
    const furniture = state.furniture
      .filter((f) => f.id !== furnitureId)
      .map((f) =>
        f.attachedToId === furnitureId ? { ...f, attachedToId: null } : f
      );
    setWithCollisions({
      furniture,
      selectedId: state.selectedId === furnitureId ? null : state.selectedId,
      selectedType: state.selectedId === furnitureId ? null : state.selectedType,
    });
  },

  toggleFurnitureRealStatus: (id) => {
    const state = get();
    const target = state.furniture.find((f) => f.id === id);
    if (!target) return;
    const isReal = !target.isRealFurniture;
    const furniture = state.furniture.map((f) => {
      if (f.id !== id) return f;
      return {
        ...f,
        isRealFurniture: isReal,
      };
    });
    set({ furniture });
  },

  setFurnitureRealStatus: (id, isReal, brand, modelName) => {
    const state = get();
    const target = state.furniture.find((f) => f.id === id);
    if (!target) return;
    const furniture = state.furniture.map((f) => {
      if (f.id !== id) return f;
      return {
        ...f,
        isRealFurniture: isReal,
        brand: brand !== undefined ? brand : f.brand,
        modelName: modelName !== undefined ? modelName : f.modelName,
      };
    });
    set({ furniture });
  },

  resetFurnitureToCatalogDimensions: (furnitureId: string) => {
    const state = get();
    const target = state.furniture.find((f) => f.id === furnitureId);
    if (!target) return;
    if (
      target.catalogWidthCm === undefined &&
      target.catalogHeightCm === undefined &&
      target.catalogDepthCm === undefined
    ) {
      return;
    }
    const furniture = state.furniture.map((f) => {
      if (f.id !== furnitureId) return f;
      return {
        ...f,
        widthCm:
          f.catalogWidthCm !== undefined
            ? Math.max(1, f.catalogWidthCm)
            : f.widthCm,
        heightCm:
          f.catalogHeightCm !== undefined
            ? Math.max(1, f.catalogHeightCm)
            : f.heightCm,
        depthCm:
          f.catalogDepthCm !== undefined
            ? Math.max(1, f.catalogDepthCm)
            : f.depthCm,
      };
    });
    setWithCollisions({ furniture });
  },

  addRug: (rug) => {
    const state = get();
    const newRug: AreaRug = {
      id: generateId('rug'),
      name: rug.name?.trim() || 'Teppich',
      widthCm: Math.max(20, Number.isFinite(rug.widthCm) ? rug.widthCm : 200),
      depthCm: Math.max(20, Number.isFinite(rug.depthCm) ? rug.depthCm : 160),
      x: Number((Number.isFinite(rug.x) ? rug.x : 200).toFixed(2)),
      z: Number((Number.isFinite(rug.z) ? rug.z : 200).toFixed(2)),
      rotationYDeg: Number(
        ((((Number.isFinite(rug.rotationYDeg) ? rug.rotationYDeg! : 0) % 360) + 360) %
          360).toFixed(1)
      ),
      color: rug.color ?? '#edece8',
    };
    const rugs = [...state.rugs, newRug];
    setWithCollisions({
      rugs,
      selectedId: newRug.id,
      selectedType: 'rug',
    });
    return newRug.id;
  },

  updateRug: (rugId, patch) => {
    const state = get();
    const existing = state.rugs.find((r) => r.id === rugId);
    if (!existing) return;
    const rugs = state.rugs.map((r) => {
      if (r.id !== rugId) return r;
      return {
        ...r,
        ...patch,
        name:
          patch.name !== undefined
            ? patch.name.trim() || 'Teppich'
            : r.name,
        widthCm:
          patch.widthCm !== undefined && Number.isFinite(patch.widthCm)
            ? Math.max(20, patch.widthCm)
            : r.widthCm,
        depthCm:
          patch.depthCm !== undefined && Number.isFinite(patch.depthCm)
            ? Math.max(20, patch.depthCm)
            : r.depthCm,
        x:
          patch.x !== undefined && Number.isFinite(patch.x)
            ? Number(patch.x.toFixed(2))
            : r.x,
        z:
          patch.z !== undefined && Number.isFinite(patch.z)
            ? Number(patch.z.toFixed(2))
            : r.z,
        rotationYDeg:
          patch.rotationYDeg !== undefined && Number.isFinite(patch.rotationYDeg)
            ? Number((((patch.rotationYDeg % 360) + 360) % 360).toFixed(1))
            : r.rotationYDeg,
      };
    });
    setWithCollisions({ rugs });
  },

  moveRug: (rugId, x, z, options) => {
    const recordHistory = options?.recordHistory ?? true;
    const state = get();
    if (!state.rugs.some((r) => r.id === rugId)) return;
    const rugs = state.rugs.map((r) =>
      r.id === rugId
        ? {
            ...r,
            x: Number(x.toFixed(2)),
            z: Number(z.toFixed(2)),
          }
        : r
    );
    setWithCollisions({ rugs }, recordHistory);
  },

  removeRug: (rugId) => {
    const state = get();
    if (!state.rugs.some((r) => r.id === rugId)) return;
    const rugs = state.rugs.filter((r) => r.id !== rugId);
    setWithCollisions({
      rugs,
      selectedId: state.selectedId === rugId ? null : state.selectedId,
      selectedType: state.selectedId === rugId ? null : state.selectedType,
    });
  },

  loadPreset: (presetKey) => {
    const preset = PRESET_FLOORPLANS[presetKey];
    if (!preset) return;
    const cloned = cloneFloorplanData(preset.data);
    setWithCollisions({
      corners: cloned.corners,
      walls: cloned.walls,
      openings: cloned.openings,
      furniture: cloned.furniture,
      rugs: cloned.rugs ?? [],
      roomLabels: cloned.roomLabels ?? [],
      backgroundImage: cloned.backgroundImage ?? null,
      activeAlignmentGuides: [],
      selectedId: null,
      selectedType: null,
    });
  },
  };
}
