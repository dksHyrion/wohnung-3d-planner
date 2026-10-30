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

    // 2. Generate modern vector banner
    const bannerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 420" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#60a5fa" />
      <stop offset="50%" stop-color="#a78bfa" />
      <stop offset="100%" stop-color="#38bdf8" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.05" />
    </linearGradient>
    <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" stroke-width="0.8" stroke-opacity="0.35" />
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="1200" height="420" rx="16" fill="url(#bgGrad)" />
  <rect width="1200" height="420" rx="16" fill="url(#gridPattern)" />
  <rect x="40" y="30" width="1120" height="360" rx="12" fill="url(#accentGrad)" stroke="#475569" stroke-width="1.2" stroke-opacity="0.4" />

  <!-- Isometric 3D room wireframe cue on right -->
  <g transform="translate(860, 210) scale(1.15)" stroke="#818cf8" stroke-width="1.8" fill="none" opacity="0.85">
    <!-- Floor polygon -->
    <polygon points="0,-70 120,0 0,70 -120,0" fill="#312e81" fill-opacity="0.35" stroke="#6366f1" stroke-width="2" />
    <!-- Back walls -->
    <polyline points="-120,0 -120,-80 0,-150 120,-80 120,0" stroke="#a5b4fc" stroke-width="2.2" />
    <line points="0,70 0,-10" stroke="#818cf8" stroke-width="1.5" stroke-dasharray="4,4" />
    <line points="0,-10 0,-150" stroke="#c7d2fe" stroke-width="2.2" />
    <!-- Table representation -->
    <polygon points="-30,-15 15,10 45,-5 0,-30" fill="#38bdf8" fill-opacity="0.5" stroke="#38bdf8" stroke-width="1.5" />
    <!-- Accent clearance zone -->
    <ellipse cx="0" cy="5" rx="55" ry="30" fill="none" stroke="#34d399" stroke-width="1.5" stroke-dasharray="3,3" />
    <text x="0" y="45" font-family="system-ui, sans-serif" font-size="11" fill="#34d399" text-anchor="middle" font-weight="600">DIN 18040: ✓ 95 cm</text>
  </g>

  <!-- Left Content -->
  <g transform="translate(90, 85)">
    <!-- Badge -->
    <rect x="0" y="0" width="260" height="30" rx="15" fill="#1e293b" stroke="#38bdf8" stroke-width="1" stroke-opacity="0.6" />
    <circle cx="15" cy="15" r="4.5" fill="#34d399" />
    <text x="30" y="20" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#93c5fd" letter-spacing="0.5">1 THREE.JS UNIT = 1.0 CM</text>

    <!-- Main Title -->
    <text x="0" y="90" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="800" fill="url(#textGrad)" letter-spacing="-1">
      Wohnung 3D Planner
    </text>

    <!-- Subtitle -->
    <text x="0" y="130" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="400" fill="#cbd5e1">
      Precision 2D/3D Architectural Simulator &amp; Clearance Engine
    </text>

    <!-- Feature Pillars -->
    <g transform="translate(0, 175)">
      <!-- Item 1 -->
      <g transform="translate(0, 0)">
        <rect width="180" height="48" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />
        <text x="14" y="24" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#f8fafc">2D CAD Precision</text>
        <text x="14" y="40" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">Winkelfang &amp; 1:50 SVG</text>
      </g>
      <!-- Item 2 -->
      <g transform="translate(195, 0)">
        <rect width="180" height="48" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />
        <text x="14" y="24" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#f8fafc">OBB &amp; SAT Collision</text>
        <text x="14" y="40" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">DIN 18040 Ergonomie</text>
      </g>
      <!-- Item 3 -->
      <g transform="translate(390, 0)">
        <rect width="180" height="48" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />
        <text x="14" y="24" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#f8fafc">Offline ArchViz</text>
        <text x="14" y="40" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">IBL &amp; AgX ToneMapping</text>
      </g>
    </g>
  </g>
</svg>`;

    const bannerPath = path.join(assetsDir, 'banner.svg');
    fs.writeFileSync(bannerPath, bannerSvg, 'utf-8');
    expect(fs.existsSync(bannerPath)).toBe(true);
  });
});
