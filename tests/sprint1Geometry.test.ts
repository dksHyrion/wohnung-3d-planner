import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import {
  computeFurnitureOBBs,
  evaluateFloorplanCollisions,
  computeDoorSwingSector,
} from '../src/core/collisionEngine';
import { FloorplanData, FurnitureItem, Corner, Wall, WallOpening } from '../src/core/types';
import { resolveFurnitureModelType } from '../src/components/viewer3d/furniture/ArchitecturalFurniture3D';
import { SofaModel } from '../src/components/viewer3d/furniture/SofaModel';
import { BedModel } from '../src/components/viewer3d/furniture/BedModel';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { InspectorSidebar } from '../src/components/sidebar/InspectorSidebar';

describe('Sprint 1 Geometry: Compound-OBB for Dining Tables', () => {
  const baseFloorplan: FloorplanData = {
    corners: [
      { id: 'c1', x: -500, z: -500 },
      { id: 'c2', x: 500, z: -500 },
      { id: 'c3', x: 500, z: 500 },
      { id: 'c4', x: -500, z: 500 },
    ],
    walls: [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
    ],
    openings: [],
    furniture: [],
  };

  const diningTable: FurnitureItem = {
    id: 'table1',
    name: 'Esstisch',
    category: 'living',
    widthCm: 160,
    heightCm: 75,
    depthCm: 90,
    x: 0,
    z: 0,
    elevationCm: 0,
    rotationYDeg: 0,
    color: '#e8dbc8',
    visual: 'dining-table',
  };

  it('detects collision when a cube hits a chair box at x=30, z=65', () => {
    // Cube 10x10x10 cm, center y = 44 -> elevationCm = 44 - 10/2 = 39
    const cubeAtChair: FurnitureItem = {
      id: 'cube-chair',
      name: 'Test Cube Chair',
      category: 'decor',
      widthCm: 10,
      heightCm: 10,
      depthCm: 10,
      x: 30,
      z: 65,
      elevationCm: 39,
      rotationYDeg: 0,
      color: '#ff0000',
    };

    const reports = evaluateFloorplanCollisions({
      ...baseFloorplan,
      furniture: [diningTable, cubeAtChair],
    });

    expect(reports['table1'].hasCollision).toBe(true);
    expect(reports['cube-chair'].hasCollision).toBe(true);
    expect(
      reports['table1'].issues.some(
        (i) => i.type === 'furniture-intersection' && i.targetId === 'cube-chair'
      )
    ).toBe(true);
  });

  it('does NOT detect collision when a cube is in the gap between chairs at x=0, z=65', () => {
    // Cube 10x10x10 cm, center y = 44 -> elevationCm = 44 - 10/2 = 39
    const cubeInGap: FurnitureItem = {
      id: 'cube-gap',
      name: 'Test Cube Gap',
      category: 'decor',
      widthCm: 10,
      heightCm: 10,
      depthCm: 10,
      x: 0,
      z: 65,
      elevationCm: 39,
      rotationYDeg: 0,
      color: '#00ff00',
    };

    const reports = evaluateFloorplanCollisions({
      ...baseFloorplan,
      furniture: [diningTable, cubeInGap],
    });

    expect(reports['table1'].hasCollision).toBe(false);
    expect(reports['cube-gap'].hasCollision).toBe(false);
  });

  it('generates compound OBBs (1 tabletop + 4 chairs) for dining table', () => {
    const obbs = computeFurnitureOBBs(diningTable);
    expect(obbs).toHaveLength(5);
  });

  it('generates a single OBB for non-dining table items', () => {
    const sofa: FurnitureItem = {
      id: 'sofa1',
      name: 'Sofa',
      category: 'living',
      widthCm: 200,
      heightCm: 85,
      depthCm: 95,
      x: 100,
      z: 100,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#4f46e5',
    };
    const obbs = computeFurnitureOBBs(sofa);
    expect(obbs).toHaveLength(1);
  });

  it('scales chair counts based on table width (3 chairs/side for >=170, 4 chairs/side for >=210)', () => {
    const table170: FurnitureItem = {
      id: 't-170',
      name: 'Dining Table Medium',
      category: 'living',
      widthCm: 180,
      heightCm: 76,
      depthCm: 90,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#fff',
      visual: 'dining-table',
    };
    // 1 tabletop + 2 * 3 chairs = 7 OBBs
    expect(computeFurnitureOBBs(table170)).toHaveLength(7);

    const table210: FurnitureItem = {
      id: 't-210',
      name: 'Esstisch Groß',
      category: 'living',
      widthCm: 220,
      heightCm: 76,
      depthCm: 100,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#fff',
      visual: 'dining-table',
    };
    // 1 tabletop + 2 * 4 chairs = 9 OBBs
    expect(computeFurnitureOBBs(table210)).toHaveLength(9);
  });

  it('supports visual: dining-table even if name does not contain esstisch or dining', () => {
    const tableVisual = {
      id: 't-vis',
      name: 'Skandinavischer Holztisch',
      category: 'living',
      widthCm: 160,
      heightCm: 75,
      depthCm: 90,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#fff',
      visual: 'dining-table',
    } as FurnitureItem;
    expect(computeFurnitureOBBs(tableVisual)).toHaveLength(5);
  });

  it('correctly transforms chair positions when table is rotated 90 degrees', () => {
    const rotatedTable: FurnitureItem = {
      ...diningTable,
      id: 'table-rot',
      rotationYDeg: 90,
    };
    // At rot 0, chair was at local cx ≈ 30.4, cz = 57.
    // Under 90-degree Y rotation:
    // (x', z') = (cz, -cx) ≈ (57, -30.4)
    const cubeAtRotatedChair: FurnitureItem = {
      id: 'cube-rot',
      name: 'Cube Rot',
      category: 'decor',
      widthCm: 10,
      heightCm: 10,
      depthCm: 10,
      x: 57,
      z: -30,
      elevationCm: 39,
      rotationYDeg: 0,
      color: '#ff0000',
    };

    const reports = evaluateFloorplanCollisions({
      ...baseFloorplan,
      furniture: [rotatedTable, cubeAtRotatedChair],
    });

    expect(reports['table-rot'].hasCollision).toBe(true);
    expect(reports['cube-rot'].hasCollision).toBe(true);
  });

  it('detects wall collision when a chair sticks into a wall', () => {
    // Table at x=0, z=0. Wall w1 is at z=-500.
    // Let's place a wall near the chairs: wall along x axis at z = 70 (chair extends to z = 57 + 21 = 78)
    // Table top extends to z = 45, so tabletop does not touch wall at z = 70, but chairs do!
    const floorplanWithCloseWall: FloorplanData = {
      corners: [
        { id: 'w-c1', x: -100, z: 70 },
        { id: 'w-c2', x: 100, z: 70 },
      ],
      walls: [
        { id: 'close-wall', startCornerId: 'w-c1', endCornerId: 'w-c2', thicknessCm: 10, heightCm: 250 },
      ],
      openings: [],
      furniture: [diningTable],
    };

    const reports = evaluateFloorplanCollisions(floorplanWithCloseWall);
    expect(reports['table1'].hasCollision).toBe(true);
    expect(
      reports['table1'].issues.some(
        (i) => i.type === 'wall-intersection' && i.targetId === 'close-wall'
      )
    ).toBe(true);
  });
});

