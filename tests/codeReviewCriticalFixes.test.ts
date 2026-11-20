import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { planContentChanged, type PlanSlice } from '../src/store/autosave';
import {
  DEFAULT_LEVEL_ID,
  scopeFloorplanToLevel,
} from '../src/core/levels';
import { splitCrossingWalls } from '../src/core/wallMath';
import {
  encodeFloorplanToUrlHash,
  decodeFloorplanFromUrlHash,
  MAX_DECODE_HASH_LENGTH,
} from '../src/core/export/urlSnapshot';
import { exportScaledFloorplanSvg } from '../src/core/export/planSvgExport';
import { evaluateErgonomicsScorecard } from '../src/core/ergonomicsScorecard';
import { processErgonomicsWorkerRequest } from '../src/core/workers/ergonomicsWorkerProtocol';
import { computeVariantMetrics } from '../src/core/layoutVariants';
import { disposeObjectSubtree } from '../src/components/viewer3d/furniture/CustomGlbModel';
import type { FloorplanData } from '../src/core/types';

function makeTwoFloorPlan(): FloorplanData {
  return {
    levels: [
      { id: DEFAULT_LEVEL_ID, name: 'EG', index: 0, elevationCm: 0, ceilingHeightCm: 250, slabThicknessCm: 22 },
      { id: 'lvl-og', name: 'OG', index: 1, elevationCm: 272, ceilingHeightCm: 250, slabThicknessCm: 22 },
    ],
    corners: [
      { id: 'c1', x: 0, z: 0, levelId: DEFAULT_LEVEL_ID },
      { id: 'c2', x: 400, z: 0, levelId: DEFAULT_LEVEL_ID },
      { id: 'c3', x: 400, z: 320, levelId: DEFAULT_LEVEL_ID },
      { id: 'c4', x: 0, z: 320, levelId: DEFAULT_LEVEL_ID },
      { id: 'oc1', x: 0, z: 0, levelId: 'lvl-og' },
      { id: 'oc2', x: 400, z: 0, levelId: 'lvl-og' },
      { id: 'oc3', x: 400, z: 320, levelId: 'lvl-og' },
      { id: 'oc4', x: 0, z: 320, levelId: 'lvl-og' },
    ],
    walls: [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      { id: 'ow1', startCornerId: 'oc1', endCornerId: 'oc2', thicknessCm: 15, heightCm: 250, levelId: 'lvl-og' },
      { id: 'ow2', startCornerId: 'oc2', endCornerId: 'oc3', thicknessCm: 15, heightCm: 250, levelId: 'lvl-og' },
      { id: 'ow3', startCornerId: 'oc3', endCornerId: 'oc4', thicknessCm: 15, heightCm: 250, levelId: 'lvl-og' },
      { id: 'ow4', startCornerId: 'oc4', endCornerId: 'oc1', thicknessCm: 15, heightCm: 250, levelId: 'lvl-og' },
    ],
    openings: [
      {
        id: 'op-door',
        wallId: 'w1',
        type: 'door',
        offsetFromStartCm: 150,
        widthCm: 90,
        heightCm: 210,
        sillHeightCm: 0,
      },
    ],
    furniture: [],
    rugs: [],
    roomLabels: [],
    roofSlopes: [],
    fixtures: [],
    stairs: [
      {
        id: 'st-1',
        type: 'straight',
        fromLevelId: DEFAULT_LEVEL_ID,
        toLevelId: 'lvl-og',
        x: 200,
        z: 220,
        rotationYDeg: 90,
        widthCm: 90,
        treadDepthCm: 25,
      },
    ],
  };
}

