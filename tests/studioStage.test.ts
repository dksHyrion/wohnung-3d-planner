import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Corner, Wall, WallOpening } from '../src/core/types';

// Mock useFrame from @react-three/fiber so WallMesh3D can be rendered without a WebGL Canvas
vi.mock('@react-three/fiber', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@react-three/fiber');
  return {
    ...actual,
    useFrame: vi.fn(),
  };
});

vi.mock('@react-three/drei', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@react-three/drei');
  return {
    ...actual,
    ContactShadows: (props: any) => React.createElement('contactShadows', props),
    Environment: (props: any) => React.createElement('environment', props, props.children),
    Lightformer: (props: any) => React.createElement('lightformer', props),
    SoftShadows: (props: any) => React.createElement('softShadows', props),
    RoundedBox: (props: any) => React.createElement('roundedBox', props, props.children),
  };
});

describe('StudioStage3D and Architectural Wall Caps (Phase 1)', () => {
  it('exports StudioStage3D component with expected props', async () => {
    const studioMod = await import('../src/components/viewer3d/StudioStage3D');
    expect(typeof studioMod.StudioStage3D).toBe('function');

    const element = React.createElement(studioMod.StudioStage3D, {
      roomBounds: {
        minX: 0,
        maxX: 500,
        minZ: 0,
        maxZ: 400,
        cx: 250,
        cz: 200,
      },
    });
    expect(element).toBeDefined();
    expect(element.type).toBe(studioMod.StudioStage3D);
  });

  it('exports wall cap constants and computeWallCaps calculation function', async () => {
    const wallMod = await import('../src/components/viewer3d/WallMesh3D');
    expect(wallMod.WALL_CAP_COLOR).toBe('#2e2a26');
    expect(wallMod.WALL_CAP_HEIGHT_CM).toBe(1.5);
    expect(wallMod.WALL_CAP_THICKNESS_OFFSET_CM).toBe(0.4);
    expect(typeof wallMod.computeWallCaps).toBe('function');
  });

  it('computes solid architectural cap for a full wall without openings', async () => {
    const { computeWallCaps, computeWallSubSegments } = await import(
      '../src/components/viewer3d/WallMesh3D'
    );
    const caps = computeWallCaps(250, 15, computeWallSubSegments(350, 250, []));

    expect(caps.length).toBe(1);
    expect(caps[0].widthCm).toBe(350);
    expect(caps[0].heightCm).toBe(1.5);
    expect(caps[0].thicknessCm).toBe(15.4);
    expect(caps[0].color).toBe('#2e2a26');
    expect(caps[0].centerYCm).toBeCloseTo(250 + 1.5 / 2, 2);
  });

  it('computes solid architectural cap for a cutaway wall at cutaway height', async () => {
    const { computeCutawayCaps } = await import('../src/components/viewer3d/WallMesh3D');
    const caps = computeCutawayCaps(400, 18, []);

    expect(caps.length).toBe(1);
    expect(caps[0].widthCm).toBe(400);
    expect(caps[0].heightCm).toBe(1.5);
    expect(caps[0].thicknessCm).toBe(18.4);
    expect(caps[0].color).toBe('#2e2a26');
    // Cutaway height is 30 cm
    expect(caps[0].centerYCm).toBeCloseTo(30 + 1.5 / 2, 2);
  });

  it('lässt im Schnitt die Tür bis zum Boden frei und kappt Fenster nicht', async () => {
    const { computeCutawayWallSegments, computeCutawayCaps } = await import(
      '../src/components/viewer3d/WallMesh3D'
    );
    const door: WallOpening = {
      id: 'door-1',
      wallId: 'w1',
      type: 'door',
      offsetFromStartCm: 120,
      widthCm: 90,
      heightCm: 210,
      sillHeightCm: 0,
    };
    const segments = computeCutawayWallSegments(400, [door]);
    expect(segments.map((segment) => segment.widthCm)).toEqual([120, 190]);
    expect(segments.every((segment) => segment.heightCm === 30)).toBe(true);

    const caps = computeCutawayCaps(400, 18, [door]);
    expect(caps.map((cap) => cap.widthCm)).toEqual([120, 190]);

    const windowed = computeCutawayWallSegments(400, [
      {
        id: 'win-1',
        wallId: 'w1',
        type: 'window',
        offsetFromStartCm: 100,
        widthCm: 120,
        heightCm: 130,
        sillHeightCm: 90,
      },
    ]);
    expect(windowed).toHaveLength(1);
    expect(windowed[0].widthCm).toBe(400);
  });

  it('computes wall caps along top segments for a wall with window opening', async () => {
    const { computeWallCaps, computeWallSubSegments } = await import(
      '../src/components/viewer3d/WallMesh3D'
    );
    const openings: WallOpening[] = [
      {
        id: 'win-1',
        wallId: 'w1',
        type: 'window',
        offsetFromStartCm: 100,
        widthCm: 120,
        heightCm: 130,
        sillHeightCm: 90,
      },
    ];

    const caps = computeWallCaps(250, 15, computeWallSubSegments(400, 250, openings));
    // Should cap left segment (100cm), lintel (120cm), and right segment (180cm)
    expect(caps.length).toBe(3);
    const totalCapWidth = caps.reduce((sum, c) => sum + c.widthCm, 0);
    expect(totalCapWidth).toBeCloseTo(400, 2);
    caps.forEach((cap) => {
      expect(cap.heightCm).toBe(1.5);
      expect(cap.thicknessCm).toBe(15.4);
      expect(cap.color).toBe('#2e2a26');
      expect(cap.centerYCm).toBeCloseTo(250 + 1.5 / 2, 2);
    });
  });

  it('computes wall caps along top segments for a wall with a door opening (sill = 0, lintel at top)', async () => {
    const { computeWallCaps, computeWallSubSegments } = await import(
      '../src/components/viewer3d/WallMesh3D'
    );
    const openings: WallOpening[] = [
      {
        id: 'door-1',
        wallId: 'w1',
        type: 'door',
        offsetFromStartCm: 120,
        widthCm: 90,
        heightCm: 210,
        sillHeightCm: 0,
      },
    ];

    const caps = computeWallCaps(250, 15, computeWallSubSegments(400, 250, openings));
    // Left segment (0..120), lintel (120..210), right segment (210..400)
    expect(caps.length).toBe(3);
    const totalCapWidth = caps.reduce((sum, c) => sum + c.widthCm, 0);
    expect(totalCapWidth).toBeCloseTo(400, 2);
    caps.forEach((cap) => {
      expect(cap.heightCm).toBe(1.5);
      expect(cap.thicknessCm).toBe(15.4);
      expect(cap.color).toBe('#2e2a26');
      expect(cap.centerYCm).toBeCloseTo(250 + 1.5 / 2, 2);
    });
  });

  it('toggles render theme between studio and blueprint in useFloorplanStore', async () => {
    const { useFloorplanStore } = await import('../src/store/useFloorplanStore');
    expect(useFloorplanStore.getState().renderTheme).toBe('studio');

    useFloorplanStore.getState().setRenderTheme('blueprint');
    expect(useFloorplanStore.getState().renderTheme).toBe('blueprint');

    useFloorplanStore.getState().setRenderTheme('studio');
    expect(useFloorplanStore.getState().renderTheme).toBe('studio');
  });

  it('renders wall cap meshes in WallMesh3D markup output', async () => {
    const { WallMesh3D } = await import('../src/components/viewer3d/WallMesh3D');

    const wall: Wall = {
      id: 'w-test',
      startCornerId: 'c1',
      endCornerId: 'c2',
      thicknessCm: 15,
      heightCm: 250,
    };
    const start: Corner = { id: 'c1', x: 0, z: 0 };
    const end: Corner = { id: 'c2', x: 300, z: 0 };

    const markup = ReactDOMServer.renderToStaticMarkup(
      React.createElement(WallMesh3D, {
        wall,
        start,
        end,
        openings: [],
        roomCenter: { x: 150, z: 150 },
        cutawayEnabled: false,
        isSelected: false,
        onSelectWall: () => {},
        onSelectOpening: () => {},
      })
    );

    expect(markup).toContain('name="wall-cap"');
    expect(markup).toContain('color="#2e2a26"');
  });

  describe('Architectural Studio Plinth and Self-Hosted Environment (Task 4)', () => {
    it('exports computePlinthBounds helper with 60cm margin, 20cm height and -0.5cm top offset to prevent floor z-fighting', async () => {
      const studioMod = await import('../src/components/viewer3d/StudioStage3D') as any;
      expect(typeof studioMod.computePlinthBounds).toBe('function');
      expect(studioMod.PLINTH_TOP_OFFSET_CM).toBe(-0.5);

      const bounds = studioMod.computePlinthBounds({
        minX: 0,
        maxX: 500,
        minZ: 0,
        maxZ: 500,
        cx: 250,
        cz: 250,
      });

      expect(bounds.widthCm).toBe(500 + 120);
      expect(bounds.depthCm).toBe(500 + 120);
      expect(bounds.heightCm).toBe(20);
      expect(bounds.centerYCm).toBe(-10.5);
      expect(bounds.centerX).toBe(250);
      expect(bounds.centerZ).toBe(250);
    });

    it('enforces minimum 600cm plinth size for small spans', async () => {
      const { computePlinthBounds } = await import('../src/components/viewer3d/StudioStage3D') as any;
      const bounds = computePlinthBounds({
        minX: 0,
        maxX: 100,
        minZ: 0,
        maxZ: 100,
        cx: 50,
        cz: 50,
      });

      expect(bounds.widthCm).toBe(600);
      expect(bounds.depthCm).toBe(600);
      expect(bounds.heightCm).toBe(20);
      expect(bounds.centerYCm).toBe(-10.5);
    });

    it('renders StudioStage3D in studio theme without errors and includes plinth, environment and stable PCF shadows without SoftShadows', async () => {
      const {
        StudioStage3D,
        SUN_SHADOW_BIAS,
        SUN_SHADOW_NORMAL_BIAS_CM,
      } = await import('../src/components/viewer3d/StudioStage3D') as any;
      expect(SUN_SHADOW_BIAS).toBe(-0.0004);
      expect(SUN_SHADOW_NORMAL_BIAS_CM).toBe(1.2);

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(StudioStage3D, {
          roomBounds: { minX: 0, maxX: 600, minZ: 0, maxZ: 500, cx: 300, cz: 250 },
          theme: 'studio',
        })
      );

      expect(markup).toContain('name="studio-stage"');
      expect(markup).toContain('roundedBox');
      expect(markup).toContain('environment');
      expect(markup).toContain('name="studio-ground-plane"');
      expect(markup).not.toContain('softShadows');
      expect(markup).toContain('shadow-normalBias="1.2"');
      // ContactShadows baked once (frames="1") in both beauty and performance modes
      expect(markup).toContain('frames="1"');
    });

    it('sets ContactShadows frames to 1 in performance quality mode', async () => {
      const { StudioStage3D } = await import('../src/components/viewer3d/StudioStage3D');
      const { useFloorplanStore } = await import('../src/store/useFloorplanStore');
      useFloorplanStore.getState().setQualityMode('performance');

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(StudioStage3D, {
          roomBounds: { minX: 0, maxX: 600, minZ: 0, maxZ: 500, cx: 300, cz: 250 },
          theme: 'studio',
        })
      );

      expect(markup).toContain('frames="1"');
      expect(markup).toContain('name="floor-contact-shadows"');
      expect(markup).toContain('resolution="512"');
      expect(markup).toContain('opacity="0.42"');
      // Restore beauty mode
      useFloorplanStore.getState().setQualityMode('beauty');
    });

    it('renders StudioStage3D in blueprint theme without plinth or environment', async () => {
      const { StudioStage3D } = await import('../src/components/viewer3d/StudioStage3D');
      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(StudioStage3D, {
          roomBounds: { minX: 0, maxX: 600, minZ: 0, maxZ: 500, cx: 300, cz: 250 },
          theme: 'blueprint',
        })
      );

      expect(markup).toContain('name="studio-stage"');
      expect(markup).not.toContain('roundedBox');
      expect(markup).not.toContain('environment');
      expect(markup).not.toContain('name="studio-ground-plane"');
    });
  });
});