describe('Sprint 1 Geometry: Compound-OBB for Sectional/Corner Sofas', () => {
  const baseFloorplan: FloorplanData = {
    corners: [
      { id: 'c1', x: -500, z: -500 },
      { id: 'c2', x: 500, z: -500 },
      { id: 'c3', x: 500, z: 500 },
      { id: 'c4', x: -500, z: 500 },
    ],
    walls: [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
    ],
    openings: [],
    furniture: [],
  };

  const ecksofa: FurnitureItem = {
    id: 'sofa-eck',
    name: 'Ecksofa 240',
    category: 'living',
    widthCm: 240,
    heightCm: 78,
    depthCm: 160,
    x: 0,
    z: 0,
    elevationCm: 0,
    rotationYDeg: 0,
    color: '#e7e5e4',
    visual: 'sectional-sofa',
  };

  const bigSofa: FurnitureItem = {
    id: 'sofa-big',
    name: 'Großes Sofa',
    category: 'living',
    widthCm: 220,
    heightCm: 78,
    depthCm: 140,
    x: 0,
    z: 0,
    elevationCm: 0,
    rotationYDeg: 0,
    color: '#e7e5e4',
    visual: 'sofa',
  };

  it('generates two OBBs for sectional sofa and single OBB for standard large sofa', () => {
    expect(computeFurnitureOBBs(ecksofa)).toHaveLength(2);
    expect(computeFurnitureOBBs(bigSofa)).toHaveLength(1);
  });

  it('supports visual: sectional-sofa even without eck in name', () => {
    const visualSofa: FurnitureItem = {
      id: 'vis-sofa',
      name: 'Designermöbel',
      category: 'living',
      widthCm: 240,
      heightCm: 78,
      depthCm: 160,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#e7e5e4',
      visual: 'sectional-sofa',
    };
    expect(computeFurnitureOBBs(visualSofa)).toHaveLength(2);
  });

  it('does NOT collide with a cube at x = -50, z = 48 (empty inner corner of L-shape)', () => {
    const cubeInEmptyCorner: FurnitureItem = {
      id: 'cube-empty-corner',
      name: 'Test Cube Empty Corner',
      category: 'decor',
      widthCm: 10,
      heightCm: 10,
      depthCm: 10,
      x: -50,
      z: 48,
      elevationCm: 15, // center y = 20
      rotationYDeg: 0,
      color: '#00ff00',
    };

    const reports = evaluateFloorplanCollisions({
      ...baseFloorplan,
      furniture: [ecksofa, cubeInEmptyCorner],
    });

    expect(reports['sofa-eck'].hasCollision).toBe(false);
    expect(reports['cube-empty-corner'].hasCollision).toBe(false);
  });

  it('MUST collide with a cube at x = 70, z = 40 (hits the chaise lounge on the right)', () => {
    const cubeChaise: FurnitureItem = {
      id: 'cube-chaise',
      name: 'Test Cube Chaise',
      category: 'decor',
      widthCm: 10,
      heightCm: 10,
      depthCm: 10,
      x: 70,
      z: 40,
      elevationCm: 15, // center y = 20
      rotationYDeg: 0,
      color: '#ff0000',
    };

    const reports = evaluateFloorplanCollisions({
      ...baseFloorplan,
      furniture: [ecksofa, cubeChaise],
    });

    expect(reports['sofa-eck'].hasCollision).toBe(true);
    expect(reports['cube-chaise'].hasCollision).toBe(true);
    expect(
      reports['sofa-eck'].issues.some(
        (i) => i.type === 'furniture-intersection' && i.targetId === 'cube-chaise'
      )
    ).toBe(true);
  });

  it('Großes Sofa (no eck/chaise/sectional) MUST collide at x = -50, z = 48 as full box', () => {
    const cubeInEmptyCorner: FurnitureItem = {
      id: 'cube-empty-corner',
      name: 'Test Cube Corner Big Sofa',
      category: 'decor',
      widthCm: 10,
      heightCm: 10,
      depthCm: 10,
      x: -50,
      z: 48,
      elevationCm: 15, // center y = 20
      rotationYDeg: 0,
      color: '#ff0000',
    };

    const reports = evaluateFloorplanCollisions({
      ...baseFloorplan,
      furniture: [bigSofa, cubeInEmptyCorner],
    });

    expect(reports['sofa-big'].hasCollision).toBe(true);
    expect(reports['cube-empty-corner'].hasCollision).toBe(true);
    expect(
      reports['sofa-big'].issues.some(
        (i) => i.type === 'furniture-intersection' && i.targetId === 'cube-empty-corner'
      )
    ).toBe(true);
  });

  it('correctly transforms sectional sofa OBBs when rotated 90 degrees', () => {
    const rotatedEcksofa: FurnitureItem = {
      ...ecksofa,
      id: 'sofa-eck-rot90',
      rotationYDeg: 90,
    };

    // At rot 0: empty corner was at x = -50, z = 48.
    // Under 90 deg rot (x' = z, z' = -x): (48, 50).
    const cubeInRotatedCorner: FurnitureItem = {
      id: 'cube-rot-empty',
      name: 'Test Cube Rotated Corner',
      category: 'decor',
      widthCm: 10,
      heightCm: 10,
      depthCm: 10,
      x: 48,
      z: 50,
      elevationCm: 15,
      rotationYDeg: 0,
      color: '#00ff00',
    };

    // At rot 0: chaise was at x = 70, z = 40.
    // Under 90 deg rot (x' = z, z' = -x): (40, -70).
    const cubeInRotatedChaise: FurnitureItem = {
      id: 'cube-rot-chaise',
      name: 'Test Cube Rotated Chaise',
      category: 'decor',
      widthCm: 10,
      heightCm: 10,
      depthCm: 10,
      x: 40,
      z: -70,
      elevationCm: 15,
      rotationYDeg: 0,
      color: '#ff0000',
    };

    const reportsCorner = evaluateFloorplanCollisions({
      ...baseFloorplan,
      furniture: [rotatedEcksofa, cubeInRotatedCorner],
    });
    expect(reportsCorner['sofa-eck-rot90'].hasCollision).toBe(false);
    expect(reportsCorner['cube-rot-empty'].hasCollision).toBe(false);

    const reportsChaise = evaluateFloorplanCollisions({
      ...baseFloorplan,
      furniture: [rotatedEcksofa, cubeInRotatedChaise],
    });
    expect(reportsChaise['sofa-eck-rot90'].hasCollision).toBe(true);
    expect(reportsChaise['cube-rot-chaise'].hasCollision).toBe(true);
  });

  it('resolveFurnitureModelType prioritizes item.visual for sofa, sectional-sofa, and dining-table', () => {
    const itemSofaVisual: FurnitureItem = {
      id: 'vis-1',
      name: 'Custom Product',
      category: 'custom',
      widthCm: 200,
      heightCm: 80,
      depthCm: 90,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#fff',
      visual: 'sofa',
    };
    expect(resolveFurnitureModelType(itemSofaVisual)).toBe('sofa');

    const itemSectionalVisual: FurnitureItem = {
      ...itemSofaVisual,
      id: 'vis-2',
      visual: 'sectional-sofa',
    };
    expect(resolveFurnitureModelType(itemSectionalVisual)).toBe('sofa');

    const itemDiningVisual: FurnitureItem = {
      ...itemSofaVisual,
      id: 'vis-3',
      visual: 'dining-table',
    };
    expect(resolveFurnitureModelType(itemDiningVisual)).toBe('dining-table');
  });

  it('SofaModel renders safely with undefined item name and splits plinth for sectionals', () => {
    const unnamedSectional: FurnitureItem = {
      id: 'unnamed-sectional',
      name: undefined as any,
      category: 'living',
      widthCm: 240,
      heightCm: 78,
      depthCm: 160,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#fff',
      visual: 'sectional-sofa',
    };

    // Should not throw on undefined name
    const htmlSectional = ReactDOMServer.renderToStaticMarkup(
      React.createElement(SofaModel, { item: unnamedSectional })
    );
    expect(htmlSectional).toBeTruthy();
    // For sectional, plinth is rendered in a group with 2 separate mesh boxes
    expect(htmlSectional).toContain('name="sofa-chaise-cushion"');

    const linearSofa: FurnitureItem = {
      id: 'linear-sofa',
      name: 'Standard Sofa',
      category: 'living',
      widthCm: 180,
      heightCm: 78,
      depthCm: 90,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#fff',
    };
    const htmlLinear = ReactDOMServer.renderToStaticMarkup(
      React.createElement(SofaModel, { item: linearSofa })
    );
    expect(htmlLinear).toBeTruthy();
    expect(htmlLinear).not.toContain('name="sofa-chaise-cushion"');
  });
});

