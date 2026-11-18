import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import * as THREE from 'three';
import {
  CM_TO_METERS_SCALE,
  prepareExportSceneGroup,
  exportSceneToGlb,
  exportSceneToUsdz,
} from '../src/core/export/scene3dExport';
import {
  buildSharePlanUrl,
  decodeFloorplanFromUrlHash,
  encodeFloorplanToUrlHash,
  extractPlanHashParam,
} from '../src/core/export/urlSnapshot';
import { computeVariantDiff } from '../src/core/layoutVariants';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { LayoutVariantsSection } from '../src/components/sidebar/LayoutVariantsSection';
import { VariantGhostLayer } from '../src/components/editor2d/layers/FurnitureAndOverlaysLayers';
import { PlanExportDialog } from '../src/components/layout/PlanExportDialog';
import { JsonPlanDialog } from '../src/components/layout/JsonPlanDialog';
import type { AreaRug, FloorplanData, FurnitureItem, LayoutVariant } from '../src/core/types';

function makeSampleFurniture(overrides: Partial<FurnitureItem> = {}): FurnitureItem {
  return {
    id: 'f-1',
    name: 'Sofa',
    category: 'living',
    widthCm: 200,
    heightCm: 80,
    depthCm: 90,
    x: 100,
    z: 100,
    elevationCm: 0,
    rotationYDeg: 0,
    color: '#64748b',
    visual: 'sofa',
    ...overrides,
  };
}

function makeSampleRug(overrides: Partial<AreaRug> = {}): AreaRug {
  return {
    id: 'rug-1',
    name: 'Teppich',
    widthCm: 200,
    depthCm: 150,
    x: 100,
    z: 100,
    rotationYDeg: 0,
    color: '#cbd5e1',
    ...overrides,
  };
}

describe('Sprint 7A: 3D GLB & USDZ Export', () => {
  function buildSampleThreeRoot(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'exportable-architecture-root';

    const wallMesh = new THREE.Mesh(
      new THREE.BoxGeometry(400, 250, 20),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0 })
    );
    wallMesh.name = 'wall-1';
    root.add(wallMesh);

    const basicMesh = new THREE.Mesh(
      new THREE.BoxGeometry(100, 50, 60),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    basicMesh.name = 'basic-fixture';
    root.add(basicMesh);

    const ignoredHelper = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    ignoredHelper.userData.exportIgnore = true;
    root.add(ignoredHelper);

    const invisibleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x000000 })
    );
    invisibleMesh.visible = false;
    root.add(invisibleMesh);

    const helperLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(100, 0, 0),
      ]),
      new THREE.LineBasicMaterial({ color: 0x00ff00 })
    );
    root.add(helperLine);

    return root;
  }

  it('scales exported root from cm to meters (0.01) and filters helpers/ignored objects', () => {
    const root = buildSampleThreeRoot();
    const { exportGroup, dispose } = prepareExportSceneGroup(root);
    try {
      expect(exportGroup.scale.x).toBeCloseTo(CM_TO_METERS_SCALE, 6);
      expect(exportGroup.scale.y).toBeCloseTo(CM_TO_METERS_SCALE, 6);
      expect(exportGroup.scale.z).toBeCloseTo(CM_TO_METERS_SCALE, 6);

      const exportedMeshes: THREE.Mesh[] = [];
      exportGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) exportedMeshes.push(obj as THREE.Mesh);
      });

      expect(exportedMeshes.map((m) => m.name)).toEqual(['wall-1', 'basic-fixture']);
      // MeshBasicMaterial must be normalized to MeshStandardMaterial for USDZ compatibility
      for (const mesh of exportedMeshes) {
        const mat = mesh.material as THREE.Material;
        expect((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial).toBe(true);
      }
    } finally {
      dispose();
    }
  });

  it('exports valid binary GLB starting with glTF magic header', async () => {
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
      const root = buildSampleThreeRoot();
      const buffer = await exportSceneToGlb(root);
      expect(buffer.byteLength).toBeGreaterThan(100);
      const view = new DataView(buffer);
      // "glTF" in little-endian ASCII = 0x46546C67
      expect(view.getUint32(0, true)).toBe(0x46546c67);
    } finally {
      if (!hadFileReader) {
        delete (globalThis as unknown as { FileReader?: unknown }).FileReader;
      }
    }
  });

  it('exports valid USDZ zip archive starting with PK header', async () => {
    const root = buildSampleThreeRoot();
    const bytes = await exportSceneToUsdz(root);
    expect(bytes.byteLength).toBeGreaterThan(100);
    // ZIP local file header signature "PK"
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});

