import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  computeGroupCentroidXZ,
  rotatePointAroundPivotXZ,
  selectFurnitureIdsInMarquee,
} from '../src/core/groupTransformMath';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { InspectorSidebar } from '../src/components/sidebar/InspectorSidebar';
import {
  FurnitureLayer,
  OverlaysAndGuidesLayer,
} from '../src/components/editor2d/layers/FurnitureAndOverlaysLayers';
import type { FurnitureItem } from '../src/core/types';

function makeFurniture(overrides: Partial<FurnitureItem> = {}): FurnitureItem {
  return {
    id: 'f-1',
    name: 'Tisch',
    category: 'living',
    widthCm: 100,
    heightCm: 75,
    depthCm: 60,
    x: 100,
    z: 100,
    elevationCm: 0,
    rotationYDeg: 0,
    color: '#64748b',
    visual: 'coffee-table',
    ...overrides,
  };
}

describe('Sprint 8A: Pure Group Transform & Marquee Math', () => {
  it('computes XZ centroid and rotates points around pivot accurately', () => {
    const items = [
      makeFurniture({ id: 'a', x: 100, z: 100 }),
      makeFurniture({ id: 'b', x: 200, z: 100 }),
    ];
    const center = computeGroupCentroidXZ(items);
    expect(center).toEqual({ x: 150, z: 100 });

    const rotatedA = rotatePointAroundPivotXZ(100, 100, center.x, center.z, 90);
    expect(rotatedA.x).toBeCloseTo(150, 3);
    expect(rotatedA.z).toBeCloseTo(150, 3);

    const rotatedB = rotatePointAroundPivotXZ(200, 100, center.x, center.z, 90);
    expect(rotatedB.x).toBeCloseTo(150, 3);
    expect(rotatedB.z).toBeCloseTo(50, 3);
  });

  it('selects furniture whose layout parts intersect the marquee box', () => {
    const items = [
      makeFurniture({ id: 'inside', x: 150, z: 150, widthCm: 80, depthCm: 60 }),
      makeFurniture({ id: 'edge-hit', x: 240, z: 150, widthCm: 100, depthCm: 60 }),
      makeFurniture({ id: 'outside', x: 420, z: 420, widthCm: 80, depthCm: 60 }),
    ];

    // Marquee [100..210] x [100..210]: 'inside' is fully inside, 'edge-hit' left edge is at 190
    const selected = selectFurnitureIdsInMarquee(items, {
      startX: 210,
      startZ: 210,
      currentX: 100,
      currentZ: 100,
    });
    expect(selected).toEqual(['inside', 'edge-hit']);
  });
});

