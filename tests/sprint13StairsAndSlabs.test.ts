import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createDefaultLevel, DEFAULT_LEVEL_ID } from '../src/core/levels';
import { computeStairGeometry } from '../src/core/stairsMath';
import { computeLevelSlabs } from '../src/core/slabMath';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { StairInspector } from '../src/components/sidebar/StairInspector';
import type { BuildingLevel, Staircase } from '../src/core/types';

function polygonAreaXZ(pts: { x: number; z: number }[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.x * b.z - b.x * a.z;
  }
  return Math.abs(area) / 2;
}

describe('Sprint 13A: Parametric Stair Geometry & DIN 18065', () => {
  const eg: BuildingLevel = createDefaultLevel();
  const og: BuildingLevel = {
    id: 'lvl-og',
    name: '1. Obergeschoss',
    index: 1,
    elevationCm: 272,
    ceilingHeightCm: 250,
    slabThicknessCm: 22,
  };

  it('computes DIN 18065 compliant straight staircase geometry and opening cutout', () => {
    const stair: Staircase = {
      id: 'st-1',
      fromLevelId: eg.id,
      toLevelId: og.id,
      type: 'straight',
      x: 200,
      z: 200,
      rotationYDeg: 0,
      widthCm: 100,
      treadDepthCm: 27,
    };

    const geom = computeStairGeometry(stair, eg, og);
    expect(geom.totalRiseCm).toBe(272);
    expect(geom.riserCount).toBe(15); // round(272 / 18)
    expect(geom.riserHeightCm).toBeCloseTo(272 / 15, 2);
    expect(geom.strideMeasureCm).toBeCloseTo(2 * (272 / 15) + 27, 2);
    expect(geom.din18065Ok).toBe(true);
    expect(geom.steps).toHaveLength(15);
    expect(geom.steps[0].yBottomCm).toBe(0);
    expect(geom.steps[14].yTopCm).toBeCloseTo(272, 1);
    expect(geom.openingPolygonXZ.length).toBeGreaterThanOrEqual(4);
    expect(geom.railingPosts.length).toBeGreaterThanOrEqual(2);
    expect(polygonAreaXZ(geom.openingPolygonXZ)).toBeGreaterThan(20000);
  });

  it('supports L-shaped and U-shaped stairs with intermediate landing and flags invalid stride', () => {
    const lStair: Staircase = {
      id: 'st-l',
      fromLevelId: eg.id,
      toLevelId: og.id,
      type: 'l-shaped',
      x: 300,
      z: 250,
      rotationYDeg: 0,
      widthCm: 100,
      treadDepthCm: 27,
      turnDirection: 'right',
      landingLengthCm: 100,
    };
    const lGeom = computeStairGeometry(lStair, eg, og);
    expect(lGeom.landings).toHaveLength(1);
    expect(lGeom.footprintPolygonXZ.length).toBeGreaterThanOrEqual(6);
    expect(lGeom.treadLines.length).toBeGreaterThanOrEqual(12);

    const uBadStair: Staircase = {
      id: 'st-u',
      fromLevelId: eg.id,
      toLevelId: og.id,
      type: 'u-shaped',
      x: 300,
      z: 250,
      rotationYDeg: 90,
      widthCm: 95,
      treadDepthCm: 19,
      riserCount: 10, // very steep -> 2*27.2 + 19 = 73.4 (> 65)
      turnDirection: 'left',
    };
    const uGeom = computeStairGeometry(uBadStair, eg, og);
    expect(uGeom.landings).toHaveLength(1);
    expect(uGeom.din18065Ok).toBe(false);
    expect(uGeom.strideMeasureCm).toBeGreaterThan(65);
  });
});

