import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import {
  BackgroundImageOverlay,
  EditorTool,
  Point2D,
  PassageSeverity,
  PassageClearance,
  PassageClearanceReport,
} from '../src/core/types';

describe('Store Tracing & Ergonomics State (Task 3)', () => {
  const sampleOverlay: BackgroundImageOverlay = {
    id: 'bg-1',
    url: 'blob:http://localhost/test-image-uuid',
    filename: 'ground-floor-blueprint.png',
    xCm: 200,
    zCm: 150,
    widthCm: 800,
    heightCm: 600,
    rotationDeg: 0,
    opacity: 0.6,
    visible: true,
    locked: false,
    naturalWidthPx: 1600,
    naturalHeightPx: 1200,
  };

  beforeEach(() => {
    // Reset to clean room preset
    useFloorplanStore.getState().loadPreset('empty-room');
    // Ensure clean tracing and heatmap state
    const state = useFloorplanStore.getState();
    if (state.removeBackgroundImage) {
      state.removeBackgroundImage();
    }
    if (state.setShowPassageHeatmap) {
      state.setShowPassageHeatmap(false);
    }
    if (state.cancelCalibration) {
      state.cancelCalibration();
    }
  });

  describe('Core Types Export Verification', () => {
    it('allows using calibrate-scale as EditorTool', () => {
      const tool: EditorTool = 'calibrate-scale';
      expect(tool).toBe('calibrate-scale');
    });

    it('re-exports ergonomics types and Point2D correctly', () => {
      const pt: Point2D = { x: 10, z: 20 };
      const sev: PassageSeverity = 'critical';
      const clearance: Partial<PassageClearance> = {
        severity: sev,
        clearanceCm: 45,
      };
      const report: Partial<PassageClearanceReport> = {
        criticalCount: 1,
        passages: [clearance as PassageClearance],
      };
      expect(pt.x).toBe(10);
      expect(report.criticalCount).toBe(1);
    });
  });

  describe('Background Image CRUD', () => {
    it('initializes backgroundImage as null', () => {
      expect(useFloorplanStore.getState().backgroundImage).toBeNull();
    });

    it('sets a background image overlay', () => {
      useFloorplanStore.getState().setBackgroundImage(sampleOverlay);
      const current = useFloorplanStore.getState().backgroundImage;
      expect(current).toEqual(sampleOverlay);
    });

    it('partially updates background image fields (opacity, locked, position, dimensions)', () => {
      useFloorplanStore.getState().setBackgroundImage(sampleOverlay);

      // Opacity update
      useFloorplanStore.getState().updateBackgroundImage({ opacity: 0.25 });
      expect(useFloorplanStore.getState().backgroundImage?.opacity).toBe(0.25);
      expect(useFloorplanStore.getState().backgroundImage?.locked).toBe(false);

      // Locked update
      useFloorplanStore.getState().updateBackgroundImage({ locked: true });
      expect(useFloorplanStore.getState().backgroundImage?.locked).toBe(true);

      // Position update
      useFloorplanStore.getState().updateBackgroundImage({ xCm: 320, zCm: 210 });
      expect(useFloorplanStore.getState().backgroundImage?.xCm).toBe(320);
      expect(useFloorplanStore.getState().backgroundImage?.zCm).toBe(210);

      // Dimensions & rotation update
      useFloorplanStore.getState().updateBackgroundImage({
        widthCm: 900,
        heightCm: 675,
        rotationDeg: 90,
      });
      expect(useFloorplanStore.getState().backgroundImage?.widthCm).toBe(900);
      expect(useFloorplanStore.getState().backgroundImage?.heightCm).toBe(675);
      expect(useFloorplanStore.getState().backgroundImage?.rotationDeg).toBe(90);
      // Ensure other fields were not mutated
      expect(useFloorplanStore.getState().backgroundImage?.id).toBe('bg-1');
      expect(useFloorplanStore.getState().backgroundImage?.filename).toBe('ground-floor-blueprint.png');
    });

    it('safely ignores updateBackgroundImage when no background image exists', () => {
      expect(useFloorplanStore.getState().backgroundImage).toBeNull();
      useFloorplanStore.getState().updateBackgroundImage({ opacity: 0.5 });
      expect(useFloorplanStore.getState().backgroundImage).toBeNull();
    });

    it('removes background image', () => {
      useFloorplanStore.getState().setBackgroundImage(sampleOverlay);
      expect(useFloorplanStore.getState().backgroundImage).not.toBeNull();

      useFloorplanStore.getState().removeBackgroundImage();
      expect(useFloorplanStore.getState().backgroundImage).toBeNull();
    });
  });

  describe('Passage Heatmap Toggle', () => {
    it('initializes showPassageHeatmap as false', () => {
      expect(useFloorplanStore.getState().showPassageHeatmap).toBe(false);
    });

    it('toggles showPassageHeatmap on and off', () => {
      useFloorplanStore.getState().setShowPassageHeatmap(true);
      expect(useFloorplanStore.getState().showPassageHeatmap).toBe(true);

      useFloorplanStore.getState().setShowPassageHeatmap(false);
      expect(useFloorplanStore.getState().showPassageHeatmap).toBe(false);
    });
  });

  describe('Calibration Workflow', () => {
    it('initializes calibrationPoints with p1: null, p2: null', () => {
      expect(useFloorplanStore.getState().calibrationPoints).toEqual({ p1: null, p2: null });
    });

    it('startCalibration sets activeTool to calibrate-scale and resets calibration points', () => {
      useFloorplanStore.getState().setActiveTool('select');
      useFloorplanStore.getState().startCalibration();

      expect(useFloorplanStore.getState().activeTool).toBe('calibrate-scale');
      expect(useFloorplanStore.getState().calibrationPoints).toEqual({ p1: null, p2: null });
    });

    it('records p1 then p2 on sequential setCalibrationPoint calls', () => {
      useFloorplanStore.getState().startCalibration();

      const p1 = { x: 50, z: 100 };
      useFloorplanStore.getState().setCalibrationPoint(p1);
      expect(useFloorplanStore.getState().calibrationPoints).toEqual({
        p1: { x: 50, z: 100 },
        p2: null,
      });

      const p2 = { x: 250, z: 100 };
      useFloorplanStore.getState().setCalibrationPoint(p2);
      expect(useFloorplanStore.getState().calibrationPoints).toEqual({
        p1: { x: 50, z: 100 },
        p2: { x: 250, z: 100 },
      });
    });

    it('cancelCalibration resets points and restores activeTool to select', () => {
      useFloorplanStore.getState().startCalibration();
      useFloorplanStore.getState().setCalibrationPoint({ x: 10, z: 20 });

      useFloorplanStore.getState().cancelCalibration();
      expect(useFloorplanStore.getState().activeTool).toBe('select');
      expect(useFloorplanStore.getState().calibrationPoints).toEqual({ p1: null, p2: null });
    });

    it('applyCalibration scales backgroundImage and resets calibration state & tool back to select', () => {
      // Background image: naturalWidthPx 1000, naturalHeightPx 500
      const img: BackgroundImageOverlay = {
        ...sampleOverlay,
        naturalWidthPx: 1000,
        naturalHeightPx: 500,
        widthCm: 500,
        heightCm: 250,
      };
      useFloorplanStore.getState().setBackgroundImage(img);

      useFloorplanStore.getState().startCalibration();
      // Distance in px between (100, 100) and (300, 100) is 200 px
      useFloorplanStore.getState().setCalibrationPoint({ x: 100, z: 100 });
      useFloorplanStore.getState().setCalibrationPoint({ x: 300, z: 100 });

      // Real distance = 400 cm -> 400 cm / 200 px = 2.0 cm/px
      // New width = 1000 * 2.0 = 2000 cm; New height = 500 * 2.0 = 1000 cm
      useFloorplanStore.getState().applyCalibration(400);

      const bg = useFloorplanStore.getState().backgroundImage;
      expect(bg?.widthCm).toBe(2000);
      expect(bg?.heightCm).toBe(1000);
      expect(useFloorplanStore.getState().activeTool).toBe('select');
      expect(useFloorplanStore.getState().calibrationPoints).toEqual({ p1: null, p2: null });
    });
  });

  describe('Undo / Redo with Background Image', () => {
    it('restores previous background image state on undo and reapplies on redo', () => {
      expect(useFloorplanStore.getState().backgroundImage).toBeNull();

      // Add background image
      useFloorplanStore.getState().setBackgroundImage(sampleOverlay);
      expect(useFloorplanStore.getState().backgroundImage).not.toBeNull();
      expect(useFloorplanStore.getState().canUndo).toBe(true);

      // Undo adding image
      useFloorplanStore.getState().undo();
      expect(useFloorplanStore.getState().backgroundImage).toBeNull();
      expect(useFloorplanStore.getState().canRedo).toBe(true);

      // Redo adding image
      useFloorplanStore.getState().redo();
      expect(useFloorplanStore.getState().backgroundImage?.id).toBe('bg-1');

      // Update image dimensions
      useFloorplanStore.getState().updateBackgroundImage({ widthCm: 1200, heightCm: 900 });
      expect(useFloorplanStore.getState().backgroundImage?.widthCm).toBe(1200);

      // Undo dimension update
      useFloorplanStore.getState().undo();
      expect(useFloorplanStore.getState().backgroundImage?.widthCm).toBe(800);

      // Redo dimension update
      useFloorplanStore.getState().redo();
      expect(useFloorplanStore.getState().backgroundImage?.widthCm).toBe(1200);

      // Remove background image
      useFloorplanStore.getState().removeBackgroundImage();
      expect(useFloorplanStore.getState().backgroundImage).toBeNull();

      // Undo removal
      useFloorplanStore.getState().undo();
      expect(useFloorplanStore.getState().backgroundImage?.id).toBe('bg-1');
      expect(useFloorplanStore.getState().backgroundImage?.widthCm).toBe(1200);
    });
  });

  describe('LocalStorage Persistence and JSON Export / Import', () => {
    it('preserves backgroundImage in exportJson and restores it via importJson', () => {
      useFloorplanStore.getState().setBackgroundImage(sampleOverlay);

      const jsonStr = useFloorplanStore.getState().exportJson();
      const parsed = JSON.parse(jsonStr);
      expect(parsed.backgroundImage).toBeDefined();
      expect(parsed.backgroundImage.id).toBe('bg-1');
      expect(parsed.backgroundImage.url).toBe('');
      expect(jsonStr).not.toContain('data:');
      expect(jsonStr).not.toContain('blob:');
      expect(parsed.backgroundImage.naturalWidthPx).toBe(1600);
      expect(parsed.backgroundImage.widthCm).toBe(800);
      expect(parsed.backgroundImage.opacity).toBe(0.6);
      expect(parsed.backgroundImage.locked).toBe(false);

      // Reset store
      useFloorplanStore.getState().removeBackgroundImage();
      expect(useFloorplanStore.getState().backgroundImage).toBeNull();

      // Import JSON. Ohne imageId gibt es keine Pixel zurück.
      const success = useFloorplanStore.getState().importJson(jsonStr);
      expect(success).toBe(true);
      const restored = useFloorplanStore.getState().backgroundImage;
      expect(restored?.id).toBe('bg-1');
      expect(restored?.url).toBe('');
      expect(restored?.widthCm).toBe(800);
      expect(restored?.opacity).toBe(0.6);
      expect(restored?.locked).toBe(false);
      expect(restored?.xCm).toBe(200);
      expect(restored?.zCm).toBe(150);
    });

    it('legt eine alte Data-URL in den Bildspeicher und exportiert keine Pixel', () => {
      const base = JSON.parse(useFloorplanStore.getState().exportJson());
      const dataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      base.backgroundImage = {
        id: 'bg-legacy',
        url: dataUrl,
        filename: 'alt.png',
        xCm: 10,
        zCm: 20,
        widthCm: 300,
        heightCm: 200,
        rotationDeg: 0,
        opacity: 0.4,
        visible: true,
        locked: true,
        naturalWidthPx: 1,
        naturalHeightPx: 1,
      };
      const success = useFloorplanStore.getState().importJson(JSON.stringify(base));
      expect(success).toBe(true);
      const image = useFloorplanStore.getState().backgroundImage;
      expect(image?.imageId).toEqual(expect.any(String));
      expect(image?.url.startsWith('data:')).toBe(false);
      expect(image?.locked).toBe(true);
      expect(image?.widthCm).toBe(300);
      const exported = useFloorplanStore.getState().exportJson();
      expect(exported).not.toContain('data:');
      expect(exported).toContain(image?.imageId);
      const undoJson = JSON.stringify(useFloorplanStore.getState().undoStack);
      expect(undoJson).not.toContain('data:');
    });

    it('imports legacy JSON without backgroundImage cleanly setting backgroundImage to null', () => {
      useFloorplanStore.getState().setBackgroundImage(sampleOverlay);

      const jsonStr = useFloorplanStore.getState().exportJson();
      const parsed = JSON.parse(jsonStr);
      delete parsed.backgroundImage;
      const legacyJson = JSON.stringify(parsed);

      const success = useFloorplanStore.getState().importJson(legacyJson);
      expect(success).toBe(true);
      expect(useFloorplanStore.getState().backgroundImage).toBeNull();
    });

    it('persists backgroundImage through saveToLocalStorage and loadFromLocalStorage', () => {
      const mockStorage: Record<string, string> = {};
      const storageMock = {
        getItem: vi.fn((key: string) => mockStorage[key] ?? null),
        setItem: vi.fn((key: string, val: string) => {
          mockStorage[key] = val;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
      };
      vi.stubGlobal('localStorage', storageMock);

      useFloorplanStore.getState().setBackgroundImage(sampleOverlay);
      useFloorplanStore.getState().saveToLocalStorage();

      expect(storageMock.setItem).toHaveBeenCalledWith(
        'wohnung_autosave',
        expect.any(String)
      );

      // Clear store image
      useFloorplanStore.getState().removeBackgroundImage();
      expect(useFloorplanStore.getState().backgroundImage).toBeNull();

      const stored = mockStorage['wohnung_autosave'];
      expect(stored).not.toContain('data:');
      expect(stored).not.toContain('blob:');

      // Restore from localStorage. Die Lage bleibt, die Blob-URL nicht.
      const success = useFloorplanStore.getState().loadFromLocalStorage();
      expect(success).toBe(true);
      const restored = useFloorplanStore.getState().backgroundImage;
      expect(restored?.id).toBe('bg-1');
      expect(restored?.url).toBe('');
      expect(restored?.filename).toBe('ground-floor-blueprint.png');
      expect(restored?.widthCm).toBe(800);
      expect(restored?.opacity).toBe(0.6);
      expect(restored?.locked).toBe(false);

      vi.unstubAllGlobals();
    });
  });

  describe('Calibration and update edge cases', () => {
    it('clamps numeric properties and ignores non-finite in updateBackgroundImage', () => {
      useFloorplanStore.getState().setBackgroundImage(sampleOverlay);

      // Opacity clamping
      useFloorplanStore.getState().updateBackgroundImage({ opacity: -0.5 });
      expect(useFloorplanStore.getState().backgroundImage?.opacity).toBe(0);

      useFloorplanStore.getState().updateBackgroundImage({ opacity: 1.5 });
      expect(useFloorplanStore.getState().backgroundImage?.opacity).toBe(1);

      // Width and Height clamping
      useFloorplanStore.getState().updateBackgroundImage({ widthCm: 0 });
      expect(useFloorplanStore.getState().backgroundImage?.widthCm).toBe(1);

      useFloorplanStore.getState().updateBackgroundImage({ widthCm: -100 });
      expect(useFloorplanStore.getState().backgroundImage?.widthCm).toBe(1);

      useFloorplanStore.getState().updateBackgroundImage({ heightCm: 0 });
      expect(useFloorplanStore.getState().backgroundImage?.heightCm).toBe(1);

      useFloorplanStore.getState().updateBackgroundImage({ heightCm: -50 });
      expect(useFloorplanStore.getState().backgroundImage?.heightCm).toBe(1);

      // Non-finite properties are ignored (keep existing)
      useFloorplanStore.getState().updateBackgroundImage({
        widthCm: 500,
        heightCm: 400,
        xCm: 100,
        zCm: 100,
        rotationDeg: 45,
        opacity: 0.5,
      });

      useFloorplanStore.getState().updateBackgroundImage({
        widthCm: NaN,
        heightCm: Infinity,
        xCm: -Infinity,
        zCm: NaN,
        rotationDeg: NaN,
        opacity: NaN,
      });

      const current = useFloorplanStore.getState().backgroundImage;
      expect(current?.widthCm).toBe(500);
      expect(current?.heightCm).toBe(400);
      expect(current?.xCm).toBe(100);
      expect(current?.zCm).toBe(100);
      expect(current?.rotationDeg).toBe(45);
      expect(current?.opacity).toBe(0.5);
    });

    it('ignores non-finite points in setCalibrationPoint', () => {
      useFloorplanStore.getState().startCalibration();

      useFloorplanStore.getState().setCalibrationPoint({ x: NaN, z: 100 });
      expect(useFloorplanStore.getState().calibrationPoints).toEqual({ p1: null, p2: null });

      useFloorplanStore.getState().setCalibrationPoint({ x: 100, z: Infinity });
      expect(useFloorplanStore.getState().calibrationPoints).toEqual({ p1: null, p2: null });

      useFloorplanStore.getState().setCalibrationPoint(null as any);
      expect(useFloorplanStore.getState().calibrationPoints).toEqual({ p1: null, p2: null });
    });

    it('does not update image dimensions and does not throw with realDistanceCm <= 0 or NaN', () => {
      useFloorplanStore.getState().setBackgroundImage(sampleOverlay);
      useFloorplanStore.getState().startCalibration();
      useFloorplanStore.getState().setCalibrationPoint({ x: 0, z: 0 });
      useFloorplanStore.getState().setCalibrationPoint({ x: 100, z: 0 });

      const origWidth = sampleOverlay.widthCm;
      const origHeight = sampleOverlay.heightCm;

      expect(() => useFloorplanStore.getState().applyCalibration(0)).not.toThrow();
      expect(useFloorplanStore.getState().backgroundImage?.widthCm).toBe(origWidth);

      expect(() => useFloorplanStore.getState().applyCalibration(-100)).not.toThrow();
      expect(useFloorplanStore.getState().backgroundImage?.widthCm).toBe(origWidth);

      expect(() => useFloorplanStore.getState().applyCalibration(NaN)).not.toThrow();
      expect(useFloorplanStore.getState().backgroundImage?.widthCm).toBe(origWidth);
      expect(useFloorplanStore.getState().backgroundImage?.heightCm).toBe(origHeight);
    });

    it('does not throw when applyCalibration is called without backgroundImage or with only 1 point', () => {
      // Without backgroundImage
      useFloorplanStore.getState().removeBackgroundImage();
      useFloorplanStore.getState().startCalibration();
      useFloorplanStore.getState().setCalibrationPoint({ x: 0, z: 0 });
      useFloorplanStore.getState().setCalibrationPoint({ x: 100, z: 0 });

      expect(() => useFloorplanStore.getState().applyCalibration(200)).not.toThrow();

      // With backgroundImage but only 1 point set
      useFloorplanStore.getState().setBackgroundImage(sampleOverlay);
      useFloorplanStore.getState().startCalibration();
      useFloorplanStore.getState().setCalibrationPoint({ x: 50, z: 50 });

      expect(() => useFloorplanStore.getState().applyCalibration(200)).not.toThrow();
      expect(useFloorplanStore.getState().backgroundImage?.widthCm).toBe(sampleOverlay.widthCm);
    });

    it('resets p1 to pt3 and p2 to null when setCalibrationPoint is called 3 times', () => {
      useFloorplanStore.getState().startCalibration();

      useFloorplanStore.getState().setCalibrationPoint({ x: 10, z: 20 });
      expect(useFloorplanStore.getState().calibrationPoints.p1).toEqual({ x: 10, z: 20 });
      expect(useFloorplanStore.getState().calibrationPoints.p2).toBeNull();

      useFloorplanStore.getState().setCalibrationPoint({ x: 30, z: 40 });
      expect(useFloorplanStore.getState().calibrationPoints.p1).toEqual({ x: 10, z: 20 });
      expect(useFloorplanStore.getState().calibrationPoints.p2).toEqual({ x: 30, z: 40 });

      useFloorplanStore.getState().setCalibrationPoint({ x: 50, z: 60 });
      expect(useFloorplanStore.getState().calibrationPoints.p1).toEqual({ x: 50, z: 60 });
      expect(useFloorplanStore.getState().calibrationPoints.p2).toBeNull();
    });
  });
});
