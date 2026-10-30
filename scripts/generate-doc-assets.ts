/**
 * Regenerates the README preview SVG (docs/assets/floorplan-2d-55sqm.svg).
 * Usage: npm run docs:assets
 *
 * The matching PNG (floorplan-2d-55sqm.png) is a rasterisation of this SVG and
 * must be re-exported manually after regeneration so both stay in sync.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportScaledFloorplanSvg } from '../src/core/export/planSvgExport';
import { PRESET_FLOORPLANS } from '../src/core/presets';

const assetsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/assets');
fs.mkdirSync(assetsDir, { recursive: true });

const svg = exportScaledFloorplanSvg(PRESET_FLOORPLANS['standard-55'].data, {
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
console.log(`Wrote ${svgPath}`);
