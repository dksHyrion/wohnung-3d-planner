import { describe, it, expect } from 'vitest';
import {
  checkSATOverlap,
  computeFurnitureClearanceCm,
  computeFurnitureToWallDistanceCm,
} from '../src/core/measureMath';
import {
  evaluatePassageClearances,
  classifyPassageSeverity,
} from '../src/core/ergonomicsEngine';
import { FurnitureItem, Wall, Corner, EPSILON_CM } from '../src/core/types';

describe('Geometry & Ergonomics Fixes', () => {
  function createCabinet(id: string, x: number, z: number, rotY = 0): FurnitureItem {
    return {
      id,
      name: `Schrank ${id}`,
      visual: 'wardrobe',
      category: 'bedroom',
      color: '#555555',
      widthCm: 100,
      heightCm: 200,
      depthCm: 60,
      x,
      z,
      elevationCm: 0,
      rotationYDeg: rotY,
    };
  }

  describe('W4: checkSATOverlap epsilon & flush furniture', () => {
    it('does not report overlap for two side-by-side flush cabinets (0 cm gap)', () => {
      // Cabinet 1 at x = 50, Cabinet 2 at x = 150. Both width 100, depth 60.
      // Cabinet 1 right edge is at x = 100. Cabinet 2 left edge is at x = 100.
      const cab1 = createCabinet('cab1', 50, 50, 0);
      const cab2 = createCabinet('cab2', 150, 50, 0);

      const res = computeFurnitureClearanceCm(cab1, cab2);
      expect(res.isOverlapping).toBe(false);
      expect(res.clearanceCm).toBeLessThanOrEqual(EPSILON_CM);
    });

    it('does not report overlap for rotated flush cabinets (30 deg)', () => {
      // Rotate both by 30 deg and place them flush along their local side edge
      const rot = 30;
      const rad = (rot * Math.PI) / 180;
      const dx = 100 * Math.cos(rad);
      const dz = -100 * Math.sin(rad);

      const cab1 = createCabinet('cab1', 100, 100, rot);
      const cab2 = createCabinet('cab2', 100 + dx, 100 + dz, rot);

      const res = computeFurnitureClearanceCm(cab1, cab2);
      expect(res.isOverlapping).toBe(false);
      expect(res.clearanceCm).toBeLessThanOrEqual(EPSILON_CM);
    });

    it('still detects genuine overlap of 1 cm', () => {
      // Cabinet 1 at x = 50, Cabinet 2 at x = 149 (1 cm penetration)
      const cab1 = createCabinet('cab1', 50, 50, 0);
      const cab2 = createCabinet('cab2', 149, 50, 0);

      const res = computeFurnitureClearanceCm(cab1, cab2);
      expect(res.isOverlapping).toBe(true);
      expect(res.clearanceCm).toBe(0);
    });

    it('does not emit a critical passage bottleneck for flush side-by-side furniture', () => {
      const cab1 = createCabinet('cab1', 50, 50, 0);
      const cab2 = createCabinet('cab2', 150, 50, 0);

      const report = evaluatePassageClearances({
        furniture: [cab1, cab2],
        walls: [],
        corners: [],
      });

      // Flush side-by-side cabinets must not be reported as a critical walking passage
      const passageBetween = report.passages.find(
        (p) =>
          (p.entity1Id === 'cab1' && p.entity2Id === 'cab2') ||
          (p.entity1Id === 'cab2' && p.entity2Id === 'cab1')
      );
      expect(passageBetween).toBeUndefined();
    });
  });

  describe('W5: Wall clearance for straddling and compound furniture', () => {
    it('reports 0 cm clearance for a wide sofa straddling a wall mid-span', () => {
      // Wall along Z axis from (0, 0) to (0, 300), thickness = 15 cm
      const corners: Corner[] = [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 0, z: 300 },
      ];
      const wall: Wall = {
        id: 'w1',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 15,
        heightCm: 250,
      };

      // 200 cm wide sofa centered at (0, 150), so corners are at x = -100 and x = +100
      // Furniture vertices are far from wall (100 cm away), but sofa crosses the wall!
      const sofa: FurnitureItem = {
        id: 'sofa-straddling',
        name: 'Straddling Sofa',
        visual: 'sofa',
        category: 'living',
        color: '#666666',
        widthCm: 200,
        heightCm: 85,
        depthCm: 90,
        x: 0,
        z: 150,
        elevationCm: 0,
        rotationYDeg: 0,
      };

      const dist = computeFurnitureToWallDistanceCm(sofa, wall, corners);
      expect(dist).toBe(0);

      const report = evaluatePassageClearances({
        furniture: [sofa],
        walls: [wall],
        corners,
      });

      // In ergonomics report, crossing wall should be critical 0 cm
      const wallPassage = report.passages.find((p) => p.entity1Id === 'sofa-straddling' || p.entity2Id === 'sofa-straddling');
      expect(wallPassage).toBeDefined();
      expect(wallPassage?.clearanceCm).toBe(0);
      expect(wallPassage?.severity).toBe('critical');
    });

    it('accounts for compound furniture parts (e.g. dining table chairs) when near a wall', () => {
      // Wall along X axis from (0, 0) to (400, 0), thickness = 15 cm
      const corners: Corner[] = [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 400, z: 0 },
      ];
      const wall: Wall = {
        id: 'w1',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 15,
        heightCm: 250,
      };

      // Dining table centered at (200, 120), table size 160x90.
      // Table top edge closest to wall is at z = 120 - 45 = 75 cm.
      // But the chair on the top side is at cz = -45 - 20 = -65, so chair edge is at z = 120 - 65 - 20 = 35 cm!
      const diningTable: FurnitureItem = {
        id: 'table1',
        name: 'Dining Table',
        visual: 'dining-table',
        category: 'living',
        color: '#777777',
        widthCm: 160,
        heightCm: 75,
        depthCm: 90,
        x: 200,
        z: 120,
        elevationCm: 0,
        rotationYDeg: 0,
      };

      const dist = computeFurnitureToWallDistanceCm(diningTable, wall, corners);
      // Wall surface is at z = 7.5 cm (half-thickness).
      // Chair center cz is -57, half-depth is 21, so chair outer edge is at z = 120 - 57 - 21 = 42 cm.
      // Clearance should be chair distance to wall surface = 42 - 7.5 = 34.5 cm (not table top distance 67.5 cm)!
      expect(dist).toBeCloseTo(34.5, 1);

      // Ergonomics report must also evaluate part polygons and find the 34.5 cm passage
      const report = evaluatePassageClearances({
        furniture: [diningTable],
        walls: [wall],
        corners,
      });
      const wallPassage = report.passages.find((p) => p.entity1Id === 'table1' || p.entity2Id === 'table1');
      expect(wallPassage).toBeDefined();
      expect(wallPassage?.clearanceCm).toBeCloseTo(34.5, 1);
      expect(wallPassage?.severity).toBe('critical'); // < 60 cm is critical
    });
  });

  describe('W6: Dead-end niches, along-wall fixtures and wall occlusions', () => {
    it('does not report a passage between two fixtures along a wall when the gap dead-ends into the wall (e.g. shower & toilet)', () => {
      // Wall along Z axis from (0, 0) to (0, 500), thickness = 15 cm (inner face at x = 7.5 cm)
      const corners: Corner[] = [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 0, z: 500 },
      ];
      const wall: Wall = {
        id: 'w-back',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 15,
        heightCm: 250,
      };
      // Shower against wall (left edge at x = 7.5 cm, z from 55 to 145)
      const shower: FurnitureItem = {
        id: 'shower',
        name: 'Duschkabine',
        visual: 'shower',
        category: 'bathroom',
        color: '#ffffff',
        widthCm: 90,
        heightCm: 200,
        depthCm: 90,
        x: 52.5,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
      };
      // Toilet against wall (left edge at x = 7.5 cm, z from 190 to 240)
      // Gap between shower bottom edge (z=145) and toilet top edge (z=190) is 45 cm.
      const toilet: FurnitureItem = {
        id: 'toilet',
        name: 'Toilette',
        visual: 'toilet',
        category: 'bathroom',
        color: '#ffffff',
        widthCm: 40,
        heightCm: 45,
        depthCm: 50,
        x: 32.5,
        z: 215,
        elevationCm: 0,
        rotationYDeg: 0,
      };
      const report = evaluatePassageClearances({
        furniture: [shower, toilet],
        walls: [wall],
        corners,
      });
      const passage = report.passages.find(
        (p) =>
          (p.entity1Id === 'shower' && p.entity2Id === 'toilet') ||
          (p.entity1Id === 'toilet' && p.entity2Id === 'shower')
      );
      expect(passage).toBeUndefined();
    });

    it('does not report a passage for a dead-end corner gap between furniture side and perpendicular wall', () => {
      const corners: Corner[] = [
        { id: 'c-corner', x: 0, z: 0 },
        { id: 'c-x', x: 400, z: 0 },
        { id: 'c-z', x: 0, z: 400 },
      ];
      const wallBack: Wall = {
        id: 'w-back',
        startCornerId: 'c-corner',
        endCornerId: 'c-x',
        thicknessCm: 15,
        heightCm: 250,
      };
      const wallSide: Wall = {
        id: 'w-side',
        startCornerId: 'c-corner',
        endCornerId: 'c-z',
        thicknessCm: 15,
        heightCm: 250,
      };
      // Wardrobe against w-back: back edge at z = 7.5 cm (wall inner face)
      // Placed 10 cm from w-side (w-side inner face is at x = 7.5 cm, wardrobe left edge at x = 17.5 cm)
      const wardrobe: FurnitureItem = {
        id: 'wardrobe1',
        name: 'Wandschrank',
        visual: 'wardrobe',
        category: 'storage',
        color: '#ffffff',
        widthCm: 150,
        heightCm: 220,
        depthCm: 60,
        x: 92.5,
        z: 37.5,
        elevationCm: 0,
        rotationYDeg: 0,
        snappedWallId: 'w-back',
      };
      const report = evaluatePassageClearances({
        furniture: [wardrobe],
        walls: [wallBack, wallSide],
        corners,
      });
      const sidePassage = report.passages.find(
        (p) => p.entity1Id === 'wardrobe1' && p.entity2Id === 'w-side'
      );
      expect(sidePassage).toBeUndefined();
    });

    it('does not report passages between furniture separated by an interior partition wall', () => {
      const corners: Corner[] = [
        { id: 'c1', x: 0, z: 200 },
        { id: 'c2', x: 300, z: 200 },
      ];
      const partition: Wall = {
        id: 'w-partition',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 15,
        heightCm: 250,
      };
      const bed: FurnitureItem = {
        id: 'bed1',
        name: 'Bett',
        visual: 'bed',
        category: 'bedroom',
        color: '#ffffff',
        widthCm: 160,
        heightCm: 90,
        depthCm: 200,
        x: 150,
        z: 80,
        elevationCm: 0,
        rotationYDeg: 0,
      };
      const shower: FurnitureItem = {
        id: 'shower1',
        name: 'Duschkabine',
        visual: 'shower',
        category: 'bathroom',
        color: '#ffffff',
        widthCm: 90,
        heightCm: 200,
        depthCm: 90,
        x: 150,
        z: 280,
        elevationCm: 0,
        rotationYDeg: 0,
      };
      const report = evaluatePassageClearances({
        furniture: [bed, shower],
        walls: [partition],
        corners,
      });
      const crossPassage = report.passages.find(
        (p) =>
          (p.entity1Id === 'bed1' && p.entity2Id === 'shower1') ||
          (p.entity1Id === 'shower1' && p.entity2Id === 'bed1')
      );
      expect(crossPassage).toBeUndefined();
    });
  });
});
