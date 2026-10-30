import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { FurnitureItem, Wall, Corner } from '../src/core/types';
import { FloorplanCanvas2D } from '../src/components/editor2d/FloorplanCanvas2D';
import { TopBar } from '../src/components/layout/TopBar';
import { PassageClearance3D } from '../src/components/viewer3d/PassageClearance3D';
import { getPassageBadgeTextColor } from '../src/core/ergonomicsEngine';

vi.mock('@react-three/drei', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@react-three/drei');
  return {
    ...actual,
    Html: ({ children, position, center, distanceFactor, style }: any) =>
      React.createElement(
        'div',
        {
          'data-component': 'drei-html',
          'data-position': position ? position.join(',') : undefined,
          'data-center': center ? 'true' : undefined,
          'data-distance-factor': distanceFactor,
          style,
        },
        children
      ),
  };
});

describe('Task 5: 2D & 3D Ergonomie- & Laufwege-Heatmap Overlay', () => {
  // Test furniture configuration:
  // Item 1: (100, 100), 100x100 -> X from 50 to 150
  // Item 2: (195, 100), 100x100 -> X from 145 to 245 -> overlap or 45 cm? Wait:
  // If Item 1 center is 100, X is 50..150.
  // If Item 2 center is 195, X is 145..245 -> distance is 0 (overlap).
  // For 45 cm clearance: Item 2 center = 150 + 45 + 50 = 245. X is 195..295. Clearance = 45 cm (CRITICAL < 60)
  // For 75 cm clearance: Item 3 center = 295 + 75 + 50 = 420. X is 370..470. Clearance = 75 cm (WARNING 60..90)
  // For 105 cm clearance: Item 4 center = 470 + 105 + 50 = 625. X is 575..675. Clearance = 105 cm (OPTIMAL 90..120)
  const testFurniture: FurnitureItem[] = [
    {
      id: 'f-crit-1',
      name: 'Schreibtisch A',
      category: 'office',
      widthCm: 100,
      depthCm: 100,
      heightCm: 75,
      x: 100,
      z: 100,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#94a3b8',
    },
    {
      id: 'f-crit-2',
      name: 'Schreibtisch B',
      category: 'office',
      widthCm: 100,
      depthCm: 100,
      heightCm: 75,
      x: 245,
      z: 100,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#94a3b8',
    },
    {
      id: 'f-warn-3',
      name: 'Regal C',
      category: 'storage',
      widthCm: 100,
      depthCm: 100,
      heightCm: 120,
      x: 420,
      z: 100,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#94a3b8',
    },
    {
      id: 'f-opt-4',
      name: 'Sessel D',
      category: 'living',
      widthCm: 100,
      depthCm: 100,
      heightCm: 80,
      x: 625,
      z: 100,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#94a3b8',
    },
  ];

  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('empty-room');
    useFloorplanStore.setState({
      showPassageHeatmap: false,
      furniture: testFurniture,
      walls: [],
      corners: [],
    });
  });

  describe('getPassageBadgeTextColor helper', () => {
    it('returns dark text for amber warning badges and white text for others', () => {
      expect(getPassageBadgeTextColor('warning')).toBe('#0f172a');
      expect(getPassageBadgeTextColor('critical')).toBe('#ffffff');
      expect(getPassageBadgeTextColor('optimal')).toBe('#ffffff');
    });
  });

  describe('2D FloorplanCanvas2D Passage Overlay', () => {
    it('does not render passage heatmap lines, circles, or badges when showPassageHeatmap is false', () => {
      useFloorplanStore.setState({ showPassageHeatmap: false });
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(FloorplanCanvas2D));

      expect(html).not.toContain('passage-heatmap-group');
      expect(html).not.toContain('⚠️ 45 cm');
      expect(html).not.toContain('⚡ 75 cm');
      expect(html).not.toContain('✓ 105 cm');
      expect(html).not.toContain('stroke-dasharray="4 3"');
    });

    it('renders passage lines, anchor circles, and pill badges when showPassageHeatmap is true', () => {
      useFloorplanStore.getState().setShowPassageHeatmap(true);
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(FloorplanCanvas2D));

      expect(html).toContain('passage-heatmap-group');

      // Critical passage badge (< 60 cm): ⚠️ 45 cm with red color #ef4444
      expect(html).toContain('⚠️ 45 cm');
      expect(html).toContain('#ef4444');

      // Warning passage badge (60..90 cm): ⚡ 75 cm with amber color #f59e0b
      expect(html).toContain('⚡ 75 cm');
      expect(html).toContain('#f59e0b');

      // Optimal passage badge (90..120 cm): ✓ 105 cm with green color #10b981
      expect(html).toContain('✓ 105 cm');
      expect(html).toContain('#10b981');

      // Dashed lines
      expect(html).toContain('stroke-dasharray="4 3"');
      // Pointer events none on passage overlay group
      expect(html).toContain('class="passage-heatmap-group"');
      expect(html).toContain('pointer-events="none"');

      // Contrast text colors: warning badge uses dark text (#0f172a), others use white (#ffffff)
      expect(html).toContain('fill="#0f172a"');
      expect(html).toContain('fill="#ffffff"');
    });

    it('renders anchor circles at endpoints and rounded rect pill badges', () => {
      useFloorplanStore.getState().setShowPassageHeatmap(true);
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(FloorplanCanvas2D));

      // Anchor circles with r="3"
      expect(html).toContain('r="3"');
      // Pill rects with rounded corners rx="8" or rx="10"
      expect(html).toMatch(/rx="(8|10)"/);
    });
  });

  describe('TopBar Laufwege Toggle Button', () => {
    it('renders Laufwege button with critical count when critical passages exist', () => {
      useFloorplanStore.setState({ showPassageHeatmap: false, furniture: testFurniture });
      const htmlOff = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));

      // Solange die Heatmap aus ist, rechnet der Store nicht mit. Die Taste zeigt keine Zahl.
      expect(htmlOff).toContain('>Laufwege</span>');
      expect(htmlOff).not.toContain('Laufwege (');
      expect(htmlOff).not.toMatch(/<button[^>]*class="[^"]*active[^"]*"[^>]*title="[^"]*DIN 18040/);
      expect(htmlOff).toContain('aria-pressed="false"');

      useFloorplanStore.getState().setShowPassageHeatmap(true);
      const htmlOn = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));
      expect(htmlOn).toContain('Laufwege (1 ⚠️)');
    });

    it('renders clean "Laufwege" label when 0 critical passages exist', () => {
      // Keep only warning and optimal items
      const nonCriticalFurniture = testFurniture.slice(1);
      useFloorplanStore.setState({
        showPassageHeatmap: false,
        furniture: nonCriticalFurniture,
      });
      useFloorplanStore.getState().setShowPassageHeatmap(true);
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));

      expect(html).toContain('>Laufwege</span>');
      expect(html).not.toContain('Laufwege (');
    });

    it('renders button with active class when showPassageHeatmap is true', () => {
      useFloorplanStore.setState({ showPassageHeatmap: true });
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));

      expect(html).toMatch(/<button[^>]*class="[^"]*active[^"]*"[^>]*title="[^"]*DIN 18040/);
      expect(html).toContain('aria-pressed="true"');
    });

    it('has informative tooltip title mentioning DIN 18040', () => {
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));
      expect(html).toContain('title="');
      expect(html).toMatch(/title="[^"]*DIN 18040[^"]*"/);
    });

    it('toggles store showPassageHeatmap state when clicked', () => {
      useFloorplanStore.setState({ showPassageHeatmap: false });
      const stateBefore = useFloorplanStore.getState().showPassageHeatmap;
      expect(stateBefore).toBe(false);

      useFloorplanStore.getState().setShowPassageHeatmap(true);
      expect(useFloorplanStore.getState().showPassageHeatmap).toBe(true);

      useFloorplanStore.getState().setShowPassageHeatmap(false);
      expect(useFloorplanStore.getState().showPassageHeatmap).toBe(false);
    });
  });

  describe('3D PassageClearance3D Component', () => {
    it('returns null and renders nothing when showPassageHeatmap is false', () => {
      useFloorplanStore.setState({ showPassageHeatmap: false });
      const markup = ReactDOMServer.renderToStaticMarkup(React.createElement(PassageClearance3D));
      expect(markup).toBe('');
    });

    it('renders plane mesh strips and Html pill badges for passages when active', async () => {
      useFloorplanStore.getState().setShowPassageHeatmap(true);
      const markup = ReactDOMServer.renderToStaticMarkup(React.createElement(PassageClearance3D));

      // Mesh strips
      expect(markup).toContain('planeGeometry');
      expect(markup).toContain('meshBasicMaterial');
      expect(markup).toContain('opacity="0.8"');

      // Verify depthWrite={false} is set to prevent z-fighting with floors
      const fs = await import('fs');
      const path = await import('path');
      const compCode = fs.readFileSync(
        path.resolve(__dirname, '../src/components/viewer3d/PassageClearance3D.tsx'),
        'utf-8'
      );
      expect(compCode).toContain('depthWrite={false}');

      // Severity colors
      expect(markup).toContain('color="#ef4444"'); // critical
      expect(markup).toContain('color="#f59e0b"'); // warning
      expect(markup).toContain('color="#10b981"'); // optimal

      // Drei Html element
      expect(markup).toContain('data-component="drei-html"');
      expect(markup).toContain('data-distance-factor="140"');

      // Badge pill content
      expect(markup).toContain('⚠️ 45 cm');
      expect(markup).toContain('⚡ 75 cm');
      expect(markup).toContain('✓ 105 cm');

      // Warning badge uses dark text for contrast
      expect(markup).toContain('color:#0f172a');
    });
  });

  describe('Scene3D Integration', () => {
    it('mounts PassageClearance3D inside Scene3D source code', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const sceneCode = fs.readFileSync(
        path.resolve(__dirname, '../src/components/viewer3d/Scene3D.tsx'),
        'utf-8'
      );
      expect(sceneCode).toContain("import { PassageClearance3D } from './PassageClearance3D';");
      expect(sceneCode).toContain('<PassageClearance3D />');
    });
  });
});
