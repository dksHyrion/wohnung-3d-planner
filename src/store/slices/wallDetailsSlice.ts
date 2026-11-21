import type {
  RoofSlope,
  RoomLabel,
  WallFixture,
  WallOpening,
} from '../../core/types';
import {
  applyRoomLabels,
  computeFloorPolygons,
  getWallGeometry,
  pointInPolygon,
} from '../../core/wallMath';
import { getEntityLevelId } from '../../core/levels';
import type { StoreDeps } from '../deps';
import type { FloorplanState } from '../state';

export type WallDetailsActions = Pick<
  FloorplanState,
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

export function createWallDetailsSlice(deps: StoreDeps): WallDetailsActions {
  const { get, setWithCollisions, generateId } = deps;

  return {
    updateRoom: (roomId, patch) => {
      const state = get();
      const activeLevelId = state.activeLevelId;
      const levelCorners = state.corners.filter(
        (c) => getEntityLevelId(c) === activeLevelId
      );
      const levelWalls = state.walls.filter(
        (w) => getEntityLevelId(w) === activeLevelId
      );
      const levelLabels = state.roomLabels.filter(
        (l) => getEntityLevelId(l) === activeLevelId
      );
      const rawRooms = applyRoomLabels(
        computeFloorPolygons(levelCorners, levelWalls),
        levelLabels
      );
      const targetRoom = rawRooms.find((r) => r.id === roomId);
      if (!targetRoom) return;

      const existingIdx = state.roomLabels.findIndex(
        (entry) =>
          getEntityLevelId(entry) === activeLevelId &&
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
        const fallbackPrefix = state.language === 'en' ? 'Room' : 'Raum';
        const fallbackName = targetRoom.name ?? `${fallbackPrefix} ${roomNumber}`;
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
            levelId: activeLevelId,
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
        levelId: opening.levelId ?? (wall ? getEntityLevelId(wall) : state.activeLevelId),
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

    addRoofSlope: (slope) => {
      const state = get();
      const id = generateId('roof');
      const parentWall = state.walls.find((w) => w.id === slope.wallId);
      const newSlope: RoofSlope = {
        id,
        wallId: slope.wallId,
        levelId: parentWall ? getEntityLevelId(parentWall) : state.activeLevelId,
        kneeWallHeightCm: Math.max(0, Math.min(250, slope.kneeWallHeightCm)),
        pitchDeg: Math.max(5, Math.min(75, slope.pitchDeg)),
        ...(slope.side ? { side: slope.side } : {}),
      };
      setWithCollisions({ roofSlopes: [...state.roofSlopes, newSlope] });
      return id;
    },

    updateRoofSlope: (slopeId, patch) => {
      const state = get();
      const roofSlopes = state.roofSlopes.map((s) => {
        if (s.id !== slopeId) return s;
        return {
          ...s,
          ...patch,
          kneeWallHeightCm:
            patch.kneeWallHeightCm !== undefined
              ? Math.max(0, Math.min(250, patch.kneeWallHeightCm))
              : s.kneeWallHeightCm,
          pitchDeg:
            patch.pitchDeg !== undefined
              ? Math.max(5, Math.min(75, patch.pitchDeg))
              : s.pitchDeg,
        };
      });
      setWithCollisions({ roofSlopes });
    },

    removeRoofSlope: (slopeId) => {
      const state = get();
      setWithCollisions({
        roofSlopes: state.roofSlopes.filter((s) => s.id !== slopeId),
      });
    },

    addFixture: (fixture) => {
      const state = get();
      const id = generateId('fix');
      const parentWall = state.walls.find((w) => w.id === fixture.wallId);
      const newFixture: WallFixture = {
        ...fixture,
        id,
        levelId: fixture.levelId ?? (parentWall ? getEntityLevelId(parentWall) : state.activeLevelId),
        widthCm: Math.max(4, fixture.widthCm),
        heightCm: Math.max(4, fixture.heightCm),
        depthCm: Math.max(1, fixture.depthCm),
        elevationCm: Math.max(0, fixture.elevationCm),
      };
      setWithCollisions({
        fixtures: [...state.fixtures, newFixture],
        selectedId: id,
        selectedType: 'fixture',
      });
      return id;
    },

    updateFixture: (fixtureId, patch) => {
      const state = get();
      const existing = state.fixtures.find((fx) => fx.id === fixtureId);
      if (!existing) return;

      const wall = state.walls.find((w) => w.id === existing.wallId);
      const start = wall ? state.corners.find((c) => c.id === wall.startCornerId) : undefined;
      const end = wall ? state.corners.find((c) => c.id === wall.endCornerId) : undefined;
      const wallLen = wall && start && end ? getWallGeometry(start, end).lengthCm : 1000;

      const nextWidth = Math.max(4, Math.min(wallLen, patch.widthCm ?? existing.widthCm));
      const halfW = nextWidth / 2;
      const rawOffset = patch.offsetFromStartCm ?? existing.offsetFromStartCm;
      const nextOffset = Math.max(halfW, Math.min(wallLen - halfW, rawOffset));

      const fixtures = state.fixtures.map((fx) => {
        if (fx.id !== fixtureId) return fx;
        return {
          ...fx,
          ...patch,
          widthCm: nextWidth,
          offsetFromStartCm: nextOffset,
          heightCm: Math.max(4, patch.heightCm ?? fx.heightCm),
          depthCm: Math.max(1, patch.depthCm ?? fx.depthCm),
          elevationCm: Math.max(0, patch.elevationCm ?? fx.elevationCm),
        };
      });
      setWithCollisions({ fixtures });
    },

    removeFixture: (fixtureId) => {
      const state = get();
      setWithCollisions({
        fixtures: state.fixtures.filter((fx) => fx.id !== fixtureId),
        selectedId: state.selectedId === fixtureId ? null : state.selectedId,
        selectedType: state.selectedId === fixtureId ? null : state.selectedType,
      });
    },
  };
}
