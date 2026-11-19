import { describe, it, expect } from 'vitest';
import { createDefaultLevel, DEFAULT_LEVEL_ID } from '../src/core/levels';
import { evaluateFloorplanCollisions } from '../src/core/collisionEngine';
import { evaluateErgonomicsScorecard } from '../src/core/ergonomicsScorecard';
import { exportScaledFloorplanSvg } from '../src/core/export/planSvgExport';
import { exportFloorplanDxf } from '../src/core/export/dxfExport';
import {
  computeRoomBalanceSummary,
  exportFurnitureBomCsv,
  exportFurnitureBomMarkdown,
} from '../src/core/export/bomExport';
import type { BuildingLevel, FloorplanData } from '../src/core/types';

function makeTwoStoryPlan(): FloorplanData {
  const eg = createDefaultLevel();
  const og: BuildingLevel = {
    id: 'lvl-og',
    name: '1. Obergeschoss',
    index: 1,
    elevationCm: 272,
    ceilingHeightCm: 250,
    slabThicknessCm: 22,
  };
  return {
    levels: [eg, og],
    corners: [
      { id: 'c1', x: 0, z: 0, levelId: eg.id },
      { id: 'c2', x: 500, z: 0, levelId: eg.id },
      { id: 'c3', x: 500, z: 400, levelId: eg.id },
      { id: 'c4', x: 0, z: 400, levelId: eg.id },
      { id: 'c5', x: 0, z: 0, levelId: og.id },
      { id: 'c6', x: 500, z: 0, levelId: og.id },
      { id: 'c7', x: 500, z: 400, levelId: og.id },
      { id: 'c8', x: 0, z: 400, levelId: og.id },
    ],
    walls: [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250, levelId: eg.id },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250, levelId: eg.id },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250, levelId: eg.id },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250, levelId: eg.id },
      { id: 'w5', startCornerId: 'c5', endCornerId: 'c6', thicknessCm: 15, heightCm: 250, levelId: og.id },
      { id: 'w6', startCornerId: 'c6', endCornerId: 'c7', thicknessCm: 15, heightCm: 250, levelId: og.id },
      { id: 'w7', startCornerId: 'c7', endCornerId: 'c8', thicknessCm: 15, heightCm: 250, levelId: og.id },
      { id: 'w8', startCornerId: 'c8', endCornerId: 'c5', thicknessCm: 15, heightCm: 250, levelId: og.id },
    ],
    openings: [
      {
        id: 'op1',
        wallId: 'w1',
        type: 'door',
        offsetFromStartCm: 350,
        widthCm: 95,
        heightCm: 210,
        sillHeightCm: 0,
        levelId: eg.id,
      },
    ],
    furniture: [
      {
        id: 'f-eg',
        name: 'EG Sofa',
        category: 'living',
        widthCm: 200,
        heightCm: 80,
        depthCm: 90,
        x: 150,
        z: 130,
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#64748b',
        visual: 'sofa',
        levelId: eg.id,
      },
      {
        id: 'f-og',
        name: 'OG Bett',
        category: 'bedroom',
        widthCm: 180,
        heightCm: 90,
        depthCm: 200,
        x: 150,
        z: 130, // Exact same (x, z) as f-eg, but on 1. OG -> MUST NOT collide with EG sofa!
        elevationCm: 0,
        rotationYDeg: 0,
        color: '#78716c',
        visual: 'bed',
        levelId: og.id,
      },
    ],
    roomLabels: [
      { name: 'Wohnzimmer', x: 250, z: 200, levelId: eg.id },
      { name: 'Schlafzimmer', x: 250, z: 200, levelId: og.id },
    ],
    stairs: [
      {
        id: 'st-1',
        fromLevelId: eg.id,
        toLevelId: og.id,
        type: 'straight',
        x: 250,
        z: 320,
        rotationYDeg: 90,
        widthCm: 90,
        treadDepthCm: 25,
      },
    ],
  };
}

describe('Sprint 14A: Level-Scoped Collision Engine & Stair Checks', () => {
  it('isolates collisions per levelId so overlapping XZ furniture on EG and OG do not collide', () => {
    const plan = makeTwoStoryPlan();
    const reports = evaluateFloorplanCollisions(plan);
    expect(reports['f-eg'].hasCollision).toBe(false);
    expect(reports['f-og'].hasCollision).toBe(false);
  });

  it('detects collision between furniture and a staircase on the same level', () => {
    const plan = makeTwoStoryPlan();
    plan.furniture.push({
      id: 'f-blocker',
      name: 'Regal im Treppenbereich',
      category: 'storage',
      widthCm: 100,
      heightCm: 200,
      depthCm: 60,
      x: 250,
      z: 320, // right inside st-1
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#475569',
      levelId: DEFAULT_LEVEL_ID,
    });
    const reports = evaluateFloorplanCollisions(plan);
    expect(reports['f-blocker'].hasCollision).toBe(true);
    expect(reports['f-blocker'].issues.some((i) => i.targetId === 'st-1')).toBe(true);
  });
});

describe('Sprint 14B: Multi-Floor Ergonomics & Reachability', () => {
  it('evaluates active level or seeds upper levels via connecting staircases', () => {
    const plan = makeTwoStoryPlan();
    const ogScorecard = evaluateErgonomicsScorecard(plan, undefined, { levelId: 'lvl-og' });
    expect(ogScorecard.rooms).toHaveLength(1);
    expect(ogScorecard.rooms[0].roomName).toBe('Schlafzimmer');
    // Reachable even though exterior door is only on EG, because st-1 connects EG -> OG!
    expect(ogScorecard.rooms[0].reachableFromEntrance).toBe(true);
  });
});

describe('Sprint 14C: Multi-Floor SVG, DXF & BOM Exports', () => {
  it('renders stairs & level name in scoped SVG and DXF exports', () => {
    const plan = makeTwoStoryPlan();
    const svg = exportScaledFloorplanSvg(plan, {
      scale: '1:50',
      levelId: DEFAULT_LEVEL_ID,
    });
    expect(svg).toContain('arch-stair');
    expect(svg).toContain('Erdgeschoss');
    expect(svg).toContain('EG Sofa');
    expect(svg).not.toContain('OG Bett');

    const dxf = exportFloorplanDxf(plan, { levelId: DEFAULT_LEVEL_ID });
    expect(dxf).toContain('STAIRS');
    expect(dxf).toContain('EG Sofa');
    expect(dxf).not.toContain('OG Bett');
  });

  it('reports per-level rooms, furniture, and total multi-floor area in BOM exports', () => {
    const plan = makeTwoStoryPlan();
    const summary = computeRoomBalanceSummary(plan, 'de');
    expect(summary.rooms).toHaveLength(2);
    expect(summary.totalNetSqM).toBeGreaterThan(35);

    const csv = exportFurnitureBomCsv(plan, { language: 'de' });
    expect(csv).toContain('Geschoss');
    expect(csv).toContain('1. Obergeschoss');
    expect(csv).toContain('EG Sofa');
    expect(csv).toContain('OG Bett');

    const md = exportFurnitureBomMarkdown(plan, { language: 'de' });
    expect(md).toContain('1. Obergeschoss');
    expect(md).toContain('Wohnzimmer');
    expect(md).toContain('Schlafzimmer');
  });
});
