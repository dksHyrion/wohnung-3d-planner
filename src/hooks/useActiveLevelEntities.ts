import { useMemo } from 'react';
import { useFloorplanStore } from '../store/useFloorplanStore';
import { getEntityLevelId } from '../core/levels';

/**
 * Returns floorplan entities scoped to the active building level (or a specific levelId).
 * Centralizes level filtering so sidebar inspectors and diagnostics stay consistent.
 */
export function useActiveLevelEntities(overrideLevelId?: string) {
  const storeActiveLevelId = useFloorplanStore((s) => s.activeLevelId);
  const corners = useFloorplanStore((s) => s.corners);
  const walls = useFloorplanStore((s) => s.walls);
  const roomLabels = useFloorplanStore((s) => s.roomLabels);
  const openings = useFloorplanStore((s) => s.openings);
  const roofSlopes = useFloorplanStore((s) => s.roofSlopes);
  const fixtures = useFloorplanStore((s) => s.fixtures);
  const furniture = useFloorplanStore((s) => s.furniture);
  const rugs = useFloorplanStore((s) => s.rugs);

  const levelId = overrideLevelId ?? storeActiveLevelId;

  const levelCorners = useMemo(
    () => corners.filter((c) => getEntityLevelId(c) === levelId),
    [corners, levelId]
  );

  const levelWalls = useMemo(
    () => walls.filter((w) => getEntityLevelId(w) === levelId),
    [walls, levelId]
  );

  const levelWallIds = useMemo(
    () => new Set(levelWalls.map((w) => w.id)),
    [levelWalls]
  );

  const levelRoomLabels = useMemo(
    () => roomLabels.filter((l) => getEntityLevelId(l) === levelId),
    [roomLabels, levelId]
  );

  const levelOpenings = useMemo(
    () =>
      openings.filter(
        (o) =>
          levelWallIds.has(o.wallId) &&
          (o.levelId === undefined || o.levelId === levelId)
      ),
    [openings, levelWallIds, levelId]
  );

  const levelRoofSlopes = useMemo(
    () =>
      (roofSlopes ?? []).filter(
        (rs) =>
          levelWallIds.has(rs.wallId) &&
          (rs.levelId === undefined || rs.levelId === levelId)
      ),
    [roofSlopes, levelWallIds, levelId]
  );

  const levelFixtures = useMemo(
    () =>
      (fixtures ?? []).filter(
        (fx) =>
          levelWallIds.has(fx.wallId) &&
          (fx.levelId === undefined || fx.levelId === levelId)
      ),
    [fixtures, levelWallIds, levelId]
  );

  const levelFurniture = useMemo(
    () => furniture.filter((f) => getEntityLevelId(f) === levelId),
    [furniture, levelId]
  );

  const levelRugs = useMemo(
    () => rugs.filter((r) => getEntityLevelId(r) === levelId),
    [rugs, levelId]
  );

  return {
    levelId,
    corners: levelCorners,
    walls: levelWalls,
    roomLabels: levelRoomLabels,
    openings: levelOpenings,
    roofSlopes: levelRoofSlopes,
    fixtures: levelFixtures,
    furniture: levelFurniture,
    rugs: levelRugs,
  };
}
