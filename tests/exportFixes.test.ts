import { describe, it, expect } from 'vitest';
import {
  exportScaledFloorplanSvg,
  computePlanFit,
  PlanExportOptions,
} from '../src/core/export/planSvgExport';
import { layoutFurnitureParts, localPartWorldCenter } from '../src/core/furnitureShapes';
import { computeFurnitureOBBs } from '../src/core/collisionEngine';
import { FloorplanData, FurnitureItem, WallOpening } from '../src/core/types';
import { PRESET_FLOORPLANS } from '../src/core/presets';

describe('Export Fixes & Compound Invariants', () => {
  // Simple 400 cm horizontal wall with a 100 cm door at offset 100
  function createDoorPlan(swingDirection: WallOpening['swingDirection']): FloorplanData {
    return {
      corners: [
        { id: 'c1', x: 0, z: 0 },
        { id: 'c2', x: 400, z: 0 },
      ],
      walls: [
        {
          id: 'w1',
          startCornerId: 'c1',
          endCornerId: 'c2',
          thicknessCm: 20,
          heightCm: 250,
        },
      ],
      openings: [
        {
          id: 'op1',
          wallId: 'w1',
          type: 'door',
          offsetFromStartCm: 100,
          widthCm: 100,
          heightCm: 210,
          sillHeightCm: 0,
          swingDirection,
        },
      ],
      furniture: [],
      roomLabels: [],
      rugs: [],
    };
  }

  describe('C1: Door swing arc sweep flag and center', () => {
    const variants: Array<WallOpening['swingDirection']> = [
      'in-left',
      'in-right',
      'out-left',
      'out-right',
    ];

    for (const variant of variants) {
      it(`draws quarter-circle arc centered at hinge for ${variant}`, () => {
        const plan = createDoorPlan(variant);
        const svg = exportScaledFloorplanSvg(plan, {
          scale: '1:50',
          paperSize: 'A4',
          orientation: 'landscape',
          includeDimensions: false,
          includeFurniture: false,
        });

        // Find the door arc path: <path class="arch-door-arc" d="M ... A rx ry 0 0 sweepFlag endX endY" />
        const pathMatch = svg.match(/<path class="arch-door-arc" d="([^"]+)"/);
        expect(pathMatch).not.toBeNull();
        const d = pathMatch![1];

        const match = d.match(
          /M\s+([\d.-]+)\s+([\d.-]+)\s+A\s+([\d.-]+)\s+([\d.-]+)\s+0\s+0\s+([01])\s+([\d.-]+)\s+([\d.-]+)/
        );
        expect(match).not.toBeNull();

        const startX = parseFloat(match![1]);
        const startY = parseFloat(match![2]);
        const rx = parseFloat(match![3]);
        const ry = parseFloat(match![4]);
        const sweepFlag = parseInt(match![5], 10);
        const endX = parseFloat(match![6]);
        const endY = parseFloat(match![7]);

        expect(rx).toBeCloseTo(20, 1); // 100 cm at 1:50 is 20 mm
        expect(ry).toBeCloseTo(20, 1);

        // Find leaf line: <line class="arch-door-leaf" x1="..." y1="..." x2="..." y2="..." />
        const leafMatch = svg.match(
          /<line class="arch-door-leaf" x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/
        );
        expect(leafMatch).not.toBeNull();
        const hingeX = parseFloat(leafMatch![1]);
        const hingeY = parseFloat(leafMatch![2]);
        const leafEndX = parseFloat(leafMatch![3]);
        const leafEndY = parseFloat(leafMatch![4]);

        // Leaf endpoint must match arc endpoint
        expect(leafEndX).toBeCloseTo(endX, 2);
        expect(leafEndY).toBeCloseTo(endY, 2);

        // Distance from hinge to start of arc (latch closed) must equal radius
        const distToStart = Math.hypot(startX - hingeX, startY - hingeY);
        expect(distToStart).toBeCloseTo(rx, 1);

        // Distance from hinge to end of arc (leaf open) must equal radius
        const distToEnd = Math.hypot(endX - hingeX, endY - hingeY);
        expect(distToEnd).toBeCloseTo(rx, 1);

        // Midpoint of arc: for a quarter circle from start to end centered at hinge:
        // Angle vector 1: start - hinge. Angle vector 2: end - hinge.
        // Mid-angle vector from hinge: normalized((start - hinge) + (end - hinge)) * r.
        // For an arc centered at hinge, the arc midpoint is distance r from hinge.
        // If the sweep flag is inverted, the arc center is at (start + end - hinge),
        // meaning distance from hinge to arc midpoint would be (sqrt(2) - 1) * r ≈ 0.414 * r != r.
        // Sweep flag expectations:
        // in-left: 1 (clockwise)
        // in-right: 0 (counter-clockwise)
        // out-left: 0 (counter-clockwise)
        // out-right: 1 (clockwise)
        if (variant === 'in-left') expect(sweepFlag).toBe(1);
        if (variant === 'in-right') expect(sweepFlag).toBe(0);
        if (variant === 'out-left') expect(sweepFlag).toBe(0);
        if (variant === 'out-right') expect(sweepFlag).toBe(1);
      });
    }
  });

  describe('W2: BoConcept Osaka unfolded compound layout in layoutFurnitureParts', () => {
    const openOsaka: FurnitureItem = {
      id: 'osaka-1',
      name: 'BoConcept Osaka Schlafcouch',
      visual: 'boconcept-osaka',
      category: 'living',
      color: '#444444',
      pose: 'open',
      widthCm: 190,
      heightCm: 90,
      depthCm: 200,
      x: 100,
      z: 100,
      elevationCm: 0,
      rotationYDeg: 45,
    };

    it('returns sofa-body and mattress-open parts from layoutFurnitureParts', () => {
      const parts = layoutFurnitureParts(openOsaka);
      expect(parts).toHaveLength(2);
      expect(parts.map((p) => p.id)).toEqual(['sofa-body', 'mattress-open']);

      const body = parts.find((p) => p.id === 'sofa-body')!;
      const mattress = parts.find((p) => p.id === 'mattress-open')!;

      expect(body.widthCm).toBe(190);
      expect(body.depthCm).toBe(95);

      expect(mattress.widthCm).toBe(190 - 32); // 158 cm
      expect(mattress.depthCm).toBe(200 - 18); // 182 cm
    });

    it('aligns computeFurnitureOBBs with localPartWorldCenter for open Osaka', () => {
      const parts = layoutFurnitureParts(openOsaka);
      const obbs = computeFurnitureOBBs(openOsaka, 0);
      expect(obbs).toHaveLength(2);

      parts.forEach((part, index) => {
        const world = localPartWorldCenter(openOsaka, part);
        expect(obbs[index].center.x).toBeCloseTo(world.x, 4);
        expect(obbs[index].center.y).toBeCloseTo(world.y, 4);
        expect(obbs[index].center.z).toBeCloseTo(world.z, 4);
      });
    });

    it('leaves closed Osaka as a single body part', () => {
      const closedOsaka: FurnitureItem = {
        ...openOsaka,
        pose: 'closed',
        depthCm: 95,
      };
      const parts = layoutFurnitureParts(closedOsaka);
      expect(parts).toHaveLength(1);
      expect(parts[0].id).toBe('body');
    });
  });

  describe('W3: XML Escaping in SVG Export', () => {
    it('escapes hostile attributes and contents in SVG export', () => {
      const hostileData: FloorplanData = {
        corners: [
          { id: 'c1', x: 0, z: 0 },
          { id: 'c2', x: 400, z: 0 },
        ],
        walls: [
          {
            id: 'w1',
            startCornerId: 'c1',
            endCornerId: 'c2',
            thicknessCm: 20,
            heightCm: 250,
          },
        ],
        openings: [],
        furniture: [
          {
            id: 'f-"><script>alert(1)</script>',
            name: 'Chair & "Table" <evil>',
            visual: 'generic-seating',
            category: 'living',
            color: '#333333',
            widthCm: 50,
            heightCm: 80,
            depthCm: 50,
            x: 100,
            z: 50,
            elevationCm: 0,
            rotationYDeg: 0,
          },
        ],
        roomLabels: [],
        rugs: [
          {
            id: 'rug-" onclick="alert(2)"',
            name: 'Wollteppich & "Silk"',
            widthCm: 150,
            depthCm: 200,
            x: 150,
            z: 100,
            rotationYDeg: 0,
          },
        ],
      };

      const svg = exportScaledFloorplanSvg(hostileData, {
        scale: '1:50',
        projectTitle: '<Hack> & "Title"',
        dateStr: '31.10.2026 <date>',
      });

      // No unescaped < or > inside attribute values or raw script tags
      expect(svg).not.toContain('<script>');
      expect(svg).not.toContain('onclick="alert(2)"');
      expect(svg).toContain('&lt;script&gt;');
      expect(svg).toContain('&quot;Table&quot;');
      expect(svg).toContain('&amp; &quot;Silk&quot;');
      expect(svg).toContain('&lt;Hack&gt; &amp; &quot;Title&quot;');
    });
  });

  describe('W1: Exact Numeric Scaling and Paper Fit', () => {
    it('scales 400 cm to exactly 80 mm at 1:50 and 40 mm at 1:100', () => {
      const plan = createDoorPlan('in-left');
      const svg50 = exportScaledFloorplanSvg(plan, { scale: '1:50' });
      const svg100 = exportScaledFloorplanSvg(plan, { scale: '1:100' });

      // Wall from 0 to 400 cm:
      // At 1:50: length = 400 * 0.2 = 80 mm.
      // At 1:100: length = 400 * 0.1 = 40 mm.
      const match50 = svg50.match(/<line class="arch-wall" x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/);
      expect(match50).not.toBeNull();
      const len50 = Math.abs(parseFloat(match50![3]) - parseFloat(match50![1]));
      expect(len50).toBeCloseTo(80, 1);

      const match100 = svg100.match(/<line class="arch-wall" x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/);
      expect(match100).not.toBeNull();
      const len100 = Math.abs(parseFloat(match100![3]) - parseFloat(match100![1]));
      expect(len100).toBeCloseTo(40, 1);
    });

    it('computes plan fit and auto-scales standard-55 to fit within A4 paper', () => {
      const stdData = PRESET_FLOORPLANS['standard-55'].data;
      const fitA4_50 = computePlanFit(stdData, { scale: '1:50', paperSize: 'A4' });
      // standard-55 (710 cm deep + walls + dim chains) overflows A4 available height at 1:50
      expect(fitA4_50.fits).toBe(false);
      expect(fitA4_50.recommendedScale).toBe('1:100');

      // Exporting with autoScale: true chooses 1:100 and fits within margins
      const svg = exportScaledFloorplanSvg(stdData, {
        scale: '1:50',
        paperSize: 'A4',
        orientation: 'landscape',
        autoScale: true,
      });

      expect(svg).toContain('data-scale="1:100"');
      expect(svg).toContain('Maßstab: <tspan font-weight="700">1 : 100</tspan>');
    });
  });
});
