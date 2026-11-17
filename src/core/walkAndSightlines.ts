import {
  Corner,
  FloorplanData,
  FurnitureItem,
  Point2D,
  Wall,
  WallOpening,
} from './types';
import { getWallGeometry } from './wallMath';
import { openingIsWalkthrough, openingLetsLightThrough } from './doorLeaf';
import { computeWallPlanPolygons } from './export/wallExportPolygons';
import { segmentsIntersect2D } from './geometry2d';
import { resolveFurnitureVisual } from './furnitureVisual';
import { computeEffectiveSunLight } from './windowLight';
import { interpolateMood } from './lighting/moodPresets';

export const PLAYER_COLLISION_RADIUS_CM = 18;
export const DEFAULT_WALK_SPEED_CM_PER_SEC = 160;

export interface WalkStepInput {
  pos: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  /** +1 forward (W / Up), -1 backward (S / Down) */
  forwardInput: number;
  /** +1 strafe right (D), -1 strafe left (A) */
  strafeInput: number;
  stepCm: number;
  eyeLevelCm: number;
  corners: Corner[];
  walls: Wall[];
  openings: WallOpening[];
}

export interface WalkStepResult {
  pos: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  moved: boolean;
  blocked: boolean;
}

export interface GlareCheckIssue {
  furnitureId: string;
  furnitureName: string;
  windowId: string;
  kind: 'reflection-glare' | 'backlight-contrast';
  distanceCm: number;
  severity: 'critical' | 'warning';
  screenPoint: Point2D;
  windowPoint: Point2D;
}

export interface SightlineCheckItem {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  distanceCm: number;
  viewingAngleDeg: number;
  obstructedByWall: boolean;
  obstructedByName: string | null;
  status: 'clear' | 'angled' | 'obstructed';
  fromPoint: Point2D;
  toPoint: Point2D;
}

export interface WalkAndSightlinesReport {
  glareIssues: GlareCheckIssue[];
  sightlines: SightlineCheckItem[];
}

function pointToSegmentDistSq(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-9) return (px - ax) ** 2 + (pz - az) ** 2;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq));
  const projX = ax + t * dx;
  const projZ = az + t * dz;
  return (px - projX) ** 2 + (pz - projZ) ** 2;
}

function pointInPolygonXZ(px: number, pz: number, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const zi = poly[i].z;
    const xj = poly[j].x;
    const zj = poly[j].z;
    const hit = zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function isWalkPositionClear(
  x: number,
  z: number,
  wallPolys: Array<{ polygon: [Point2D, Point2D, Point2D, Point2D] }>,
  radiusCm: number
): boolean {
  const rSq = radiusCm * radiusCm;
  for (const wp of wallPolys) {
    const poly = wp.polygon;
    if (pointInPolygonXZ(x, z, poly)) return false;
    for (let i = 0; i < 4; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % 4];
      if (pointToSegmentDistSq(x, z, a.x, a.z, b.x, b.z) < rSq) {
        return false;
      }
    }
  }
  return true;
}

