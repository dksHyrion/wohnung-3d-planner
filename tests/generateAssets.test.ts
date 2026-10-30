import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { exportScaledFloorplanSvg } from '../src/core/export/planSvgExport';
import { PRESET_FLOORPLANS } from '../src/core/presets';

describe('Generate Preview Assets', () => {
  it('exports standard-55 SVG and banner', () => {
    const assetsDir = path.resolve(__dirname, '../docs/assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // 1. Export 2D architectural SVG
    const planData = PRESET_FLOORPLANS['standard-55'].data;
    const svg = exportScaledFloorplanSvg(planData, {
      scale: '1:50',
      paperSize: 'A4',
      orientation: 'landscape',
      projectTitle: 'Beispielwohnung 55 m² — Maßstabsgetreuer Vektorplan',
      dateStr: '30.10.2026',
      includeFurniture: true,
      includeDimensions: true,
    });

    const svgPath = path.join(assetsDir, 'floorplan-2d-55sqm.svg');
    fs.writeFileSync(svgPath, svg, 'utf-8');
    expect(fs.existsSync(svgPath)).toBe(true);
  });
});
