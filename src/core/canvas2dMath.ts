import { snapAngleToOrthogonal } from './wallMath';

export interface CanvasViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Matrix2DLike {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/**
 * Converts client pointer coordinates into SVG world coordinates (cm),
 * using an inverse screen CTM when available and falling back to
 * exact `preserveAspectRatio="xMidYMid meet"` mapping.
 */
export function clientPointToSvgWorldCm(
  clientX: number,
  clientY: number,
  rect: RectLike,
  viewBox: CanvasViewBox,
  screenCtmInverse?: Matrix2DLike | null
): { x: number; z: number } {
  if (screenCtmInverse) {
    const x = screenCtmInverse.a * clientX + screenCtmInverse.c * clientY + screenCtmInverse.e;
    const z = screenCtmInverse.b * clientX + screenCtmInverse.d * clientY + screenCtmInverse.f;
    if (Number.isFinite(x) && Number.isFinite(z)) {
      return {
        x: Number(x.toFixed(1)),
        z: Number(z.toFixed(1)),
      };
    }
  }

  if (rect.width <= 0 || rect.height <= 0 || viewBox.w <= 0 || viewBox.h <= 0) {
    return { x: 0, z: 0 };
  }

  const scale = Math.min(rect.width / viewBox.w, rect.height / viewBox.h);
  const renderedW = viewBox.w * scale;
  const renderedH = viewBox.h * scale;
  const offsetX = rect.left + (rect.width - renderedW) / 2;
  const offsetY = rect.top + (rect.height - renderedH) / 2;

  return {
    x: Number((viewBox.x + (clientX - offsetX) / scale).toFixed(1)),
    z: Number((viewBox.y + (clientY - offsetY) / scale).toFixed(1)),
  };
}

/**
 * Converts a pointer drag delta in screen pixels into world cm delta
 * respecting `preserveAspectRatio="xMidYMid meet"`.
 */
export function clientDeltaToWorldDelta(
  dxPx: number,
  dyPx: number,
  rect: RectLike,
  viewBox: CanvasViewBox
): { dxCm: number; dzCm: number } {
  if (rect.width <= 0 || rect.height <= 0 || viewBox.w <= 0 || viewBox.h <= 0) {
    return { dxCm: 0, dzCm: 0 };
  }
  const scale = Math.min(rect.width / viewBox.w, rect.height / viewBox.h);
  return {
    dxCm: dxPx / scale,
    dzCm: dyPx / scale,
  };
}

/**
 * Zooms a viewBox by `factor` while keeping `anchorWorldPt` stationary under the cursor.
 */
export function zoomViewBoxAtPoint(
  viewBox: CanvasViewBox,
  anchorWorldPt: { x: number; z: number },
  factor: number,
  minW = 250,
  maxW = 3000
): CanvasViewBox {
  const nextW = Math.min(maxW, Math.max(minW, viewBox.w * factor));
  const actualFactor = nextW / viewBox.w;
  const nextH = viewBox.h * actualFactor;

  const relX = (anchorWorldPt.x - viewBox.x) / viewBox.w;
  const relZ = (anchorWorldPt.z - viewBox.y) / viewBox.h;

  return {
    x: anchorWorldPt.x - relX * nextW,
    y: anchorWorldPt.z - relZ * nextH,
    w: nextW,
    h: nextH,
  };
}

/**
 * Computes a wall endpoint at an exact `targetLengthCm` along the cursor's
 * (optionally ortho-snapped) direction from `start`.
 */
export function computeWallEndpointFromLength(
  start: { x: number; z: number },
  cursor: { x: number; z: number },
  targetLengthCm: number,
  orthoSnapEnabled: boolean,
  shiftKey = false
): { x: number; z: number } {
  const safeLen = Math.max(10, targetLengthCm);
  let targetX = cursor.x;
  let targetZ = cursor.z;

  if (orthoSnapEnabled || shiftKey) {
    const snapped = snapAngleToOrthogonal(
      start.x,
      start.z,
      cursor.x,
      cursor.z,
      shiftKey ? 45.0 : 7.0
    );
    if (snapped.isSnapped) {
      targetX = snapped.x;
      targetZ = snapped.z;
    }
  }

  const dx = targetX - start.x;
  const dz = targetZ - start.z;
  const dist = Math.hypot(dx, dz);
  const ux = dist >= 1 ? dx / dist : 1;
  const uz = dist >= 1 ? dz / dist : 0;

  return {
    x: Number((start.x + ux * safeLen).toFixed(2)),
    z: Number((start.z + uz * safeLen).toFixed(2)),
  };
}
