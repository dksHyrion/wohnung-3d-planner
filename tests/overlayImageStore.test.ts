import { describe, it, expect } from 'vitest';
import { fitSize, backgroundImageForExport, isHeavyImageUrl } from '../src/core/overlayImageStore';
import { BackgroundImageOverlay } from '../src/core/types';

describe('overlayImageStore', () => {
  it('begrenzt die längere Kante auf 1920 px', () => {
    expect(fitSize(3840, 2160)).toEqual({ width: 1920, height: 1080 });
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitSize(1000, 4000).height).toBe(1920);
  });

  it('entfernt Data-URLs aus dem Export', () => {
    const image: BackgroundImageOverlay = {
      id: 'bg-1',
      imageId: 'bg-1',
      url: 'data:image/png;base64,aaaa',
      filename: 'plan.png',
      xCm: 0,
      zCm: 0,
      widthCm: 100,
      heightCm: 80,
      rotationDeg: 0,
      opacity: 0.5,
      visible: true,
      locked: false,
      naturalWidthPx: 100,
      naturalHeightPx: 80,
    };
    const exported = backgroundImageForExport(image);
    expect(exported?.url).toBe('');
    expect(exported?.imageId).toBe('bg-1');
    expect(exported?.widthCm).toBe(100);
    expect(isHeavyImageUrl('blob:http://local/1')).toBe(true);
  });
});
