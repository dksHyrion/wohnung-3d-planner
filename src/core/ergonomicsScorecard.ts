import type { FloorplanData, Point2D } from './types';
import type { PassageClearanceReport } from './ergonomicsEngine';
import { evaluatePassageClearances } from './ergonomicsEngine';
import { applyRoomLabels, computeFloorPolygons, isPointInRoom } from './wallMath';
import {
  DEFAULT_LEVEL_ID,
  normalizeLevels,
  scopeFloorplanToLevel,
} from './levels';
import { computeStairGeometry } from './stairsMath';
import { layoutFurnitureParts } from './furnitureShapes';
import {
  CHAIR_PULLBACK_CRITICAL_CM,
  CHAIR_PULLBACK_RECOMMENDED_CM,
  MIN_WALK_HALF_WIDTH_CM,
  TURNING_CIRCLE_DIAMETER_CM,
  type ChairPullbackIssue,
  type DeliveryStatus,
  type ErgonomicsScorecardReport,
  type FoldOpenDiffItem,
  type FurnitureDeliveryCheck,
  type RoomScorecard,
  type ScorecardGrade,
} from './ergonomics/scorecardTypes';
import {
  type WalkabilityGrid,
  buildWalkabilityGrid,
  collectBlockedStairPolygonsForLevel,
  findRoomReachabilityAndTurning,
  findSeedPointsForWalkthroughs,
  findUnreachableFurniture,
  floodWalkableCells,
  isFloorFurniture,
  isPointNearVisitedWalkCell,
} from './ergonomics/walkabilityGrid';
import {
  evaluateChairPullbackIssues,
  evaluateDeliveryRoutes,
  evaluateFoldOpenDiff,
} from './ergonomics/deliveryAndPullback';

export {
  TURNING_CIRCLE_DIAMETER_CM,
  CHAIR_PULLBACK_RECOMMENDED_CM,
  CHAIR_PULLBACK_CRITICAL_CM,
};
export type {
  DeliveryStatus,
  ScorecardGrade,
  FurnitureDeliveryCheck,
  ChairPullbackIssue,
  FoldOpenDiffItem,
  RoomScorecard,
  ErgonomicsScorecardReport,
};

function gradeFromScore(score: number): ScorecardGrade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}


