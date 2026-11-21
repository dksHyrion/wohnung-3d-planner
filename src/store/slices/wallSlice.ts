import type {
  Corner,
  FurnitureItem,
  Wall,
  WallOpening,
} from '../../core/types';
import {
  getWallGeometry,
  setWallLengthCm,
  splitCrossingWalls,
  splitWallsAtCorner,
} from '../../core/wallMath';
import { getEntityLevelId } from '../../core/levels';
import type { StoreDeps } from '../deps';
import { propagateAttachedChildren } from './furnitureSlice';
import type { FloorplanState } from '../state';
import { createWallDetailsSlice } from './wallDetailsSlice';

export type WallActions = Pick<
  FloorplanState,
  | 'updateWallLengthCm'
  | 'updateWallProps'
  | 'addWallWithCorners'
  | 'splitWallAt'
  | 'removeWall'
  | 'moveCorner'
  | 'removeCorner'
  | 'updateRoom'
  | 'addOpening'
  | 'updateOpening'
  | 'removeOpening'
  | 'addRoofSlope'
  | 'updateRoofSlope'
  | 'removeRoofSlope'
  | 'addFixture'
  | 'updateFixture'
  | 'removeFixture'
>;

export function createWallSlice(deps: StoreDeps): WallActions {
  const { get, setWithCollisions, generateId } = deps;

  const realignSnappedFurnitureOnWalls = (
    oldCorners: Corner[],
    newCorners: Corner[],
    newWalls: Wall[],
    oldFurniture: FurnitureItem[],
    affectedWallIds: Set<string>
  ): FurnitureItem[] => {
    const oldCornerMap = new Map(oldCorners.map((c) => [c.id, c]));
    const newCornerMap = new Map(newCorners.map((c) => [c.id, c]));
    const newWallMap = new Map(newWalls.map((w) => [w.id, w]));

    const movedCarrierIds: string[] = [];
    let updatedFurniture = oldFurniture.map((item) => {
      if (!item.snappedWallId || !affectedWallIds.has(item.snappedWallId)) {
        return item;
      }
      const affectedWall = newWallMap.get(item.snappedWallId);
      if (!affectedWall) return item;
      const wStart = newCornerMap.get(affectedWall.startCornerId);
      const wEnd = newCornerMap.get(affectedWall.endCornerId);
      if (!wStart || !wEnd) return item;

      const oldStart = oldCornerMap.get(affectedWall.startCornerId);
      const oldEnd = oldCornerMap.get(affectedWall.endCornerId);
      let side = 1;
      if (oldStart && oldEnd) {
        const oldGeom = getWallGeometry(oldStart, oldEnd);
        const oldRelX = item.x - oldStart.x;
        const oldRelZ = item.z - oldStart.z;
        side = oldRelX * oldGeom.normal.x + oldRelZ * oldGeom.normal.z >= 0 ? 1 : -1;
      }

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
        oldFurniture,
        updatedFurniture,
        carrierId
      );
    }

    return updatedFurniture;
  };

  return {
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
      const affectedWallIds = new Set(affectedWalls.map((w) => w.id));
      const updatedFurniture = realignSnappedFurnitureOnWalls(
        state.corners,
        updatedCorners,
        state.walls,
        state.furniture,
        affectedWallIds
      );

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

    updateWallProps: (wallId, patch, options) => {
      const recordHistory = options?.recordHistory ?? true;
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
          posFinish:
            patch.posFinish !== undefined
              ? patch.posFinish.finish === 'plaster' && !patch.posFinish.color
                ? undefined
                : patch.posFinish
              : w.posFinish,
          negFinish:
            patch.negFinish !== undefined
              ? patch.negFinish.finish === 'plaster' && !patch.negFinish.color
                ? undefined
                : patch.negFinish
              : w.negFinish,
        };
      });

      const furniture =
        patch.thicknessCm !== undefined
          ? realignSnappedFurnitureOnWalls(
              state.corners,
              state.corners,
              walls,
              state.furniture,
              new Set([wallId])
            )
          : state.furniture;

      setWithCollisions({ walls, furniture }, recordHistory);
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

      const activeLevelId = state.activeLevelId;
      const levelCorners = state.corners.filter(
        (c) => getEntityLevelId(c) === activeLevelId
      );
      const otherCorners = state.corners.filter(
        (c) => getEntityLevelId(c) !== activeLevelId
      );
      const levelWalls = state.walls.filter(
        (w) => getEntityLevelId(w) === activeLevelId
      );
      const otherWalls = state.walls.filter(
        (w) => getEntityLevelId(w) !== activeLevelId
      );
      const levelOpenings = state.openings.filter(
        (o) => getEntityLevelId(o) === activeLevelId
      );
      const otherOpenings = state.openings.filter(
        (o) => getEntityLevelId(o) !== activeLevelId
      );

      const existingStart = levelCorners.find(
        (c) =>
          Math.hypot(c.x - normalizedStart.x, c.z - normalizedStart.z) < 0.1
      );
      const startCorner: Corner = existingStart ?? {
        id: generateId('c'),
        x: normalizedStart.x,
        z: normalizedStart.z,
        levelId: activeLevelId,
      };

      const existingEnd = levelCorners.find(
        (c) =>
          c.id !== startCorner.id &&
          Math.hypot(c.x - normalizedEnd.x, c.z - normalizedEnd.z) < 0.1
      );
      const endCorner: Corner = existingEnd ?? {
        id: generateId('c'),
        x: normalizedEnd.x,
        z: normalizedEnd.z,
        levelId: activeLevelId,
      };

      let corners = [...levelCorners];
      if (!existingStart) corners.push(startCorner);
      if (!existingEnd) corners.push(endCorner);

      // Split existing walls at startCorner or endCorner if landing mid-span (T-junction)
      let walls = [...levelWalls];
      let openings = [...levelOpenings];

      const splitStart = splitWallsAtCorner(corners, walls, openings, startCorner, generateId);
      corners = splitStart.corners;
      walls = splitStart.walls;
      openings = splitStart.openings;

      const splitEnd = splitWallsAtCorner(corners, walls, openings, endCorner, generateId);
      corners = splitEnd.corners;
      walls = splitEnd.walls;
      openings = splitEnd.openings;

      const newWall: Wall = {
        id: generateId('w'),
        startCornerId: startCorner.id,
        endCornerId: endCorner.id,
        thicknessCm: 15,
        heightCm: 250,
        levelId: activeLevelId,
      };

      // Split X-crossing walls mid-span so planar room face extraction stays intact
      const crossing = splitCrossingWalls(corners, walls, openings, newWall, generateId);
      corners = [...otherCorners, ...crossing.corners];
      walls = [...otherWalls, ...crossing.walls];
      openings = [...otherOpenings, ...crossing.openings];
      const primaryWallId = crossing.createdWallIds[0] ?? newWall.id;

      setWithCollisions({
        corners,
        walls,
        openings,
        selectedId: primaryWallId,
        selectedType: 'wall',
      });

      return primaryWallId;
    },

    splitWallAt: (wallId, point) => {
      const state = get();
      const wall = state.walls.find((w) => w.id === wallId);
      if (!wall) return null;

      const start = state.corners.find((c) => c.id === wall.startCornerId);
      const end = state.corners.find((c) => c.id === wall.endCornerId);
      if (!start || !end) return null;

      const geom = getWallGeometry(start, end);
      if (geom.lengthCm < 20) return null;

      let t = geom.lengthCm / 2;
      if (point && Number.isFinite(point.x) && Number.isFinite(point.z)) {
        const relX = point.x - start.x;
        const relZ = point.z - start.z;
        const proj = relX * geom.tangent.x + relZ * geom.tangent.z;
        t = Math.max(10, Math.min(geom.lengthCm - 10, proj));
      }

      const wallLevelId = getEntityLevelId(wall);
      const splitCorner: Corner = {
        id: generateId('c'),
        x: Number((start.x + geom.tangent.x * t).toFixed(2)),
        z: Number((start.z + geom.tangent.z * t).toFixed(2)),
        levelId: wallLevelId,
      };

      const levelCorners = state.corners.filter(
        (c) => getEntityLevelId(c) === wallLevelId
      );
      const otherCorners = state.corners.filter(
        (c) => getEntityLevelId(c) !== wallLevelId
      );
      const levelWalls = state.walls.filter(
        (w) => getEntityLevelId(w) === wallLevelId
      );
      const otherWalls = state.walls.filter(
        (w) => getEntityLevelId(w) !== wallLevelId
      );
      const levelOpenings = state.openings.filter(
        (o) => getEntityLevelId(o) === wallLevelId
      );
      const otherOpenings = state.openings.filter(
        (o) => getEntityLevelId(o) !== wallLevelId
      );

      const splitResult = splitWallsAtCorner(
        [...levelCorners, splitCorner],
        levelWalls,
        levelOpenings,
        splitCorner,
        generateId
      );
      if (!splitResult.didSplit) return null;

      setWithCollisions({
        corners: [...otherCorners, ...splitResult.corners],
        walls: [...otherWalls, ...splitResult.walls],
        openings: [...otherOpenings, ...splitResult.openings],
        selectedId: splitCorner.id,
        selectedType: 'corner',
      });

      return splitCorner.id;
    },

    moveCorner: (cornerId, x, z, options) => {
      const recordHistory = options?.recordHistory ?? true;
      const state = get();
      const candidatePos = {
        x: Number(x.toFixed(2)),
        z: Number(z.toFixed(2)),
      };

      const affectedWallIds = new Set<string>();
      const wallLengths = new Map<string, number>();

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
            affectedWallIds.add(wall.id);
            wallLengths.set(wall.id, geom.lengthCm);
          }
        }
      }

      const corners = state.corners.map((c) =>
        c.id === cornerId ? { ...c, x: candidatePos.x, z: candidatePos.z } : c
      );

      const openings =
        affectedWallIds.size > 0
          ? state.openings.map((op) => {
              const len = wallLengths.get(op.wallId);
              if (len === undefined) return op;
              const widthCm = Math.min(op.widthCm, Math.max(10, len - 2));
              const maxOffset = Math.max(0, len - widthCm);
              const offsetFromStartCm = Math.max(
                0,
                Math.min(maxOffset, op.offsetFromStartCm)
              );
              if (
                widthCm === op.widthCm &&
                offsetFromStartCm === op.offsetFromStartCm
              ) {
                return op;
              }
              return { ...op, widthCm, offsetFromStartCm };
            })
          : state.openings;

      const fixtures =
        affectedWallIds.size > 0
          ? state.fixtures.map((fx) => {
              const len = wallLengths.get(fx.wallId);
              if (len === undefined) return fx;
              const halfW = fx.widthCm / 2;
              const offsetFromStartCm = Math.max(
                halfW,
                Math.min(Math.max(halfW, len - halfW), fx.offsetFromStartCm)
              );
              return offsetFromStartCm === fx.offsetFromStartCm
                ? fx
                : { ...fx, offsetFromStartCm };
            })
          : state.fixtures;

      const furniture =
        affectedWallIds.size > 0
          ? realignSnappedFurnitureOnWalls(
              state.corners,
              corners,
              state.walls,
              state.furniture,
              affectedWallIds
            )
          : state.furniture;

      setWithCollisions({ corners, openings, fixtures, furniture }, recordHistory);
    },

    removeWall: (wallId) => {
      const state = get();
      const wallExists = state.walls.some((w) => w.id === wallId);
      if (!wallExists) return;

      const walls = state.walls.filter((w) => w.id !== wallId);
      const openings = state.openings.filter((o) => o.wallId !== wallId);
      const roofSlopes = state.roofSlopes.filter((s) => s.wallId !== wallId);
      const fixtures = state.fixtures.filter((fx) => fx.wallId !== wallId);
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
        (state.selectedType === 'fixture' &&
          state.selectedId !== null &&
          !fixtures.some((fx) => fx.id === state.selectedId)) ||
        (state.selectedType === 'corner' &&
          state.selectedId !== null &&
          !corners.some((c) => c.id === state.selectedId));

      setWithCollisions({
        corners,
        walls,
        openings,
        roofSlopes,
        fixtures,
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
      const roofSlopes = state.roofSlopes.filter((rs) => !removedWallIds.has(rs.wallId));
      const fixtures = state.fixtures.filter((fx) => !removedWallIds.has(fx.wallId));
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
          !openings.some((o) => o.id === state.selectedId)) ||
        (state.selectedType === 'fixture' &&
          state.selectedId !== null &&
          !fixtures.some((fx) => fx.id === state.selectedId));

      setWithCollisions({
        corners,
        walls,
        openings,
        roofSlopes,
        fixtures,
        furniture,
        ...(shouldClearSelection
          ? { selectedId: null, selectedType: null, selectedRoomId: null }
          : {}),
      });
    },


    ...createWallDetailsSlice(deps),
  };
}
