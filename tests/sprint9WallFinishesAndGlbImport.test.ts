import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import * as THREE from 'three';
import {
  WALL_FINISH_TYPES,
  isWallFinishType,
  resolveWallSideFinishProps,
} from '../src/core/materials/wallFinishes';
import {
  computeCustomModelFitTransform,
  deleteCustomModelBlobs,
  getCustomModelBlob,
  memoryCustomModelIds,
  parseGlbSceneAndDimensionsCm,
  putCustomModelBlob,
  rememberCustomModelBlob,
  runtimeUrlForCustomModel,
} from '../src/core/customModelStore';
import { exportSceneToGlb } from '../src/core/export/scene3dExport';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { WallInspector } from '../src/components/sidebar/WallInspector';
import { FurnitureInspector } from '../src/components/sidebar/FurnitureInspector';

describe('Sprint 9A: Per-Side Wall Finishes', () => {
  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('empty-room');
    useFloorplanStore.getState().setLanguage('de');
  });

  it('validates finish types and resolves material properties per finish', () => {
    expect(WALL_FINISH_TYPES).toContain('wood-slats');
    expect(WALL_FINISH_TYPES).toContain('tile');
    expect(isWallFinishType('wood-slats')).toBe(true);
    expect(isWallFinishType('invalid-finish')).toBe(false);

    const accent = resolveWallSideFinishProps({
      finish: 'accent-paint',
      color: '#334155',
    });
    expect(accent.color).toBe('#334155');
    expect(accent.map).toBeNull();

    const slats = resolveWallSideFinishProps({ finish: 'wood-slats' });
    expect(slats.map).not.toBeNull();
    expect(slats.roughness).toBeGreaterThan(0.5);

    const tile = resolveWallSideFinishProps({ finish: 'tile' });
    expect(tile.map).not.toBeNull();
    expect(tile.bumpMap).not.toBeNull();
  });

  it('updates posFinish and negFinish independently, inherits on split, and roundtrips JSON', () => {
    const store = useFloorplanStore.getState();
    const wall = store.walls[0];

    store.updateWallProps(wall.id, {
      posFinish: { finish: 'wood-slats', color: '#d6c3a5' },
      negFinish: { finish: 'accent-paint', color: '#475569' },
    });

    const updatedWall = useFloorplanStore
      .getState()
      .walls.find((w) => w.id === wall.id)!;
    expect(updatedWall.posFinish).toEqual({ finish: 'wood-slats', color: '#d6c3a5' });
    expect(updatedWall.negFinish).toEqual({ finish: 'accent-paint', color: '#475569' });

    const json = useFloorplanStore.getState().exportJson();
    useFloorplanStore.getState().loadPreset('standard-55');
    expect(useFloorplanStore.getState().importJson(json)).toBe(true);

    const importedWall = useFloorplanStore
      .getState()
      .walls.find((w) => w.id === wall.id)!;
    expect(importedWall.posFinish).toEqual({ finish: 'wood-slats', color: '#d6c3a5' });
    expect(importedWall.negFinish).toEqual({ finish: 'accent-paint', color: '#475569' });

    // Splitting the wall inherits finishes on both segments
    const splitCornerId = useFloorplanStore.getState().splitWallAt(wall.id);
    expect(splitCornerId).not.toBeNull();
    const splitSegments = useFloorplanStore
      .getState()
      .walls.filter(
        (w) => w.startCornerId === splitCornerId || w.endCornerId === splitCornerId
      );
    expect(splitSegments).toHaveLength(2);
    for (const seg of splitSegments) {
      expect(seg.posFinish?.finish).toBe('wood-slats');
      expect(seg.negFinish?.finish).toBe('accent-paint');
    }
  });

  it('renders per-side finish controls in WallInspector', () => {
    const wall = useFloorplanStore.getState().walls[0];
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(WallInspector, { selectedWall: wall })
    );
    expect(html).toContain('wall-finish-pos');
    expect(html).toContain('wall-finish-neg');
  });
});

