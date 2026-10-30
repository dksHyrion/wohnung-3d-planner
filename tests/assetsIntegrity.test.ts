import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('README Visual Assets (Task C)', () => {
  it('generates and includes valid SVG and PNG architectural preview assets', () => {
    const svgPath = path.resolve(__dirname, '../docs/assets/floorplan-2d-55sqm.svg');
    const pngPath = path.resolve(__dirname, '../docs/assets/floorplan-2d-55sqm.png');
    const bannerPath = path.resolve(__dirname, '../docs/assets/banner.svg');

    expect(fs.existsSync(svgPath)).toBe(true);
    expect(fs.existsSync(pngPath)).toBe(true);
    expect(fs.existsSync(bannerPath)).toBe(true);

    const svgContent = fs.readFileSync(svgPath, 'utf-8');
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('Wohnküche');
    expect(svgContent).toContain('Maßstabsleiste');

    const bannerContent = fs.readFileSync(bannerPath, 'utf-8');
    expect(bannerContent).toContain('<svg');
    expect(bannerContent).toContain('Wohnung 3D Planner');
  });
});