describe('Sprint 7B: Compressed URL-Hash Snapshot', () => {
  const samplePlan: FloorplanData = {
    corners: [
      { id: 'c1', x: 0, z: 0 },
      { id: 'c2', x: 400, z: 0 },
      { id: 'c3', x: 400, z: 300 },
      { id: 'c4', x: 0, z: 300 },
    ],
    walls: [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250 },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250 },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250 },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250 },
    ],
    openings: [],
    furniture: [makeSampleFurniture()],
    rugs: [makeSampleRug()],
    roomLabels: [{ name: 'Wohnzimmer', x: 200, z: 150, flooringType: 'parquet' }],
    backgroundImage: {
      id: 'bg-1',
      url: 'blob:http://localhost:5173/123',
      imageId: 'img-1',
      filename: 'scan.png',
      xCm: 0,
      zCm: 0,
      widthCm: 400,
      heightCm: 300,
      rotationDeg: 0,
      opacity: 0.5,
      visible: true,
      locked: true,
      naturalWidthPx: 1000,
      naturalHeightPx: 750,
    },
  };

  it('encodes and decodes floorplan data cleanly via URL hash while stripping backgroundImage', async () => {
    const hash = await encodeFloorplanToUrlHash(samplePlan);
    expect(hash.startsWith('#plan=')).toBe(true);
    expect(extractPlanHashParam(hash)).not.toBeNull();

    const decoded = await decodeFloorplanFromUrlHash(hash);
    expect(decoded).not.toBeNull();
    expect(decoded!.corners).toHaveLength(4);
    expect(decoded!.walls).toHaveLength(4);
    expect(decoded!.furniture).toHaveLength(1);
    expect(decoded!.furniture[0].name).toBe('Sofa');
    expect(decoded!.rugs).toHaveLength(1);
    expect(decoded!.backgroundImage ?? null).toBeNull();
  });

  it('supports uncompressed b64 fallback payloads and rejects malformed hashes', async () => {
    const json = JSON.stringify({ ...samplePlan, backgroundImage: null });
    const b64url = Buffer.from(json, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const decoded = await decodeFloorplanFromUrlHash(`#plan=b64:${b64url}`);
    expect(decoded).not.toBeNull();
    expect(decoded!.corners).toHaveLength(4);

    expect(await decodeFloorplanFromUrlHash('#plan=gz:!!!not-valid!!!')).toBeNull();
    expect(await decodeFloorplanFromUrlHash('#other=123')).toBeNull();
    expect(await decodeFloorplanFromUrlHash('')).toBeNull();
  });

  it('builds share URL and flags overly huge plans exceeding hash budget', async () => {
    const res = await buildSharePlanUrl('https://example.com/planner/', samplePlan);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.url.startsWith('https://example.com/planner/#plan=')).toBe(true);
    }

    const hugePlan: FloorplanData = {
      ...samplePlan,
      furniture: Array.from({ length: 800 }, (_, i) =>
        makeSampleFurniture({
          id: `f-${i}`,
          name: `UniquePiece-${i}-${Math.sin(i).toFixed(8)}`,
          x: (i * 37) % 1000,
          z: (i * 53) % 1000,
          notes: `note-${i}-${(i * 97).toString(36)}-${Math.cos(i).toFixed(6)}`,
        })
      ),
    };
    const oversized = await buildSharePlanUrl('https://example.com/', hugePlan, {
      maxHashLength: 500,
    });
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) {
      expect(oversized.reason).toBe('too-large');
    }
  });
});

