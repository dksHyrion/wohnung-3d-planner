import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

describe('Karpathy LLM-Wiki Structure', () => {
  it('contains SCHEMA.md, raw/, wiki/index.md, and wiki/log.md', () => {
    expect(fs.existsSync(path.join(ROOT, 'SCHEMA.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'raw/2026-10-20-threejs-research-report.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'raw/2026-10-30-github-floorplan-comparison.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'raw/furniture-specs/din-and-neufert-standards.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'wiki/index.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'wiki/log.md'))).toBe(true);
  });

  it('indexes all wiki concept and architecture pages in wiki/index.md with valid relative links', () => {
    const indexContent = fs.readFileSync(path.join(ROOT, 'wiki/index.md'), 'utf-8');
    const expectedPages = [
      'concepts/coordinate-system-cm.md',
      'concepts/wall-graph-topology.md',
      'concepts/collision-detection.md',
      'concepts/furniture-inventory-and-design-specs.md',
      'concepts/cinematic-lighting-and-atmosphere.md',
      'concepts/precision-editor-and-scale-export.md',
      'architecture/app-state-and-views.md',
      'architecture/github-reference-comparison.md',
    ];

    for (const relPath of expectedPages) {
      expect(indexContent).toContain(relPath);
      const fullPath = path.join(ROOT, 'wiki', relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });
});
