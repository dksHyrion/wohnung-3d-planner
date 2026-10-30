import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('GitHub Actions workflows', () => {
  it('has a valid CI workflow file (.github/workflows/ci.yml)', () => {
    const ciPath = path.resolve(__dirname, '../.github/workflows/ci.yml');
    expect(fs.existsSync(ciPath)).toBe(true);
    const content = fs.readFileSync(ciPath, 'utf-8');
    expect(content).toContain('name: CI');
    expect(content).toContain('npm test');
    expect(content).toContain('npm run build');
    expect(content).toContain('ubuntu-latest');
  });

  it('has a valid GitHub Pages workflow (.github/workflows/deploy-pages.yml)', () => {
    const pagesPath = path.resolve(__dirname, '../.github/workflows/deploy-pages.yml');
    expect(fs.existsSync(pagesPath)).toBe(true);
    const content = fs.readFileSync(pagesPath, 'utf-8');
    expect(content).toContain('Deploy GitHub Pages');
    expect(content).toContain('upload-pages-artifact');
    expect(content).toContain('deploy-pages');
    expect(content).toContain('github-pages');
  });
});
