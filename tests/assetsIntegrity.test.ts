import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('README preview assets', () => {
  it('ships valid SVG and PNG architectural preview assets', () => {
    const svgPath = path.resolve(__dirname, '../docs/assets/floorplan-2d-55sqm.svg');
    const pngPath = path.resolve(__dirname, '../docs/assets/floorplan-2d-55sqm.png');

    expect(fs.existsSync(svgPath)).toBe(true);
    expect(fs.existsSync(pngPath)).toBe(true);

    const svgContent = fs.readFileSync(svgPath, 'utf-8');
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('Wohnküche');
    expect(svgContent).toContain('Maßstabsleiste');
  });
});
