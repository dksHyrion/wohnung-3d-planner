import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { buildWallGraphFromSegments } from '../src/core/import/importTopology';
import { parseDxfFloorplan } from '../src/core/import/dxfImport';
import { parseSvgFloorplan } from '../src/core/import/svgImport';
import { parseRoomPlanJson } from '../src/core/import/roomPlanImport';
import { exportFloorplanDxf } from '../src/core/export/dxfExport';
import { PRESET_FLOORPLANS } from '../src/core/presets';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { PlanImportDialog } from '../src/components/layout/PlanImportDialog';

describe('Sprint 11A: Import Topology Builder', () => {
  it('welds nearby endpoints, drops degenerate walls, and splits crossings', () => {
    const result = buildWallGraphFromSegments(
      [
        { x1: 0, z1: 0, x2: 400, z2: 0 },
        { x1: 401.5, z1: -1.0, x2: 400, z2: 300 },
        { x1: 400, z1: 300, x2: 0, z2: 300 },
        { x1: 0, z1: 300, x2: 1, z2: 1 },
        // Degenerate tiny sliver (< 10 cm)
        { x1: 100, z1: 100, x2: 104, z2: 100 },
        // Crossing interior wall
        { x1: 200, z1: -20, x2: 200, z2: 320 },
      ],
      { weldToleranceCm: 5 }
    );

    expect(result.corners.length).toBeGreaterThanOrEqual(4);
    expect(result.walls.length).toBeGreaterThanOrEqual(5);
    expect(result.corners.every((c) => c.x >= 0 && c.z >= 0)).toBe(true);
  });
});

describe('Sprint 11B: DXF Floorplan Importer', () => {
  it('parses ASCII DXF LINE/LWPOLYLINE with $INSUNITS mm -> cm conversion and prefers WALLS layer', () => {
    const dxfMm = [
      '0', 'SECTION', '2', 'HEADER',
      '9', '$INSUNITS', '70', '4', // 4 = millimeters
      '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', 'WALLS', '70', '1',
      '10', '0', '20', '0',
      '10', '5000', '20', '0',
      '10', '5000', '20', '-4000',
      '10', '0', '20', '-4000',
      // Non-wall annotation line on DIMENSIONS layer should be ignored when WALLS layer exists
      '0', 'LINE', '8', 'DIMENSIONS',
      '10', '0', '20', '500', '11', '5000', '21', '500',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');

    const parsed = parseDxfFloorplan(dxfMm);
    expect(parsed.detectedUnit).toBe('mm');
    expect(parsed.data.walls).toHaveLength(4);
    expect(parsed.data.corners).toHaveLength(4);
    // 5000 mm -> 500 cm span
    const xs = parsed.data.corners.map((c) => c.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(500, 1);
  });

  it('imports POLYLINE/VERTEX entities from exported DXF roundtrip', () => {
    const sample = PRESET_FLOORPLANS['rectangular-room'].data;
    const dxf = exportFloorplanDxf(sample, {
      includeFurniture: false,
      includeDimensions: false,
    });
    const parsed = parseDxfFloorplan(dxf, { unit: 'cm' });
    expect(parsed.data.walls.length).toBeGreaterThanOrEqual(4);
    expect(parsed.data.corners.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Sprint 11C: SVG Vector Floorplan Importer', () => {
  it('parses SVG lines, rects, polylines, and M/L/H/V/Z paths into walls', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
        <g class="Wall">
          <path d="M 50 50 H 450 V 350 L 50 350 Z" />
          <line x1="250" y1="50" x2="250" y2="350" />
        </g>
        <g class="Furniture">
          <rect x="100" y="100" width="80" height="40" />
        </g>
      </svg>
    `;

    const parsed = parseSvgFloorplan(svg, { cmPerUnit: 1 });
    expect(parsed.data.corners.length).toBeGreaterThanOrEqual(4);
    expect(parsed.data.walls.length).toBeGreaterThanOrEqual(5);
  });
});

describe('Sprint 11D: Apple RoomPlan CapturedRoom JSON Importer', () => {
  it('parses CapturedRoom walls, doors, windows, and objects into cm FloorplanData', () => {
    const capturedRoom = {
      version: 2,
      walls: [
        {
          identifier: 'wall-north',
          dimensions: [4.0, 2.6, 0.15],
          transform: [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            2.0, 1.3, 0.0, 1,
          ],
        },
        {
          identifier: 'wall-east',
          dimensions: [3.0, 2.6, 0.15],
          transform: [
            0, 0, 1, 0,
            0, 1, 0, 0,
            -1, 0, 0, 0,
            4.0, 1.3, 1.5, 1,
          ],
        },
      ],
      doors: [
        {
          identifier: 'door-1',
          parentIdentifier: 'wall-north',
          dimensions: [0.9, 2.05, 0.15],
          transform: [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            1.5, 1.025, 0.0, 1,
          ],
        },
      ],
      windows: [
        {
          identifier: 'win-1',
          parentIdentifier: 'wall-east',
          dimensions: [1.2, 1.3, 0.15],
          transform: [
            0, 0, 1, 0,
            0, 1, 0, 0,
            -1, 0, 0, 0,
            4.0, 1.55, 1.5, 1,
          ],
        },
      ],
      objects: [
        {
          identifier: 'obj-sofa',
          category: { sofa: {} },
          dimensions: [2.1, 0.8, 0.9],
          transform: [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            2.0, 0.4, 2.0, 1,
          ],
        },
      ],
    };

    const parsed = parseRoomPlanJson(JSON.stringify(capturedRoom));
    expect(parsed).not.toBeNull();
    expect(parsed!.data.walls).toHaveLength(2);
    expect(parsed!.data.openings).toHaveLength(2);
    const door = parsed!.data.openings.find((o) => o.type === 'door')!;
    const win = parsed!.data.openings.find((o) => o.type === 'window')!;
    expect(door.widthCm).toBeCloseTo(90, 1);
    expect(door.heightCm).toBeCloseTo(205, 1);
    expect(win.widthCm).toBeCloseTo(120, 1);
    expect(win.sillHeightCm).toBeCloseTo(90, 1);

    expect(parsed!.data.furniture).toHaveLength(1);
    expect(parsed!.data.furniture[0].visual).toBe('sofa');
    expect(parsed!.data.furniture[0].widthCm).toBeCloseTo(210, 1);
    expect(parsed!.data.furniture[0].depthCm).toBeCloseTo(90, 1);

    expect(useFloorplanStore.getState().importJson(JSON.stringify(parsed!.data))).toBe(true);
    expect(useFloorplanStore.getState().walls).toHaveLength(2);
    expect(useFloorplanStore.getState().openings).toHaveLength(2);
  });
});

describe('Sprint 11E: PlanImportDialog UI SSR', () => {
  beforeEach(() => {
    useFloorplanStore.getState().setLanguage('de');
  });

  it('renders localized import dialog in DE and EN', () => {
    const htmlDe = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PlanImportDialog, { isOpen: true, onClose: () => {} })
    );
    expect(htmlDe).toContain('Grundriss importieren');
    expect(htmlDe).toContain('DXF');
    expect(htmlDe).toContain('RoomPlan');

    useFloorplanStore.getState().setLanguage('en');
    const htmlEn = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PlanImportDialog, { isOpen: true, onClose: () => {} })
    );
    expect(htmlEn).toContain('Import Floorplan');
  });
});