describe('Sprint 1 Geometry: Opening Clamping at Wall Ends & 90°-Circular Sector Door Swing', () => {
  it('clamps opening width to wall end and discards openings beyond wall or with clamped width < 1', () => {
    // Wall from (0, 0) to (200, 0)
    useFloorplanStore.setState({
      corners: [
        { id: 'c-test-1', x: 0, z: 0 },
        { id: 'c-test-2', x: 200, z: 0 },
      ],
      walls: [
        {
          id: 'w-clamp-1',
          startCornerId: 'c-test-1',
          endCornerId: 'c-test-2',
          thicknessCm: 15,
          heightCm: 250,
        },
      ],
      openings: [],
      furniture: [],
      collisionReports: {},
    });

    // 1. Add opening with offset 150 cm and width 80 cm
    const opId = useFloorplanStore.getState().addOpening({
      wallId: 'w-clamp-1',
      type: 'door',
      offsetFromStartCm: 150,
      widthCm: 80,
      heightCm: 200,
      sillHeightCm: 0,
      swingDirection: 'in-left',
    });

    const stored = useFloorplanStore
      .getState()
      .openings.find((o) => o.id === opId);
    expect(stored).toBeDefined();
    // Clamped width must be 200 - 150 = 50 cm
    expect(stored!.widthCm).toBe(50);
    expect(stored!.offsetFromStartCm).toBe(150);

    // 2. Update opening to offset 180 cm, width 50 cm
    useFloorplanStore.getState().updateOpening(opId, {
      offsetFromStartCm: 180,
      widthCm: 50,
    });

    const updated = useFloorplanStore
      .getState()
      .openings.find((o) => o.id === opId);
    expect(updated).toBeDefined();
    // Clamped width must be 200 - 180 = 20 cm
    expect(updated!.widthCm).toBe(20);
    expect(updated!.offsetFromStartCm).toBe(180);

    // 3. Attempting to add opening beyond wall (offset 200 cm >= length 200 cm) is discarded/not added
    const beyondId = useFloorplanStore.getState().addOpening({
      wallId: 'w-clamp-1',
      type: 'door',
      offsetFromStartCm: 200,
      widthCm: 80,
      heightCm: 200,
      sillHeightCm: 0,
      swingDirection: 'in-left',
    });
    const beyondOp = useFloorplanStore
      .getState()
      .openings.find((o) => o.id === beyondId);
    expect(beyondOp).toBeUndefined();

    // 4. Attempting to add opening with width clamped < 1 cm (e.g. offset 199.5 on 200 cm wall) is discarded
    const tinyId = useFloorplanStore.getState().addOpening({
      wallId: 'w-clamp-1',
      type: 'door',
      offsetFromStartCm: 199.5,
      widthCm: 80,
      heightCm: 200,
      sillHeightCm: 0,
      swingDirection: 'in-left',
    });
    const tinyOp = useFloorplanStore
      .getState()
      .openings.find((o) => o.id === tinyId);
    expect(tinyOp).toBeUndefined();
  });

  it('does NOT collide with furniture placed beyond the wall at x=210, z=20 when door width is clamped', () => {
    // Wall from (0, 0) to (200, 0).
    // Door at offset 150, width 50 (clamped).
    const floorplan: FloorplanData = {
      corners: [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 200, z: 0 },
      ],
      walls: [
        {
          id: 'w1',
          startCornerId: 'c1',
          endCornerId: 'c2',
          thicknessCm: 15,
          heightCm: 250,
        },
      ],
      openings: [
        {
          id: 'door-clamped',
          wallId: 'w1',
          type: 'door',
          offsetFromStartCm: 150,
          widthCm: 50, // Clamped from 80 cm
          heightCm: 200,
          sillHeightCm: 0,
          swingDirection: 'in-left',
        },
      ],
      furniture: [
        {
          id: 'item-beyond',
          name: 'Item Beyond Wall',
          category: 'decor',
          widthCm: 10,
          heightCm: 10,
          depthCm: 10,
          x: 210,
          z: 20,
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#10b981',
        },
      ],
    };

    const reports = evaluateFloorplanCollisions(floorplan);
    expect(reports['item-beyond'].hasCollision).toBe(false);
    expect(reports['item-beyond'].issues).toHaveLength(0);
  });

  it('90°-Kreissektor vs Bounding Box: avoids false positives in the bounding box corner and detects actual hits', () => {
    // Wall from (0, 0) to (200, 0), thickness 0 for exact hinge at (100, 0).
    // Door at offset 100 cm, width 80 cm, swingDirection: 'in-left' (swings into +z).
    // Door radius is 80 cm.
    // In the old square bounding box (100..180 x 0..80):
    // - A 10x10 cube at (170, 70) (bounds [165..175] x [65..75]) was inside [100..180 x 0..80] -> collided!
    //   In the 90°-circular sector, distance from hinge (100, 0) is > 80 cm -> MUST NOT collide.
    // - Also at (165, 65), closest corner is at (160, 60):
    //   distance from hinge (100, 0) is sqrt(60^2 + 60^2) ≈ 84.85 cm > 80 cm.
    //   In the old square bounding box, this collided. In the 90°-circular sector, MUST NOT collide.
    // - At (120, 20): distance from hinge (100, 0) is sqrt(20^2 + 20^2) ≈ 28.3 cm <= 80 cm.
    //   In the 90°-circular sector, this MUST collide!
    const baseDoorFloorplan: FloorplanData = {
      corners: [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 200, z: 0 },
      ],
      walls: [
        {
          id: 'w1',
          startCornerId: 'c1',
          endCornerId: 'c2',
          thicknessCm: 0,
          heightCm: 250,
        },
      ],
      openings: [
        {
          id: 'door-swing-1',
          wallId: 'w1',
          type: 'door',
          offsetFromStartCm: 100,
          widthCm: 80,
          heightCm: 200,
          sillHeightCm: 0,
          swingDirection: 'in-left',
        },
      ],
      furniture: [],
    };

    const cubeOutsideCorner: FurnitureItem = {
      id: 'cube-outside-corner',
      name: 'Cube In Box Corner',
      category: 'decor',
      widthCm: 10,
      heightCm: 10,
      depthCm: 10,
      x: 170,
      z: 70,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#00ff00',
    };

    const cubeOutsideDiag: FurnitureItem = {
      id: 'cube-outside-diag',
      name: 'Cube Corner At 160_60',
      category: 'decor',
      widthCm: 10,
      heightCm: 10,
      depthCm: 10,
      x: 165,
      z: 65,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#00ff00',
    };

    const cubeInsideSector: FurnitureItem = {
      id: 'cube-inside',
      name: 'Cube Inside Sector',
      category: 'decor',
      widthCm: 10,
      heightCm: 10,
      depthCm: 10,
      x: 120,
      z: 20,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#ff0000',
    };

    const reportsCorner = evaluateFloorplanCollisions({
      ...baseDoorFloorplan,
      furniture: [cubeOutsideCorner],
    });

    expect(reportsCorner['cube-outside-corner'].hasCollision).toBe(false);
    expect(
      reportsCorner['cube-outside-corner'].issues.some(
        (i) => i.type === 'opening-blocked'
      )
    ).toBe(false);

    const reportsDiag = evaluateFloorplanCollisions({
      ...baseDoorFloorplan,
      furniture: [cubeOutsideDiag],
    });

    expect(reportsDiag['cube-outside-diag'].hasCollision).toBe(false);
    expect(
      reportsDiag['cube-outside-diag'].issues.some(
        (i) => i.type === 'opening-blocked'
      )
    ).toBe(false);

    const reportsInside = evaluateFloorplanCollisions({
      ...baseDoorFloorplan,
      furniture: [cubeInsideSector],
    });

    expect(reportsInside['cube-inside'].hasCollision).toBe(true);
    expect(
      reportsInside['cube-inside'].issues.some(
        (i) => i.type === 'opening-blocked' && i.targetId === 'door-swing-1'
      )
    ).toBe(true);
  });

  it('updateOpening clamps boundary exceedances non-destructively without deleting the opening', () => {
    useFloorplanStore.setState({
      corners: [
        { id: 'c-nondestr-1', x: 0, z: 0 },
        { id: 'c-nondestr-2', x: 200, z: 0 },
      ],
      walls: [
        {
          id: 'w-nondestr-1',
          startCornerId: 'c-nondestr-1',
          endCornerId: 'c-nondestr-2',
          thicknessCm: 15,
          heightCm: 250,
        },
      ],
      openings: [],
      furniture: [],
      collisionReports: {},
    });

    const opId = useFloorplanStore.getState().addOpening({
      wallId: 'w-nondestr-1',
      type: 'door',
      offsetFromStartCm: 50,
      widthCm: 80,
      heightCm: 200,
      sillHeightCm: 0,
      swingDirection: 'in-left',
    });

    expect(useFloorplanStore.getState().openings).toHaveLength(1);

    // 1. Updating with offset exceeding wall length (e.g. 280 cm) clamps offset to wall.length - 1 (199 cm)
    // and width to 1 cm, keeping the opening in state (non-destructive)
    useFloorplanStore.getState().updateOpening(opId, {
      offsetFromStartCm: 280,
      widthCm: 60,
    });

    const afterExceed = useFloorplanStore
      .getState()
      .openings.find((o) => o.id === opId);
    expect(afterExceed).toBeDefined();
    expect(afterExceed!.offsetFromStartCm).toBe(199);
    expect(afterExceed!.widthCm).toBe(1);

    // 2. Updating with negative offset clamps offset to 0 cm
    useFloorplanStore.getState().updateOpening(opId, {
      offsetFromStartCm: -45,
      widthCm: 70,
    });

    const afterNegative = useFloorplanStore
      .getState()
      .openings.find((o) => o.id === opId);
    expect(afterNegative).toBeDefined();
    expect(afterNegative!.offsetFromStartCm).toBe(0);
    expect(afterNegative!.widthCm).toBe(70);

    // 3. Updating with width exceeding remaining wall length clamps width to remaining length
    useFloorplanStore.getState().updateOpening(opId, {
      offsetFromStartCm: 140,
      widthCm: 100, // 200 - 140 = 60 cm available
    });

    const afterWidthClamp = useFloorplanStore
      .getState()
      .openings.find((o) => o.id === opId);
    expect(afterWidthClamp).toBeDefined();
    expect(afterWidthClamp!.offsetFromStartCm).toBe(140);
    expect(afterWidthClamp!.widthCm).toBe(60);
  });

  it('computeDoorSwingSector computes exact hinge, radius, unit vectors for all 4 swing configurations', () => {
    const start: Corner = { id: 'c1', x: 0, z: 0 };
    const end: Corner = { id: 'c2', x: 200, z: 0 };
    const wall: Wall = {
      id: 'w1',
      startCornerId: 'c1',
      endCornerId: 'c2',
      thicknessCm: 20,
      heightCm: 250,
    };
    const baseOpening: WallOpening = {
      id: 'op1',
      wallId: 'w1',
      type: 'door',
      offsetFromStartCm: 50,
      widthCm: 80,
      heightCm: 210,
      sillHeightCm: 10,
    };

    // 1. in-left: swings into +z (normal), hinge on left (offset 50)
    const sectorInLeft = computeDoorSwingSector(start, end, wall, {
      ...baseOpening,
      swingDirection: 'in-left',
    });
    expect(sectorInLeft).not.toBeNull();
    expect(sectorInLeft!.hinge).toEqual({ x: 50, z: 10 });
    expect(sectorInLeft!.radiusCm).toBe(80);
    expect(sectorInLeft!.uClosed).toEqual({ x: 1, z: 0 });
    expect(sectorInLeft!.uOpen).toEqual({ x: 0, z: 1 });
    expect(sectorInLeft!.minY).toBe(10);
    expect(sectorInLeft!.maxY).toBe(220);

    // 2. in-right: swings into +z (normal), hinge on right (offset 50 + 80 = 130)
    const sectorInRight = computeDoorSwingSector(start, end, wall, {
      ...baseOpening,
      swingDirection: 'in-right',
    });
    expect(sectorInRight).not.toBeNull();
    expect(sectorInRight!.hinge).toEqual({ x: 130, z: 10 });
    expect(sectorInRight!.radiusCm).toBe(80);
    expect(sectorInRight!.uClosed).toEqual({ x: -1, z: 0 });
    expect(sectorInRight!.uOpen).toEqual({ x: 0, z: 1 });
    expect(sectorInRight!.minY).toBe(10);
    expect(sectorInRight!.maxY).toBe(220);

    // 3. out-left: swings into -z (-normal), hinge on left (offset 50)
    const sectorOutLeft = computeDoorSwingSector(start, end, wall, {
      ...baseOpening,
      swingDirection: 'out-left',
    });
    expect(sectorOutLeft).not.toBeNull();
    expect(sectorOutLeft!.hinge).toEqual({ x: 50, z: -10 });
    expect(sectorOutLeft!.radiusCm).toBe(80);
    expect(sectorOutLeft!.uClosed).toEqual({ x: 1, z: 0 });
    expect(sectorOutLeft!.uOpen).toEqual({ x: 0, z: -1 });
    expect(sectorOutLeft!.minY).toBe(10);
    expect(sectorOutLeft!.maxY).toBe(220);

    // 4. out-right: swings into -z (-normal), hinge on right (offset 50 + 80 = 130)
    const sectorOutRight = computeDoorSwingSector(start, end, wall, {
      ...baseOpening,
      swingDirection: 'out-right',
    });
    expect(sectorOutRight).not.toBeNull();
    expect(sectorOutRight!.hinge).toEqual({ x: 130, z: -10 });
    expect(sectorOutRight!.radiusCm).toBe(80);
    expect(sectorOutRight!.uClosed).toEqual({ x: -1, z: 0 });
    expect(sectorOutRight!.uOpen).toEqual({ x: 0, z: -1 });
    expect(sectorOutRight!.minY).toBe(10);
    expect(sectorOutRight!.maxY).toBe(220);

    // Also verify rotated wall: vertical wall along +Z
    const startVert: Corner = { id: 'cv1', x: 0, z: 0 };
    const endVert: Corner = { id: 'cv2', x: 0, z: 300 };
    const wallVert: Wall = {
      id: 'wv1',
      startCornerId: 'cv1',
      endCornerId: 'cv2',
      thicknessCm: 20,
      heightCm: 250,
    };
    // tangent is (0, 1), normal is (-1, 0)
    const sectorVertInLeft = computeDoorSwingSector(startVert, endVert, wallVert, {
      ...baseOpening,
      offsetFromStartCm: 100,
      swingDirection: 'in-left',
    });
    expect(sectorVertInLeft).not.toBeNull();
    expect(sectorVertInLeft!.hinge.x).toBeCloseTo(-10, 4);
    expect(sectorVertInLeft!.hinge.z).toBeCloseTo(100, 4);
    expect(sectorVertInLeft!.uClosed.x).toBeCloseTo(0, 4);
    expect(sectorVertInLeft!.uClosed.z).toBeCloseTo(1, 4);
    expect(sectorVertInLeft!.uOpen.x).toBeCloseTo(-1, 4);
    expect(sectorVertInLeft!.uOpen.z).toBeCloseTo(0, 4);
  });
});

