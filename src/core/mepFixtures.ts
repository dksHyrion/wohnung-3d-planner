import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import {
  Corner,
  EPSILON_CM,
  FloorplanData,
  FurnitureItem,
  FurnitureVisualType,
  RoomPolygon,
  Wall,
  WallFixture,
  WallFixtureType,
} from './types';
import { getWallGeometry, isPointInRoom } from './wallMath';
import { resolveFurnitureVisual } from './furnitureVisual';

export const WALL_FIXTURE_TYPES: readonly WallFixtureType[] = [
  'radiator',
  'socket',
  'switch',
  'data-outlet',
  'water-outlet',
  'shaft',
];

export const FIXTURE_DEFAULTS: Record<
  WallFixtureType,
  { widthCm: number; heightCm: number; depthCm: number; elevationCm: number }
> = {
  radiator: { widthCm: 100, heightCm: 60, depthCm: 12, elevationCm: 15 },
  socket: { widthCm: 14, heightCm: 8, depthCm: 3, elevationCm: 30 },
  switch: { widthCm: 8, heightCm: 8, depthCm: 3, elevationCm: 105 },
  'data-outlet': { widthCm: 10, heightCm: 8, depthCm: 3, elevationCm: 30 },
  'water-outlet': { widthCm: 20, heightCm: 25, depthCm: 10, elevationCm: 50 },
  shaft: { widthCm: 35, heightCm: 250, depthCm: 35, elevationCm: 0 },
};

export const MAX_RECOMMENDED_SOCKET_DISTANCE_CM = 200;

export interface ResolvedWallFixtureBox {
  fixtureId: string;
  wallId: string;
  type: WallFixtureType;
  label?: string;
  center: { x: number; y: number; z: number };
  angleRad: number;
  tangent: { x: number; z: number };
  inwardNormal: { x: number; z: number };
  wallFaceAnchor: { x: number; z: number };
  widthCm: number;
  heightCm: number;
  depthCm: number;
  elevationCm: number;
  side: 'pos' | 'neg';
  obb: OBB;
  clearanceZoneObb: OBB | null;
}

export interface MepDiagnosticIssue {
  fixtureId: string;
  fixtureType: WallFixtureType;
  furnitureId: string;
  furnitureName: string;
  kind: 'heat-trap' | 'switch-covered' | 'outlet-covered' | 'shaft-collision';
}

export interface ApplianceSocketDistance {
  furnitureId: string;
  furnitureName: string;
  nearestSocketId: string | null;
  distanceCm: number | null;
  warning: boolean;
}

export interface MepDiagnosticsReport {
  issues: MepDiagnosticIssue[];
  socketDistances: ApplianceSocketDistance[];
}

export function createDefaultFixture(
  type: WallFixtureType,
  wallId: string,
  wallLengthCm: number,
  side?: 'pos' | 'neg'
): Omit<WallFixture, 'id'> {
  const def = FIXTURE_DEFAULTS[type];
  const widthCm = Math.min(def.widthCm, Math.max(8, Math.round(wallLengthCm - 10)));
  const offsetFromStartCm = Math.max(
    widthCm / 2,
    Math.round(wallLengthCm / 2)
  );
  return {
    wallId,
    type,
    offsetFromStartCm,
    widthCm,
    heightCm: def.heightCm,
    depthCm: def.depthCm,
    elevationCm: def.elevationCm,
    ...(side ? { side } : {}),
  };
}

