import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Package.json Metadata (Task D)', () => {
  it('contains valid open-source metadata fields', () => {
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    expect(pkg.license).toBe('MIT');
    expect(pkg.description).toContain('Architectural Floorplan');
    expect(pkg.homepage).toBe('https://dkshyrion.github.io/wohnung-3d-planner/');
    expect(pkg.repository?.url).toContain('github.com/dksHyrion/wohnung-3d-planner');
    expect(Array.isArray(pkg.keywords)).toBe(true);
    expect(pkg.keywords).toContain('threejs');
    expect(pkg.keywords).toContain('architecture');
  });
});
