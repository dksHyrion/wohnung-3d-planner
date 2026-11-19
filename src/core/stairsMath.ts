import type { BuildingLevel, Staircase } from './types';

export interface PointXZ {
  x: number;
  z: number;
}

export interface StairBoxGeometry {
  x: number;
  z: number;
  yBottomCm: number;
  yTopCm: number;
  widthCm: number;
  depthCm: number;
  rotationYDeg: number;
}

export interface StairTreadLine {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface StairRailingPost {
  x: number;
  z: number;
  yBottomCm: number;
  heightCm: number;
}

export interface StairGeometry {
  totalRiseCm: number;
  riserCount: number;
  riserHeightCm: number;
  treadDepthCm: number;
  strideMeasureCm: number;
  din18065Ok: boolean;
  steps: StairBoxGeometry[];
  landings: StairBoxGeometry[];
  railingPosts: StairRailingPost[];
  footprintPolygonXZ: PointXZ[];
  openingPolygonXZ: PointXZ[];
  treadLines: StairTreadLine[];
  walkArrowPolylineXZ: PointXZ[];
  entryPointXZ: PointXZ;
  exitPointXZ: PointXZ;
}

function rotatePointXZ(
  lx: number,
  lz: number,
  cx: number,
  cz: number,
  cos: number,
  sin: number
): PointXZ {
  return {
    x: Number((cx + lx * cos + lz * sin).toFixed(2)),
    z: Number((cz - lx * sin + lz * cos).toFixed(2)),
  };
}

function rectCornersLocal(
  cx: number,
  cz: number,
  widthCm: number,
  depthCm: number
): PointXZ[] {
  const hw = widthCm / 2;
  const hd = depthCm / 2;
  return [
    { x: cx - hw, z: cz - hd },
    { x: cx + hw, z: cz - hd },
    { x: cx + hw, z: cz + hd },
    { x: cx - hw, z: cz + hd },
  ];
}

function boundingRectLocal(points: PointXZ[]): PointXZ[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ },
  ];
}