export function resolveWallFixtureBox(
  fixture: WallFixture,
  wall: Wall,
  start: Corner,
  end: Corner,
  rooms?: RoomPolygon[]
): ResolvedWallFixtureBox | null {
  const geom = getWallGeometry(start, end);
  if (geom.lengthCm < 1) return null;

  let side: 'pos' | 'neg' = fixture.side ?? 'pos';
  if (!fixture.side && rooms && rooms.length > 0) {
    const along = Math.max(0, Math.min(geom.lengthCm, fixture.offsetFromStartCm));
    const ax = start.x + geom.tangent.x * along;
    const az = start.z + geom.tangent.z * along;
    const probeDist = wall.thicknessCm / 2 + 20;
    const posIn = rooms.some((r) =>
      isPointInRoom(ax + geom.normal.x * probeDist, az + geom.normal.z * probeDist, r)
    );
    const negIn = rooms.some((r) =>
      isPointInRoom(ax - geom.normal.x * probeDist, az - geom.normal.z * probeDist, r)
    );
    if (negIn && !posIn) {
      side = 'neg';
    }
  }

  const sign = side === 'neg' ? -1 : 1;
  const nx = geom.normal.x * sign;
  const nz = geom.normal.z * sign;

  const clampedWidth = Math.max(4, Math.min(geom.lengthCm, fixture.widthCm));
  const halfW = clampedWidth / 2;
  const clampedOffset = Math.max(
    halfW,
    Math.min(geom.lengthCm - halfW, fixture.offsetFromStartCm)
  );
  const depthCm = Math.max(1, fixture.depthCm);
  const heightCm = Math.max(4, fixture.heightCm);
  const elevationCm = Math.max(0, fixture.elevationCm);

  const anchorX =
    start.x + geom.tangent.x * clampedOffset + nx * (wall.thicknessCm / 2);
  const anchorZ =
    start.z + geom.tangent.z * clampedOffset + nz * (wall.thicknessCm / 2);

  const cx = anchorX + nx * (depthCm / 2);
  const cz = anchorZ + nz * (depthCm / 2);
  const cy = elevationCm + heightCm / 2;

  const rotMatrix = new THREE.Matrix4().makeRotationY(-geom.angleRad);
  const basis = new THREE.Matrix3().setFromMatrix4(rotMatrix);

  const obb = new OBB(
    new THREE.Vector3(cx, cy, cz),
    new THREE.Vector3(
      Math.max(0.5, clampedWidth / 2 - EPSILON_CM),
      Math.max(0.5, heightCm / 2 - EPSILON_CM),
      Math.max(0.5, depthCm / 2 - EPSILON_CM)
    ),
    basis.clone()
  );

  let clearanceZoneObb: OBB | null = null;
  if (fixture.type !== 'shaft') {
    const frontClearanceDepth = fixture.type === 'radiator' ? 30 : 20;
    const clearOffset = depthCm + frontClearanceDepth / 2;
    clearanceZoneObb = new OBB(
      new THREE.Vector3(
        anchorX + nx * clearOffset,
        cy,
        anchorZ + nz * clearOffset
      ),
      new THREE.Vector3(
        Math.max(0.5, clampedWidth / 2 - EPSILON_CM),
        Math.max(0.5, heightCm / 2 - EPSILON_CM),
        Math.max(0.5, frontClearanceDepth / 2 - EPSILON_CM)
      ),
      basis.clone()
    );
  }

  return {
    fixtureId: fixture.id,
    wallId: wall.id,
    type: fixture.type,
    label: fixture.label,
    center: { x: cx, y: cy, z: cz },
    angleRad: geom.angleRad,
    tangent: geom.tangent,
    inwardNormal: { x: nx, z: nz },
    wallFaceAnchor: { x: anchorX, z: anchorZ },
    widthCm: clampedWidth,
    heightCm,
    depthCm,
    elevationCm,
    side,
    obb,
    clearanceZoneObb,
  };
}

export function computeWallFixtureBoxes(
  corners: Corner[],
  walls: Wall[],
  fixtures: WallFixture[] | undefined,
  rooms?: RoomPolygon[]
): ResolvedWallFixtureBox[] {
  if (!fixtures || fixtures.length === 0) return [];
  const cornerMap = new Map(corners.map((c) => [c.id, c]));
  const wallMap = new Map(walls.map((w) => [w.id, w]));
  const result: ResolvedWallFixtureBox[] = [];

  for (const fx of fixtures) {
    const wall = wallMap.get(fx.wallId);
    if (!wall) continue;
    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) continue;
    const resolved = resolveWallFixtureBox(fx, wall, start, end, rooms);
    if (resolved) result.push(resolved);
  }

  return result;
}

const PLUMBING_CONNECTED_VISUALS = new Set<FurnitureVisualType>([
  'kitchen-unit',
  'kitchen-island',
  'vanity',
  'washing-machine',
  'toilet',
  'bathtub',
  'shower',
]);

const OPEN_UNDERNEATH_DESK_VISUALS = new Set<FurnitureVisualType>([
  'desk',
  'inwerk-masterlift',
  'generic-table',
  'dining-table',
]);

const POWERED_FURNITURE_VISUALS = new Set<FurnitureVisualType>([
  'inwerk-masterlift',
  'desk-monitor',
  'washing-machine',
  'neona-viva',
]);

/**
 * Determines if a furniture item semantically obstructs a given wall fixture
 * (e.g. a kitchen unit in front of a water outlet is normal plumbing, whereas
 * a wardrobe in front of a light switch or a radiator is a layout conflict).
 */