describe('Sprint 8B: Store Multi-Selection & Group Transforms', () => {
  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('empty-room');
  });

  it('supports toggleSelectFurniture and selectMultipleFurniture', () => {
    const store = useFloorplanStore.getState();
    const id1 = store.addFurniture({
      name: 'Sofa',
      category: 'living',
      widthCm: 180,
      heightCm: 80,
      depthCm: 85,
      x: 150,
      z: 150,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#64748b',
      visual: 'sofa',
    });
    const id2 = useFloorplanStore.getState().addFurniture({
      name: 'Tisch',
      category: 'living',
      widthCm: 90,
      heightCm: 45,
      depthCm: 60,
      x: 150,
      z: 260,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#94a3b8',
      visual: 'coffee-table',
    });

    useFloorplanStore.getState().selectEntity(id1, 'furniture');
    expect(useFloorplanStore.getState().selectedIds).toEqual([id1]);

    useFloorplanStore.getState().toggleSelectFurniture(id2);
    expect(useFloorplanStore.getState().selectedIds).toEqual([id1, id2]);
    expect(useFloorplanStore.getState().selectedType).toBe('furniture');

    // Toggling id1 off leaves id2
    useFloorplanStore.getState().toggleSelectFurniture(id1);
    expect(useFloorplanStore.getState().selectedIds).toEqual([id2]);
    expect(useFloorplanStore.getState().selectedId).toBe(id2);

    // Toggling id2 off clears selection
    useFloorplanStore.getState().toggleSelectFurniture(id2);
    expect(useFloorplanStore.getState().selectedIds).toEqual([]);
    expect(useFloorplanStore.getState().selectedId).toBeNull();
    expect(useFloorplanStore.getState().selectedType).toBeNull();

    // Marquee bulk selection
    useFloorplanStore.getState().selectMultipleFurniture([id1, id2]);
    expect(useFloorplanStore.getState().selectedIds).toEqual([id1, id2]);
    expect(useFloorplanStore.getState().selectedId).toBe(id1);
  });

  it('moves and rotates a group together without double-moving attached children', () => {
    const store = useFloorplanStore.getState();
    const deskId = store.addFurniture({
      name: 'Schreibtisch',
      category: 'office',
      widthCm: 160,
      heightCm: 74,
      depthCm: 80,
      x: 200,
      z: 200,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#f8fafc',
      visual: 'desk',
    });
    const monitorId = useFloorplanStore.getState().addFurniture({
      name: 'Monitor',
      category: 'office',
      widthCm: 60,
      heightCm: 42,
      depthCm: 20,
      x: 200,
      z: 190,
      elevationCm: 74,
      rotationYDeg: 0,
      color: '#0f172a',
      visual: 'desk-monitor',
      attachedToId: deskId,
    });
    const chairId = useFloorplanStore.getState().addFurniture({
      name: 'Stuhl',
      category: 'office',
      widthCm: 60,
      heightCm: 95,
      depthCm: 60,
      x: 200,
      z: 280,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#334155',
      visual: 'steelcase-gesture',
    });

    // Even if both desk AND monitor AND chair are selected, moving by (50, 20) moves each exactly once
    useFloorplanStore
      .getState()
      .moveSelectedFurniture([deskId, monitorId, chairId], 50, 20);

    const afterMove = useFloorplanStore.getState().furniture;
    expect(afterMove.find((f) => f.id === deskId)).toMatchObject({ x: 250, z: 220 });
    expect(afterMove.find((f) => f.id === monitorId)).toMatchObject({ x: 250, z: 210 });
    expect(afterMove.find((f) => f.id === chairId)).toMatchObject({ x: 250, z: 300 });

    // Moving ONLY desk + chair (without monitor in selection) still brings monitor along once
    useFloorplanStore
      .getState()
      .moveSelectedFurniture([deskId, chairId], 10, -10, { recordHistory: false });
    const afterSecondMove = useFloorplanStore.getState().furniture;
    expect(afterSecondMove.find((f) => f.id === deskId)).toMatchObject({ x: 260, z: 210 });
    expect(afterSecondMove.find((f) => f.id === monitorId)).toMatchObject({ x: 260, z: 200 });
    expect(afterSecondMove.find((f) => f.id === chairId)).toMatchObject({ x: 260, z: 290 });

    // Rotating desk + chair by 90 deg rotates around centroid (260, 250) and updates monitor too
    useFloorplanStore.getState().rotateSelectedFurniture([deskId, chairId], 90);
    const afterRot = useFloorplanStore.getState().furniture;
    const deskAfter = afterRot.find((f) => f.id === deskId)!;
    const chairAfter = afterRot.find((f) => f.id === chairId)!;
    const monitorAfter = afterRot.find((f) => f.id === monitorId)!;
    expect(deskAfter.rotationYDeg).toBe(90);
    expect(chairAfter.rotationYDeg).toBe(90);
    expect(monitorAfter.rotationYDeg).toBe(90);
    // Relative distance between desk and monitor (10 cm) must stay preserved
    expect(Math.hypot(monitorAfter.x - deskAfter.x, monitorAfter.z - deskAfter.z)).toBeCloseTo(
      10,
      1
    );

    // Group removal removes all selected items
    useFloorplanStore.getState().removeSelectedFurniture([deskId, chairId]);
    const afterRemove = useFloorplanStore.getState().furniture;
    expect(afterRemove.map((f) => f.id)).toEqual([monitorId]);
    expect(afterRemove[0].attachedToId).toBeNull();
  });

  it('respects recordHistory: false in updateFurniture for 3D gizmo dragging', () => {
    const store = useFloorplanStore.getState();
    const id = store.addFurniture({
      name: 'Bild',
      category: 'decor',
      widthCm: 100,
      heightCm: 70,
      depthCm: 4,
      x: 200,
      z: 100,
      elevationCm: 120,
      rotationYDeg: 0,
      color: '#cbd5e1',
      visual: 'wall-picture',
    });
    const undoLenBefore = useFloorplanStore.getState().undoStack.length;
    useFloorplanStore
      .getState()
      .updateFurniture(id, { elevationCm: 145, rotationYDeg: 15 }, { recordHistory: false });
    expect(useFloorplanStore.getState().undoStack.length).toBe(undoLenBefore);
    const updated = useFloorplanStore.getState().furniture.find((f) => f.id === id)!;
    expect(updated.elevationCm).toBe(145);
    expect(updated.rotationYDeg).toBe(15);
  });
});

describe('Sprint 8C: Multi-Select Sidebar & 2D Marquee Rendering', () => {
  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('empty-room');
    useFloorplanStore.getState().setLanguage('de');
  });

  it('renders group card in InspectorSidebar, highlights all selected in 2D, and renders marquee box', () => {
    const store = useFloorplanStore.getState();
    const id1 = store.addFurniture({
      name: 'Sessel A',
      category: 'living',
      widthCm: 80,
      heightCm: 80,
      depthCm: 80,
      x: 150,
      z: 150,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#64748b',
      visual: 'generic-seating',
    });
    const id2 = useFloorplanStore.getState().addFurniture({
      name: 'Sessel B',
      category: 'living',
      widthCm: 80,
      heightCm: 80,
      depthCm: 80,
      x: 260,
      z: 150,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#64748b',
      visual: 'generic-seating',
    });
    useFloorplanStore.getState().selectMultipleFurniture([id1, id2]);

    const sidebarHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(InspectorSidebar)
    );
    expect(sidebarHtml).toContain('multi-select-inspector');
    expect(sidebarHtml).toContain('2 Möbel ausgewählt');

    const furnitureSvg = ReactDOMServer.renderToStaticMarkup(
      React.createElement(
        'svg',
        null,
        React.createElement(FurnitureLayer, {
          setDragState: () => {},
          clientToWorldCm: () => ({ x: 0, z: 0 }),
        })
      )
    );
    expect(furnitureSvg).toContain(`data-furniture-id="${id1}"`);
    expect(furnitureSvg).toContain(`data-furniture-id="${id2}"`);

    const marqueeSvg = ReactDOMServer.renderToStaticMarkup(
      React.createElement(
        'svg',
        null,
        React.createElement(OverlaysAndGuidesLayer, {
          dragState: {
            type: 'marquee',
            startX: 100,
            startZ: 100,
            currentX: 300,
            currentZ: 250,
          },
          calibrationHoverPt: null,
        })
      )
    );
    expect(marqueeSvg).toContain('data-testid="marquee-selection-rect"');
  });
});
