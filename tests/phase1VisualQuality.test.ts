import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { Wall, Corner } from '../src/core/types';

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
    RoundedBox: (props: any) => React.createElement('roundedBox', props, props.children),
  };
});

vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children, multisampling, enableNormalPass }: any) =>
    React.createElement('effect-composer', { 'data-multisampling': multisampling, 'data-normal-pass': enableNormalPass }, children),
  N8AO: (props: any) =>
    React.createElement('n8-ao', {
      'data-radius': props.aoRadius,
      'data-intensity': props.intensity,
      'data-color': props.color,
      'data-quality': props.quality,
      'data-half-res': props.halfRes,
      'data-distance-falloff': props.distanceFalloff,
    }),
  Bloom: (props: any) =>
    React.createElement('bloom-effect', { 'data-threshold': props.luminanceThreshold, 'data-intensity': props.intensity }),
  ToneMapping: (props: any) => React.createElement('tone-mapping', { 'data-mode': props.mode }),
  Vignette: (props: any) => React.createElement('vignette-effect', { 'data-offset': props.offset, 'data-darkness': props.darkness }),
  SMAA: () => React.createElement('smaa-effect', null),
}));

describe('Phase 1: Visual Quality Upgrade (Real-time Architectural Lighting & Shadows)', () => {
  beforeEach(() => {
    useFloorplanStore.setState({
      qualityMode: 'beauty',
      renderTheme: 'studio',
      timeOfDay: 12.5,
      glowingWallCaps: true,
    });
  });

  describe('Floor-Level ContactShadows & Floor-Bounce Light (StudioStage3D)', () => {
    it('renders floor-level ContactShadows at Y=0.05cm with soft warm tint in beauty studio mode', async () => {
      const { StudioStage3D } = await import('../src/components/viewer3d/StudioStage3D');

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(StudioStage3D, {
          roomBounds: { minX: 0, maxX: 600, minZ: 0, maxZ: 500, cx: 300, cz: 250 },
          theme: 'studio',
        })
      );

      // Floor-level contact shadows
      expect(markup).toContain('name="floor-contact-shadows"');
      expect(markup).toContain('color="#292019"');
      expect(markup).toContain('position="300,0.05,250"');
      expect(markup).toContain('opacity="0.68"');
      expect(markup).toContain('blur="2.4"');
      expect(markup).toContain('resolution="1024"');
    });

    it('renders upward floor-bounce light simulating warm oak radiosity', async () => {
      const { StudioStage3D } = await import('../src/components/viewer3d/StudioStage3D');

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(StudioStage3D, {
          roomBounds: { minX: 0, maxX: 600, minZ: 0, maxZ: 500, cx: 300, cz: 250 },
          theme: 'studio',
        })
      );

      // Upward floor bounce light
      expect(markup).toContain('name="floor-bounce-light"');
      expect(markup).toContain('color="#fed7aa"');
      expect(markup).toContain('intensity="0.32"');
    });

    it('renders high-resolution Lightformer environment (512px) in beauty mode', async () => {
      const { StudioStage3D } = await import('../src/components/viewer3d/StudioStage3D');

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(StudioStage3D, {
          roomBounds: { minX: 0, maxX: 600, minZ: 0, maxZ: 500, cx: 300, cz: 250 },
          theme: 'studio',
        })
      );

      expect(markup).toContain('resolution="512"');
    });
  });

  describe('Cove Lighting on Full-Height Walls (WallMesh3D)', () => {
    it('renders wall-cap-glow cove strip along full-height non-cutaway walls when glowingWallCaps is enabled', async () => {
      const { WallMesh3D } = await import('../src/components/viewer3d/WallMesh3D');

      const wall: Wall = {
        id: 'w-full',
        startCornerId: 'c1',
        endCornerId: 'c2',
        thicknessCm: 15,
        heightCm: 250,
      };
      const start: Corner = { id: 'c1', x: 0, z: 0 };
      const end: Corner = { id: 'c2', x: 400, z: 0 };

      const markup = ReactDOMServer.renderToStaticMarkup(
        React.createElement(WallMesh3D, {
          wall,
          start,
          end,
          openings: [],
          roomCenter: { x: 200, z: 200 },
          cutawayEnabled: false,
          isCutaway: false,
          isSelected: false,
          onSelectWall: () => {},
          onSelectOpening: () => {},
        })
      );

      expect(markup).toContain('name="wall-cap"');
      expect(markup).toContain('name="wall-cap-glow"');
    });

    it('defaults glowingWallCaps to true in store', async () => {
      const { useFloorplanStore } = await import('../src/store/useFloorplanStore');
      expect(useFloorplanStore.getState().glowingWallCaps).toBe(true);
    });
  });

  describe('Post-Processing High-Quality Ambient Occlusion (PostFX3D)', () => {
    it('configures N8AO with enableNormalPass=true, quality=high, halfRes=false and warm tint', async () => {
      const { PostFX3D } = await import('../src/components/viewer3d/PostFX3D');

      const markup = ReactDOMServer.renderToStaticMarkup(React.createElement(PostFX3D));

      expect(markup).toContain('data-normal-pass="true"');
      expect(markup).toContain('data-quality="high"');
      expect(markup).toContain('data-half-res="false"');
      expect(markup).toContain('data-color="#2e241f"');
      expect(markup).toContain('data-radius="36"');
      expect(markup).toContain('data-distance-falloff="0.6"');
    });
  });
});
