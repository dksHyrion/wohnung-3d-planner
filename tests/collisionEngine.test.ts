import { describe, it, expect } from 'vitest';
import {
  computeDoorSwingOBB,
  evaluateFloorplanCollisions,
} from '../src/core/collisionEngine';
import { PRESET_FLOORPLANS, FURNITURE_CATALOG } from '../src/core/presets';
import { FloorplanData, FurnitureItem } from '../src/core/types';

describe('3D OBB Collision Engine & Presets', () => {
  const baseRoom: FloorplanData = {
    corners: [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 400, z: 0 },
      { id: 'c3', x: 400, z: 300 },
      { id: 'c4', x: 0, z: 300 },
    ],
    walls: [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
    ],
    openings: [
      {
        id: 'door1',
        wallId: 'w3',
        type: 'door',
        offsetFromStartCm: 150,
        widthCm: 86,
        heightCm: 200,
        sillHeightCm: 0,
        swingDirection: 'in-left',
      },
    ],
    furniture: [],
  };

  it('detects OBB intersection between two overlapping rotated furniture items', () => {
    const table: FurnitureItem = {
      id: 'f1',
      name: 'Esstisch',
      category: 'living',
      widthCm: 160,
      heightCm: 75,
      depthCm: 90,
      x: 200,
      z: 150,
      elevationCm: 0,
      rotationYDeg: 45,
      color: '#d97706',
    };
    const sofa: FurnitureItem = {
      id: 'f2',
      name: 'Sofa',
      category: 'living',
      widthCm: 200,
      heightCm: 85,
      depthCm: 95,
      x: 220,
      z: 160,
      elevationCm: 0,
      rotationYDeg: 15,
      color: '#4f46e5',
    };

    const reports = evaluateFloorplanCollisions({
      ...baseRoom,
      furniture: [table, sofa],
    });

    expect(reports['f1'].hasCollision).toBe(true);
    expect(reports['f2'].hasCollision).toBe(true);
    expect(
      reports['f1'].issues.some((i) => i.type === 'furniture-intersection')
    ).toBe(true);
  });

  it('allows two cabinets placed flush side-by-side (0 cm gap) without false collision', () => {
    const cab1: FurnitureItem = {
      id: 'cab1',
      name: 'Schrank A',
      category: 'storage',
      widthCm: 100,
      heightCm: 200,
      depthCm: 60,
      x: 100, // occupies X: 50..150
      z: 37.5, // flush against w1 inner face (thickness/2 = 7.5 + depth/2 = 30 -> 37.5)
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#0284c7',
      snappedWallId: 'w1',
    };
    const cab2: FurnitureItem = {
      id: 'cab2',
      name: 'Schrank B',
      category: 'storage',
      widthCm: 100,
      heightCm: 200,
      depthCm: 60,
      x: 200, // occupies X: 150..250 -> touches cab1 at X = 150
      z: 37.5,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#0284c7',
      snappedWallId: 'w1',
    };

    const reports = evaluateFloorplanCollisions({
      ...baseRoom,
      furniture: [cab1, cab2],
    });

    expect(reports['cab1'].hasCollision).toBe(false);
    expect(reports['cab2'].hasCollision).toBe(false);
  });

  it('detects collision when a furniture item stands inside a door swing arc', () => {
    const armchair: FurnitureItem = {
      id: 'chair1',
      name: 'Sessel',
      category: 'living',
      widthCm: 80,
      heightCm: 85,
      depthCm: 80,
      x: 210,
      z: 250, // right inside the inward door swing zone!
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#e11d48',
    };

    const reports = evaluateFloorplanCollisions({
      ...baseRoom,
      furniture: [armchair],
    });

    expect(reports['chair1'].hasCollision).toBe(true);
    expect(
      reports['chair1'].issues.some((i) => i.type === 'opening-blocked')
    ).toBe(true);

    const elevatedDoorObb = computeDoorSwingOBB(
      baseRoom.corners[2],
      baseRoom.corners[3],
      baseRoom.walls[2],
      {
        ...baseRoom.openings[0],
        sillHeightCm: 15,
        heightCm: 200,
      }
    );
    expect(elevatedDoorObb).not.toBeNull();
    expect(elevatedDoorObb!.center.y).toBe(115);
  });

  it('provides valid floorplan presets and standard furniture catalog items in cm', () => {
    expect(PRESET_FLOORPLANS['studio-apartment']).toBeDefined();
    expect(PRESET_FLOORPLANS['rectangular-room']).toBeDefined();
    expect(PRESET_FLOORPLANS['empty-room']).toBeDefined();
    expect(FURNITURE_CATALOG.length).toBeGreaterThanOrEqual(6);

    // Ensure studio-apartment preset furniture is placed without unintended corner overlaps
    const studioReports = evaluateFloorplanCollisions(
      PRESET_FLOORPLANS['studio-apartment'].data
    );
    for (const item of PRESET_FLOORPLANS['studio-apartment'].data.furniture) {
      expect(
        studioReports[item.id]?.hasCollision,
        `Expected ${item.name} in studio-apartment to have no collision`
      ).toBe(false);
    }
  });
});