describe('Sprint 9B: Custom GLB Model Import & IndexedDB Store', () => {
  beforeEach(async () => {
    useFloorplanStore.getState().loadPreset('empty-room');
    useFloorplanStore.getState().setLanguage('de');
    await deleteCustomModelBlobs(memoryCustomModelIds());
  });

  it('computes exact centering and scaling transform to fit canonical OBB dimensions', () => {
    const min = new THREE.Vector3(-1, 0, -0.45);
    const max = new THREE.Vector3(1, 0.8, 0.45);
    // Raw size: 2 x 0.8 x 0.9 -> target 200 x 80 x 90 cm
    const fit = computeCustomModelFitTransform(min, max, 200, 80, 90);
    expect(fit.scale[0]).toBeCloseTo(100, 3);
    expect(fit.scale[1]).toBeCloseTo(100, 3);
    expect(fit.scale[2]).toBeCloseTo(100, 3);
    // Centered in X/Z, bottom aligned to -targetHeightCm / 2 = -40
    expect(fit.offset[0]).toBeCloseTo(0, 3);
    expect(fit.offset[1]).toBeCloseTo(-40, 3);
    expect(fit.offset[2]).toBeCloseTo(0, 3);
  });

  it('parses real GLB binary buffer and recovers centimeter dimensions', async () => {
    const hadFileReader = typeof globalThis.FileReader !== 'undefined';
    if (!hadFileReader) {
      (globalThis as unknown as { FileReader: unknown }).FileReader = class NodeFileReader {
        result: ArrayBuffer | null = null;
        onloadend: (() => void) | null = null;
        readAsArrayBuffer(blob: Blob) {
          void blob.arrayBuffer().then((buf) => {
            this.result = buf;
            this.onloadend?.();
          });
        }
      };
    }

    try {
      const root = new THREE.Group();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(200, 80, 90),
        new THREE.MeshStandardMaterial({ color: 0x64748b })
      );
      box.position.set(0, 40, 0);
      root.add(box);

      // Exported with CM_TO_METERS_SCALE = 0.01 -> 2.0m x 0.8m x 0.9m
      const glbBuffer = await exportSceneToGlb(root);
      const parsed = await parseGlbSceneAndDimensionsCm(glbBuffer);
      expect(parsed.widthCm).toBeCloseTo(200, 1);
      expect(parsed.heightCm).toBeCloseTo(80, 1);
      expect(parsed.depthCm).toBeCloseTo(90, 1);
    } finally {
      if (!hadFileReader) {
        delete (globalThis as unknown as { FileReader?: unknown }).FileReader;
      }
    }
  });

  it('stores custom GLB blobs in memory/IDB, preserves references in JSON, and garbage-collects unused blobs', async () => {
    const blob = new Blob([new Uint8Array([0x67, 0x6c, 0x54, 0x46])], {
      type: 'model/gltf-binary',
    });
    const modelId = 'glb-test-1';
    await putCustomModelBlob(modelId, blob);
    expect(await getCustomModelBlob(modelId)).toBe(blob);
    expect(memoryCustomModelIds()).toContain(modelId);
    rememberCustomModelBlob('glb-orphan', blob);
    expect(memoryCustomModelIds()).toContain('glb-orphan');

    const fid = useFloorplanStore.getState().addFurniture({
      name: 'Designer Sessel GLB',
      category: 'living',
      widthCm: 90,
      heightCm: 80,
      depthCm: 85,
      x: 200,
      z: 200,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#64748b',
      visual: 'generic-seating',
      customModelId: modelId,
      customModelFilename: 'sessel.glb',
    });

    // Triggering GC keeps glb-test-1 (referenced by furniture) and removes glb-orphan
    // Wait: addFurniture already triggered setWithCollisions -> gcCustomModels!
    expect(memoryCustomModelIds()).toContain(modelId);
    expect(memoryCustomModelIds()).not.toContain('glb-orphan');

    const item = useFloorplanStore.getState().furniture.find((f) => f.id === fid)!;
    expect(item.customModelId).toBe(modelId);
    expect(item.customModelFilename).toBe('sessel.glb');

    const json = useFloorplanStore.getState().exportJson();
    useFloorplanStore.getState().loadPreset('empty-room');
    expect(useFloorplanStore.getState().importJson(json)).toBe(true);
    const reimported = useFloorplanStore.getState().furniture.find((f) => f.id === fid)!;
    expect(reimported.customModelId).toBe(modelId);
    expect(reimported.customModelFilename).toBe('sessel.glb');
    expect(typeof runtimeUrlForCustomModel(modelId)).toBe('string');

    const inspectorHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(FurnitureInspector, { selectedFurniture: reimported })
    );
    expect(inspectorHtml).toContain('custom-glb-upload-section');
    expect(inspectorHtml).toContain('sessel.glb');
  });
});
