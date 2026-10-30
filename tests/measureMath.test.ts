import { describe, it, expect } from 'vitest';
import {
  computePointDistanceCm,
  computeFurnitureClearanceCm,
  computeFurnitureToWallDistanceCm,
  formatMeasureDimension,
} from '../src/core/measureMath';
import { FurnitureItem, Wall, Corner } from '../src/core/types';

describe('Measure Math Core (Sprint 4 Task 1)', () => {
  describe('computePointDistanceCm', () => {
    it('computes exact Euclidean distance and delta components between two 2D points', () => {
      const p1 = { x: 100, z: 200 };
      const p2 = { x: 400, z: 600 };
      const result = computePointDistanceCm(p1, p2);

      // dx = 300, dz = 400, distance = sqrt(300^2 + 400^2) = 500
      expect(result.dxCm).toBe(300);
      expect(result.dzCm).toBe(400);
      expect(result.distanceCm).toBe(500);
      expect(result.formattedDistance).toBe('500 cm');
    });

    it('handles identical points gracefully with 0 distance', () => {
      const p1 = { x: 150.5, z: 220 };
      const result = computePointDistanceCm(p1, p1);
      expect(result.distanceCm).toBe(0);
      expect(result.dxCm).toBe(0);
      expect(result.dzCm).toBe(0);
      expect(result.formattedDistance).toBe('0 cm');
    });

    it('formats large dimensions over 10m cleanly in meters', () => {
      expect(formatMeasureDimension(145)).toBe('145 cm');
      expect(formatMeasureDimension(1250)).toBe('12,50 m');
    });
  });

  describe('computeFurnitureClearanceCm (Edge-to-Edge Furniture Gap)', () => {
    it('calculates exact gap between two parallel furniture items separated along X axis', () => {
      // Item 1: Center at (100, 200), width=120 (extends x: 40..160), depth=80 (z: 160..240)
      const f1: FurnitureItem = {
        id: 'f1',
        name: 'Desk',
        category: 'office',
        widthCm: 120,
        heightCm: 75,
        depthCm: 80,
        x: 100,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
      };

      // Item 2: Center at (300, 200), width=100 (extends x: 250..350), depth=80 (z: 160..240)
      // Gap between x=160 and x=250 is exactly 90 cm
      const f2: FurnitureItem = {
        id: 'f2',
        name: 'Shelf',
        category: 'storage',
        widthCm: 100,
        heightCm: 200,
        depthCm: 80,
        x: 300,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
      };

      const clearance = computeFurnitureClearanceCm(f1, f2);
      expect(clearance.isOverlapping).toBe(false);
      expect(clearance.clearanceCm).toBeCloseTo(90, 1);
      expect(clearance.closestPoint1.x).toBeCloseTo(160, 1);
      expect(clearance.closestPoint2.x).toBeCloseTo(250, 1);
    });

    it('calculates exact gap between two parallel furniture items separated along Z axis', () => {
      // Sofa at z=100, depth=90 (z: 55..145)
      const sofa: FurnitureItem = {
        id: 'f-sofa',
        name: 'Sofa',
        category: 'living',
        widthCm: 220,
        heightCm: 85,
        depthCm: 90,
        x: 200,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
      };

      // Coffee table at z=200, depth=60 (z: 170..230)
      // Gap between z=145 and z=170 is exactly 25 cm (Durchgang Sofa-Couchtisch)
      const table: FurnitureItem = {
        id: 'f-table',
        name: 'Coffee Table',
        category: 'living',
        widthCm: 120,
        heightCm: 45,
        depthCm: 60,
        x: 200,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
      };

      const clearance = computeFurnitureClearanceCm(sofa, table);
      expect(clearance.isOverlapping).toBe(false);
      expect(clearance.clearanceCm).toBeCloseTo(25, 1);
    });

    it('reports isOverlapping: true and clearanceCm: 0 when items intersect', () => {
      const f1: FurnitureItem = {
        id: 'f1',
        name: 'Item 1',
        category: 'living',
        widthCm: 100,
        heightCm: 50,
        depthCm: 100,
        x: 100,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
      };

      const f2: FurnitureItem = {
        id: 'f2',
        name: 'Item 2',
        category: 'living',
        widthCm: 100,
        heightCm: 50,
        depthCm: 100,
        x: 140, // Overlaps by 60cm
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
      };

      const clearance = computeFurnitureClearanceCm(f1, f2);
      expect(clearance.isOverlapping).toBe(true);
      expect(clearance.clearanceCm).toBe(0);
    });

    it('correctly accounts for 90-degree rotated furniture bounding geometry', () => {
      // Item rotated 90 degrees: effective width is depth (80) and effective depth is width (200)
      const rotatedItem: FurnitureItem = {
        id: 'f-rot',
        name: 'Rotated Wardrobe',
        category: 'storage',
        widthCm: 200,
        heightCm: 220,
        depthCm: 60,
        x: 100,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 90,
        color: '#ffffff',
      };

      // Item 2 placed at x=200, z=200, width=80 (x: 160..240), depth=80
      // For rotatedItem, rotation 90deg swaps X halfSize to 30 (x: 70..130)
      // Gap to x=160 should be 160 - 130 = 30 cm
      const item2: FurnitureItem = {
        id: 'f-other',
        name: 'Other',
        category: 'storage',
        widthCm: 80,
        heightCm: 100,
        depthCm: 80,
        x: 200,
        z: 200,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
      };

      const clearance = computeFurnitureClearanceCm(rotatedItem, item2);
      expect(clearance.isOverlapping).toBe(false);
      expect(clearance.clearanceCm).toBeCloseTo(30, 1);
    });

    it('respects the open inner corner of a sectional L-sofa (layoutFurnitureParts)', () => {
      const lSofa: FurnitureItem = {
        id: 'f-lsofa',
        name: 'Ecksofa L-Form',
        category: 'living',
        widthCm: 240,
        heightCm: 80,
        depthCm: 160,
        x: 0,
        z: 0,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#94a3b8',
        visual: 'sectional-sofa',
      };

      // Small coffee table placed in the open left-front corner (x=-50, z=48)
      // Inside bounding box of 240x160, but outside both main (z: -80..16) and chaise (x: 19.2..120)
      const tableInOpenCorner: FurnitureItem = {
        id: 'f-table-open',
        name: 'Beistelltisch',
        category: 'living',
        widthCm: 20,
        heightCm: 45,
        depthCm: 20,
        x: -50,
        z: 48,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#cbd5e1',
      };

      const clearance = computeFurnitureClearanceCm(lSofa, tableInOpenCorner);
      expect(clearance.isOverlapping).toBe(false);
      expect(clearance.clearanceCm).toBeGreaterThan(20);
    });
  });

  describe('computeFurnitureToWallDistanceCm', () => {
    it('computes perpendicular distance from furniture edge to a wall accounting for wall thickness', () => {
      const corners: Corner[] = [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 600, z: 0 },
      ];
      // Wall along z=0 with thickness 15cm (extends to z=7.5)
      const wall: Wall = {
        id: 'w1',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 15,
        heightCm: 280,
      };

      // Furniture at x=300, z=60, width=120, depth=60
      // Furthest edge towards wall is at z = 60 - 30 = 30
      // Wall surface is at z = 7.5
      // Distance is 30 - 7.5 = 22.5 cm
      const furniture: FurnitureItem = {
        id: 'f-desk',
        name: 'Desk',
        category: 'office',
        widthCm: 120,
        heightCm: 75,
        depthCm: 60,
        x: 300,
        z: 60,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#ffffff',
      };

      const dist = computeFurnitureToWallDistanceCm(furniture, wall, corners);
      expect(dist).toBeCloseTo(22.5, 1);
    });
  });
});
