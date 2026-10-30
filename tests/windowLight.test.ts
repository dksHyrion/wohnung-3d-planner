import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  WINDOW_LIGHT_POOL_DEPTH_CM,
  windowLightPoolCenter,
  windowLightPoolOpacity,
  windowLightPoolRotation,
} from '../src/core/windowLight';

function poolFacing(inwardSign: 1 | -1): { brightZ: number; normalY: number } {
  const obj = new THREE.Object3D();
  const [rx, ry, rz] = windowLightPoolRotation(inwardSign);
  obj.rotation.set(rx, ry, rz);
  obj.updateMatrixWorld(true);
  const tip = new THREE.Vector3(0, 1, 0).applyMatrix4(obj.matrixWorld);
  const normal = new THREE.Vector3(0, 0, 1).transformDirection(obj.matrixWorld);
  return { brightZ: tip.z, normalY: normal.y };
}

describe('Fensterlicht auf dem Boden', () => {
  it('bleibt bei Nacht fast unsichtbar und am Morgen ruhig sichtbar', () => {
    expect(windowLightPoolOpacity(0)).toBe(0);
    expect(windowLightPoolOpacity(0.5)).toBeCloseTo(0.035);
    expect(windowLightPoolOpacity(2.5)).toBeCloseTo(0.175);
    expect(windowLightPoolOpacity(8)).toBe(0.28);
  });

  it('legt den Fleck innen vor das Fenster, nicht in die Wand', () => {
    const pool = windowLightPoolCenter({
      offsetFromStartCm: 100,
      widthCm: 120,
      wallLengthCm: 400,
      wallThicknessCm: 15,
      inwardSign: 1,
    });
    expect(pool.x).toBeCloseTo(100 + 60 - 200);
    expect(pool.z).toBeCloseTo(15 / 2 + 4 + WINDOW_LIGHT_POOL_DEPTH_CM / 2);
    expect(pool.widthCm).toBeCloseTo(108);
    expect(pool.depthCm).toBe(WINDOW_LIGHT_POOL_DEPTH_CM);
  });

  it('zeigt die helle Kante zur Wand und die Fläche nach oben', () => {
    const intoPlusZ = poolFacing(1);
    expect(intoPlusZ.brightZ).toBeLessThan(-0.9);
    expect(intoPlusZ.normalY).toBeGreaterThan(0.9);

    const intoMinusZ = poolFacing(-1);
    expect(intoMinusZ.brightZ).toBeGreaterThan(0.9);
    expect(intoMinusZ.normalY).toBeGreaterThan(0.9);
  });
});
