import { getEntityLevelId, normalizeLevels } from './levels';
import { computeStairGeometry, type PointXZ } from './stairsMath';
import type { BuildingLevel, Corner, Staircase, Wall } from './types';
import { computeFloorPolygons, pointInPolygon } from './wallMath';

export interface LevelSlab {
  id: string;
  levelId: string;
  elevationCm: number;
  thicknessCm: number;
  outerPolygon: PointXZ[];
  holes: PointXZ[][];
  grossAreaSqM: number;
  netAreaSqM: number;
}

function polygonAreaCm2(poly: PointXZ[]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a.x * b.z - b.x * a.z;
  }
  return Math.abs(area) / 2;
}

function boundingBox(poly: PointXZ[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { minX, maxX, minZ, maxZ };
}

function holeOverlapsPolygon(hole: PointXZ[], outer: PointXZ[]): boolean {
  if (hole.length < 3 || outer.length < 3) return false;
  const hb = boundingBox(hole);
  const ob = boundingBox(outer);
  if (
    hb.maxX < ob.minX ||
    hb.minX > ob.maxX ||
    hb.maxZ < ob.minZ ||
    hb.minZ > ob.maxZ
  ) {
    return false;
  }
  const cx = hole.reduce((acc, p) => acc + p.x, 0) / hole.length;
  const cz = hole.reduce((acc, p) => acc + p.z, 0) / hole.length;
  if (pointInPolygon(cx, cz, outer)) return true;
  return hole.some((p) => pointInPolygon(p.x, p.z, outer));
}

export function computeLevelSlabs(params: {
  levels: BuildingLevel[];
  corners: Corner[];
  walls: Wall[];
  stairs: Staircase[];
}): LevelSlab[] {
  const levels = normalizeLevels(params.levels);
  if (levels.length <= 1) return [];

  const levelMap = new Map(levels.map((l) => [l.id, l]));
  const minIndex = levels[0].index;
  const slabs: LevelSlab[] = [];

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    if (level.index <= minIndex) continue;

    // Derive slab contours from the level's own enclosed rooms, or fall back to the level directly below
    let sourceLevel = level;
    let levelCorners = params.corners.filter(
      (c) => getEntityLevelId(c) === sourceLevel.id
    );
    let levelWalls = params.walls.filter(
      (w) => getEntityLevelId(w) === sourceLevel.id
    );
    let rooms = computeFloorPolygons(levelCorners, levelWalls);

    if (rooms.length === 0 && i > 0) {
      sourceLevel = levels[i - 1];
      levelCorners = params.corners.filter(
        (c) => getEntityLevelId(c) === sourceLevel.id
      );
      levelWalls = params.walls.filter(
        (w) => getEntityLevelId(w) === sourceLevel.id
      );
      rooms = computeFloorPolygons(levelCorners, levelWalls);
    }

    const arrivingStairHoles = params.stairs
      .filter((s) => s.toLevelId === level.id)
      .map((s) =>
        computeStairGeometry(
          s,
          levelMap.get(s.fromLevelId),
          levelMap.get(s.toLevelId)
        ).openingPolygonXZ
      );

    for (const room of rooms) {
      const outerPolygon: PointXZ[] = room.corners.map((c) => ({ x: c.x, z: c.z }));
      const holes = arrivingStairHoles.filter((h) =>
        holeOverlapsPolygon(h, outerPolygon)
      );
      const grossAreaCm2 = polygonAreaCm2(outerPolygon);
      const holeAreaCm2 = holes.reduce(
        (acc, h) => acc + Math.min(grossAreaCm2, polygonAreaCm2(h)),
        0
      );
      slabs.push({
        id: `slab-${level.id}-${room.id}`,
        levelId: level.id,
        elevationCm: level.elevationCm,
        thicknessCm: level.slabThicknessCm,
        outerPolygon,
        holes,
        grossAreaSqM: Number((grossAreaCm2 / 10000).toFixed(2)),
        netAreaSqM: Number((Math.max(0, grossAreaCm2 - holeAreaCm2) / 10000).toFixed(2)),
      });
    }
  }

  return slabs;
}
