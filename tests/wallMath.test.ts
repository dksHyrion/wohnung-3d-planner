import { describe, it, expect } from 'vitest';
import {
  getWallGeometry,
  setWallLengthCm,
  checkWallFitCm,
  findWallSnap,
  shouldCutawayWall,
  computeFloorPolygons,
  getInteriorWallIds,
  splitWallsAtCorner,
  computeFitViewBox,
} from '../src/core/wallMath';
import { PRESET_FLOORPLANS } from '../src/core/presets';
import { Corner, Wall, WallOpening, FurnitureItem } from '../src/core/types';

describe('wallMath (cm-accurate 1D projection & snapping)', () => {
  const cornerA: Corner = { id: 'c1', x: 0, z: 0 };
  const cornerB: Corner = { id: 'c2', x: 300, z: 0 }; // 300 cm wall along +X
  const wall: Wall = {
    id: 'w1',
    startCornerId: 'c1',
    endCornerId: 'c2',
    thicknessCm: 15,
    heightCm: 250,
  };

  it('computes exact wall length, tangent, and inward normal in cm', () => {
    const geom = getWallGeometry(cornerA, cornerB);
    expect(geom.lengthCm).toBeCloseTo(300, 5);
    expect(geom.tangent.x).toBeCloseTo(1, 5);
    expect(geom.tangent.z).toBeCloseTo(0, 5);
    expect(geom.normal.x).toBeCloseTo(0, 5);
    expect(geom.normal.z).toBeCloseTo(1, 5);
  });

  it('resizes a wall endpoint to an exact target centimeter length', () => {
    const nextEnd = setWallLengthCm(cornerA, cornerB, 425);
    expect(nextEnd.x).toBeCloseTo(425, 5);
    expect(nextEnd.z).toBeCloseTo(0, 5);
  });

  it('detects when a furniture item is longer than the wall (wall-exceeded)', () => {
    const sofa: FurnitureItem = {
      id: 'f1',
      name: 'Big Sofa',
      category: 'living',
      widthCm: 340, // 40 cm longer than the 300 cm wall!
      heightCm: 85,
      depthCm: 95,
      x: 150,
      z: 55,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#4f46e5',
      snappedWallId: 'w1',
    };

    const res = checkWallFitCm(cornerA, cornerB, wall, [], sofa);
    expect(res.fitsOnWall).toBe(false);
    expect(res.issues.some((i) => i.type === 'wall-exceeded')).toBe(true);
    const exceeded = res.issues.find((i) => i.type === 'wall-exceeded');
    expect(exceeded?.overflowCm).toBeCloseTo(40, 2);
  });

  it('detects left and right corner overflow in cm when furniture protrudes past a corner', () => {
    const cabinet: FurnitureItem = {
      id: 'f2',
      name: 'Sideboard',
      category: 'storage',
      widthCm: 160,
      heightCm: 90,
      depthCm: 45,
      x: 50, // spans from -30 cm to +130 cm -> 30 cm overflow at start corner
      z: 30,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#0ea5e9',
      snappedWallId: 'w1',
    };

    const res = checkWallFitCm(cornerA, cornerB, wall, [], cabinet);
    expect(res.fitsOnWall).toBe(false);
    const overflowIssue = res.issues.find((i) => i.type === 'corner-overflow');
    expect(overflowIssue).toBeDefined();
    expect(overflowIssue?.overflowCm).toBeCloseTo(30, 2);
  });

  it('allows an exact 300 cm wardrobe on a 300 cm wall thanks to EPSILON_CM tolerance', () => {
    const wardrobe: FurnitureItem = {
      id: 'f3',
      name: 'Fitted Wardrobe',
      category: 'bedroom',
      widthCm: 300,
      heightCm: 220,
      depthCm: 60,
      x: 150,
      z: 37.5,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#10b981',
      snappedWallId: 'w1',
    };

    const res = checkWallFitCm(cornerA, cornerB, wall, [], wardrobe);
    expect(res.fitsOnWall).toBe(true);
    expect(res.issues).toHaveLength(0);
    expect(res.clearancesCm.leftCm).toBeCloseTo(0, 2);
    expect(res.clearancesCm.rightCm).toBeCloseTo(0, 2);
  });

  it('detects blocked door or low-sill window openings along the wall', () => {
    const door: WallOpening = {
      id: 'o1',
      wallId: 'w1',
      type: 'door',
      offsetFromStartCm: 200,
      widthCm: 86,
      heightCm: 200,
      sillHeightCm: 0,
      swingDirection: 'in-left',
    };
    const dresser: FurnitureItem = {
      id: 'f4',
      name: 'Dresser',
      category: 'bedroom',
      widthCm: 100,
      heightCm: 110,
      depthCm: 50,
      x: 180, // spans 130..230 cm, overlapping door at 200..286 cm
      z: 32.5,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#f59e0b',
      snappedWallId: 'w1',
    };

    const res = checkWallFitCm(cornerA, cornerB, wall, [door], dresser);
    expect(res.fitsOnWall).toBe(false);
    expect(res.issues.some((i) => i.type === 'opening-blocked')).toBe(true);
  });

  it('snaps furniture flush to a nearby wall inner face within threshold', () => {
    const item: FurnitureItem = {
      id: 'f5',
      name: 'Bookcase',
      category: 'living',
      widthCm: 120,
      heightCm: 200,
      depthCm: 40,
      x: 140,
      z: 35, // Wall inner face is at z = 7.5, desired center z = 7.5 + 20 = 27.5 (distance = 7.5 cm <= 20 cm)
      elevationCm: 0,
      rotationYDeg: 8,
      color: '#8b5cf6',
    };

    const snap = findWallSnap(item, [cornerA, cornerB], [wall], 20);
    expect(snap).not.toBeNull();
    expect(snap?.snappedWallId).toBe('w1');
    expect(snap?.z).toBeCloseTo(27.5, 3);
    expect(snap?.rotationYDeg).toBeCloseTo(0, 3);
  });

  it('determines cutaway visibility when a wall is between the camera and the room center', () => {
    const roomCenter = { x: 150, z: 150 };
    // Camera in front of wall w1 (at z = -250 looking towards +Z)
    expect(shouldCutawayWall(cornerA, cornerB, { x: 150, y: 300, z: -250 }, roomCenter)).toBe(true);
    // Camera on the opposite side (at z = 450 looking towards -Z, so w1 is the back wall)
    expect(shouldCutawayWall(cornerA, cornerB, { x: 150, y: 300, z: 450 }, roomCenter)).toBe(false);
  });

  it('computes exact net area for a simple 400x300 cm rectangle with 10 cm walls (390x290 = 11.31 m²)', () => {
    const corners: Corner[] = [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 400, z: 0 },
      { id: 'c3', x: 400, z: 300 },
      { id: 'c4', x: 0, z: 300 },
    ];
    const walls: Wall[] = [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 10, heightCm: 250 },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 10, heightCm: 250 },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 10, heightCm: 250 },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 10, heightCm: 250 },
    ];
    const rooms = computeFloorPolygons(corners, walls);
    expect(rooms.length).toBe(1);
    expect(rooms[0].areaSqM).toBe(12.0); // centerline: 4.0 * 3.0
    expect(rooms[0].netAreaSqM).toBeCloseTo(11.31, 2); // net: 3.9 * 2.9 = 11.31
    expect(rooms[0].netCorners).toEqual([
      { x: 5, z: 5 },
      { x: 395, z: 5 },
      { x: 395, z: 295 },
      { x: 5, z: 295 },
    ]);
  });

  it('computes net area with mixed wall thicknesses', () => {
    const corners: Corner[] = [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 400, z: 0 },
      { id: 'c3', x: 400, z: 300 },
      { id: 'c4', x: 0, z: 300 },
    ];
    const walls: Wall[] = [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 20, heightCm: 250 }, // inner face z = 10
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 30, heightCm: 250 }, // inner face x = 385
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 10, heightCm: 250 }, // inner face z = 295
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 10, heightCm: 250 }, // inner face x = 5
    ];
    const rooms = computeFloorPolygons(corners, walls);
    expect(rooms.length).toBe(1);
    // net width: 385 - 5 = 380 cm; net height: 295 - 10 = 285 cm -> 3.80 * 2.85 = 10.83 m²
    expect(rooms[0].netAreaSqM).toBeCloseTo(10.83, 2);
    expect(rooms[0].netCorners).toEqual([
      { x: 5, z: 10 },
      { x: 385, z: 10 },
      { x: 385, z: 295 },
      { x: 5, z: 295 },
    ]);
  });

  it('computes net areas and net bounding boxes for studio-apartment (22.00 m² adjoining room and 24.29 m² main room)', () => {
    const studio = PRESET_FLOORPLANS['studio-apartment'].data;
    const rooms = computeFloorPolygons(studio.corners, studio.walls);
    expect(rooms.length).toBe(2);

    const room2 = rooms.find((r) => r.corners.some((c) => c.id === 'c8'))!;
    expect(room2).toBeDefined();
    expect(room2.netAreaSqM).toBeCloseTo(22.00, 2);

    const r2MinX = Math.min(...room2.netCorners.map((c) => c.x));
    const r2MaxX = Math.max(...room2.netCorners.map((c) => c.x));
    const r2MinZ = Math.min(...room2.netCorners.map((c) => c.z));
    const r2MaxZ = Math.max(...room2.netCorners.map((c) => c.z));
    expect(r2MaxX - r2MinX).toBeCloseTo(550, 1);
    expect(r2MaxZ - r2MinZ).toBeCloseTo(400, 1);

    const room1 = rooms.find((r) => r.corners.some((c) => c.id === 'c1'))!;
    expect(room1).toBeDefined();
    expect(room1.netAreaSqM).toBeCloseTo(24.29, 2);
  });

  it('correctly identifies interior partition walls with getInteriorWallIds', () => {
    const studio = PRESET_FLOORPLANS['studio-apartment'].data;
    const interiorIds = getInteriorWallIds(studio.corners, studio.walls);
    expect(interiorIds.has('w2')).toBe(true);
    expect(interiorIds.has('w1')).toBe(false);
    expect(interiorIds.has('w7')).toBe(false);
    expect(interiorIds.has('w8')).toBe(false);
  });

  it('splits walls at T-junction corners and repositions openings correctly', () => {
    const corners: Corner[] = [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 400, z: 0 },
      { id: 'c-mid', x: 150, z: 0 },
    ];
    const walls: Wall[] = [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
    ];
    const openings: WallOpening[] = [
      // Stays on first half (offset 0..80 <= 150)
      { id: 'op1', wallId: 'w1', type: 'door', offsetFromStartCm: 30, widthCm: 80, heightCm: 200, sillHeightCm: 0 },
      // Moves to second half (offset 200..280 >= 150) -> new offset = 200 - 150 = 50
      { id: 'op2', wallId: 'w1', type: 'window', offsetFromStartCm: 200, widthCm: 80, heightCm: 130, sillHeightCm: 90 },
    ];

    const result = splitWallsAtCorner(corners, walls, openings, corners[2]);
    expect(result.didSplit).toBe(true);
    expect(result.walls.length).toBe(2);

    const firstHalf = result.walls.find((w) => w.startCornerId === 'c1')!;
    const secondHalf = result.walls.find((w) => w.endCornerId === 'c2')!;
    expect(firstHalf.endCornerId).toBe('c-mid');
    expect(secondHalf.startCornerId).toBe('c-mid');

    const op1 = result.openings.find((o) => o.id === 'op1')!;
    expect(op1.wallId).toBe(firstHalf.id);
    expect(op1.offsetFromStartCm).toBe(30);

    const op2 = result.openings.find((o) => o.id === 'op2')!;
    expect(op2.wallId).toBe(secondHalf.id);
    expect(op2.offsetFromStartCm).toBe(50);
  });
});

describe('computeFitViewBox', () => {
  it('encloses every corner of the studio preset (incl. adjoining room) plus margin', () => {
    const studio = PRESET_FLOORPLANS['studio-apartment'].data;
    const vb = computeFitViewBox(studio.corners, 100);
    const maxX = Math.max(...studio.corners.map((c) => c.x));
    const maxZ = Math.max(...studio.corners.map((c) => c.z));
    const minX = Math.min(...studio.corners.map((c) => c.x));
    const minZ = Math.min(...studio.corners.map((c) => c.z));
    expect(vb).toEqual({ x: minX - 100, y: minZ - 100, w: maxX - minX + 200, h: maxZ - minZ + 200 });
    expect(vb.x + vb.w).toBeGreaterThan(1170);
  });

  it('falls back to a sane default box when there are no corners', () => {
    const vb = computeFitViewBox([], 100);
    expect(vb.w).toBeGreaterThan(0);
    expect(vb.h).toBeGreaterThan(0);
  });
});