function segmentCrossesAnyPolygon(
  a: Point2D,
  b: Point2D,
  wallPolys: Array<{ polygon: [Point2D, Point2D, Point2D, Point2D] }>
): boolean {
  for (const wp of wallPolys) {
    const poly = wp.polygon;
    for (let i = 0; i < 4; i++) {
      if (segmentsIntersect2D(a, b, poly[i], poly[(i + 1) % 4])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Advances first-person camera position and look-at target along horizontal WASD vectors,
 * allowing passage through `openingIsWalkthrough` apertures and sliding smoothly along solid walls.
 */
export function stepFirstPersonWalk(input: WalkStepInput): WalkStepResult {
  const { pos, target, forwardInput, strafeInput, stepCm, eyeLevelCm } = input;
  if (
    (Math.abs(forwardInput) < 1e-6 && Math.abs(strafeInput) < 1e-6) ||
    stepCm <= 0
  ) {
    return {
      pos: { x: pos.x, y: eyeLevelCm, z: pos.z },
      target: { x: target.x, y: eyeLevelCm, z: target.z },
      moved: false,
      blocked: false,
    };
  }

  let fx = target.x - pos.x;
  let fz = target.z - pos.z;
  const fLen = Math.hypot(fx, fz);
  if (fLen < 1e-4) {
    fx = 0;
    fz = -1;
  } else {
    fx /= fLen;
    fz /= fLen;
  }

  // Screen-right horizontal unit vector in Three.js (+Y up): forward x up = (-fz, fx)
  const rx = -fz;
  const rz = fx;

  let moveX = fx * forwardInput + rx * strafeInput;
  let moveZ = fz * forwardInput + rz * strafeInput;
  const moveLen = Math.hypot(moveX, moveZ);
  if (moveLen < 1e-6) {
    return {
      pos: { x: pos.x, y: eyeLevelCm, z: pos.z },
      target: { x: target.x, y: eyeLevelCm, z: target.z },
      moved: false,
      blocked: false,
    };
  }
  moveX = (moveX / moveLen) * stepCm;
  moveZ = (moveZ / moveLen) * stepCm;

  // Walkthrough openings (doors, sliding-doors, passages, balcony-doors) remain hollow
  const walkthroughOpenings = input.openings.filter((op) => openingIsWalkthrough(op.type));
  const wallPolys = computeWallPlanPolygons(input.corners, input.walls, walkthroughOpenings);

  const tryMove = (dx: number, dz: number): boolean => {
    const nx = pos.x + dx;
    const nz = pos.z + dz;
    if (!isWalkPositionClear(nx, nz, wallPolys, PLAYER_COLLISION_RADIUS_CM)) {
      return false;
    }
    return !segmentCrossesAnyPolygon({ x: pos.x, z: pos.z }, { x: nx, z: nz }, wallPolys);
  };

  let finalDx = 0;
  let finalDz = 0;
  if (tryMove(moveX, moveZ)) {
    finalDx = moveX;
    finalDz = moveZ;
  } else if (Math.abs(moveX) > 0.1 && tryMove(moveX, 0)) {
    finalDx = moveX;
  } else if (Math.abs(moveZ) > 0.1 && tryMove(0, moveZ)) {
    finalDz = moveZ;
  }

  const moved = Math.abs(finalDx) > 1e-4 || Math.abs(finalDz) > 1e-4;
  return {
    pos: { x: pos.x + finalDx, y: eyeLevelCm, z: pos.z + finalDz },
    target: { x: target.x + finalDx, y: eyeLevelCm, z: target.z + finalDz },
    moved,
    blocked: !moved,
  };
}

function resolveOpeningWorldCenter(
  op: WallOpening,
  wallMap: Map<string, Wall>,
  cornerMap: Map<string, Corner>
): { x: number; z: number } | null {
  const wall = wallMap.get(op.wallId);
  if (!wall) return null;
  const start = cornerMap.get(wall.startCornerId);
  const end = cornerMap.get(wall.endCornerId);
  if (!start || !end) return null;
  const geom = getWallGeometry(start, end);
  if (geom.lengthCm < 1) return null;
  const along = op.offsetFromStartCm + op.widthCm / 2;
  return {
    x: start.x + geom.tangent.x * along,
    z: start.z + geom.tangent.z * along,
  };
}

function getFurnitureFrontDirXZ(item: FurnitureItem): { x: number; z: number } {
  const rad = (item.rotationYDeg * Math.PI) / 180;
  return { x: Math.sin(rad), z: Math.cos(rad) };
}

function getItemWorldAABBXZ(item: FurnitureItem) {
  const rad = (item.rotationYDeg * Math.PI) / 180;
  const ac = Math.abs(Math.cos(rad));
  const as = Math.abs(Math.sin(rad));
  const hw = (item.widthCm * ac + item.depthCm * as) / 2;
  const hd = (item.widthCm * as + item.depthCm * ac) / 2;
  return {
    minX: item.x - hw,
    maxX: item.x + hw,
    minZ: item.z - hd,
    maxZ: item.z + hd,
  };
}

function segmentIntersectsFurnitureTallObstacle(
  a: Point2D,
  b: Point2D,
  furniture: FurnitureItem[],
  ignoreIds: Set<string>
): string | null {
  for (const item of furniture) {
    if (ignoreIds.has(item.id)) continue;
    if (item.elevationCm + item.heightCm < 115) continue;
    const box = getItemWorldAABBXZ(item);
    const corners: [Point2D, Point2D, Point2D, Point2D] = [
      { x: box.minX, z: box.minZ },
      { x: box.maxX, z: box.minZ },
      { x: box.maxX, z: box.maxZ },
      { x: box.minX, z: box.maxZ },
    ];
    for (let i = 0; i < 4; i++) {
      if (segmentsIntersect2D(a, b, corners[i], corners[(i + 1) % 4])) {
        return item.name;
      }
    }
  }
  return null;
}

/**
 * Evaluates screen glare (window reflections / backlight contrast on desk monitors and workstations)
 * and living-room sightlines (seating -> wall art / media targets).
 */
export function evaluateWalkAndSightlines(
  data: FloorplanData,
  options: { timeOfDay?: number; alignSunWithWindows?: boolean } = {}
): WalkAndSightlinesReport {
  const cornerMap = new Map(data.corners.map((c) => [c.id, c]));
  const wallMap = new Map(data.walls.map((w) => [w.id, w]));

  // Solid walls excluding daylight openings along sightlines for glare/LOS
  const allOpeningWallPolys = computeWallPlanPolygons(data.corners, data.walls, data.openings);
  const opaqueWallPolys = computeWallPlanPolygons(
    data.corners,
    data.walls,
    data.openings.filter((o) => openingIsWalkthrough(o.type))
  );

  // Compute sun direction
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const c of data.corners) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.z < minZ) minZ = c.z;
    if (c.z > maxZ) maxZ = c.z;
  }
  const roomCenter = {
    cx: Number.isFinite(minX) ? (minX + maxX) / 2 : 0,
    cz: Number.isFinite(minZ) ? (minZ + maxZ) / 2 : 0,
  };
  const mood = interpolateMood(options.timeOfDay ?? 12);
  const sun = computeEffectiveSunLight({
    corners: data.corners,
    walls: data.walls,
    openings: data.openings,
    roomCenter,
    sunElevationDeg: mood.sunElevationDeg,
    sunAzimuthDeg: mood.sunAzimuthDeg,
    alignSunWithWindows: options.alignSunWithWindows ?? true,
  });
  const sunHorizLen = Math.hypot(sun.dirToRoom.x, sun.dirToRoom.z) || 1;
  const sunDirXZ = {
    x: sun.dirToRoom.x / sunHorizLen,
    z: sun.dirToRoom.z / sunHorizLen,
  };

  // 1. Monitor / Workstation Glare Check
  const monitors = data.furniture.filter((f) => {
    const v = resolveFurnitureVisual(f);
    if (v === 'desk-monitor') return true;
    if (v === 'desk' || v === 'inwerk-masterlift') {
      return !data.furniture.some(
        (child) => child.attachedToId === f.id && resolveFurnitureVisual(child) === 'desk-monitor'
      );
    }
    return false;
  });

  const windows = data.openings
    .filter((o) => openingLetsLightThrough(o.type))
    .map((o) => ({ op: o, center: resolveOpeningWorldCenter(o, wallMap, cornerMap) }))
    .filter((w): w is { op: WallOpening; center: { x: number; z: number } } => w.center !== null);

  const glareIssues: GlareCheckIssue[] = [];
  for (const mon of monitors) {
    const front = getFurnitureFrontDirXZ(mon);
    for (const win of windows) {
      const dx = win.center.x - mon.x;
      const dz = win.center.z - mon.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 10 || dist > 550) continue;
      const ux = dx / dist;
      const uz = dz / dist;

      // Shrink ray slightly at window end so it doesn't hit the window's own wall edge
      const rayEnd = { x: win.center.x - ux * 15, z: win.center.z - uz * 15 };
      const rayStart = { x: mon.x + ux * 10, z: mon.z + uz * 10 };
      if (segmentCrossesAnyPolygon(rayStart, rayEnd, allOpeningWallPolys)) {
        continue;
      }

      const alignWithFront = ux * front.x + uz * front.z;
      // Reflection glare: window lies behind the seated viewer shining onto screen (+front)
      if (alignWithFront >= 0.65) {
        const sunTowardsMonitor = sunDirXZ.x * -ux + sunDirXZ.z * -uz;
        glareIssues.push({
          furnitureId: mon.id,
          furnitureName: mon.name,
          windowId: win.op.id,
          kind: 'reflection-glare',
          distanceCm: Math.round(dist),
          severity: sunTowardsMonitor > 0.2 ? 'critical' : 'warning',
          screenPoint: { x: mon.x, z: mon.z },
          windowPoint: { x: win.center.x, z: win.center.z },
        });
      } else if (alignWithFront <= -0.75) {
        // Backlight contrast: window directly behind screen
        glareIssues.push({
          furnitureId: mon.id,
          furnitureName: mon.name,
          windowId: win.op.id,
          kind: 'backlight-contrast',
          distanceCm: Math.round(dist),
          severity: 'warning',
          screenPoint: { x: mon.x, z: mon.z },
          windowPoint: { x: win.center.x, z: win.center.z },
        });
      }
    }
  }

  // 2. Sofa -> Artwork / TV Sightlines
  const seating = data.furniture.filter((f) => {
    const v = resolveFurnitureVisual(f);
    return v === 'sofa' || v === 'sectional-sofa' || v === 'boconcept-osaka';
  });
  const artTargets = data.furniture.filter((f) => {
    const v = resolveFurnitureVisual(f);
    return v === 'wall-picture' || v === 'picture-rail';
  });

  const sightlines: SightlineCheckItem[] = [];
  for (const seat of seating) {
    const gaze = getFurnitureFrontDirXZ(seat);
    for (const target of artTargets) {
      const dx = target.x - seat.x;
      const dz = target.z - seat.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 20 || dist > 650) continue;

      const ux = dx / dist;
      const uz = dz / dist;
      const dot = Math.max(-1, Math.min(1, ux * gaze.x + uz * gaze.z));
      const angleDeg = Math.round((Math.acos(dot) * 180) / Math.PI);
      if (angleDeg > 65) continue;

      const ignoreIds = new Set([seat.id, target.id]);
      const wallBlocked = segmentCrossesAnyPolygon(
        { x: seat.x + ux * 20, z: seat.z + uz * 20 },
        { x: target.x - ux * 15, z: target.z - uz * 15 },
        opaqueWallPolys
      );
      const furnBlocked = wallBlocked
        ? null
        : segmentIntersectsFurnitureTallObstacle(
            { x: seat.x, z: seat.z },
            { x: target.x, z: target.z },
            data.furniture,
            ignoreIds
          );

      const obstructed = wallBlocked || Boolean(furnBlocked);
      const status: SightlineCheckItem['status'] = obstructed
        ? 'obstructed'
        : angleDeg > 35
        ? 'angled'
        : 'clear';

      sightlines.push({
        fromId: seat.id,
        fromName: seat.name,
        toId: target.id,
        toName: target.name,
        distanceCm: Math.round(dist),
        viewingAngleDeg: angleDeg,
        obstructedByWall: wallBlocked,
        obstructedByName: furnBlocked,
        status,
        fromPoint: { x: seat.x, z: seat.z },
        toPoint: { x: target.x, z: target.z },
      });
    }
  }

  return { glareIssues, sightlines };
}