export function doesFurnitureBlockFixture(
  item: FurnitureItem,
  fixtureBox: ResolvedWallFixtureBox,
  itemOBBs: OBB[]
): boolean {
  const visual = resolveFurnitureVisual(item);

  // Wall pictures mounted high/flush against wall do not clash with lower outlets unless overlapping physically
  if (fixtureBox.type === 'shaft') {
    return itemOBBs.some((obb) => obb.intersectsOBB(fixtureBox.obb));
  }

  if (fixtureBox.type === 'water-outlet' && PLUMBING_CONNECTED_VISUALS.has(visual)) {
    return false;
  }

  // Physical intersection always blocks
  if (itemOBBs.some((obb) => obb.intersectsOBB(fixtureBox.obb))) {
    return true;
  }

  if (!fixtureBox.clearanceZoneObb) return false;

  // Low sockets/data outlets behind an open desk frame are usable under the desk
  if (
    (fixtureBox.type === 'socket' || fixtureBox.type === 'data-outlet') &&
    fixtureBox.elevationCm <= 55 &&
    OPEN_UNDERNEATH_DESK_VISUALS.has(visual)
  ) {
    return false;
  }

  return itemOBBs.some((obb) => obb.intersectsOBB(fixtureBox.clearanceZoneObb!));
}

export function formatFixtureCollisionMessage(
  itemName: string,
  fixtureType: WallFixtureType
): string {
  switch (fixtureType) {
    case 'radiator':
      return `"${itemName}" verstellt Heizkörper (Wärmestau).`;
    case 'switch':
      return `"${itemName}" verdeckt Lichtschalter.`;
    case 'socket':
      return `"${itemName}" verdeckt Steckdose.`;
    case 'data-outlet':
      return `"${itemName}" verdeckt LAN-/TV-Dose.`;
    case 'water-outlet':
      return `"${itemName}" blockiert Wasser-/Abwasseranschluss.`;
    case 'shaft':
      return `"${itemName}" kollidiert mit Versorgungsschacht.`;
  }
}

export function evaluateMepDiagnostics(
  data: FloorplanData,
  furnitureOBBMap: Map<string, OBB[]>,
  rooms?: RoomPolygon[]
): MepDiagnosticsReport {
  const boxes = computeWallFixtureBoxes(
    data.corners,
    data.walls,
    data.fixtures,
    rooms
  );

  const issues: MepDiagnosticIssue[] = [];
  for (const box of boxes) {
    for (const item of data.furniture) {
      const obbs = furnitureOBBMap.get(item.id);
      if (!obbs || obbs.length === 0) continue;
      if (doesFurnitureBlockFixture(item, box, obbs)) {
        const kind: MepDiagnosticIssue['kind'] =
          box.type === 'shaft'
            ? 'shaft-collision'
            : box.type === 'radiator'
            ? 'heat-trap'
            : box.type === 'switch'
            ? 'switch-covered'
            : 'outlet-covered';
        issues.push({
          fixtureId: box.fixtureId,
          fixtureType: box.type,
          furnitureId: item.id,
          furnitureName: item.name,
          kind,
        });
      }
    }
  }

  const sockets = boxes.filter((b) => b.type === 'socket');
  const socketDistances: ApplianceSocketDistance[] = [];
  for (const item of data.furniture) {
    const visual = resolveFurnitureVisual(item);
    if (!POWERED_FURNITURE_VISUALS.has(visual)) continue;

    if (sockets.length === 0) {
      socketDistances.push({
        furnitureId: item.id,
        furnitureName: item.name,
        nearestSocketId: null,
        distanceCm: null,
        warning: (data.fixtures?.length ?? 0) > 0,
      });
      continue;
    }

    let bestDist = Infinity;
    let bestSocketId: string | null = null;
    for (const sock of sockets) {
      const dist = Math.hypot(item.x - sock.center.x, item.z - sock.center.z);
      if (dist < bestDist) {
        bestDist = dist;
        bestSocketId = sock.fixtureId;
      }
    }

    const roundedDist = Math.round(bestDist);
    socketDistances.push({
      furnitureId: item.id,
      furnitureName: item.name,
      nearestSocketId: bestSocketId,
      distanceCm: roundedDist,
      warning: roundedDist > MAX_RECOMMENDED_SOCKET_DISTANCE_CM,
    });
  }

  return { issues, socketDistances };
}