describe('Code Review Critical Fixes', () => {
  it('#1: live store updates evaluate stair collisions when stairs or furniture change', () => {
    const store = useFloorplanStore;
    store.getState().importJson(JSON.stringify(makeTwoFloorPlan()));

    const fId = store.getState().addFurniture({
      name: 'Regal',
      category: 'storage',
      visual: 'wardrobe',
      widthCm: 100,
      heightCm: 200,
      depthCm: 60,
      x: 200,
      z: 220,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#475569',
      levelId: DEFAULT_LEVEL_ID,
    });

    expect(store.getState().collisionReports[fId]?.hasCollision).toBe(true);
    expect(
      store.getState().collisionReports[fId]?.issues.some((i) => i.targetId === 'st-1')
    ).toBe(true);

    // Removing the stair must clear the collision live
    store.getState().removeStair('st-1');
    expect(store.getState().collisionReports[fId]?.hasCollision).toBe(false);
  });

  it('#2: planContentChanged detects levels, stairs, roofSlopes, fixtures, layoutVariants, activeVariantId', () => {
    const base: PlanSlice = {
      levels: [],
      stairs: [],
      corners: [],
      walls: [],
      openings: [],
      furniture: [],
      rugs: [],
      roomLabels: [],
      roofSlopes: [],
      fixtures: [],
      layoutVariants: [],
      activeVariantId: null,
      backgroundImage: null,
    };
    expect(planContentChanged(base, { ...base })).toBe(false);
    expect(planContentChanged(base, { ...base, levels: [{}] })).toBe(true);
    expect(planContentChanged(base, { ...base, stairs: [{}] })).toBe(true);
    expect(planContentChanged(base, { ...base, roofSlopes: [{}] })).toBe(true);
    expect(planContentChanged(base, { ...base, fixtures: [{}] })).toBe(true);
    expect(planContentChanged(base, { ...base, layoutVariants: [{}] })).toBe(true);
    expect(planContentChanged(base, { ...base, activeVariantId: 'v1' })).toBe(true);
  });

  it('#3 & #14: URL snapshot preserves levels & stairs and rejects oversized hashes', async () => {
    const plan = makeTwoFloorPlan();
    const hash = await encodeFloorplanToUrlHash(plan);
    const decoded = await decodeFloorplanFromUrlHash(hash);
    expect(decoded).not.toBeNull();
    expect(decoded?.levels).toHaveLength(2);
    expect(decoded?.stairs).toHaveLength(1);
    expect(decoded?.stairs?.[0].id).toBe('st-1');

    const hugeHash = `#plan=b64:${'A'.repeat(MAX_DECODE_HASH_LENGTH + 100)}`;
    expect(await decodeFloorplanFromUrlHash(hugeHash)).toBeNull();
  });

  it('#4: splitCrossingWalls propagates levelId to junctionCorner and ignores walls on other levels', () => {
    const plan = makeTwoFloorPlan();
    const newStart = { id: 'nc1', x: 200, z: -20, levelId: 'lvl-og' };
    const newEnd = { id: 'nc2', x: 200, z: 340, levelId: 'lvl-og' };
    let seq = 0;
    const res = splitCrossingWalls(
      [...plan.corners, newStart, newEnd],
      plan.walls,
      plan.openings,
      {
        id: 'nw-og',
        startCornerId: 'nc1',
        endCornerId: 'nc2',
        thicknessCm: 15,
        heightCm: 250,
        levelId: 'lvl-og',
      },
      (p) => `${p}-gen-${++seq}`
    );

    // EG walls must remain completely untouched (4 original EG walls)
    const egWalls = res.walls.filter((w) => w.levelId === DEFAULT_LEVEL_ID);
    expect(egWalls).toHaveLength(4);

    // New junction corners created on lvl-og must carry levelId: 'lvl-og'
    const generatedCorners = res.corners.filter((c) => c.id.startsWith('c-gen-'));
    expect(generatedCorners.length).toBeGreaterThanOrEqual(2);
    for (const c of generatedCorners) {
      expect(c.levelId).toBe('lvl-og');
    }
  });

  it('#5: scopeFloorplanToLevel retains child wall entities whose optional levelId is omitted', () => {
    const plan = makeTwoFloorPlan();
    plan.openings.push({
      id: 'op-og-no-level',
      wallId: 'ow1',
      type: 'window',
      offsetFromStartCm: 100,
      widthCm: 120,
      heightCm: 120,
      sillHeightCm: 90,
      // levelId intentionally omitted
    });
    plan.fixtures = [
      {
        id: 'fx-og-no-level',
        wallId: 'ow2',
        type: 'water-outlet',
        offsetFromStartCm: 80,
        elevationCm: 30,
        widthCm: 12,
        heightCm: 12,
        depthCm: 5,
        side: 'pos',
      },
    ];
    plan.roofSlopes = [
      {
        id: 'rs-og-no-level',
        wallId: 'ow3',
        kneeWallHeightCm: 100,
        pitchDeg: 40,
      },
    ];

    const og = scopeFloorplanToLevel(plan, 'lvl-og');
    expect(og.openings.some((o) => o.id === 'op-og-no-level')).toBe(true);
    expect(og.fixtures?.some((f) => f.id === 'fx-og-no-level')).toBe(true);
    expect(og.roofSlopes?.some((r) => r.id === 'rs-og-no-level')).toBe(true);
  });

  it('#6: moveFurniture on OG does not snap to EG walls', () => {
    const store = useFloorplanStore;
    const plan = makeTwoFloorPlan();
    // Add an interior wall only on EG at x=200
    plan.corners.push(
      { id: 'mid1', x: 200, z: 0, levelId: DEFAULT_LEVEL_ID },
      { id: 'mid2', x: 200, z: 320, levelId: DEFAULT_LEVEL_ID }
    );
    plan.walls.push({
      id: 'w-eg-mid',
      startCornerId: 'mid1',
      endCornerId: 'mid2',
      thicknessCm: 15,
      heightCm: 250,
      levelId: DEFAULT_LEVEL_ID,
    });
    store.getState().importJson(JSON.stringify(plan));
    store.getState().setActiveLevel('lvl-og');

    const ogItemId = store.getState().addFurniture({
      name: 'OG Tisch',
      category: 'living',
      visual: 'dining-table',
      widthCm: 100,
      heightCm: 75,
      depthCm: 60,
      x: 235,
      z: 160,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#cbd5e1',
      levelId: 'lvl-og',
    });

    store.getState().moveFurniture(ogItemId, 238, 160);
    const moved = store.getState().furniture.find((f) => f.id === ogItemId);
    expect(moved?.snappedWallId).not.toBe('w-eg-mid');
  });

  it('#7: removeLevel scrubs deleted level entities from layoutVariants', () => {
    const store = useFloorplanStore;
    const plan = makeTwoFloorPlan();
    plan.furniture.push({
      id: 'f-og',
      name: 'OG Bett',
      category: 'bedroom',
      visual: 'bed',
      widthCm: 180,
      heightCm: 90,
      depthCm: 200,
      x: 200,
      z: 160,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#94a3b8',
      levelId: 'lvl-og',
    });
    store.getState().importJson(JSON.stringify(plan));
    const vId = store.getState().saveLayoutVariant('Var A');
    expect(
      store.getState().layoutVariants.find((v) => v.id === vId)?.furniture
    ).toHaveLength(1);

    store.getState().removeLevel('lvl-og');
    expect(
      store.getState().layoutVariants.find((v) => v.id === vId)?.furniture
    ).toHaveLength(0);
  });

  it('#8: removeCorner removes roofSlopes and fixtures attached to deleted walls', () => {
    const store = useFloorplanStore;
    const plan = makeTwoFloorPlan();
    plan.fixtures = [
      { id: 'fx-1', wallId: 'w1', type: 'water-outlet', offsetFromStartCm: 50, elevationCm: 30, widthCm: 12, heightCm: 12, depthCm: 5, side: 'pos', levelId: DEFAULT_LEVEL_ID },
    ];
    plan.roofSlopes = [
      { id: 'rs-1', wallId: 'w1', kneeWallHeightCm: 100, pitchDeg: 35, levelId: DEFAULT_LEVEL_ID },
    ];
    store.getState().importJson(JSON.stringify(plan));
    store.getState().selectEntity('fx-1', 'fixture');

    store.getState().removeCorner('c1');
    expect(store.getState().fixtures).toHaveLength(0);
    expect(store.getState().roofSlopes).toHaveLength(0);
    expect(store.getState().selectedId).toBeNull();
  });

  it('#9: ergonomics scorecard does not falsely mark walled-off room with stair as reachable', () => {
    const plan = makeTwoFloorPlan();
    // Add an interior dividing wall on EG splitting x=0..200 (has door at x=150) and x=200..400 (no door!)
    // Place the stair at x=300 (inside the walled-off room)
    plan.corners.push(
      { id: 'div1', x: 200, z: 0, levelId: DEFAULT_LEVEL_ID },
      { id: 'div2', x: 200, z: 320, levelId: DEFAULT_LEVEL_ID }
    );
    // Split w1 (0..400) and w3 (400..0) at x=200
    plan.walls = [
      { id: 'w1a', startCornerId: 'c1', endCornerId: 'div1', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      { id: 'w1b', startCornerId: 'div1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      { id: 'w3a', startCornerId: 'c3', endCornerId: 'div2', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      { id: 'w3b', startCornerId: 'div2', endCornerId: 'c4', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      { id: 'wdiv', startCornerId: 'div1', endCornerId: 'div2', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      ...plan.walls.filter((w) => w.levelId === 'lvl-og'),
    ];
    plan.openings = [
      { id: 'op-door', wallId: 'w1a', type: 'door', offsetFromStartCm: 60, widthCm: 90, heightCm: 210, sillHeightCm: 0 },
    ];
    plan.stairs = [
      {
        id: 'st-isolated',
        type: 'straight',
        fromLevelId: DEFAULT_LEVEL_ID,
        toLevelId: 'lvl-og',
        x: 310,
        z: 180,
        rotationYDeg: 0,
        widthCm: 80,
        treadDepthCm: 25,
      },
    ];

    const egScorecard = evaluateErgonomicsScorecard(plan, undefined, { levelId: DEFAULT_LEVEL_ID });
    const unreachableRooms = egScorecard.rooms.filter((r) => !r.reachableFromEntrance);
    expect(unreachableRooms.length).toBeGreaterThanOrEqual(1);
  });

  it('#10: worker protocol and variant metrics scope multi-floor passages per level', () => {
    const plan = makeTwoFloorPlan();
    plan.furniture = [
      {
        id: 'f-eg',
        name: 'EG Sofa',
        category: 'living',
        visual: 'sofa',
        widthCm: 200,
        heightCm: 80,
        depthCm: 90,
        x: 200,
        z: 100,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
        levelId: DEFAULT_LEVEL_ID,
      },
      {
        id: 'f-og',
        name: 'OG Sofa',
        category: 'living',
        visual: 'sofa',
        widthCm: 200,
        heightCm: 80,
        depthCm: 90,
        x: 200,
        z: 130, // only 30 cm apart in XZ, but on different floor!
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
        levelId: 'lvl-og',
      },
    ];

    const workerRes = processErgonomicsWorkerRequest({
      requestId: 1,
      kind: 'evaluate-ergonomics',
      payload: plan,
      levelId: DEFAULT_LEVEL_ID,
    });
    expect(workerRes.kind).toBe('evaluate-ergonomics');
    if (workerRes.kind === 'evaluate-ergonomics') {
      // Must not see f-og as a furniture-to-furniture bottleneck against f-eg
      const crossFloor = workerRes.passageReport.passages.some(
        (p) => p.entity1Id === 'f-og' || p.entity2Id === 'f-og'
      );
      expect(crossFloor).toBe(false);
    }

    const { furniture, rugs, ...baseArch } = plan;
    const metrics = computeVariantMetrics(baseArch, {
      id: 'v1',
      name: 'V1',
      createdAt: new Date().toISOString(),
      furniture,
      rugs: rugs ?? [],
    });
    expect(metrics.freeFloorPercent).toBeGreaterThan(50);
  });

  it('#13: SVG export exterior dimension chains reflect true 400 x 320 cm room dimensions, not padded bounds', () => {
    const plan = makeTwoFloorPlan();
    const svg = exportScaledFloorplanSvg(plan, {
      scale: '1:50',
      levelId: DEFAULT_LEVEL_ID,
      includeDimensions: true,
    });
    expect(svg).toContain('400 cm');
    expect(svg).toContain('320 cm');
    expect(svg).not.toContain('515 cm');
    expect(svg).not.toContain('435 cm');
  });

  it('#18: disposeObjectSubtree disposes all textures attached to GLB materials', () => {
    const group = new THREE.Group();
    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mapTex = new THREE.Texture();
    const normalTex = new THREE.Texture();
    const mat = new THREE.MeshStandardMaterial({
      map: mapTex,
      normalMap: normalTex,
    });
    const geomDispose = vi.spyOn(geom, 'dispose');
    const matDispose = vi.spyOn(mat, 'dispose');
    const mapDispose = vi.spyOn(mapTex, 'dispose');
    const normalDispose = vi.spyOn(normalTex, 'dispose');

    group.add(new THREE.Mesh(geom, mat));
    disposeObjectSubtree(group);

    expect(geomDispose).toHaveBeenCalledTimes(1);
    expect(matDispose).toHaveBeenCalledTimes(1);
    expect(mapDispose).toHaveBeenCalledTimes(1);
    expect(normalDispose).toHaveBeenCalledTimes(1);
  });
});