export function evaluateErgonomicsScorecard(
  data: FloorplanData,
  precomputedPassageReport?: PassageClearanceReport | null,
  options?: { levelId?: string }
): ErgonomicsScorecardReport {
  const levels = normalizeLevels(data.levels);
  const targetLevelId =
    options?.levelId ??
    levels.find((l) => l.index === 0)?.id ??
    levels[0]?.id ??
    DEFAULT_LEVEL_ID;
  const scoped =
    options?.levelId || levels.length > 1
      ? scopeFloorplanToLevel(data, targetLevelId)
      : data;

  const rooms = applyRoomLabels(
    computeFloorPolygons(scoped.corners, scoped.walls),
    scoped.roomLabels
  );
  const passageReport =
    !options?.levelId && levels.length <= 1 && precomputedPassageReport
      ? precomputedPassageReport
      : evaluatePassageClearances(scoped.furniture, scoped.walls, scoped.corners);

  const stairs = data.stairs ?? [];
  const levelMap = new Map(levels.map((l) => [l.id, l]));
  const targetStairPolys = collectBlockedStairPolygonsForLevel(
    stairs,
    levelMap,
    targetLevelId
  );

  const walkGrid = buildWalkabilityGrid(scoped, true, 5, targetStairPolys);
  const wallGrid = buildWalkabilityGrid(scoped, false, 10, targetStairPolys);
  const seedInfo = findSeedPointsForWalkthroughs(scoped, rooms);
  let { seeds, hasEntranceSeed } = seedInfo;
  let visitedWalk = hasEntranceSeed
    ? floodWalkableCells(walkGrid, seeds, MIN_WALK_HALF_WIDTH_CM)
    : new Uint8Array(walkGrid.cols * walkGrid.rows);

  // Cross-floor stair reachability: propagate entrance reachability only across stairs
  // whose departure/arrival landing is actually reachable on the source level.
  if (stairs.length > 0 && levels.length > 1) {
    interface LevelReachState {
      grid: WalkabilityGrid;
      seeds: Point2D[];
      hasEntranceSeed: boolean;
      visited: Uint8Array;
    }
    const reachByLevel = new Map<string, LevelReachState>();
    for (const lvl of levels) {
      if (lvl.id === targetLevelId) {
        reachByLevel.set(lvl.id, {
          grid: walkGrid,
          seeds: [...seeds],
          hasEntranceSeed,
          visited: visitedWalk,
        });
        continue;
      }
      const lvlScoped = scopeFloorplanToLevel(data, lvl.id);
      const lvlRooms = applyRoomLabels(
        computeFloorPolygons(lvlScoped.corners, lvlScoped.walls),
        lvlScoped.roomLabels
      );
      const lvlStairPolys = collectBlockedStairPolygonsForLevel(
        stairs,
        levelMap,
        lvl.id
      );
      const lvlGrid = buildWalkabilityGrid(lvlScoped, true, 5, lvlStairPolys);
      const lvlSeedInfo = findSeedPointsForWalkthroughs(lvlScoped, lvlRooms);
      const lvlVisited = lvlSeedInfo.hasEntranceSeed
        ? floodWalkableCells(lvlGrid, lvlSeedInfo.seeds, MIN_WALK_HALF_WIDTH_CM)
        : new Uint8Array(lvlGrid.cols * lvlGrid.rows);
      reachByLevel.set(lvl.id, {
        grid: lvlGrid,
        seeds: [...lvlSeedInfo.seeds],
        hasEntranceSeed: lvlSeedInfo.hasEntranceSeed,
        visited: lvlVisited,
      });
    }

    const stairGeoms = stairs.map((st) => ({
      stair: st,
      geom: computeStairGeometry(
        st,
        levelMap.get(st.fromLevelId),
        levelMap.get(st.toLevelId)
      ),
    }));
    const propagatedKeys = new Set<string>();

    let changed = true;
    while (changed) {
      changed = false;
      for (const { stair, geom } of stairGeoms) {
        const fromState = reachByLevel.get(stair.fromLevelId);
        const toState = reachByLevel.get(stair.toLevelId);
        if (!fromState || !toState) continue;

        const fwdKey = `${stair.id}:fwd`;
        if (
          !propagatedKeys.has(fwdKey) &&
          fromState.hasEntranceSeed &&
          isPointNearVisitedWalkCell(fromState.grid, fromState.visited, geom.entryPointXZ)
        ) {
          propagatedKeys.add(fwdKey);
          toState.seeds.push(geom.exitPointXZ);
          toState.hasEntranceSeed = true;
          toState.visited = floodWalkableCells(
            toState.grid,
            toState.seeds,
            MIN_WALK_HALF_WIDTH_CM
          );
          changed = true;
        }

        const revKey = `${stair.id}:rev`;
        if (
          !propagatedKeys.has(revKey) &&
          toState.hasEntranceSeed &&
          isPointNearVisitedWalkCell(toState.grid, toState.visited, geom.exitPointXZ)
        ) {
          propagatedKeys.add(revKey);
          fromState.seeds.push(geom.entryPointXZ);
          fromState.hasEntranceSeed = true;
          fromState.visited = floodWalkableCells(
            fromState.grid,
            fromState.seeds,
            MIN_WALK_HALF_WIDTH_CM
          );
          changed = true;
        }
      }
    }

    const targetState = reachByLevel.get(targetLevelId);
    if (targetState) {
      seeds = targetState.seeds;
      hasEntranceSeed = targetState.hasEntranceSeed;
      visitedWalk = targetState.visited;
    }
  }

  const roomSpatial = findRoomReachabilityAndTurning(walkGrid, visitedWalk, rooms, hasEntranceSeed);
  const unreachableFurnitureIds = findUnreachableFurniture(
    scoped,
    walkGrid,
    visitedWalk,
    rooms,
    hasEntranceSeed
  );
  const deliveryChecks = evaluateDeliveryRoutes(scoped, seeds, hasEntranceSeed);
  const chairPullbackIssues = evaluateChairPullbackIssues(scoped, wallGrid);
  const foldOpenDiffs = evaluateFoldOpenDiff(scoped);

  // Map each furniture item to its room index
  const furnitureRoomIdx = new Map<string, number>();
  const footprintPerRoomCm2 = new Array<number>(rooms.length).fill(0);
  for (const f of scoped.furniture) {
    if (!isFloorFurniture(f)) continue;
    const ri = rooms.findIndex((r) => isPointInRoom(f.x, f.z, r));
    if (ri >= 0) {
      furnitureRoomIdx.set(f.id, ri);
      for (const part of layoutFurnitureParts(f)) {
        footprintPerRoomCm2[ri] += part.widthCm * part.depthCm;
      }
    }
  }

  const roomScorecards: RoomScorecard[] = rooms.map((room, ri) => {
    const roomName = room.name?.trim() || `Raum ${ri + 1}`;
    const occupiedSqM = footprintPerRoomCm2[ri] / 10000;
    const occupiedPercent =
      room.netAreaSqM > 0 ? Math.min(100, Math.round((occupiedSqM / room.netAreaSqM) * 1000) / 10) : 0;
    const freeFloorPercent = Math.max(0, Math.round((100 - occupiedPercent) * 10) / 10);

    const roomPassages = passageReport.passages.filter((p) => {
      const r1 = p.entity1Type === 'furniture' ? furnitureRoomIdx.get(p.entity1Id) : undefined;
      const r2 = p.entity2Type === 'furniture' ? furnitureRoomIdx.get(p.entity2Id) : undefined;
      return r1 === ri || r2 === ri || isPointInRoom((p.point1.x + p.point2.x) / 2, (p.point1.z + p.point2.z) / 2, room);
    });

    let criticalCount = 0;
    let warningCount = 0;
    let minClearanceCm: number | null = null;
    for (const p of roomPassages) {
      if (p.severity === 'critical') criticalCount++;
      else if (p.severity === 'warning') warningCount++;
      if (minClearanceCm === null || p.clearanceCm < minClearanceCm) {
        minClearanceCm = p.clearanceCm;
      }
    }

    const spatial = roomSpatial[ri];
    const maxTurningDiameterCm = Math.round(spatial.maxSurfaceDistCm * 2);
    const hasTurningCircle150 = spatial.maxSurfaceDistCm >= TURNING_CIRCLE_DIAMETER_CM / 2;

    let score = 100;
    if (!spatial.reachable) score -= 35;
    score -= Math.min(45, criticalCount * 15);
    score -= Math.min(15, warningCount * 5);
    if (!hasTurningCircle150) score -= 15;
    if (freeFloorPercent < 35) score -= 10;
    score = Math.max(0, Math.min(100, score));

    return {
      roomId: room.id,
      roomName,
      netAreaSqM: Number(room.netAreaSqM.toFixed(2)),
      occupiedPercent,
      freeFloorPercent,
      reachableFromEntrance: spatial.reachable,
      hasTurningCircle150,
      maxTurningDiameterCm,
      turningCircleCenter: spatial.bestCenter,
      minClearanceCm,
      criticalCount,
      warningCount,
      score,
      grade: gradeFromScore(score),
    };
  });

  const totalArea = roomScorecards.reduce((s, r) => s + Math.max(1, r.netAreaSqM), 0);
  let baseScore =
    roomScorecards.length > 0
      ? roomScorecards.reduce((s, r) => s + r.score * Math.max(1, r.netAreaSqM), 0) / totalArea
      : 100 - Math.min(45, passageReport.criticalCount * 15) - Math.min(15, passageReport.warningCount * 5);

  baseScore -= Math.min(20, unreachableFurnitureIds.length * 10);
  baseScore -= Math.min(15, deliveryChecks.filter((d) => d.status === 'blocked').length * 10);
  baseScore -= Math.min(15, chairPullbackIssues.filter((c) => c.severity === 'critical').length * 8);
  baseScore -= Math.min(10, foldOpenDiffs.filter((d) => d.introducesCollisions).length * 5);

  const overallScore = Math.max(0, Math.min(100, Math.round(baseScore)));

  return {
    overallScore,
    overallGrade: gradeFromScore(overallScore),
    rooms: roomScorecards,
    unreachableFurnitureIds,
    deliveryChecks,
    chairPullbackIssues,
    foldOpenDiffs,
    hasEntranceSeed,
  };
}
