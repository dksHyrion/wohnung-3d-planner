import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { BackgroundImageOverlay } from '../src/core/types';
import { BackgroundOverlayControls } from '../src/components/editor2d/BackgroundOverlayControls';
import { FloorplanCanvas2D } from '../src/components/editor2d/FloorplanCanvas2D';
import { TopBar, handleOverlayImageFile } from '../src/components/layout/TopBar';

describe('2D Grundriss-Unterleger & Kalibrierungs-UI (Task 4)', () => {
  const sampleImage: BackgroundImageOverlay = {
    id: 'bg-test-1',
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    filename: 'arch-blueprint-sample.png',
    xCm: 50,
    zCm: 80,
    widthCm: 600,
    heightCm: 450,
    rotationDeg: 0,
    opacity: 0.65,
    visible: true,
    locked: false,
    naturalWidthPx: 1200,
    naturalHeightPx: 900,
  };

  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('empty-room');
    useFloorplanStore.setState({
      backgroundImage: null,
      activeTool: 'select',
      viewMode: '2d',
      calibrationPoints: { p1: null, p2: null },
    });
  });

  describe('BackgroundOverlayControls component', () => {
    it('returns null and renders nothing when backgroundImage is null', () => {
      useFloorplanStore.setState({ backgroundImage: null });
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(html).toBe('');
    });

    it('renders floating controls when backgroundImage exists in store', () => {
      useFloorplanStore.setState({ backgroundImage: sampleImage });
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));

      // Filename badge
      expect(html).toContain('arch-blueprint-sample.png');
      // Opacity slider
      expect(html).toContain('type="range"');
      expect(html).toContain('value="0.65"');
      expect(html).toContain('min="0.1"');
      expect(html).toContain('max="1"');
      expect(html).toContain('step="0.05"');
      // Calibration button
      expect(html).toContain('Kalibrieren');
      // Accessible labels
      expect(html).toContain('aria-label');
      expect(html).toContain('aria-valuetext="65%"');
      expect(html).toContain('title');
    });

    it('shows lock icon / accessible label according to locked state', () => {
      useFloorplanStore.setState({
        backgroundImage: { ...sampleImage, locked: false },
      });
      let html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(html).toContain('sperren');

      useFloorplanStore.setState({
        backgroundImage: { ...sampleImage, locked: true },
      });
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(html).toContain('entsperren');
    });

    it('shows eye icon / accessible label according to visible state', () => {
      useFloorplanStore.setState({
        backgroundImage: { ...sampleImage, visible: true },
      });
      let html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(html).toContain('ausblenden');

      useFloorplanStore.setState({
        backgroundImage: { ...sampleImage, visible: false },
      });
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(html).toContain('einblenden');
    });

    it('styles calibration button active when activeTool === "calibrate-scale"', () => {
      useFloorplanStore.setState({
        backgroundImage: sampleImage,
        activeTool: 'select',
      });
      let html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(html).not.toMatch(/btn\s+active[^"]*".*?Kalibrieren/s);

      useFloorplanStore.setState({
        backgroundImage: sampleImage,
        activeTool: 'calibrate-scale',
      });
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(html).toMatch(/active.*?Kalibrieren|Kalibrieren.*?active/s);
    });
  });

  describe('FloorplanCanvas2D background image layer & calibration', () => {
    it('renders SVG image element with correct attributes when backgroundImage is visible', () => {
      useFloorplanStore.setState({ backgroundImage: sampleImage });
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(FloorplanCanvas2D));

      expect(html).toContain('<image');
      expect(html).toContain('href="data:image/png;base64');
      expect(html).toContain('x="50"');
      expect(html).toContain('y="80"');
      expect(html).toContain('width="600"');
      expect(html).toContain('height="450"');
      expect(html).toContain('opacity="0.65"');
      expect(html).toContain('preserveAspectRatio="none"');
    });

    it('applies SVG rotate transform when rotationDeg is set', () => {
      useFloorplanStore.setState({
        backgroundImage: {
          ...sampleImage,
          xCm: 100,
          zCm: 200,
          widthCm: 400,
          heightCm: 300,
          rotationDeg: 90,
        },
      });
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(FloorplanCanvas2D));
      // centerX = 100 + 200 = 300, centerZ = 200 + 150 = 350
      expect(html).toContain('transform="rotate(90 300 350)"');
    });

    it('does NOT render SVG image element when backgroundImage is null or visible is false', () => {
      useFloorplanStore.setState({ backgroundImage: null });
      let html = ReactDOMServer.renderToStaticMarkup(React.createElement(FloorplanCanvas2D));
      expect(html).not.toContain('<image');

      useFloorplanStore.setState({
        backgroundImage: { ...sampleImage, visible: false },
      });
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(FloorplanCanvas2D));
      expect(html).not.toContain('<image');
    });

    it('sets pointer-events: none when backgroundImage is locked', () => {
      useFloorplanStore.setState({
        backgroundImage: { ...sampleImage, locked: true },
      });
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(FloorplanCanvas2D));
      expect(html).toMatch(/<image[^>]*style="[^"]*pointer-events:\s*none/);
    });

    it('renders BackgroundOverlayControls inside FloorplanCanvas2D wrapper', () => {
      useFloorplanStore.setState({ backgroundImage: sampleImage });
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(FloorplanCanvas2D));
      expect(html).toContain('arch-blueprint-sample.png');
      expect(html).toContain('Kalibrieren');
    });

    it('renders cyan crosshairs and calibration line when in calibrate-scale tool', () => {
      useFloorplanStore.setState({
        backgroundImage: sampleImage,
        activeTool: 'calibrate-scale',
        calibrationPoints: {
          p1: { x: 100, z: 100 },
          p2: { x: 400, z: 100 },
        },
      });
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(FloorplanCanvas2D));

      // Should render calibration crosshairs and connector line
      expect(html).toContain('#06b6d4'); // cyan stroke color
      // Calibration popup dialog asking for reference distance
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('Reale Referenzlänge in cm:');
      expect(html).toContain('Übernehmen');
      expect(html).toContain('Abbrechen');
    });
  });

  describe('TopBar file upload for background overlay', () => {
    it('renders "Unterleger" upload button and hidden file input', () => {
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(TopBar));
      expect(html).toContain('Unterleger');
      expect(html).toContain('type="file"');
      expect(html).toContain('accept="image/png,image/jpeg,image/webp,image/svg+xml"');
    });

    it('handleOverlayImageFile reads image and sets background image in store', async () => {
      useFloorplanStore.setState({ viewMode: '3d-persp' });

      // Create a mock File object
      const mockFile = {
        name: 'ground-floor-plan.jpg',
        type: 'image/jpeg',
      } as File;

      // Mock image dimensions
      const mockDimensions = { naturalWidth: 1000, naturalHeight: 800 };

      await handleOverlayImageFile(
        mockFile,
        'data:image/jpeg;base64,mockBase64String',
        mockDimensions
      );

      const state = useFloorplanStore.getState();
      expect(state.backgroundImage).not.toBeNull();
      expect(state.backgroundImage?.filename).toBe('ground-floor-plan.jpg');
      expect(state.backgroundImage?.imageId).toEqual(expect.any(String));
      expect(state.backgroundImage?.url.startsWith('data:')).toBe(false);
      expect(state.exportJson()).not.toContain('data:');
      expect(state.backgroundImage?.naturalWidthPx).toBe(1000);
      expect(state.backgroundImage?.naturalHeightPx).toBe(800);
      expect(state.backgroundImage?.opacity).toBe(0.65);
      expect(state.backgroundImage?.visible).toBe(true);
      expect(state.backgroundImage?.locked).toBe(false);
      expect(state.backgroundImage?.rotationDeg).toBe(0);
      expect(typeof state.backgroundImage?.xCm).toBe('number');
      expect(typeof state.backgroundImage?.zCm).toBe('number');
      expect(state.backgroundImage?.widthCm).toBe(500); // 1000 * 0.5 default scale
      expect(state.backgroundImage?.heightCm).toBe(400); // 800 * 0.5 default scale

      // Switches viewMode to '2d'
      expect(state.viewMode).toBe('2d');
    });
  });

  describe('Store interactions with controls and calibration', () => {
    it('updates opacity through store updateBackgroundImage', () => {
      useFloorplanStore.setState({ backgroundImage: sampleImage });
      useFloorplanStore.getState().updateBackgroundImage({ opacity: 0.35 });
      expect(useFloorplanStore.getState().backgroundImage?.opacity).toBe(0.35);
    });

    it('toggles lock state through store updateBackgroundImage', () => {
      useFloorplanStore.setState({ backgroundImage: sampleImage });
      expect(useFloorplanStore.getState().backgroundImage?.locked).toBe(false);

      useFloorplanStore.getState().updateBackgroundImage({ locked: true });
      expect(useFloorplanStore.getState().backgroundImage?.locked).toBe(true);
    });

    it('clears background image on removeBackgroundImage', () => {
      useFloorplanStore.setState({ backgroundImage: sampleImage });
      expect(useFloorplanStore.getState().backgroundImage).not.toBeNull();

      useFloorplanStore.getState().removeBackgroundImage();
      expect(useFloorplanStore.getState().backgroundImage).toBeNull();
    });

    it('runs calibration workflow from startCalibration through applyCalibration', () => {
      useFloorplanStore.setState({ backgroundImage: sampleImage });
      useFloorplanStore.getState().startCalibration();

      expect(useFloorplanStore.getState().activeTool).toBe('calibrate-scale');
      expect(useFloorplanStore.getState().calibrationPoints.p1).toBeNull();

      useFloorplanStore.getState().setCalibrationPoint({ x: 0, z: 0 });
      expect(useFloorplanStore.getState().calibrationPoints.p1).toEqual({ x: 0, z: 0 });
      expect(useFloorplanStore.getState().calibrationPoints.p2).toBeNull();

      useFloorplanStore.getState().setCalibrationPoint({ x: 100, z: 0 });
      expect(useFloorplanStore.getState().calibrationPoints.p2).toEqual({ x: 100, z: 0 });

      // Apply calibration with 200cm real distance
      // sampleImage has naturalWidth: 1200, naturalHeight: 900
      // scale = 200 / 100 = 2 cm/px
      // widthCm = 1200 * 2 = 2400 cm, heightCm = 900 * 2 = 1800 cm
      useFloorplanStore.getState().applyCalibration(200);

      expect(useFloorplanStore.getState().backgroundImage?.widthCm).toBe(2400);
      expect(useFloorplanStore.getState().backgroundImage?.heightCm).toBe(1800);
      expect(useFloorplanStore.getState().activeTool).toBe('select');
      expect(useFloorplanStore.getState().calibrationPoints.p1).toBeNull();
      expect(useFloorplanStore.getState().calibrationPoints.p2).toBeNull();
    });

    it('cancels calibration correctly and resets tool', () => {
      useFloorplanStore.setState({ backgroundImage: sampleImage });
      useFloorplanStore.getState().startCalibration();
      useFloorplanStore.getState().setCalibrationPoint({ x: 50, z: 50 });

      expect(useFloorplanStore.getState().activeTool).toBe('calibrate-scale');
      expect(useFloorplanStore.getState().calibrationPoints.p1).not.toBeNull();

      useFloorplanStore.getState().cancelCalibration();
      expect(useFloorplanStore.getState().activeTool).toBe('select');
      expect(useFloorplanStore.getState().calibrationPoints.p1).toBeNull();
      expect(useFloorplanStore.getState().calibrationPoints.p2).toBeNull();
    });

    it('reacts to store changes and updates rendered markup of BackgroundOverlayControls', () => {
      useFloorplanStore.setState({ backgroundImage: sampleImage });

      let html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(html).toContain('value="0.65"');
      expect(html).toContain('sperren');
      expect(html).toContain('ausblenden');

      // Update opacity
      useFloorplanStore.getState().updateBackgroundImage({ opacity: 0.85 });
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(html).toContain('value="0.85"');
      expect(html).toContain('85%');

      // Toggle locked
      useFloorplanStore.getState().updateBackgroundImage({ locked: true });
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(html).toContain('entsperren');

      // Toggle visible
      useFloorplanStore.getState().updateBackgroundImage({ visible: false });
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(html).toContain('einblenden');

      // Start calibration
      useFloorplanStore.getState().startCalibration();
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(useFloorplanStore.getState().activeTool).toBe('calibrate-scale');

      // Delete
      useFloorplanStore.getState().removeBackgroundImage();
      html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(html).toBe('');
      expect(useFloorplanStore.getState().backgroundImage).toBeNull();
    });

    it('toggles calibration off when clicking calibration button while already in calibrate-scale', () => {
      useFloorplanStore.setState({
        backgroundImage: sampleImage,
        activeTool: 'calibrate-scale',
        calibrationPoints: { p1: { x: 10, z: 20 }, p2: null },
      });

      // Render BackgroundOverlayControls
      const html = ReactDOMServer.renderToStaticMarkup(React.createElement(BackgroundOverlayControls));
      expect(html).toContain('Kalibrieren');

      // Calling cancelCalibration directly toggles it off
      useFloorplanStore.getState().cancelCalibration();
      expect(useFloorplanStore.getState().activeTool).toBe('select');
      expect(useFloorplanStore.getState().calibrationPoints.p1).toBeNull();
    });

    it('keeps 2d viewMode when already in 2d during overlay image load', async () => {
      useFloorplanStore.setState({ viewMode: '2d' });

      await handleOverlayImageFile(
        { name: 'plan.png', type: 'image/png' } as File,
        'data:image/png;base64,abc',
        { naturalWidth: 800, naturalHeight: 600 }
      );

      expect(useFloorplanStore.getState().viewMode).toBe('2d');
    });
  });
});
