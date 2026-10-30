import { describe, it, expect } from 'vitest';
import {
  calculateScaleFromReference,
  fitOverlayToViewport,
  type Point2D,
  type ReferenceScaleResult,
} from '../src/core/tracingMath';

describe('tracingMath', () => {
  describe('calculateScaleFromReference', () => {
    it('calculates scale correctly for a horizontal reference line', () => {
      const p1: Point2D = { x: 0, z: 0 };
      const p2: Point2D = { x: 100, z: 0 };
      const realDistanceCm = 200;
      const naturalWidthPx = 1000;
      const naturalHeightPx = 800;

      const result: ReferenceScaleResult | null = calculateScaleFromReference(
        p1,
        p2,
        realDistanceCm,
        naturalWidthPx,
        naturalHeightPx
      );

      expect(result).not.toBeNull();
      expect(result).toEqual({
        pixelDistance: 100,
        scaleCmPerPixel: 2,
        widthCm: 2000,
        heightCm: 1600,
      });
    });

    it('calculates scale correctly for a diagonal reference line (3-4-5 triangle)', () => {
      const p1: Point2D = { x: 100, z: 100 };
      const p2: Point2D = { x: 400, z: 500 }; // dx = 300, dz = 400, dist = 500
      const realDistanceCm = 250;
      const naturalWidthPx = 1200;
      const naturalHeightPx = 800;

      const result = calculateScaleFromReference(
        p1,
        p2,
        realDistanceCm,
        naturalWidthPx,
        naturalHeightPx
      );

      expect(result).not.toBeNull();
      expect(result).toEqual({
        pixelDistance: 500,
        scaleCmPerPixel: 0.5,
        widthCm: 600,
        heightCm: 400,
      });
    });

    it('rounds pixelDistance to 2 decimals, scale to 4 decimals, dimensions to 1 decimal', () => {
      const p1: Point2D = { x: 0, z: 0 };
      const p2: Point2D = { x: 33.333, z: 44.444 }; // hypot ~ 55.5548
      const realDistanceCm = 100;
      const naturalWidthPx = 1024;
      const naturalHeightPx = 768;

      const result = calculateScaleFromReference(
        p1,
        p2,
        realDistanceCm,
        naturalWidthPx,
        naturalHeightPx
      );

      expect(result).not.toBeNull();
      expect(result?.pixelDistance).toBe(55.56);
      // 100 / 55.555... ≈ 1.8000
      expect(result?.scaleCmPerPixel).toBeCloseTo(1.8, 3);
      expect(typeof result?.widthCm).toBe('number');
      expect(typeof result?.heightCm).toBe('number');
    });

    it('returns null when realDistanceCm is zero or negative', () => {
      const p1: Point2D = { x: 0, z: 0 };
      const p2: Point2D = { x: 100, z: 0 };

      expect(calculateScaleFromReference(p1, p2, 0, 1000, 800)).toBeNull();
      expect(calculateScaleFromReference(p1, p2, -50, 1000, 800)).toBeNull();
    });

    it('returns null when natural dimensions are zero or negative', () => {
      const p1: Point2D = { x: 0, z: 0 };
      const p2: Point2D = { x: 100, z: 0 };

      expect(calculateScaleFromReference(p1, p2, 100, 0, 800)).toBeNull();
      expect(calculateScaleFromReference(p1, p2, 100, -100, 800)).toBeNull();
      expect(calculateScaleFromReference(p1, p2, 100, 1000, 0)).toBeNull();
      expect(calculateScaleFromReference(p1, p2, 100, 1000, -50)).toBeNull();
    });

    it('returns null when reference points are virtually identical (pixelDistance < 1e-4)', () => {
      const p1: Point2D = { x: 50, z: 50 };
      const p2: Point2D = { x: 50, z: 50 };

      expect(calculateScaleFromReference(p1, p2, 100, 1000, 800)).toBeNull();

      const pAlmostSame: Point2D = { x: 50.00001, z: 50 };
      expect(calculateScaleFromReference(p1, pAlmostSame, 100, 1000, 800)).toBeNull();
    });

    it('returns null when inputs contain NaN or Infinity', () => {
      const p1: Point2D = { x: 0, z: 0 };
      const p2: Point2D = { x: 100, z: 0 };

      expect(calculateScaleFromReference(p1, p2, NaN, 1000, 800)).toBeNull();
      expect(calculateScaleFromReference(p1, p2, Infinity, 1000, 800)).toBeNull();
      expect(calculateScaleFromReference(p1, p2, -Infinity, 1000, 800)).toBeNull();

      expect(calculateScaleFromReference(p1, p2, 100, NaN, 800)).toBeNull();
      expect(calculateScaleFromReference(p1, p2, 100, Infinity, 800)).toBeNull();
      expect(calculateScaleFromReference(p1, p2, 100, 1000, NaN)).toBeNull();
      expect(calculateScaleFromReference(p1, p2, 100, 1000, Infinity)).toBeNull();

      expect(calculateScaleFromReference({ x: NaN, z: 0 }, p2, 100, 1000, 800)).toBeNull();
      expect(calculateScaleFromReference({ x: 0, z: Infinity }, p2, 100, 1000, 800)).toBeNull();
      expect(calculateScaleFromReference(p1, { x: -Infinity, z: 0 }, 100, 1000, 800)).toBeNull();
      expect(calculateScaleFromReference(p1, { x: 100, z: NaN }, 100, 1000, 800)).toBeNull();
    });
  });

  describe('fitOverlayToViewport', () => {
    it('centers overlay in viewport with default scale factor (0.5 cm/px)', () => {
      const naturalWidthPx = 1000;
      const naturalHeightPx = 800;
      const viewBox = { x: -200, y: -100, w: 600, h: 400 };

      const result = fitOverlayToViewport(naturalWidthPx, naturalHeightPx, viewBox);

      // Center x = viewBox.x + viewBox.w / 2 = -200 + 300 = 100
      // Center z = viewBox.y + viewBox.h / 2 = -100 + 200 = 100
      // widthCm = 1000 * 0.5 = 500
      // heightCm = 800 * 0.5 = 400
      expect(result).toEqual({
        xCm: 100,
        zCm: 100,
        widthCm: 500,
        heightCm: 400,
      });
    });

    it('respects custom defaultScaleCmPerPixel', () => {
      const naturalWidthPx = 800;
      const naturalHeightPx = 600;
      const viewBox = { x: 0, y: 0, w: 1000, h: 1000 };
      const customScale = 0.25;

      const result = fitOverlayToViewport(naturalWidthPx, naturalHeightPx, viewBox, customScale);

      expect(result).toEqual({
        xCm: 500,
        zCm: 500,
        widthCm: 200,
        heightCm: 150,
      });
    });

    it('formats coordinates and dimensions to 1 decimal place', () => {
      const naturalWidthPx = 333;
      const naturalHeightPx = 555;
      const viewBox = { x: 10.333, y: 20.666, w: 100.1, h: 200.3 };

      const result = fitOverlayToViewport(naturalWidthPx, naturalHeightPx, viewBox, 0.3333);

      expect(result).not.toBeNull();
      expect(result?.xCm).toBe(Number((10.333 + 50.05).toFixed(1)));
      expect(result?.zCm).toBe(Number((20.666 + 100.15).toFixed(1)));
      expect(result?.widthCm).toBe(Number((333 * 0.3333).toFixed(1)));
      expect(result?.heightCm).toBe(Number((555 * 0.3333).toFixed(1)));
    });

    it('returns null when dimensions or scale are non-positive or non-finite', () => {
      const validViewBox = { x: 0, y: 0, w: 1000, h: 1000 };

      // Non-positive naturalWidthPx / naturalHeightPx
      expect(fitOverlayToViewport(0, 800, validViewBox)).toBeNull();
      expect(fitOverlayToViewport(-100, 800, validViewBox)).toBeNull();
      expect(fitOverlayToViewport(1000, 0, validViewBox)).toBeNull();
      expect(fitOverlayToViewport(1000, -50, validViewBox)).toBeNull();

      // Non-positive defaultScaleCmPerPixel
      expect(fitOverlayToViewport(1000, 800, validViewBox, 0)).toBeNull();
      expect(fitOverlayToViewport(1000, 800, validViewBox, -0.5)).toBeNull();

      // NaN or Infinity
      expect(fitOverlayToViewport(NaN, 800, validViewBox)).toBeNull();
      expect(fitOverlayToViewport(1000, Infinity, validViewBox)).toBeNull();
      expect(fitOverlayToViewport(1000, 800, validViewBox, NaN)).toBeNull();
      expect(fitOverlayToViewport(1000, 800, validViewBox, Infinity)).toBeNull();

      // Invalid viewBox
      expect(fitOverlayToViewport(1000, 800, { x: NaN, y: 0, w: 100, h: 100 })).toBeNull();
      expect(fitOverlayToViewport(1000, 800, { x: 0, y: Infinity, w: 100, h: 100 })).toBeNull();
    });
  });
});
