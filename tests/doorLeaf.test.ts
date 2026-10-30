import { describe, expect, it } from 'vitest';
import {
  DOOR_LEAF_OPEN_RAD,
  doorLeafPose,
  doorSwingArcPoints,
} from '../src/core/doorLeaf';
import { WallOpening } from '../src/core/types';

function opening(
  swing: WallOpening['swingDirection']
): WallOpening {
  return {
    id: 'op',
    wallId: 'w',
    type: 'door',
    offsetFromStartCm: 100,
    widthCm: 86,
    heightCm: 200,
    sillHeightCm: 0,
    swingDirection: swing,
  };
}

describe('Türblatt', () => {
  it('schlägt nach innen links zur Wandnormalen auf', () => {
    const pose = doorLeafPose(opening('in-left'), 400);
    expect(pose.hingeX).toBe(-100);
    expect(pose.leafCenterX).toBeGreaterThan(0);
    expect(pose.rotationYRad).toBeCloseTo(-DOOR_LEAF_OPEN_RAD);
    expect(pose.leafCenterY).toBe(100);
    expect(pose.leafWidthCm).toBeCloseTo(84.8);
  });

  it('setzt das Band bei Aufschlag nach innen rechts ans andere Ende', () => {
    const pose = doorLeafPose(opening('in-right'), 400);
    expect(pose.hingeX).toBeCloseTo(-14);
    expect(pose.leafCenterX).toBeLessThan(0);
    expect(pose.rotationYRad).toBeCloseTo(DOOR_LEAF_OPEN_RAD);
  });

  it('dreht nach außen links von der Wandnormalen weg', () => {
    const pose = doorLeafPose(opening('out-left'), 400);
    expect(pose.hingeX).toBe(-100);
    expect(pose.rotationYRad).toBeCloseTo(DOOR_LEAF_OPEN_RAD);
  });

  it('legt den Bodenbogen vom geschlossenen Ende bis zum offenen Blatt', () => {
    const points = doorSwingArcPoints(opening('in-left'), 400);
    const pose = doorLeafPose(opening('in-left'), 400);
    const end = points[points.length - 1];
    expect(points[0].x).toBeCloseTo(pose.hingeX + pose.leafWidthCm);
    expect(points[0].z).toBeCloseTo(0);
    expect(end.z).toBeGreaterThan(pose.leafWidthCm * 0.9);
    expect(end.x).toBeLessThan(points[0].x);

    const outward = doorSwingArcPoints(opening('out-left'), 400);
    expect(outward[outward.length - 1].z).toBeLessThan(0);
  });
});
