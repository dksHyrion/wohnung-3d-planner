import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { useFloorplanStore } from '../src/store/useFloorplanStore';

vi.mock('@react-three/postprocessing', () => ({
  EffectComposer: ({ children, multisampling, enableNormalPass }: any) =>
    React.createElement('effect-composer', { 'data-multisampling': multisampling, 'data-normal-pass': enableNormalPass }, children),
  N8AO: (props: any) => React.createElement('n8-ao', { 'data-radius': props.aoRadius, 'data-intensity': props.intensity, 'data-color': props.color, 'data-quality': props.quality }),
  Bloom: (props: any) => React.createElement('bloom-effect', { 'data-threshold': props.luminanceThreshold, 'data-intensity': props.intensity }),
  ToneMapping: (props: any) => React.createElement('tone-mapping', { 'data-mode': props.mode }),
  Vignette: (props: any) => React.createElement('vignette-effect', { 'data-offset': props.offset, 'data-darkness': props.darkness }),
  SMAA: () => React.createElement('smaa-effect', null),
}));

vi.mock('../src/store/useFloorplanStore', async () => {
  const actual = await vi.importActual<any>('../src/store/useFloorplanStore');
  const store = actual.useFloorplanStore;
  const useMockStore = (selector: (s: any) => any) => selector(store.getState());
  Object.assign(useMockStore, store);
  return {
    ...actual,
    useFloorplanStore: useMockStore,
  };
});

describe('PostFX3D Pipeline Configuration & Rendering', () => {
  beforeEach(() => {
    (useFloorplanStore as any).getInitialState = () => useFloorplanStore.getState();
    useFloorplanStore.setState({
      qualityMode: 'beauty',
      timeOfDay: 18.0,
      renderTheme: 'studio',
    });
  });

  it('exports PostFX3D component function', async () => {
    const mod = await import('../src/components/viewer3d/PostFX3D');
    expect(typeof mod.PostFX3D).toBe('function');
  });

  it('exports N8AO and Bloom tuning constants for cm scale', async () => {
    const mod = await import('../src/components/viewer3d/PostFX3D');
    expect(mod.N8AO_RADIUS_CM).toBe(36);
    expect(mod.BLOOM_LUMINANCE_THRESHOLD).toBe(1.0);
  });

  it('renders complete pipeline in beauty mode with studio theme without throwing', async () => {
    const { PostFX3D } = await import('../src/components/viewer3d/PostFX3D');
    useFloorplanStore.setState({
      qualityMode: 'beauty',
      renderTheme: 'studio',
      timeOfDay: 18.0,
    });

    const markup = ReactDOMServer.renderToStaticMarkup(React.createElement(PostFX3D));
    expect(markup).toContain('effect-composer');
    expect(markup).toContain('data-normal-pass="true"');
    expect(markup).toContain('n8-ao');
    expect(markup).toContain('data-radius="36"');
    expect(markup).toContain('data-quality="high"');
    expect(markup).toContain('data-color="#2e241f"');
    expect(markup).toContain('bloom-effect');
    expect(markup).toContain('data-threshold="1"');
    expect(markup).toContain('tone-mapping');
    expect(markup).toContain('vignette-effect');
  });

  it('completely unmounts EffectComposer (returns empty markup) in performance mode for zero FBO overhead', async () => {
    const { PostFX3D } = await import('../src/components/viewer3d/PostFX3D');
    useFloorplanStore.setState({
      qualityMode: 'performance',
      renderTheme: 'studio',
      timeOfDay: 18.0,
    });

    const markup = ReactDOMServer.renderToStaticMarkup(React.createElement(PostFX3D));
    expect(markup).toBe('');
  });

  it('completely unmounts EffectComposer when renderTheme is blueprint', async () => {
    const { PostFX3D } = await import('../src/components/viewer3d/PostFX3D');
    useFloorplanStore.setState({
      qualityMode: 'beauty',
      renderTheme: 'blueprint',
      timeOfDay: 18.0,
    });

    const markup = ReactDOMServer.renderToStaticMarkup(React.createElement(PostFX3D));
    expect(markup).toBe('');
  });
});
