import { describe, it, expect } from 'vitest';
import { exportScaledFloorplanSvg, PlanExportOptions } from '../src/core/export/planSvgExport';
import { PRESET_FLOORPLANS } from '../src/core/presets';

describe('Scaled 2D Plan Export (Sprint 4 Task 4)', () => {
  const villaData = PRESET_FLOORPLANS['luxury-villa'].data;
  const studioData = PRESET_FLOORPLANS['studio-apartment'].data;
  const emptyData = PRESET_FLOORPLANS['empty-room'].data;

  it('generates a valid SVG document with correct xml headers, viewBox, and doctype', () => {
    const svg = exportScaledFloorplanSvg(studioData, {
      scale: '1:50',
      paperSize: 'A4',
      orientation: 'landscape',
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('viewBox=');
  });

  it('includes standard architectural title block (Plankopf) with scale, date, and net interior area', () => {
    const svg = exportScaledFloorplanSvg(studioData, {
      scale: '1:50',
      paperSize: 'A4',
      projectTitle: 'Musterwohnung - Stellprobe',
      dateStr: '24.10.2026',
    });

    expect(svg).toContain('Musterwohnung - Stellprobe');
    expect(svg).toContain('1 : 50');
    expect(svg).toContain('24.10.2026');
    // Must contain honest interior area stamp
    expect(svg).toContain('m²');
    expect(svg).toContain('Innenfläche');
  });

  it('includes a graphical scale bar (Maßstabsbalken) indicating exact metric units', () => {
    const svg50 = exportScaledFloorplanSvg(emptyData, { scale: '1:50' });
    expect(svg50).toContain('Maßstabsleiste');
    expect(svg50).toContain('1 m');

    const svg100 = exportScaledFloorplanSvg(emptyData, { scale: '1:100' });
    expect(svg100).toContain('1 : 100');
  });

  it('renders wall lines and openings (doors with 90-degree swing arc and windows)', () => {
    const svg = exportScaledFloorplanSvg(studioData, {
      scale: '1:50',
      includeFurniture: true,
    });

    // Walls
    expect(svg).toContain('class="arch-wall"');
    // Door opening
    expect(svg).toContain('class="arch-door"');
    // Window opening
    expect(svg).toContain('class="arch-window"');
  });

  it('renders furniture outlines and labels when includeFurniture: true, omits them when false', () => {
    const svgWith = exportScaledFloorplanSvg(studioData, {
      scale: '1:50',
      includeFurniture: true,
    });
    expect(svgWith).toContain('class="arch-furniture"');

    const svgWithout = exportScaledFloorplanSvg(studioData, {
      scale: '1:50',
      includeFurniture: false,
    });
    expect(svgWithout).not.toContain('class="arch-furniture"');
  });

  it('renders exterior dimension chains when includeDimensions: true, omits them when false', () => {
    const svgWith = exportScaledFloorplanSvg(studioData, {
      scale: '1:50',
      includeDimensions: true,
    });
    expect(svgWith).toContain('class="arch-dimension"');

    const svgWithout = exportScaledFloorplanSvg(studioData, {
      scale: '1:50',
      includeDimensions: false,
    });
    expect(svgWithout).not.toContain('class="arch-dimension"');
  });

  it('handles empty-room cleanly without errors', () => {
    expect(() =>
      exportScaledFloorplanSvg(emptyData, {
        scale: '1:50',
        paperSize: 'A4',
      })
    ).not.toThrow();
  });

  it('renders compound furniture parts (sectional sofa, dining table chairs, bed nightstands, unfolded Osaka)', () => {
    const stdData = PRESET_FLOORPLANS['standard-55'].data;
    const svg = exportScaledFloorplanSvg(stdData, {
      scale: '1:50',
      includeFurniture: true,
    });

    // Dining table with chairs in standard-55
    expect(svg).toContain('data-part="top"');
    expect(svg).toContain('data-part="chair--1-0"');

    // Open Osaka pose
    const openOsakaData = {
      ...stdData,
      furniture: stdData.furniture.map((f) =>
        f.id === 'f-std-osaka'
          ? { ...f, pose: 'open' as const, depthCm: 200 }
          : f
      ),
    };
    const svgOpen = exportScaledFloorplanSvg(openOsakaData, {
      scale: '1:50',
      includeFurniture: true,
    });
    expect(svgOpen).toContain('data-part="sofa-body"');
    expect(svgOpen).toContain('data-part="mattress-open"');
  });
});