export function computeStairGeometry(
  stair: Staircase,
  fromLevel?: BuildingLevel,
  toLevel?: BuildingLevel
): StairGeometry {
  const totalRiseCm =
    toLevel && fromLevel
      ? Math.max(20, Math.abs(toLevel.elevationCm - fromLevel.elevationCm))
      : fromLevel
      ? Math.max(20, fromLevel.ceilingHeightCm + fromLevel.slabThicknessCm)
      : 272;

  const riserCount =
    stair.riserCount !== undefined && Number.isFinite(stair.riserCount) && stair.riserCount >= 3
      ? Math.round(stair.riserCount)
      : Math.max(4, Math.round(totalRiseCm / 18));

  const riserHeightCm = Number((totalRiseCm / riserCount).toFixed(3));
  const treadDepthCm =
    stair.treadDepthCm > 0 && Number.isFinite(stair.treadDepthCm)
      ? stair.treadDepthCm
      : 27;
  const widthCm =
    stair.widthCm > 0 && Number.isFinite(stair.widthCm) ? stair.widthCm : 100;

  const strideMeasureCm = Number((2 * riserHeightCm + treadDepthCm).toFixed(2));
  const din18065Ok =
    strideMeasureCm >= 59 &&
    strideMeasureCm <= 65 &&
    riserHeightCm >= 14 &&
    riserHeightCm <= 20.5 &&
    treadDepthCm >= 23;

  const rad = (stair.rotationYDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const toWorld = (lx: number, lz: number) =>
    rotatePointXZ(lx, lz, stair.x, stair.z, cos, sin);

  interface LocalBox {
    lx: number;
    lz: number;
    yBottomCm: number;
    yTopCm: number;
    widthCm: number;
    depthCm: number;
    localRotDeg: number;
  }

  const localSteps: LocalBox[] = [];
  const localLandings: LocalBox[] = [];
  const localTreads: { x1: number; z1: number; x2: number; z2: number }[] = [];
  const localArrow: PointXZ[] = [];
  let rawFootprintLocal: PointXZ[] = [];

  const landingLen = Math.max(
    60,
    stair.landingLengthCm && Number.isFinite(stair.landingLengthCm)
      ? stair.landingLengthCm
      : widthCm
  );
  const turnSign = stair.turnDirection === 'left' ? -1 : 1;

  if (stair.type === 'straight') {
    const totalRun = riserCount * treadDepthCm;
    const zStart = -totalRun / 2;
    for (let i = 0; i < riserCount; i++) {
      const lz = zStart + (i + 0.5) * treadDepthCm;
      localSteps.push({
        lx: 0,
        lz,
        yBottomCm: Number((i * riserHeightCm).toFixed(2)),
        yTopCm: Number(((i + 1) * riserHeightCm).toFixed(2)),
        widthCm,
        depthCm: treadDepthCm,
        localRotDeg: 0,
      });
      if (i > 0) {
        const edgeZ = zStart + i * treadDepthCm;
        localTreads.push({ x1: -widthCm / 2, z1: edgeZ, x2: widthCm / 2, z2: edgeZ });
      }
    }
    rawFootprintLocal = rectCornersLocal(0, 0, widthCm, totalRun);
    localArrow.push({ x: 0, z: zStart + 10 }, { x: 0, z: -zStart - 10 });
  } else if (stair.type === 'l-shaped') {
    const n1 = Math.max(1, Math.floor((riserCount - 1) / 2));
    const n2 = Math.max(1, riserCount - n1 - 1);
    const run1 = n1 * treadDepthCm;
    const run2 = n2 * treadDepthCm;

    // Raw frame before centering:
    // Flight 1 climbs +Z from z=0..run1, centered at x=0
    // Landing covers x in [-w/2, +w/2], z in [run1, run1 + landingLen] (step n1 -> n1+1)
    // Flight 2 climbs along turnSign * X from x=turnSign*(w/2) to turnSign*(w/2 + run2), z in [run1 + landingLen - w, run1 + landingLen]
    const f2CenterZ = run1 + landingLen - widthCm / 2;
    const landingCenterZ = run1 + landingLen / 2;

    const allPts: PointXZ[] = [
      ...rectCornersLocal(0, run1 / 2, widthCm, run1),
      ...rectCornersLocal(0, landingCenterZ, widthCm, landingLen),
      ...rectCornersLocal(turnSign * (widthCm / 2 + run2 / 2), f2CenterZ, run2, widthCm),
    ];
    const bbox = boundingRectLocal(allPts);
    const cxOff = (bbox[0].x + bbox[1].x) / 2;
    const czOff = (bbox[0].z + bbox[2].z) / 2;

    for (let i = 0; i < n1; i++) {
      const lz = (i + 0.5) * treadDepthCm - czOff;
      localSteps.push({
        lx: -cxOff,
        lz,
        yBottomCm: Number((i * riserHeightCm).toFixed(2)),
        yTopCm: Number(((i + 1) * riserHeightCm).toFixed(2)),
        widthCm,
        depthCm: treadDepthCm,
        localRotDeg: 0,
      });
      const edgeZ = (i + 1) * treadDepthCm - czOff;
      localTreads.push({ x1: -widthCm / 2 - cxOff, z1: edgeZ, x2: widthCm / 2 - cxOff, z2: edgeZ });
    }

    const landingTopY = Number(((n1 + 1) * riserHeightCm).toFixed(2));
    localLandings.push({
      lx: -cxOff,
      lz: landingCenterZ - czOff,
      yBottomCm: Number((n1 * riserHeightCm).toFixed(2)),
      yTopCm: landingTopY,
      widthCm,
      depthCm: landingLen,
      localRotDeg: 0,
    });

    for (let j = 0; j < n2; j++) {
      const stepIdx = n1 + 1 + j;
      const lx = turnSign * (widthCm / 2 + (j + 0.5) * treadDepthCm) - cxOff;
      localSteps.push({
        lx,
        lz: f2CenterZ - czOff,
        yBottomCm: Number((stepIdx * riserHeightCm).toFixed(2)),
        yTopCm: Number(((stepIdx + 1) * riserHeightCm).toFixed(2)),
        widthCm,
        depthCm: treadDepthCm,
        localRotDeg: turnSign * 90,
      });
      const edgeX = turnSign * (widthCm / 2 + j * treadDepthCm) - cxOff;
      localTreads.push({
        x1: edgeX,
        z1: f2CenterZ - widthCm / 2 - czOff,
        x2: edgeX,
        z2: f2CenterZ + widthCm / 2 - czOff,
      });
    }

    // Exact 6-corner L polygon (CCW / ordered perimeter)
    const xL = -widthCm / 2 - cxOff;
    const xR = widthCm / 2 - cxOff;
    const xEnd = turnSign * (widthCm / 2 + run2) - cxOff;
    const z0 = -czOff;
    const zF2Start = f2CenterZ - widthCm / 2 - czOff;
    const zTop = run1 + landingLen - czOff;
    rawFootprintLocal =
      turnSign > 0
        ? [
            { x: xL, z: z0 },
            { x: xR, z: z0 },
            { x: xR, z: zF2Start },
            { x: xEnd, z: zF2Start },
            { x: xEnd, z: zTop },
            { x: xL, z: zTop },
          ]
        : [
            { x: xL, z: z0 },
            { x: xR, z: z0 },
            { x: xR, z: zTop },
            { x: xEnd, z: zTop },
            { x: xEnd, z: zF2Start },
            { x: xL, z: zF2Start },
          ];

    localArrow.push(
      { x: -cxOff, z: 10 - czOff },
      { x: -cxOff, z: f2CenterZ - czOff },
      { x: xEnd - turnSign * 10, z: f2CenterZ - czOff }
    );
  } else {
    // u-shaped
    const gap = 12;
    const n1 = Math.max(1, Math.floor((riserCount - 1) / 2));
    const n2 = Math.max(1, riserCount - n1 - 1);
    const run1 = n1 * treadDepthCm;
    const run2 = n2 * treadDepthCm;
    const maxRun = Math.max(run1, run2);

    const xF1 = -turnSign * (widthCm / 2 + gap / 2);
    const xF2 = turnSign * (widthCm / 2 + gap / 2);
    const totalW = widthCm * 2 + gap;
    const czOff = (maxRun + landingLen) / 2;

    for (let i = 0; i < n1; i++) {
      const lz = maxRun - run1 + (i + 0.5) * treadDepthCm - czOff;
      localSteps.push({
        lx: xF1,
        lz,
        yBottomCm: Number((i * riserHeightCm).toFixed(2)),
        yTopCm: Number(((i + 1) * riserHeightCm).toFixed(2)),
        widthCm,
        depthCm: treadDepthCm,
        localRotDeg: 0,
      });
      const edgeZ = maxRun - run1 + (i + 1) * treadDepthCm - czOff;
      localTreads.push({ x1: xF1 - widthCm / 2, z1: edgeZ, x2: xF1 + widthCm / 2, z2: edgeZ });
    }

    localLandings.push({
      lx: 0,
      lz: maxRun + landingLen / 2 - czOff,
      yBottomCm: Number((n1 * riserHeightCm).toFixed(2)),
      yTopCm: Number(((n1 + 1) * riserHeightCm).toFixed(2)),
      widthCm: totalW,
      depthCm: landingLen,
      localRotDeg: 0,
    });

    for (let j = 0; j < n2; j++) {
      const stepIdx = n1 + 1 + j;
      const lz = maxRun - (j + 0.5) * treadDepthCm - czOff;
      localSteps.push({
        lx: xF2,
        lz,
        yBottomCm: Number((stepIdx * riserHeightCm).toFixed(2)),
        yTopCm: Number(((stepIdx + 1) * riserHeightCm).toFixed(2)),
        widthCm,
        depthCm: treadDepthCm,
        localRotDeg: 180,
      });
      const edgeZ = maxRun - j * treadDepthCm - czOff;
      localTreads.push({ x1: xF2 - widthCm / 2, z1: edgeZ, x2: xF2 + widthCm / 2, z2: edgeZ });
    }

    rawFootprintLocal = rectCornersLocal(0, 0, totalW, maxRun + landingLen);
    localArrow.push(
      { x: xF1, z: maxRun - run1 + 10 - czOff },
      { x: xF1, z: maxRun + landingLen / 2 - czOff },
      { x: xF2, z: maxRun + landingLen / 2 - czOff },
      { x: xF2, z: maxRun - run2 + 10 - czOff }
    );
  }

  const steps: StairBoxGeometry[] = localSteps.map((s) => {
    const wPos = toWorld(s.lx, s.lz);
    return {
      x: wPos.x,
      z: wPos.z,
      yBottomCm: s.yBottomCm,
      yTopCm: s.yTopCm,
      widthCm: s.widthCm,
      depthCm: s.depthCm,
      rotationYDeg: stair.rotationYDeg + s.localRotDeg,
    };
  });

  const landings: StairBoxGeometry[] = localLandings.map((l) => {
    const wPos = toWorld(l.lx, l.lz);
    return {
      x: wPos.x,
      z: wPos.z,
      yBottomCm: l.yBottomCm,
      yTopCm: l.yTopCm,
      widthCm: l.widthCm,
      depthCm: l.depthCm,
      rotationYDeg: stair.rotationYDeg + l.localRotDeg,
    };
  });

  const treadLines: StairTreadLine[] = localTreads.map((t) => {
    const p1 = toWorld(t.x1, t.z1);
    const p2 = toWorld(t.x2, t.z2);
    return { x1: p1.x, z1: p1.z, x2: p2.x, z2: p2.z };
  });

  const footprintPolygonXZ = rawFootprintLocal.map((p) => toWorld(p.x, p.z));
  // Architectural ceiling cutout mirrors the stairwell footprint (or bounding hull for U-shaped)
  const openingPolygonXZ =
    stair.type === 'l-shaped' ? footprintPolygonXZ : boundingRectLocal(rawFootprintLocal).map((p) => toWorld(p.x, p.z));

  const walkArrowPolylineXZ = localArrow.map((p) => toWorld(p.x, p.z));
  const entryPointXZ = walkArrowPolylineXZ[0] ?? { x: stair.x, z: stair.z };
  const exitPointXZ =
    walkArrowPolylineXZ[walkArrowPolylineXZ.length - 1] ?? { x: stair.x, z: stair.z };

  const railingPosts: StairRailingPost[] = [];
  if (stair.hasRailing !== false && steps.length > 0) {
    const sampleIndices = new Set<number>([
      0,
      Math.floor(steps.length / 2),
      steps.length - 1,
    ]);
    for (const idx of sampleIndices) {
      const s = steps[idx];
      const offsetRad = (s.rotationYDeg * Math.PI) / 180;
      const sideX = Math.cos(offsetRad) * (s.widthCm / 2 - 4);
      const sideZ = -Math.sin(offsetRad) * (s.widthCm / 2 - 4);
      railingPosts.push({
        x: Number((s.x - sideX).toFixed(2)),
        z: Number((s.z - sideZ).toFixed(2)),
        yBottomCm: s.yTopCm,
        heightCm: 90,
      });
      railingPosts.push({
        x: Number((s.x + sideX).toFixed(2)),
        z: Number((s.z + sideZ).toFixed(2)),
        yBottomCm: s.yTopCm,
        heightCm: 90,
      });
    }
  }

  return {
    totalRiseCm,
    riserCount,
    riserHeightCm,
    treadDepthCm,
    strideMeasureCm,
    din18065Ok,
    steps,
    landings,
    railingPosts,
    footprintPolygonXZ,
    openingPolygonXZ,
    treadLines,
    walkArrowPolylineXZ,
    entryPointXZ,
    exitPointXZ,
  };
}
