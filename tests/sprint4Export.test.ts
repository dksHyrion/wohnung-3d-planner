import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import type { FloorplanData, FurnitureItem } from '../src/core/types';
import { computeWallPlanPolygons } from '../src/core/export/wallExportPolygons';
import { exportScaledFloorplanSvg } from '../src/core/export/planSvgExport';
import { exportFloorplanDxf } from '../src/core/export/dxfExport';
import {
  buildFurnitureBomRows,
  computeRoomBalanceSummary,
  exportFurnitureBomCsv,
  exportFurnitureBomMarkdown,
} from '../src/core/export/bomExport';
import { PlanExportDialog } from '../src/components/layout/PlanExportDialog';
import { useFloorplanStore } from '../src/store/useFloorplanStore';

function createSampleFloorplan(): FloorplanData {
  const corners = [
    { id: 'c1', x: 0, z: 0 },
    { id: 'c2', x: 500, z: 0 },
    { id: 'c3', x: 500, z: 400 },
    { id: 'c4', x: 0, z: 400 },
  ];
  const walls = [
    { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 20, heightCm: 250 },
    { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 20, heightCm: 250 },
    { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 20, heightCm: 250 },
    { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 20, heightCm: 250 },
  ];
  const openings = [
    {
      id: 'op1',
      wallId: 'w1',
      type: 'window' as const,
      offsetFromStartCm: 150,
      widthCm: 120,
      heightCm: 130,
      sillHeightCm: 90,
    },
    {
      id: 'op2',
      wallId: 'w3',
      type: 'door' as const,
      offsetFromStartCm: 100,
      widthCm: 90,
      heightCm: 210,
      sillHeightCm: 0,
      swingDirection: 'in-left' as const,
    },
  ];
  const furniture: FurnitureItem[] = [
    {
      id: 'f-sofa',
      name: 'BoConcept Osaka',
      category: 'living',
      visual: 'boconcept-osaka',
      widthCm: 210,
      depthCm: 92,
      heightCm: 77,
      x: 160,
      z: 100,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#64748b',
      pose: 'open',
      isRealFurniture: true,
      brand: 'BoConcept',
      modelName: 'Osaka Schlafsofa',
      articleNumber: 'BC-OSK-210',
      catalogWidthCm: 205,
      catalogDepthCm: 92,
      catalogHeightCm: 77,
      notes: 'Auf "Kundenwunsch" angepasst, mit Stauraum',
    },
    {
      id: 'f-bed',
      name: 'Doppelbett',
      category: 'bedroom',
      visual: 'bed',
      widthCm: 180,
      depthCm: 200,
      heightCm: 45,
      x: 380,
      z: 260,
      elevationCm: 0,
      rotationYDeg: 90,
      color: '#e2e8f0',
      isRealFurniture: false,
    },
    {
      id: 'f-toilet',
      name: 'WC',
      category: 'bathroom',
      visual: 'toilet',
      widthCm: 40,
      depthCm: 60,
      heightCm: 75,
      x: 50,
      z: 320,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#ffffff',
    },
    {
      id: 'f-kitchen',
      name: 'Küchenzeile',
      category: 'kitchen',
      visual: 'kitchen-unit',
      widthCm: 220,
      depthCm: 60,
      heightCm: 90,
      x: 350,
      z: 45,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#cbd5e1',
    },
    {
      id: 'f-art',
      name: 'Wandbild',
      category: 'decor',
      visual: 'wall-picture',
      widthCm: 100,
      depthCm: 4,
      heightCm: 70,
      x: 250,
      z: 14,
      elevationCm: 135,
      rotationYDeg: 0,
      color: '#94a3b8',
    },
  ];
  const rugs = [
    {
      id: 'r1',
      name: 'Wollteppich',
      widthCm: 240,
      depthCm: 170,
      x: 160,
      z: 180,
      rotationYDeg: 0,
    },
  ];
  const roomLabels = [{ name: 'Wohnzimmer', x: 250, z: 200, flooringType: 'parquet' as const }];
  return { corners, walls, openings, furniture, rugs, roomLabels };
}