describe('Sprint 1 Geometry: Bed Dimensions & Mattress Sizing (BedModel)', () => {
  it('strictly defines mattress and bed frame width by item dimensions without 60cm shrinking', () => {
    const bed200: FurnitureItem = {
      id: 'bed-200',
      name: 'Doppelbett 200x200',
      category: 'bedroom',
      widthCm: 200,
      heightCm: 90,
      depthCm: 200,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#e2d8ce',
    };

    let tree200: any = null;
    function Wrapper200() {
      tree200 = BedModel({ item: bed200 });
      return tree200;
    }
    ReactDOMServer.renderToStaticMarkup(React.createElement(Wrapper200));

    const children200 = React.Children.toArray(tree200.props.children) as React.ReactElement[];
    const frame200 =
      children200.find((c) => c.props?.name === 'bed-platform-frame') ||
      tree200.props.children[1];
    const mattress200 =
      children200.find((c) => c.props?.name === 'bed-mattress') ||
      tree200.props.children[2];

    expect(frame200).toBeDefined();
    expect(frame200.props.args[0]).toBe(200);

    expect(mattress200).toBeDefined();
    expect(mattress200.props.args[0]).toBe(196);

    const bed180: FurnitureItem = {
      id: 'bed-180',
      name: 'Doppelbett 180x200',
      category: 'bedroom',
      widthCm: 180,
      heightCm: 90,
      depthCm: 200,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#e2d8ce',
    };

    let tree180: any = null;
    function Wrapper180() {
      tree180 = BedModel({ item: bed180 });
      return tree180;
    }
    ReactDOMServer.renderToStaticMarkup(React.createElement(Wrapper180));

    const children180 = React.Children.toArray(tree180.props.children) as React.ReactElement[];
    const frame180 =
      children180.find((c) => c.props?.name === 'bed-platform-frame') ||
      tree180.props.children[1];

    expect(frame180).toBeDefined();
    expect(frame180.props.args[0]).toBe(180);

    // Verify markup renders without throwing
    expect(() =>
      ReactDOMServer.renderToStaticMarkup(React.createElement(BedModel, { item: bed200 }))
    ).not.toThrow();
  });
});

