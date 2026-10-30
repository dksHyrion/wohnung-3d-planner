import { describe, it, expect } from 'vitest';
import { snapAngleToOrthogonal, snapValueToGrid } from '../src/core/wallMath';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import fs from 'fs';
import path from 'path';

describe('2D Editor Precision & Orthogonal Snap (Sprint 4 Task 2)', () => {
  describe('snapAngleToOrthogonal', () => {
    const start = { x: 100, z: 100 };

    it('snaps horizontal line near 0 degrees (pointing right) to exact horizontal line', () => {
      // 3 degrees off horizontal: (100, 100) -> (400, 115) angle is approx 2.86 deg
      const snapped = snapAngleToOrthogonal(start.x, start.z, 400, 115, 6.0);
      expect(snapped.isSnapped).toBe(true);
      expect(snapped.snappedAngleDeg).toBe(0);
      expect(snapped.snappedAxis).toBe('x');
      expect(snapped.z).toBe(100); // Forced to exact start.z
      expect(snapped.x).toBe(400);
    });

    it('snaps vertical line near 90 degrees (pointing down) to exact vertical line', () => {
      // 88 degrees: (100, 100) -> (110, 500) dx=10, dz=400, angle approx 88.5 deg
      const snapped = snapAngleToOrthogonal(start.x, start.z, 110, 500, 6.0);
      expect(snapped.isSnapped).toBe(true);
      expect(snapped.snappedAngleDeg).toBe(90);
      expect(snapped.snappedAxis).toBe('z');
      expect(snapped.x).toBe(100); // Forced to exact start.x
      expect(snapped.z).toBe(500);
    });

    it('snaps horizontal line near 180 degrees (pointing left) to exact horizontal line', () => {
      // 178 degrees: (100, 100) -> (-200, 110) dx=-300, dz=10
      const snapped = snapAngleToOrthogonal(start.x, start.z, -200, 110, 6.0);
      expect(snapped.isSnapped).toBe(true);
      expect(snapped.snappedAngleDeg).toBe(180);
      expect(snapped.snappedAxis).toBe('x');
      expect(snapped.z).toBe(100);
      expect(snapped.x).toBe(-200);
    });

    it('snaps vertical line near 270 degrees (pointing up) to exact vertical line', () => {
      // 268 degrees: (100, 100) -> (90, -300) dx=-10, dz=-400
      const snapped = snapAngleToOrthogonal(start.x, start.z, 90, -300, 6.0);
      expect(snapped.isSnapped).toBe(true);
      expect(snapped.snappedAngleDeg).toBe(270);
      expect(snapped.snappedAxis).toBe('z');
      expect(snapped.x).toBe(100);
      expect(snapped.z).toBe(-300);
    });

    it('does NOT snap diagonal line far from right angle (e.g. 45 degrees)', () => {
      // 45 degrees: (100, 100) -> (300, 300)
      const snapped = snapAngleToOrthogonal(start.x, start.z, 300, 300, 6.0);
      expect(snapped.isSnapped).toBe(false);
      expect(snapped.snappedAngleDeg).toBeNull();
      expect(snapped.snappedAxis).toBeNull();
      expect(snapped.x).toBe(300);
      expect(snapped.z).toBe(300);
    });
  });

  describe('snapValueToGrid', () => {
    it('snaps values to 1cm, 5cm, 10cm, 25cm grids correctly', () => {
      expect(snapValueToGrid(123.4, 1)).toBe(123);
      expect(snapValueToGrid(123.4, 5)).toBe(125);
      expect(snapValueToGrid(121.0, 5)).toBe(120);
      expect(snapValueToGrid(124.0, 10)).toBe(120);
      expect(snapValueToGrid(126.0, 10)).toBe(130);
      expect(snapValueToGrid(137.0, 25)).toBe(125);
      expect(snapValueToGrid(138.0, 25)).toBe(150);
    });
  });

  describe('Store Grid & Ortho Snap Integration', () => {
    it('initializes with default gridSizeCm = 5 and orthoSnapEnabled = true', () => {
      const state = useFloorplanStore.getState();
      expect(state.gridSizeCm).toBe(5);
      expect(state.orthoSnapEnabled).toBe(true);
    });

    it('updates gridSizeCm and orthoSnapEnabled through store actions', () => {
      const state = useFloorplanStore.getState();
      state.setGridSizeCm(10);
      expect(useFloorplanStore.getState().gridSizeCm).toBe(10);

      state.setOrthoSnapEnabled(false);
      expect(useFloorplanStore.getState().orthoSnapEnabled).toBe(false);

      // Reset back
      state.setGridSizeCm(5);
      state.setOrthoSnapEnabled(true);
    });
  });

  describe('Documentation Integrity: Honest Interior Area (Befund 6)', () => {
    it('README.md uses honest "Lichte Innenfläche" instead of misleading "WoFlV"', () => {
      const readmePath = path.resolve(__dirname, '../README.md');
      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).not.toContain('WoFlV');
      expect(content).toContain('Lichte Innenfläche');
    });
  });
});