describe('Sprint 4: CAD SVG, DXF, and BOM Exports', () => {
  it('computes mitered wall polygons split around openings', () => {
    const data = createSampleFloorplan();
    const polys = computeWallPlanPolygons(data.corners, data.walls, data.openings);

    // w1 has 1 window (2 spans), w3 has 1 door (2 spans), w2 & w4 have 1 span each -> 6 polygons
    expect(polys).toHaveLength(6);
    const w1Spans = polys.filter((p) => p.wallId === 'w1');
    expect(w1Spans).toHaveLength(2);

    // None of w1 spans should overlap the window interval [150, 270]
    for (const span of w1Spans) {
      const xs = span.polygon.map((pt) => pt.x);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      expect(maxX <= 150.1 || minX >= 269.9).toBe(true);
    }
  });

  it('exports scaled SVG without white knockout strokes and includes 2D CAD symbols', () => {
    const data = createSampleFloorplan();
    const svg = exportScaledFloorplanSvg(data, {
      scale: '1:50',
      paperSize: 'A3',
      orientation: 'landscape',
      language: 'de',
    });

    // No white knockout strokes on openings
    expect(svg).not.toContain('stroke="#ffffff"');

    // Hatch pattern + polygon walls
    expect(svg).toContain('<pattern id="arch-wall-hatch"');
    expect(svg).toContain('<polygon class="arch-wall"');

    // CAD symbol details derived strictly from visual
    expect(svg).toContain('data-cad="osaka-fold"');
    expect(svg).toContain('data-cad="bed-headboard"');
    expect(svg).toContain('data-cad="bed-pillow"');
    expect(svg).toContain('data-cad="toilet-bowl"');
    expect(svg).toContain('data-cad="kitchen-sink"');
    expect(svg).toContain('data-cad="kitchen-burner"');

    // Visual decoupling check: box named "Toilette" must NOT get toilet-bowl CAD symbol
    const boxToiletSvg = exportScaledFloorplanSvg(
      {
        ...data,
        furniture: [
          {
            id: 'f-fake',
            name: 'Toilette',
            category: 'custom',
            visual: 'box',
            widthCm: 50,
            depthCm: 50,
            heightCm: 50,
            x: 200,
            z: 200,
            elevationCm: 0,
            rotationYDeg: 0,
            color: '#999999',
          },
        ],
      },
      { scale: '1:50', language: 'de' }
    );
    expect(boxToiletSvg).not.toContain('data-cad="toilet-bowl"');
  });

  it('exports valid R12 ASCII DXF with expected layers, Y-inversion, and toggles', () => {
    const data = createSampleFloorplan();
    const dxf = exportFloorplanDxf(data, { language: 'de' });

    expect(dxf).toContain('$ACADVER\n1\nAC1009');
    expect(dxf).toContain('0\nEOF\n');

    for (const layer of ['WALLS', 'OPENINGS', 'FURNITURE', 'RUGS', 'DIMENSIONS', 'TEXT']) {
      expect(dxf).toContain(`0\nLAYER\n2\n${layer}`);
    }

    // Wall polygons and door arc present
    expect(dxf).toContain('0\nPOLYLINE\n8\nWALLS');
    expect(dxf).toContain('0\nARC\n8\nOPENINGS');
    expect(dxf).toContain('0\nPOLYLINE\n8\nFURNITURE');
    expect(dxf).toContain('0\nPOLYLINE\n8\nRUGS');
    expect(dxf).toContain('0\nLINE\n8\nDIMENSIONS');

    // Check dxfY = -z coordinate inversion for sofa center text (x=160, z=100 -> y=-100)
    expect(dxf).toContain('0\nTEXT\n8\nTEXT\n10\n160\n20\n-100');

    // Respects includeFurniture=false & includeDimensions=false
    const minimalDxf = exportFloorplanDxf(data, {
      includeFurniture: false,
      includeDimensions: false,
    });
    expect(minimalDxf).not.toContain('0\nPOLYLINE\n8\nFURNITURE');
    expect(minimalDxf).not.toContain('0\nPOLYLINE\n8\nRUGS');
    expect(minimalDxf).not.toContain('0\nLINE\n8\nDIMENSIONS');
  });

  it('builds structured BOM rows, room balance summary, CSV, and Markdown', () => {
    const data = createSampleFloorplan();
    const rows = buildFurnitureBomRows(data, 'de');
    expect(rows).toHaveLength(5);

    const osaka = rows.find((r) => r.id === 'f-sofa')!;
    expect(osaka.isRealFurniture).toBe(true);
    expect(osaka.brand).toBe('BoConcept');
    expect(osaka.articleNumber).toBe('BC-OSK-210');
    expect(osaka.dimensionDeviates).toBe(true); // 210 vs 205
    expect(osaka.roomName).toBe('Wohnzimmer');
    expect(osaka.pose).toBe('open');

    const bed = rows.find((r) => r.id === 'f-bed')!;
    expect(bed.isRealFurniture).toBe(false);
    expect(bed.dimensionDeviates).toBe(false);

    const balance = computeRoomBalanceSummary(data, 'de');
    expect(balance.rooms).toHaveLength(1);
    expect(balance.rooms[0].name).toBe('Wohnzimmer');
    expect(balance.totalGrossSqM).toBeCloseTo(20, 1);
    expect(balance.totalNetSqM).toBeGreaterThan(16);
    // Wall-mounted picture (elevationCm = 135) must not consume floor area
    expect(balance.furnitureFootprintSqM).toBeGreaterThan(0);
    expect(balance.occupiedPercent).toBeGreaterThan(0);
    expect(balance.occupiedPercent).toBeLessThan(100);

    const csv = exportFurnitureBomCsv(data, { language: 'de' });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('BC-OSK-210');
    // RFC-4180 quote escaping for commas and double quotes inside notes
    expect(csv).toContain('"Auf ""Kundenwunsch"" angepasst, mit Stauraum"');

    const mdDe = exportFurnitureBomMarkdown(data, {
      projectTitle: 'Altbau Test',
      language: 'de',
    });
    expect(mdDe).toContain('# Altbau Test');
    expect(mdDe).toContain('## Stückliste Möbel');
    expect(mdDe).toContain('## Flächenbilanz Räume');
    expect(mdDe).toContain('| Wohnzimmer | BoConcept Osaka | Katalog | BoConcept Osaka Schlafsofa | BC-OSK-210 |');

    const mdEn = exportFurnitureBomMarkdown(data, { language: 'en' });
    expect(mdEn).toContain('## Furniture List');
    expect(mdEn).toContain('## Room Area Balance');
  });

  describe('PlanExportDialog Sprint 4 export actions', () => {
    beforeEach(() => {
      useFloorplanStore.getState().setLanguage('de');
    });

    it('renders DXF and BOM CSV/MD buttons in DE and EN when handlers are provided', () => {
      const noop = () => {};
      const htmlDe = ReactDOMServer.renderToStaticMarkup(
        React.createElement(PlanExportDialog, {
          planExportModalOpen: true,
          handleDownloadPlanSvg: noop,
          handleDownloadPlanDxf: noop,
          handleDownloadBomCsv: noop,
          handleDownloadBomMd: noop,
        })
      );
      expect(htmlDe).toContain('DXF (CAD) herunterladen');
      expect(htmlDe).toContain('Stückliste (CSV)');
      expect(htmlDe).toContain('Stückliste (Markdown)');

      useFloorplanStore.getState().setLanguage('en');
      const htmlEn = ReactDOMServer.renderToStaticMarkup(
        React.createElement(PlanExportDialog, {
          planExportModalOpen: true,
          handleDownloadPlanSvg: noop,
          handleDownloadPlanDxf: noop,
          handleDownloadBomCsv: noop,
          handleDownloadBomMd: noop,
        })
      );
      expect(htmlEn).toContain('Download DXF (CAD)');
      expect(htmlEn).toContain('BOM List (CSV)');
      expect(htmlEn).toContain('BOM Report (Markdown)');
    });
  });
});