describe('Sprint 1 Geometry: Synchronized Wall Length Resizing with Connected Walls, Openings, and Snapped Furniture', () => {
  it('updates wall length, moves end corner, clamps openings on all affected walls, and clamps snapped furniture', () => {
    // 1. Set up store with corners c1, c2, c3; walls w1, w2; door op1 on w1, op2 on w2; wardrobe snapped to w1
    useFloorplanStore.setState({
      corners: [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 300, z: 0 },
        { id: 'c3', x: 300, z: 200 },
      ],
      walls: [
        { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
        { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
      ],
      openings: [
        {
          id: 'op1',
          wallId: 'w1',
          type: 'door',
          offsetFromStartCm: 160,
          widthCm: 80,
          heightCm: 200,
          sillHeightCm: 0,
          swingDirection: 'in-left',
        },
        {
          id: 'op2',
          wallId: 'w2',
          type: 'door',
          offsetFromStartCm: 180,
          widthCm: 60,
          heightCm: 200,
          sillHeightCm: 0,
          swingDirection: 'in-left',
        },
      ],
      furniture: [
        {
          id: 'wardrobe-1',
          name: 'Kleiderschrank',
          category: 'bedroom',
          widthCm: 100,
          heightCm: 200,
          depthCm: 60,
          x: 150,
          z: 37.5,
          elevationCm: 0,
          rotationYDeg: 0,
          color: '#475569',
          snappedWallId: 'w1',
        },
      ],
      collisionReports: {},
    });

    // 2. Call updateWallLengthCm('w1', 200)
    useFloorplanStore.getState().updateWallLengthCm('w1', 200);

    const state = useFloorplanStore.getState();

    // - Corner c2 moves to (200, 0)
    const c2 = state.corners.find((c) => c.id === 'c2');
    expect(c2).toBeDefined();
    expect(c2!.x).toBe(200);
    expect(c2!.z).toBe(0);

    // - Door op1 on w1: clamped to width 40 cm (160 + 40 = 200)
    const op1 = state.openings.find((o) => o.id === 'op1');
    expect(op1).toBeDefined();
    expect(op1!.offsetFromStartCm).toBe(160);
    expect(op1!.widthCm).toBe(40);

    // - Wardrobe on w1: stays snapped to w1, clamped along wall to [halfW, length - halfW] = [50, 150]
    const wardrobe = state.furniture.find((f) => f.id === 'wardrobe-1');
    expect(wardrobe).toBeDefined();
    expect(wardrobe!.snappedWallId).toBe('w1');
    expect(wardrobe!.x).toBe(150);
    expect(wardrobe!.z).toBe(37.5);

    // - Door op2 on w2: w2 now goes from c2(200, 0) to c3(300, 200).
    //   Length of w2 is sqrt(100^2 + 200^2) = sqrt(50000) ≈ 223.61 cm.
    //   op2 was offset 180 + width 60 = 240 > 223.61 cm.
    //   op2 is clamped so offset + width <= wallLength (clamped width ≈ 223.61 - 180 ≈ 43.61 cm).
    const op2 = state.openings.find((o) => o.id === 'op2');
    expect(op2).toBeDefined();
    expect(op2!.offsetFromStartCm).toBe(180);
    expect(op2!.widthCm).toBeLessThanOrEqual(223.61 - 180 + 0.01);
    expect(op2!.offsetFromStartCm + op2!.widthCm).toBeLessThanOrEqual(223.61 + 0.01);

    // 3. Further test: shrink w1 to 150 cm
    // - Select op1 so we verify discarded opening resets selection
    useFloorplanStore.setState({ selectedId: 'op1', selectedType: 'opening' });

    // - Wardrobe must clamp along wall: length 150, halfW 50 -> max along wall is 100 cm.
    //   Wardrobe x must become 100 cm!
    // - Door op1 (offset 160 >= 150) must be filtered out (< 1 cm).
    useFloorplanStore.getState().updateWallLengthCm('w1', 150);
    const stateAfter150 = useFloorplanStore.getState();

    const w150 = stateAfter150.furniture.find((f) => f.id === 'wardrobe-1');
    expect(w150).toBeDefined();
    expect(w150!.x).toBe(100);
    expect(w150!.z).toBe(37.5);
    expect(w150!.snappedWallId).toBe('w1');

    const op1After150 = stateAfter150.openings.find((o) => o.id === 'op1');
    expect(op1After150).toBeUndefined();
    // Selection must reset to null when selected opening is discarded
    expect(stateAfter150.selectedId).toBeNull();
    expect(stateAfter150.selectedType).toBeNull();

    // 4. Fallback safeLength: non-finite value falls back to minimum 10 cm safely
    useFloorplanStore.getState().updateWallLengthCm('w1', NaN);
    const c2Min = useFloorplanStore.getState().corners.find((c) => c.id === 'c2');
    expect(c2Min!.x).toBe(10);
  });

  it('updates furniture snapped to an adjacent wall that changes angle and length', () => {
    // Wall w1 from (0, 0) to (300, 0), w2 from (300, 0) to (300, 200)
    // Shelf snapped to w2 initially at x=272.5, z=100
    useFloorplanStore.setState({
      corners: [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 300, z: 0 },
        { id: 'c3', x: 300, z: 200 },
      ],
      walls: [
        { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
        { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
      ],
      openings: [],
      furniture: [
        {
          id: 'shelf-w2',
          name: 'Regal',
          category: 'storage',
          widthCm: 80,
          heightCm: 180,
          depthCm: 40,
          x: 272.5,
          z: 100,
          elevationCm: 0,
          rotationYDeg: 270,
          color: '#e2e8f0',
          snappedWallId: 'w2',
        },
      ],
      collisionReports: {},
    });

    useFloorplanStore.getState().updateWallLengthCm('w1', 200);
    const state = useFloorplanStore.getState();
    const shelf = state.furniture.find((f) => f.id === 'shelf-w2');
    expect(shelf).toBeDefined();
    expect(shelf!.snappedWallId).toBe('w2');
    // w2 angle has changed because c2 moved to (200, 0) while c3 is (300, 200)
    // Shelf position and rotation must stay on interior face (296.6° instead of flipping to 116.6°)
    expect(shelf!.rotationYDeg).toBe(296.6);
    expect(shelf!.rotationYDeg).not.toBe(116.6);
  });

  it('renders moved corner and connected walls metadata in InspectorSidebar', () => {
    useFloorplanStore.setState({
      corners: [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 300, z: 0 },
        { id: 'c3', x: 300, z: 200 },
      ],
      walls: [
        { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
        { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
      ],
      openings: [],
      furniture: [],
      selectedId: 'w1',
      selectedType: 'wall',
    });

    const markupWithConnected = ReactDOMServer.renderToStaticMarkup(
      React.createElement(InspectorSidebar)
    );
    expect(markupWithConnected).toContain('Endpunkt: c2 (Mitbewegte Wände: w2)');

    // When wall has no other walls connected to end corner
    useFloorplanStore.setState({
      selectedId: 'w2',
      selectedType: 'wall',
    });

    const markupSingle = ReactDOMServer.renderToStaticMarkup(
      React.createElement(InspectorSidebar)
    );
    expect(markupSingle).toContain('Endpunkt: c3 (Mitbewegte Wände: keine)');
  });
});



