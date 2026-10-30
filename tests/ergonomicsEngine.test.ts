import { describe, it, expect } from 'vitest';
import {
  evaluatePassageClearances,
  PassageClearance,
  PassageClearanceReport,
  DEFAULT_MAX_PASSAGE_DISTANCE_CM,
  classifyPassageSeverity,
  isVerticallySeparated,
} from '../src/core/ergonomicsEngine';
import { FurnitureItem, Wall, Corner } from '../src/core/types';

describe('Ergonomics & Passage Clearance Engine (DIN 18040 / Neufert)', () => {
  it('classifies Sofa and Coffee table with 50 cm clearance as critical (< 60 cm DIN minimum)', () => {
    // Sofa at (0, 0), depth 90 cm (z: -45 to +45)
    const sofa: FurnitureItem = {
      id: 'sofa-1',
      name: 'BoConcept Osaka Sofa',
      category: 'living',
      widthCm: 210,
      heightCm: 80,
      depthCm: 90,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#444444',
    };

    // Coffee table at (0, 115), depth 50 cm (z: 90 to 140)
    // Gap: 90 - 45 = 45 or let's place it at z = 115 with depth 40 -> z: 95..135 -> gap = 50 cm
    const coffeeTable: FurnitureItem = {
      id: 'table-1',
      name: 'Coffee Table',
      category: 'living',
      widthCm: 120,
      heightCm: 45,
      depthCm: 40,
      x: 0,
      z: 115,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#888888',
    };

    const report = evaluatePassageClearances([sofa, coffeeTable]);

    expect(report.passages).toHaveLength(1);
    const passage = report.passages[0];
    expect(passage.entity1Id).toBe('sofa-1');
    expect(passage.entity2Id).toBe('table-1');
    expect(passage.clearanceCm).toBeCloseTo(50, 1);
    expect(passage.severity).toBe('critical');
    expect(report.criticalCount).toBe(1);
    expect(report.warningCount).toBe(0);
    expect(report.optimalCount).toBe(0);
    expect(report.minClearanceCm).toBeCloseTo(50, 1);
  });

  it('classifies Dining table to wall with 75 cm clearance as warning (narrow secondary passage 60-90 cm)', () => {
    // Wall along Z=0, thickness 10 cm (extends z: -5 to +5)
    const corners: Corner[] = [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 400, z: 0 },
    ];
    const wall: Wall = {
      id: 'w1',
      startCornerId: 'c1',
      endCornerId: 'c2',
      thicknessCm: 10,
      heightCm: 260,
    };

    // Dining table at x=200, depth=90 cm, centered at z=125 cm.
    // Table edge towards wall: z = 125 - 45 = 80 cm.
    // Wall surface: z = 5 cm.
    // Clearance: 80 - 5 = 75 cm.
    const diningTable: FurnitureItem = {
      id: 'dining-1',
      name: 'Dining Table',
      category: 'kitchen',
      widthCm: 160,
      heightCm: 76,
      depthCm: 90,
      x: 200,
      z: 125,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#bb8866',
    };

    const report = evaluatePassageClearances([diningTable], [wall], corners);

    expect(report.passages).toHaveLength(1);
    const passage = report.passages[0];
    expect(passage.entity1Id).toBe('dining-1');
    expect(passage.entity1Type).toBe('furniture');
    expect(passage.entity2Id).toBe('w1');
    expect(passage.entity2Type).toBe('wall');
    expect(passage.clearanceCm).toBeCloseTo(75, 1);
    expect(passage.severity).toBe('warning');
    expect(report.warningCount).toBe(1);
    expect(report.criticalCount).toBe(0);
    expect(report.optimalCount).toBe(0);
    expect(report.minClearanceCm).toBeCloseTo(75, 1);
  });

  it('classifies hallway passage with 100 cm clearance as optimal (>= 90 cm standard walkway)', () => {
    // Hallway opposite wall along Z=0, thickness 10 cm (surface at z = 5 cm)
    const corners: Corner[] = [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 300, z: 0 },
    ];
    const wall: Wall = {
      id: 'w-hall',
      startCornerId: 'c1',
      endCornerId: 'c2',
      thicknessCm: 10,
      heightCm: 260,
    };

    // Sideboard in hallway with depth 40 cm, centered at z = 125 cm.
    // Sideboard edge towards wall: z = 125 - 20 = 105 cm.
    // Wall surface: z = 5 cm.
    // Clearance: 105 - 5 = 100 cm.
    const sideboard: FurnitureItem = {
      id: 'sideboard-1',
      name: 'Hallway Console',
      category: 'storage',
      widthCm: 120,
      heightCm: 85,
      depthCm: 40,
      x: 150,
      z: 125,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#333333',
    };

    const report = evaluatePassageClearances([sideboard], [wall], corners);

    expect(report.passages).toHaveLength(1);
    const passage = report.passages[0];
    expect(passage.clearanceCm).toBeCloseTo(100, 1);
    expect(passage.severity).toBe('optimal');
    expect(report.optimalCount).toBe(1);
    expect(report.criticalCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.minClearanceCm).toBeCloseTo(100, 1);
  });

  it('ignores furniture placed directly against wall (clearance <= 5 cm or snapped)', () => {
    const corners: Corner[] = [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 1000, z: 0 },
    ];
    const wall: Wall = {
      id: 'w-back',
      startCornerId: 'c1',
      endCornerId: 'c2',
      thicknessCm: 10,
      heightCm: 260,
    };

    // Item 1: Snapped wardrobe with snappedWallId = 'w-back'
    const snappedWardrobe: FurnitureItem = {
      id: 'wardrobe-1',
      name: 'Wardrobe',
      category: 'storage',
      widthCm: 150,
      heightCm: 220,
      depthCm: 60,
      x: 100,
      z: 40, // edge at 10, surface at 5 -> clearance 5 cm
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#ffffff',
      snappedWallId: 'w-back',
    };

    // Item 2: Bookshelf placed 3 cm from wall (not snapped, but clearance <= 5 cm)
    // Wall surface at z=5, edge at z=8 -> clearance = 3 cm. Place at x=500 so gap to wardrobe > 300 cm.
    const bookshelf: FurnitureItem = {
      id: 'shelf-1',
      name: 'Bookshelf',
      category: 'storage',
      widthCm: 80,
      heightCm: 200,
      depthCm: 30,
      x: 500,
      z: 23, // edge at 23 - 15 = 8 cm
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#aaaaaa',
    };

    const report = evaluatePassageClearances([snappedWardrobe, bookshelf], [wall], corners);

    // Both items are flushed against the wall; neither should be flagged as a passage bottleneck
    expect(report.passages).toHaveLength(0);
    expect(report.criticalCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.optimalCount).toBe(0);
    expect(report.minClearanceCm).toBeNull();
  });

  it('ignores vertical stacking (e.g. monitor on desk with elevation >= desk height)', () => {
    // Desk at (100, 100), width=120, depth=80, height=75, elevation=0
    const desk: FurnitureItem = {
      id: 'desk-1',
      name: 'Inwerk Masterlift Desk',
      category: 'office',
      widthCm: 120,
      heightCm: 75,
      depthCm: 80,
      x: 100,
      z: 100,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#eeeeee',
    };

    // Monitor on desk: sits at elevation 75 cm (>= desk height 75 cm)
    const monitor: FurnitureItem = {
      id: 'monitor-1',
      name: 'Desk Monitor',
      category: 'office',
      widthCm: 60,
      heightCm: 45,
      depthCm: 20,
      x: 100,
      z: 100,
      elevationCm: 75,
      rotationYDeg: 0,
      color: '#111111',
    };

    const report = evaluatePassageClearances([desk, monitor]);

    expect(report.passages).toHaveLength(0);
    expect(report.criticalCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.optimalCount).toBe(0);
    expect(report.minClearanceCm).toBeNull();
  });

  it('classifies overlap / collision (clearance 0) as severity critical', () => {
    // Two chairs intersecting horizontally on the same elevation
    const chairA: FurnitureItem = {
      id: 'chair-a',
      name: 'Steelcase Gesture A',
      category: 'office',
      widthCm: 60,
      heightCm: 100,
      depthCm: 60,
      x: 100,
      z: 100,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#222222',
    };

    const chairB: FurnitureItem = {
      id: 'chair-b',
      name: 'Steelcase Gesture B',
      category: 'office',
      widthCm: 60,
      heightCm: 100,
      depthCm: 60,
      x: 130, // overlaps by 30 cm
      z: 100,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#333333',
    };

    const report = evaluatePassageClearances([chairA, chairB]);

    expect(report.passages).toHaveLength(1);
    const passage = report.passages[0];
    expect(passage.clearanceCm).toBe(0);
    expect(passage.severity).toBe('critical');
    expect(report.criticalCount).toBe(1);
    expect(report.minClearanceCm).toBe(0);
  });

  it('summarizes PassageClearanceReport: sorted ascending by clearanceCm with counts and minClearanceCm', () => {
    const corners: Corner[] = [
      { id: 'c1', x: -500, z: 0 },
      { id: 'c2', x: 1000, z: 0 },
    ];
    const wall: Wall = {
      id: 'w-main',
      startCornerId: 'c1',
      endCornerId: 'c2',
      thicknessCm: 10,
      heightCm: 260,
    };

    // 1. Sofa & Coffee table: 50 cm clearance (critical)
    const sofa: FurnitureItem = {
      id: 'sofa',
      name: 'Sofa',
      category: 'living',
      widthCm: 200,
      heightCm: 85,
      depthCm: 90,
      x: 200,
      z: 200,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#444444',
    };
    const coffeeTable: FurnitureItem = {
      id: 'table',
      name: 'Coffee Table',
      category: 'living',
      widthCm: 100,
      heightCm: 45,
      depthCm: 50,
      x: 200,
      z: 320, // gap: (320 - 25) - (200 + 45) = 295 - 245 = 50 cm
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#666666',
    };

    // 2. Dining table to wall: 75 cm clearance (warning)
    // Wall surface at z=5. Table edge at z = 130 - 50 = 80 cm. Gap = 75 cm.
    const diningTable: FurnitureItem = {
      id: 'dining',
      name: 'Dining Table',
      category: 'kitchen',
      widthCm: 180,
      heightCm: 76,
      depthCm: 100,
      x: 600,
      z: 130,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#bb8866',
    };

    // 3. Sideboard to opposite furniture: 100 cm clearance (optimal)
    const consoleA: FurnitureItem = {
      id: 'console-a',
      name: 'Console A',
      category: 'storage',
      widthCm: 100,
      heightCm: 80,
      depthCm: 40,
      x: 900,
      z: 200, // z: 180..220
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#111111',
    };
    const consoleB: FurnitureItem = {
      id: 'console-b',
      name: 'Console B',
      category: 'storage',
      widthCm: 100,
      heightCm: 80,
      depthCm: 40,
      x: 900,
      z: 340, // z: 320..360 -> gap = 320 - 220 = 100 cm
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#222222',
    };

    // 4. Item flushed against wall: clearance 0 cm -> ignored.
    // Placed at x=-300 far from sofa at x=200 (> 400 cm apart).
    const wardrobe: FurnitureItem = {
      id: 'wardrobe',
      name: 'Wardrobe',
      category: 'storage',
      widthCm: 100,
      heightCm: 200,
      depthCm: 60,
      x: -300,
      z: 35, // edge at 35 - 30 = 5 -> surface at 5 -> clearance 0
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#ffffff',
      snappedWallId: 'w-main',
    };

    const report = evaluatePassageClearances(
      [sofa, coffeeTable, diningTable, consoleA, consoleB, wardrobe],
      [wall],
      corners
    );

    expect(report.criticalCount).toBe(1); // Sofa to Coffee table (50 cm)
    expect(report.warningCount).toBe(1);  // Dining table to wall (75 cm)
    expect(report.optimalCount).toBe(1);  // Console A to Console B (100 cm)
    expect(report.minClearanceCm).toBeCloseTo(50, 1);

    // Ensure passages are strictly sorted ascending by clearanceCm
    for (let i = 1; i < report.passages.length; i++) {
      expect(report.passages[i].clearanceCm).toBeGreaterThanOrEqual(
        report.passages[i - 1].clearanceCm
      );
    }

    expect(report.passages[0].clearanceCm).toBeCloseTo(50, 1);
    expect(report.passages[0].severity).toBe('critical');

    expect(report.passages[1].clearanceCm).toBeCloseTo(75, 1);
    expect(report.passages[1].severity).toBe('warning');

    expect(report.passages[2].clearanceCm).toBeCloseTo(100, 1);
    expect(report.passages[2].severity).toBe('optimal');
  });

  it('supports options object signature as well as positional arguments', () => {
    const f1: FurnitureItem = {
      id: 'f1',
      name: 'Item 1',
      category: 'living',
      widthCm: 100,
      heightCm: 50,
      depthCm: 100,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#fff',
    };
    const f2: FurnitureItem = {
      id: 'f2',
      name: 'Item 2',
      category: 'living',
      widthCm: 100,
      heightCm: 50,
      depthCm: 100,
      x: 0,
      z: 180, // gap: (180 - 50) - 50 = 80 cm
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#fff',
    };

    const report = evaluatePassageClearances({
      furniture: [f1, f2],
      maxDistanceCm: 120,
    });

    expect(report.passages).toHaveLength(1);
    expect(report.passages[0].clearanceCm).toBeCloseTo(80, 1);
    expect(report.passages[0].severity).toBe('warning');
  });

  it('defensively validates inputs and handles non-finite values gracefully', () => {
    const invalidFurniture: any = [
      null,
      undefined,
      { id: 'bad-1', name: 'Bad', widthCm: NaN, depthCm: 100, x: 0, z: 0 },
      { id: 'bad-2', name: 'Bad', widthCm: 100, depthCm: -10, x: 0, z: 0 },
      { id: 'bad-3', name: 'Bad', widthCm: 100, depthCm: 100, x: Infinity, z: 0 },
    ];

    const report = evaluatePassageClearances(invalidFurniture);
    expect(report.passages).toEqual([]);
    expect(report.criticalCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.optimalCount).toBe(0);
    expect(report.minClearanceCm).toBeNull();
  });

  it('ignores furniture pairs with clearance exceeding maxDistanceCm', () => {
    const f1: FurnitureItem = {
      id: 'f1',
      name: 'Item 1',
      category: 'living',
      widthCm: 100,
      heightCm: 50,
      depthCm: 100,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#fff',
    };
    const f2: FurnitureItem = {
      id: 'f2',
      name: 'Far Item',
      category: 'living',
      widthCm: 100,
      heightCm: 50,
      depthCm: 100,
      x: 0,
      z: 400, // gap: (400 - 50) - 50 = 300 cm
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#fff',
    };

    const report = evaluatePassageClearances([f1, f2], [], [], 120);
    expect(report.passages).toHaveLength(0);
    expect(report.minClearanceCm).toBeNull();
  });

  it('accurately verifies DIN 18040 threshold boundaries (60 cm, 90 cm, maxDistanceCm)', () => {
    // < 60 -> critical
    expect(classifyPassageSeverity(0)).toBe('critical');
    expect(classifyPassageSeverity(59.9)).toBe('critical');

    // 60 <= clearance < 90 -> warning
    expect(classifyPassageSeverity(60.0)).toBe('warning');
    expect(classifyPassageSeverity(89.9)).toBe('warning');

    // 90 <= clearance <= maxDistanceCm -> optimal
    expect(classifyPassageSeverity(90.0)).toBe('optimal');
    expect(classifyPassageSeverity(120.0, 120)).toBe('optimal');

    // > maxDistanceCm -> null (ignored)
    expect(classifyPassageSeverity(120.1, 120)).toBeNull();
    expect(classifyPassageSeverity(200.0, 120)).toBeNull();
  });

  it('correctly calculates clearance when a freestanding partition wall endpoint points at the center edge of a long furniture piece', () => {
    // Partition wall from (0, 0) to (0, 100), thickness = 10 cm. End tip at (0, 100).
    const corners: Corner[] = [
      { id: 'c-start', x: 0, z: 0 },
      { id: 'c-tip', x: 0, z: 100 },
    ];
    const wall: Wall = {
      id: 'w-partition',
      startCornerId: 'c-start',
      endCornerId: 'c-tip',
      thicknessCm: 10,
      heightCm: 260,
    };

    // Long sofa: centered at (0, 200), width=200 (x: -100..100), depth=80 (z: 160..240)
    // Front edge at z=160. Center of front edge is (0, 160).
    // Wall tip is at (0, 100). Distance = 160 - 100 = 60 cm.
    // Minus wall.thicknessCm/2 (5 cm) = 55 cm.
    // (Note: Sofa corners are at (-100, 160) and (100, 160), with distance hypot(100, 60) - 5 = ~111.6 cm)
    const sofa: FurnitureItem = {
      id: 'sofa-long',
      name: 'Long Sofa',
      category: 'living',
      widthCm: 200,
      heightCm: 85,
      depthCm: 80,
      x: 0,
      z: 200,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#444444',
    };

    const report = evaluatePassageClearances([sofa], [wall], corners);

    expect(report.passages).toHaveLength(1);
    const passage = report.passages[0];
    expect(passage.clearanceCm).toBeCloseTo(55, 1);
    expect(passage.severity).toBe('critical'); // 55 cm < 60 cm DIN minimum
    expect(passage.point1.x).toBeCloseTo(0, 1);
    expect(passage.point1.z).toBeCloseTo(160, 1);
    expect(passage.point2.x).toBeCloseTo(0, 1);
    expect(passage.point2.z).toBeCloseTo(105, 1);
  });

  it('does not falsely consider items with zero height as vertically separated', () => {
    const f1: FurnitureItem = {
      id: 'f1',
      name: 'Rug or Zero Height Item',
      category: 'decor',
      widthCm: 100,
      heightCm: 0,
      depthCm: 100,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#fff',
    };
    const f2: FurnitureItem = {
      id: 'f2',
      name: 'Normal Item',
      category: 'living',
      widthCm: 100,
      heightCm: 50,
      depthCm: 100,
      x: 0,
      z: 0,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#fff',
    };

    expect(isVerticallySeparated(f1, f2)).toBe(false);
    expect(isVerticallySeparated(f2, f1)).toBe(false);
  });
});