describe('Sprint 13B: Inter-Floor Slabs with Staircase Cutouts', () => {
  it('generates inter-floor slabs above the base level and subtracts staircase openings', () => {
    const eg: BuildingLevel = createDefaultLevel();
    const og: BuildingLevel = {
      id: 'lvl-og',
      name: '1. Obergeschoss',
      index: 1,
      elevationCm: 272,
      ceilingHeightCm: 250,
      slabThicknessCm: 22,
    };

    const corners = [
      { id: 'c1', x: 0, z: 0, levelId: eg.id },
      { id: 'c2', x: 500, z: 0, levelId: eg.id },
      { id: 'c3', x: 500, z: 400, levelId: eg.id },
      { id: 'c4', x: 0, z: 400, levelId: eg.id },
      { id: 'c5', x: 0, z: 0, levelId: og.id },
      { id: 'c6', x: 500, z: 0, levelId: og.id },
      { id: 'c7', x: 500, z: 400, levelId: og.id },
      { id: 'c8', x: 0, z: 400, levelId: og.id },
    ];
    const walls = [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250, levelId: eg.id },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250, levelId: eg.id },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250, levelId: eg.id },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250, levelId: eg.id },
      { id: 'w5', startCornerId: 'c5', endCornerId: 'c6', thicknessCm: 15, heightCm: 250, levelId: og.id },
      { id: 'w6', startCornerId: 'c6', endCornerId: 'c7', thicknessCm: 15, heightCm: 250, levelId: og.id },
      { id: 'w7', startCornerId: 'c7', endCornerId: 'c8', thicknessCm: 15, heightCm: 250, levelId: og.id },
      { id: 'w8', startCornerId: 'c8', endCornerId: 'c5', thicknessCm: 15, heightCm: 250, levelId: og.id },
    ];
    const stair: Staircase = {
      id: 'st-1',
      fromLevelId: eg.id,
      toLevelId: og.id,
      type: 'straight',
      x: 250,
      z: 200,
      rotationYDeg: 0,
      widthCm: 100,
      treadDepthCm: 27,
    };

    const slabsNoStair = computeLevelSlabs({
      levels: [eg, og],
      corners,
      walls,
      stairs: [],
    });
    expect(slabsNoStair).toHaveLength(1);
    expect(slabsNoStair[0].levelId).toBe(og.id);
    expect(slabsNoStair[0].holes).toHaveLength(0);

    const slabsWithStair = computeLevelSlabs({
      levels: [eg, og],
      corners,
      walls,
      stairs: [stair],
    });
    expect(slabsWithStair).toHaveLength(1);
    expect(slabsWithStair[0].holes).toHaveLength(1);
    expect(slabsWithStair[0].netAreaSqM).toBeLessThan(slabsNoStair[0].netAreaSqM);
  });
});

describe('Sprint 13C: Store stairSlice & StairInspector SSR', () => {
  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('rectangular-room');
    useFloorplanStore.getState().setLanguage('de');
  });

  it('adds, updates, moves, selects, roundtrips JSON, and deletes a staircase', () => {
    const ogId = useFloorplanStore.getState().addLevel({
      name: '1. OG',
      direction: 'above',
      copyFromLevelId: DEFAULT_LEVEL_ID,
    });

    const stairId = useFloorplanStore.getState().addStair({
      fromLevelId: DEFAULT_LEVEL_ID,
      toLevelId: ogId,
      type: 'straight',
      x: 220,
      z: 200,
    });

    let state = useFloorplanStore.getState();
    expect(state.stairs).toHaveLength(1);
    expect(state.selectedId).toBe(stairId);
    expect(state.selectedType).toBe('stair');

    state.updateStair(stairId, { type: 'l-shaped', widthCm: 110, turnDirection: 'left' });
    state.moveStair(stairId, 260, 240);
    state = useFloorplanStore.getState();
    expect(state.stairs[0].type).toBe('l-shaped');
    expect(state.stairs[0].widthCm).toBe(110);
    expect(state.stairs[0].x).toBe(260);

    const selected = state.stairs[0];
    const htmlDe = ReactDOMServer.renderToStaticMarkup(
      React.createElement(StairInspector, { selectedStair: selected })
    );
    expect(htmlDe).toContain('Treppe');
    expect(htmlDe).toContain('DIN 18065');

    const json = state.exportJson();
    useFloorplanStore.getState().loadPreset('empty-room');
    expect(useFloorplanStore.getState().importJson(json)).toBe(true);
    expect(useFloorplanStore.getState().stairs).toHaveLength(1);
    expect(useFloorplanStore.getState().stairs[0].id).toBe(stairId);

    useFloorplanStore.getState().removeStair(stairId);
    expect(useFloorplanStore.getState().stairs).toHaveLength(0);
    expect(useFloorplanStore.getState().selectedId).toBeNull();
  });
});
