import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  DEFAULT_LEVEL_ID,
  createDefaultLevel,
  getEntityLevelId,
  normalizeLevels,
  recomputeLevelElevations,
  scopeFloorplanToLevel,
} from '../src/core/levels';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { LevelManagerSection } from '../src/components/sidebar/LevelManagerSection';
import type { FloorplanData } from '../src/core/types';

describe('Sprint 12A: Pure Multi-Level Geometry & Scoping', () => {
  it('provides a default EG level and recomputes stacked elevations accurately', () => {
    const levels = normalizeLevels(undefined);
    expect(levels).toHaveLength(1);
    expect(levels[0].id).toBe(DEFAULT_LEVEL_ID);
    expect(levels[0].elevationCm).toBe(0);

    const stacked = recomputeLevelElevations([
      { id: 'lvl-ug', name: 'UG', index: -1, elevationCm: 0, ceilingHeightCm: 230, slabThicknessCm: 20 },
      createDefaultLevel(),
      { id: 'lvl-og', name: '1. OG', index: 1, elevationCm: 0, ceilingHeightCm: 250, slabThicknessCm: 20 },
    ]);

    expect(stacked.map((l) => l.id)).toEqual(['lvl-ug', DEFAULT_LEVEL_ID, 'lvl-og']);
    expect(stacked[0].elevationCm).toBe(-250); // -(230 + 20)
    expect(stacked[1].elevationCm).toBe(0);
    expect(stacked[2].elevationCm).toBe(270); // 250 + 20
  });

  it('scopes FloorplanData cleanly by levelId while treating missing levelId as level-0', () => {
    const plan: FloorplanData = {
      levels: [
        createDefaultLevel(),
        { id: 'lvl-1', name: '1. OG', index: 1, elevationCm: 270, ceilingHeightCm: 250, slabThicknessCm: 20 },
      ],
      corners: [
        { id: 'c1', x: 0, z: 0 }, // missing levelId -> level-0
        { id: 'c2', x: 400, z: 0, levelId: DEFAULT_LEVEL_ID },
        { id: 'c3', x: 0, z: 0, levelId: 'lvl-1' },
        { id: 'c4', x: 400, z: 0, levelId: 'lvl-1' },
      ],
      walls: [
        { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
        { id: 'w2', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250, levelId: 'lvl-1' },
      ],
      openings: [],
      furniture: [
        {
          id: 'f1',
          name: 'EG Sofa',
          category: 'living',
          widthCm: 200,
          heightCm: 80,
          depthCm: 90,
          x: 150,
          z: 150,
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#64748b',
        },
        {
          id: 'f2',
          name: 'OG Bett',
          category: 'bedroom',
          widthCm: 200,
          heightCm: 90,
          depthCm: 200,
          x: 200,
          z: 200,
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#78716c',
          levelId: 'lvl-1',
        },
      ],
    };

    expect(getEntityLevelId(plan.corners[0])).toBe(DEFAULT_LEVEL_ID);
    const eg = scopeFloorplanToLevel(plan, DEFAULT_LEVEL_ID);
    expect(eg.walls.map((w) => w.id)).toEqual(['w1']);
    expect(eg.furniture.map((f) => f.id)).toEqual(['f1']);

    const og = scopeFloorplanToLevel(plan, 'lvl-1');
    expect(og.walls.map((w) => w.id)).toEqual(['w2']);
    expect(og.furniture.map((f) => f.id)).toEqual(['f2']);
  });
});

describe('Sprint 12B: Store Multi-Level Actions & Persistence', () => {
  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('rectangular-room');
    useFloorplanStore.getState().setLanguage('de');
  });

  it('adds upper and basement levels, optionally copies exterior walls, switches activeLevelId, and roundtrips JSON', () => {
    const store = useFloorplanStore.getState();
    expect(store.levels).toHaveLength(1);
    expect(store.activeLevelId).toBe(DEFAULT_LEVEL_ID);

    const ogId = store.addLevel({
      name: '1. Obergeschoss',
      direction: 'above',
      copyFromLevelId: DEFAULT_LEVEL_ID,
    });

    const afterAdd = useFloorplanStore.getState();
    expect(afterAdd.levels).toHaveLength(2);
    expect(afterAdd.activeLevelId).toBe(ogId);
    const ogLevel = afterAdd.levels.find((l) => l.id === ogId)!;
    expect(ogLevel.elevationCm).toBe(270);
    // Copied 4 walls from EG onto OG
    expect(afterAdd.walls.filter((w) => getEntityLevelId(w) === ogId)).toHaveLength(4);

    // Adding furniture stamps it onto activeLevelId (OG)
    const fid = useFloorplanStore.getState().addFurniture({
      name: 'OG Schreibtisch',
      category: 'office',
      widthCm: 160,
      heightCm: 75,
      depthCm: 80,
      x: 200,
      z: 200,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#64748b',
      visual: 'desk',
    });
    expect(
      useFloorplanStore.getState().furniture.find((f) => f.id === fid)?.levelId
    ).toBe(ogId);

    // JSON export/import preserves levels and levelId assignments
    const json = useFloorplanStore.getState().exportJson();
    useFloorplanStore.getState().loadPreset('empty-room');
    expect(useFloorplanStore.getState().importJson(json)).toBe(true);
    expect(useFloorplanStore.getState().levels).toHaveLength(2);
    expect(
      useFloorplanStore.getState().furniture.find((f) => f.id === fid)?.levelId
    ).toBe(ogId);

    // Removing OG cleans up its walls/furniture and falls back to EG
    useFloorplanStore.getState().removeLevel(ogId);
    expect(useFloorplanStore.getState().levels).toHaveLength(1);
    expect(useFloorplanStore.getState().activeLevelId).toBe(DEFAULT_LEVEL_ID);
    expect(useFloorplanStore.getState().furniture.some((f) => f.id === fid)).toBe(false);
  });

  it('prevents removing the last remaining level', () => {
    useFloorplanStore.getState().removeLevel(DEFAULT_LEVEL_ID);
    expect(useFloorplanStore.getState().levels).toHaveLength(1);
  });
});

describe('Sprint 12C: LevelManagerSection UI SSR', () => {
  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('rectangular-room');
    useFloorplanStore.getState().setLanguage('de');
  });

  it('renders LevelManagerSection in German and English', () => {
    const htmlDe = ReactDOMServer.renderToStaticMarkup(
      React.createElement(LevelManagerSection)
    );
    expect(htmlDe).toContain('level-manager-section');
    expect(htmlDe).toContain('Erdgeschoss');

    useFloorplanStore.getState().setLanguage('en');
    const htmlEn = ReactDOMServer.renderToStaticMarkup(
      React.createElement(LevelManagerSection)
    );
    expect(htmlEn).toContain('Floors &amp; Levels');
  });
});
