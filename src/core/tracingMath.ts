export interface Point2D {
  x: number;
  z: number;
}

export interface ReferenceScaleResult {
  pixelDistance: number;
  scaleCmPerPixel: number;
  widthCm: number;
  heightCm: number;
}

export function calculateScaleFromReference(
  p1: Point2D,
  p2: Point2D,
  realDistanceCm: number,
  naturalWidthPx: number,
  naturalHeightPx: number
): ReferenceScaleResult | null {
  if (
    !Number.isFinite(realDistanceCm) || realDistanceCm <= 0 ||
    !Number.isFinite(naturalWidthPx) || naturalWidthPx <= 0 ||
    !Number.isFinite(naturalHeightPx) || naturalHeightPx <= 0 ||
    !Number.isFinite(p1?.x) || !Number.isFinite(p1?.z) ||
    !Number.isFinite(p2?.x) || !Number.isFinite(p2?.z)
  ) {
    return null;
  }
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const pixelDistance = Math.hypot(dx, dz);
  if (!Number.isFinite(pixelDistance) || pixelDistance < 1e-4) {
    return null;
  }
  const scaleCmPerPixel = realDistanceCm / pixelDistance;
  return {
    pixelDistance: Number(pixelDistance.toFixed(2)),
    scaleCmPerPixel: Number(scaleCmPerPixel.toFixed(4)),
    widthCm: Number((naturalWidthPx * scaleCmPerPixel).toFixed(1)),
    heightCm: Number((naturalHeightPx * scaleCmPerPixel).toFixed(1)),
  };
}

export function fitOverlayToViewport(
  naturalWidthPx: number,
  naturalHeightPx: number,
  viewBox: { x: number; y: number; w: number; h: number },
  defaultScaleCmPerPixel: number = 0.5
): { xCm: number; zCm: number; widthCm: number; heightCm: number } | null {
  if (
    !Number.isFinite(naturalWidthPx) || naturalWidthPx <= 0 ||
    !Number.isFinite(naturalHeightPx) || naturalHeightPx <= 0 ||
    !Number.isFinite(defaultScaleCmPerPixel) || defaultScaleCmPerPixel <= 0 ||
    !viewBox ||
    !Number.isFinite(viewBox.x) || !Number.isFinite(viewBox.y) ||
    !Number.isFinite(viewBox.w) || !Number.isFinite(viewBox.h)
  ) {
    return null;
  }
  const widthCm = Number((naturalWidthPx * defaultScaleCmPerPixel).toFixed(1));
  const heightCm = Number((naturalHeightPx * defaultScaleCmPerPixel).toFixed(1));
  const xCm = Number((viewBox.x + viewBox.w / 2).toFixed(1));
  const zCm = Number((viewBox.y + viewBox.h / 2).toFixed(1));
  return { xCm, zCm, widthCm, heightCm };
}
