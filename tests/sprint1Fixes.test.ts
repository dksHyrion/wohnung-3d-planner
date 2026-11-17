import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeWallSegmentOBBs,
  evaluateFloorplanCollisions,
  segmentsIntersect2D as collisionSegmentsIntersect2D,
} from '../src/core/collisionEngine';
import { segmentsIntersect2D as measureSegmentsIntersect2D } from '../src/core/measureMath';
import {
  applyRoomLabels,
  computeFloorPolygons,
  isPointInRoom,
  splitWallsAtCorner,
} from '../src/core/wallMath';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { setGlobalLanguage } from '../src/i18n/i18n';
import type { Corner, FloorplanData, FurnitureItem, Wall, WallOpening } from '../src/core/types';

describe('Sprint 1: Geometry, Collision & Store Fixes', () => {
  const baseRoom: FloorplanData = {
    corners: [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 400, z: 0 },
      { id: 'c3', x: 400, z: 300 },
      { id: 'c4', x: 0, z: 300 },
    ],
    walls: [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
    ],
    openings: [],
    furniture: [],
  };

  describe('Opening-aware wall collision', () => {
    it('allows furniture inside a passage opening below lintel without false wall-intersection', () => {
      const passage: WallOpening = {
        id: 'op-passage',
        wallId: 'w1',
        type: 'passage',
        offsetFromStartCm: 100,
        widthCm: 160,
        heightCm: 210,
        sillHeightCm: 0,
      };
      const cart: FurnitureItem = {
        id: 'cart',
        name: 'Servierwagen',
        category: 'kitchen',
        widthCm: 80,
        heightCm: 85,
        depthCm: 50,
        x: 180,
        z: 0, // directly through the passage centerline
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
      };

      const reports = evaluateFloorplanCollisions({
        ...baseRoom,
        openings: [passage],
        furniture: [cart],
      });

      expect(reports['cart'].hasCollision).toBe(false);
      expect(reports['cart'].issues).toHaveLength(0);
    });

    it('detects lintel wall-intersection when tall furniture exceeds passage height', () => {
      const passage: WallOpening = {
        id: 'op-passage',
        wallId: 'w1',
        type: 'passage',
        offsetFromStartCm: 100,
        widthCm: 160,
        heightCm: 200,
        sillHeightCm: 0,
      };
      const tallWardrobe: FurnitureItem = {
        id: 'tall',
        name: 'Hoher Schrank',
        category: 'storage',
        widthCm: 100,
        heightCm: 230, // exceeds 200 cm passage lintel
        depthCm: 50,
        x: 180,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
      };

      const reports = evaluateFloorplanCollisions({
        ...baseRoom,
        openings: [passage],
        furniture: [tallWardrobe],
      });

      expect(reports['tall'].hasCollision).toBe(true);
      expect(reports['tall'].issues.some((i) => i.type === 'wall-intersection')).toBe(true);
    });

    it('allows decor plants on a window sill and flags non-passage threshold blocking as opening-blocked', () => {
      const windowOp: WallOpening = {
        id: 'op-win',
        wallId: 'w1',
        type: 'window',
        offsetFromStartCm: 120,
        widthCm: 120,
        heightCm: 130,
        sillHeightCm: 90,
      };
      const sillPlant: FurnitureItem = {
        id: 'plant-sill',
        name: 'Fensterbank-Pflanze',
        category: 'decor',
        visual: 'plant',
        widthCm: 20,
        heightCm: 35,
        depthCm: 12,
        x: 180,
        z: 0,
        elevationCm: 90,
        rotationYDeg: 0,
        color: '#15803d',
      };
      const slidingDoor: WallOpening = {
        id: 'op-slide',
        wallId: 'w3',
        type: 'sliding-door',
        offsetFromStartCm: 120,
        widthCm: 120,
        heightCm: 210,
        sillHeightCm: 0,
      };
      const tableInSlidingDoor: FurnitureItem = {
        id: 'table-slide',
        name: 'Tisch',
        category: 'living',
        widthCm: 80,
        heightCm: 75,
        depthCm: 60,
        x: 220,
        z: 300,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#94a3b8',
      };

      const reports = evaluateFloorplanCollisions({
        ...baseRoom,
        openings: [windowOp, slidingDoor],
        furniture: [sillPlant, tableInSlidingDoor],
      });

      expect(reports['plant-sill'].hasCollision).toBe(false);
      expect(reports['table-slide'].hasCollision).toBe(true);
      expect(reports['table-slide'].issues.some((i) => i.type === 'opening-blocked')).toBe(true);
      expect(reports['table-slide'].issues.some((i) => i.type === 'wall-intersection')).toBe(false);

      const segOBBs = computeWallSegmentOBBs(
        baseRoom.corners[0],
        baseRoom.corners[1],
        baseRoom.walls[0],
        [windowOp]
      );
      expect(segOBBs).toHaveLength(4); // left, sill, lintel, right
    });
  });

  describe('Wall thickness sync for snapped furniture & children', () => {
    beforeEach(() => {
      useFloorplanStore.getState().loadPreset('empty-room');
    });

    it('repositions snapped furniture and attached children when wall thickness changes', () => {
      const state = useFloorplanStore.getState();
      state.setSnapToWallEnabled(true);
      const wall = state.walls[0]; // w1 along z = 0, thickness 15 -> inner face z = 7.5

      const deskId = state.addFurniture({
        name: 'Schreibtisch',
        category: 'office',
        visual: 'desk',
        widthCm: 140,
        heightCm: 75,
        depthCm: 70,
        x: 220,
        z: 42.5,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
        snappedWallId: wall.id,
      });
      const monitorId = state.addFurniture({
        name: 'Monitor',
        category: 'office',
        visual: 'desk-monitor',
        widthCm: 60,
        heightCm: 40,
        depthCm: 20,
        x: 220,
        z: 30,
        elevationCm: 75,
        rotationYDeg: 0,
        color: '#0f172a',
        attachedToId: deskId,
      });

      // Increase wall thickness from 15 cm to 35 cm (+10 cm inward face shift)
      useFloorplanStore.getState().updateWallProps(wall.id, { thicknessCm: 35 });

      const updated = useFloorplanStore.getState();
      const desk = updated.furniture.find((f) => f.id === deskId)!;
      const monitor = updated.furniture.find((f) => f.id === monitorId)!;

      // Expected z = 35/2 + 70/2 = 17.5 + 35 = 52.5 (+10 cm shift)
      expect(desk.z).toBeCloseTo(52.5, 1);
      expect(monitor.z).toBeCloseTo(40, 1);
      expect(updated.collisionReports[deskId].hasCollision).toBe(false);
    });
  });

  describe('Graph topology, immutability & room holes', () => {
    it('does not mutate input corner in splitWallsAtCorner', () => {
      const cMid: Corner = { id: 'c-mid', x: 150, z: 1.2 };
      const corners: Corner[] = [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 400, z: 0 },
        cMid,
      ];
      const walls: Wall[] = [
        { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
      ];

      const res = splitWallsAtCorner(corners, walls, [], cMid);
      expect(res.didSplit).toBe(true);
      expect(cMid.z).toBe(1.2); // original object untouched
      expect(res.corners.find((c) => c.id === 'c-mid')?.z).toBe(0);
    });

    it('splits X-crossing walls mid-span in addWallWithCorners to form 4 closed rooms', () => {
      useFloorplanStore.getState().loadPreset('empty-room');
      const s = useFloorplanStore.getState();
      // Empty room is 0..400 in X, 0..320 in Z
      s.addWallWithCorners({ x: 200, z: 0 }, { x: 200, z: 320 });
      s.addWallWithCorners({ x: 0, z: 160 }, { x: 400, z: 160 });

      const after = useFloorplanStore.getState();
      const rooms = computeFloorPolygons(after.corners, after.walls);
      expect(rooms).toHaveLength(4);
    });

    it('subtracts interior shaft/island holes from enclosing room area and ignores hole points in room labels', () => {
      const corners: Corner[] = [
        // Outer 600 x 500 room (30.0 m²)
        { id: 'o1', x: 0, z: 0 },
        { id: 'o2', x: 600, z: 0 },
        { id: 'o3', x: 600, z: 500 },
        { id: 'o4', x: 0, z: 500 },
        // Inner 100 x 100 shaft centered inside (1.0 m²)
        { id: 'i1', x: 250, z: 200 },
        { id: 'i2', x: 350, z: 200 },
        { id: 'i3', x: 350, z: 300 },
        { id: 'i4', x: 250, z: 300 },
      ];
      const walls: Wall[] = [
        { id: 'ow1', startCornerId: 'o1', endCornerId: 'o2', thicknessCm: 20, heightCm: 250 },
        { id: 'ow2', startCornerId: 'o2', endCornerId: 'o3', thicknessCm: 20, heightCm: 250 },
        { id: 'ow3', startCornerId: 'o3', endCornerId: 'o4', thicknessCm: 20, heightCm: 250 },
        { id: 'ow4', startCornerId: 'o4', endCornerId: 'o1', thicknessCm: 20, heightCm: 250 },
        { id: 'iw1', startCornerId: 'i1', endCornerId: 'i2', thicknessCm: 10, heightCm: 250 },
        { id: 'iw2', startCornerId: 'i2', endCornerId: 'i3', thicknessCm: 10, heightCm: 250 },
        { id: 'iw3', startCornerId: 'i3', endCornerId: 'i4', thicknessCm: 10, heightCm: 250 },
        { id: 'iw4', startCornerId: 'i4', endCornerId: 'i1', thicknessCm: 10, heightCm: 250 },
      ];

      const rooms = computeFloorPolygons(corners, walls);
      expect(rooms).toHaveLength(2);
      const outer = rooms.find((r) => r.corners.some((c) => c.id === 'o1'))!;
      const inner = rooms.find((r) => r.corners.some((c) => c.id === 'i1'))!;

      expect(outer.holes).toHaveLength(1);
      // Outer centerline 30.0 - inner 1.0 = 29.0 m²
      expect(outer.areaSqM).toBeCloseTo(29.0, 2);
      // Outer net (580*480 = 27.84 m²) - shaft outer net (110*110 = 1.21 m²) = 26.63 m²
      expect(outer.netAreaSqM).toBeCloseTo(26.63, 2);
      expect(inner.areaSqM).toBeCloseTo(1.0, 2);

      // Point inside inner shaft belongs to inner, not outer
      expect(isPointInRoom(300, 250, outer)).toBe(false);
      expect(isPointInRoom(300, 250, inner)).toBe(true);

      const labeled = applyRoomLabels(rooms, [
        { name: 'Loft', x: 100, z: 100 },
        { name: 'Schacht', x: 300, z: 250 },
      ]);
      expect(labeled.find((r) => r.id === outer.id)?.name).toBe('Loft');
      expect(labeled.find((r) => r.id === inner.id)?.name).toBe('Schacht');
    });

    it('produces identical room ordering regardless of wall array order', () => {
      const base = useFloorplanStore.getState();
      base.loadPreset('standard-55');
      const { corners, walls } = useFloorplanStore.getState();
      const roomsA = computeFloorPolygons(corners, walls);
      const roomsB = computeFloorPolygons(corners, [...walls].reverse());
      expect(roomsB.map((r) => r.centroid)).toEqual(roomsA.map((r) => r.centroid));
      expect(roomsB.map((r) => r.netAreaSqM)).toEqual(roomsA.map((r) => r.netAreaSqM));
    });

    it('shares canonical segmentsIntersect2D across measureMath and collisionEngine', () => {
      expect(measureSegmentsIntersect2D).toBe(collisionSegmentsIntersect2D);
      // Collinear endpoint touch
      expect(
        measureSegmentsIntersect2D(
          { x: 0, z: 0 },
          { x: 100, z: 0 },
          { x: 100, z: 0 },
          { x: 200, z: 0 }
        )
      ).toBe(true);
    });
  });

  describe('Localized persistence error messages', () => {
    it('uses active language for corrupt backup error in loadFromLocalStorage', () => {
      const orig = globalThis.localStorage;
      const storeMap = new Map<string, string>([['wohnung_autosave', '{not-json']]);
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
          getItem: (k: string) => storeMap.get(k) ?? null,
          setItem: (k: string, v: string) => {
            storeMap.set(k, v);
          },
          removeItem: (k: string) => {
            storeMap.delete(k);
          },
        },
      });
      try {
        setGlobalLanguage('en');
        useFloorplanStore.getState().loadFromLocalStorage();
        expect(useFloorplanStore.getState().persistenceError).toBe(
          'The automatic backup was corrupted and saved as a copy.'
        );
      } finally {
        setGlobalLanguage('de');
        Object.defineProperty(globalThis, 'localStorage', {
          configurable: true,
          value: orig,
        });
      }
    });
  });
});
