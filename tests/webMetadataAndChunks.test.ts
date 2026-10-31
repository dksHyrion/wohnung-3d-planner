import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

describe('Web Metadata, Favicon and Vite Chunk Splitting', () => {
  it('provides a dedicated architectural vector favicon in public/favicon.svg', () => {
    const faviconPath = path.join(ROOT, 'public/favicon.svg');
    expect(fs.existsSync(faviconPath), 'public/favicon.svg should exist').toBe(true);

    const content = fs.readFileSync(faviconPath, 'utf-8');
    expect(content).toContain('<svg');
    expect(content).toContain('viewBox="0 0 64 64"');
    // Expect architectural wall/blueprint styling
    expect(content).toContain('#0f172a');
    expect(content).toContain('#6366f1');
  });

  it('provides an Open Graph preview image in public/og-image.png', () => {
    const ogPath = path.join(ROOT, 'public/og-image.png');
    expect(fs.existsSync(ogPath), 'public/og-image.png should exist').toBe(true);

    const stats = fs.statSync(ogPath);
    expect(stats.size).toBeGreaterThan(10000); // Should be a real image asset
  });

  it('configures index.html with favicon, SEO, and social graph meta tags', () => {
    const indexPath = path.join(ROOT, 'index.html');
    const html = fs.readFileSync(indexPath, 'utf-8');

    // Favicon link
    expect(html).toMatch(/<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="\.\/favicon\.svg"/);

    // SEO description & theme color
    expect(html).toContain('name="description"');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('#0f172a');

    // Open Graph
    expect(html).toContain('property="og:type"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('property="og:url"');

    // Twitter Card
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('name="twitter:title"');
    expect(html).toContain('name="twitter:description"');
    expect(html).toContain('name="twitter:image"');
  });

  it('configures vite.config.ts with vendor chunk splitting and appropriate limit', async () => {
    const viteConfigPath = path.join(ROOT, 'vite.config.ts');
    const content = fs.readFileSync(viteConfigPath, 'utf-8');

    expect(content).toContain('chunkSizeWarningLimit: 1000');
    expect(content).toContain("'three-core'");
    expect(content).toContain("'r3f-ecosystem'");
    expect(content).toContain("'postprocessing'");
    expect(content).toContain("'react-vendor'");
    expect(content).toContain("'lucide'");
  });
});