describe('Sprint 7C: Layout Variant Ghost-Diff', () => {
  beforeEach(() => {
    useFloorplanStore.getState().loadPreset('standard-55');
  });

  it('computes ghost-only, active-only, moved furniture and moved rugs accurately', () => {
    const sofaA = makeSampleFurniture({ id: 'f-sofa', x: 100, z: 100, rotationYDeg: 0 });
    const tableA = makeSampleFurniture({ id: 'f-table', x: 200, z: 150 });
    const onlyActive = makeSampleFurniture({ id: 'f-desk', x: 300, z: 150 });

    const sofaB = makeSampleFurniture({ id: 'f-sofa', x: 180, z: 100, rotationYDeg: 90 });
    const tableB = makeSampleFurniture({ id: 'f-table', x: 200, z: 150 });
    const onlyGhost = makeSampleFurniture({ id: 'f-chair', x: 250, z: 220 });

    const rugA = makeSampleRug({ id: 'r-1', x: 100, z: 100 });
    const rugB = makeSampleRug({ id: 'r-1', x: 140, z: 100 });

    const diff = computeVariantDiff(
      { furniture: [sofaA, tableA, onlyActive], rugs: [rugA] },
      { furniture: [sofaB, tableB, onlyGhost], rugs: [rugB] }
    );

    expect(diff.activeOnlyFurniture.map((f) => f.id)).toEqual(['f-desk']);
    expect(diff.ghostOnlyFurniture.map((f) => f.id)).toEqual(['f-chair']);
    expect(diff.movedFurniture).toHaveLength(1);
    expect(diff.movedFurniture[0].active.id).toBe('f-sofa');
    expect(diff.movedFurniture[0].distanceCm).toBeCloseTo(80, 3);
    expect(diff.movedFurniture[0].deltaRotDeg).toBe(-90);
    expect(diff.unchangedCount).toBe(1);
    expect(diff.movedRugs).toHaveLength(1);
    expect(diff.movedRugs[0].distanceCm).toBeCloseTo(40, 3);
  });

  it('manages ghostVariantId in store and clears it on switch or delete', () => {
    const store = useFloorplanStore.getState();
    const idA = store.saveLayoutVariant('Variante A');
    const idB = store.saveLayoutVariant('Variante B');

    useFloorplanStore.getState().setGhostVariantId(idA);
    expect(useFloorplanStore.getState().ghostVariantId).toBe(idA);

    // Switching onto the ghosted variant clears ghostVariantId so it doesn't ghost itself
    useFloorplanStore.getState().switchLayoutVariant(idA);
    expect(useFloorplanStore.getState().activeVariantId).toBe(idA);
    expect(useFloorplanStore.getState().ghostVariantId).toBeNull();

    // Deleting the ghosted variant clears ghostVariantId
    useFloorplanStore.getState().setGhostVariantId(idB);
    expect(useFloorplanStore.getState().ghostVariantId).toBe(idB);
    useFloorplanStore.getState().deleteLayoutVariant(idB);
    expect(useFloorplanStore.getState().ghostVariantId).toBeNull();

    // Verify LayoutVariant shape compatibility
    const remaining: LayoutVariant[] = useFloorplanStore.getState().layoutVariants;
    expect(remaining.some((v) => v.id === idA)).toBe(true);
  });

  it('renders Ghost-Diff UI in LayoutVariantsSection, 2D VariantGhostLayer, and Export/Share dialogs', () => {
    const store = useFloorplanStore.getState();
    store.setLanguage('de');
    const idA = store.saveLayoutVariant('Variante A');
    store.addFurniture({
      name: 'Extra Tisch',
      category: 'living',
      widthCm: 80,
      heightCm: 45,
      depthCm: 80,
      x: 200,
      z: 200,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#94a3b8',
      visual: 'coffee-table',
    });
    const idB = useFloorplanStore.getState().saveLayoutVariant('Variante B');
    useFloorplanStore.getState().setGhostVariantId(idA);

    const sidebarHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(LayoutVariantsSection)
    );
    expect(sidebarHtml).toContain(`variant-ghost-toggle-${idA}`);
    expect(sidebarHtml).toContain('variant-ghost-diff-summary');
    expect(sidebarHtml).not.toContain(`variant-ghost-toggle-${idB}`);

    const ghostSvgHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement('svg', null, React.createElement(VariantGhostLayer))
    );
    expect(ghostSvgHtml).toContain('variant-ghost-layer-2d');

    const exportHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PlanExportDialog, {
        planExportModalOpen: true,
        handleDownloadPlanSvg: () => {},
        handleDownloadGlb: () => {},
        handleDownloadUsdz: () => {},
      })
    );
    expect(exportHtml).toContain('3D-Modell (.glb)');
    expect(exportHtml).toContain('AR-Szene (.usdz)');

    const jsonHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(JsonPlanDialog, {
        jsonModalMode: 'export',
        jsonText: '{}',
        handleCopyShareLink: async () => 'copied' as const,
      })
    );
    expect(jsonHtml).toContain('Share-Link kopieren');
  });
});
