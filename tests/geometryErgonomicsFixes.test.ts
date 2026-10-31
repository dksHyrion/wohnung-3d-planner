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
});
