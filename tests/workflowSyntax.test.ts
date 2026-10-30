import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('GitHub Actions Workflows (Task A & B)', () => {
  it('has a valid CI workflow file (.github/workflows/ci.yml)', () => {
    const ciPath = path.resolve(__dirname, '../.github/workflows/ci.yml');
    expect(fs.existsSync(ciPath)).toBe(true);
    const content = fs.readFileSync(ciPath, 'utf-8');
    expect(content).toContain('name: CI');
    expect(content).toContain('npm test');
    expect(content).toContain('npm run build');
    expect(content).toContain('ubuntu-latest');
  });
});
