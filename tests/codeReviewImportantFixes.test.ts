import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { exportFurnitureBomCsv } from '../src/core/export/bomExport';
import { prepareExportSceneGroup } from '../src/core/export/scene3dExport';
import { parseDxfFloorplan } from '../src/core/import/dxfImport';
import { parseSvgFloorplan } from '../src/core/import/svgImport';
import { parseRoomPlanJson } from '../src/core/import/roomPlanImport';
import { computeStairGeometry } from '../src/core/stairsMath';
import { createErgonomicsWorkerClient, type WorkerLike } from '../src/core/workers/ergonomicsWorkerClient';
import { DEFAULT_LEVEL_ID } from '../src/core/levels';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import type { FloorplanData } from '../src/core/types';

function makeMinimalPlan(): FloorplanData {
  return {
    levels: [
      { id: DEFAULT_LEVEL_ID, name: 'EG', index: 0, elevationCm: 0, ceilingHeightCm: 250, slabThicknessCm: 22 },
      { id: 'lvl-og', name: 'OG', index: 1, elevationCm: 272, ceilingHeightCm: 250, slabThicknessCm: 22 },
    ],
    corners: [
      { id: 'c1', x: 0, z: 0, levelId: DEFAULT_LEVEL_ID },
      { id: 'c2', x: 400, z: 0, levelId: DEFAULT_LEVEL_ID },
      { id: 'c3', x: 400, z: 300, levelId: DEFAULT_LEVEL_ID },
      { id: 'c4', x: 0, z: 300, levelId: DEFAULT_LEVEL_ID },
    ],
    walls: [
      { id: 'w1', startCornerId: 'c1', endCornerId: 'c2', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      { id: 'w2', startCornerId: 'c2', endCornerId: 'c3', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      { id: 'w3', startCornerId: 'c3', endCornerId: 'c4', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
      { id: 'w4', startCornerId: 'c4', endCornerId: 'c1', thicknessCm: 15, heightCm: 250, levelId: DEFAULT_LEVEL_ID },
    ],
    openings: [],
    furniture: [],
    rugs: [],
    roomLabels: [],
    roofSlopes: [],
    fixtures: [],
    stairs: [],
  };
}

describe('Code Review Important Fixes (Packages 1, 2 & 3)', () => {
  it('Package 1: BOM CSV neutralizes formula injection prefixes', () => {
    const plan = makeMinimalPlan();
    plan.furniture.push({
      id: 'f-evil',
      name: '=HYPERLINK("http://evil.example","Click")',
      category: 'living',
      visual: 'sofa',
      widthCm: 200,
      heightCm: 80,
      depthCm: 90,
      x: 200,
      z: 150,
      elevationCm: 0,
      rotationYDeg: 0,
      color: '#334155',
      brand: '+CMD|calc',
      notes: '@SUM(A1:A2)',
      levelId: DEFAULT_LEVEL_ID,
    });
    const csv = exportFurnitureBomCsv(plan, { language: 'en' });
    expect(csv).toContain(`"'=HYPERLINK`);
    expect(csv).toContain(`'+CMD|calc`);
    expect(csv).toContain(`'@SUM(A1:A2)`);
  });

  it('Package 1: 3D export preserves multi-material arrays instead of collapsing to material[0]', () => {
    const root = new THREE.Group();
    const geom = new THREE.BoxGeometry(100, 100, 100);
    const matA = new THREE.MeshStandardMaterial({ color: '#ff0000' });
    const matB = new THREE.MeshStandardMaterial({ color: '#00ff00' });
    root.add(new THREE.Mesh(geom, [matA, matB]));

    const prepared = prepareExportSceneGroup(root);
    let foundMats = 0;
    prepared.exportGroup.traverse((n) => {
      const m = n as THREE.Mesh;
      if (m.isMesh && Array.isArray(m.material)) {
        foundMats = m.material.length;
      }
    });
    prepared.dispose();
    expect(foundMats).toBe(2);
  });

  it('Package 1: DXF import handles leading UTF-8 BOM and blank lines', () => {
    const dxf = `\uFEFF\n\n0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nWALLS\n10\n0\n20\n0\n11\n400\n21\n0\n0\nLINE\n8\nWALLS\n10\n400\n20\n0\n11\n400\n21\n300\n0\nENDSEC\n0\nEOF\n`;
    const res = parseDxfFloorplan(dxf);
    expect(res.data.walls.length).toBeGreaterThanOrEqual(2);
  });

  it('Package 1: SVG import skips <defs>/<pattern> and scales wall-bar threshold', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="arch-wall-hatch"><rect x="0" y="0" width="100" height="5" /></pattern>
        </defs>
        <rect x="0" y="0" width="4" height="0.15" />
      </svg>
    `;
    // cmPerUnit = 100 (meters): 4m x 0.15m => 400cm x 15cm wall bar (1 segment, ignoring defs)
    const res = parseSvgFloorplan(svg, { cmPerUnit: 100 });
    expect(res.data.walls).toHaveLength(1);
    expect(res.data.walls[0].thicknessCm).toBeCloseTo(15, 0);
  });

  it('Package 1: RoomPlan import rejects non-finite dimensions and clamps oversized opening widths', () => {
    const json = JSON.stringify({
      walls: [
        {
          dimensions: [1.0, 2.5, 0.15],
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.5, 1.25, 0, 1],
        },
        {
          dimensions: [null, 2.5, 0.15],
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, 1.25, 0, 1],
        },
      ],
      doors: [
        {
          dimensions: [2.5, 2.1, 0.1], // 250 cm door on 100 cm wall -> must clamp to <= 100 cm
          transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.5, 1.05, 0, 1],
        },
      ],
    });
    const res = parseRoomPlanJson(json);
    expect(res).not.toBeNull();
    expect(res?.data.walls).toHaveLength(1);
    expect(res?.data.openings).toHaveLength(1);
    expect(res?.data.openings[0].widthCm).toBeLessThanOrEqual(100);
  });

  it('Package 3: L-shaped stair clamps landingLengthCm >= widthCm to prevent self-intersection', () => {
    const geom = computeStairGeometry(
      {
        id: 'st-l',
        type: 'l-shaped',
        fromLevelId: DEFAULT_LEVEL_ID,
        toLevelId: 'lvl-og',
        x: 200,
        z: 200,
        rotationYDeg: 0,
        widthCm: 110,
        treadDepthCm: 26,
        landingLengthCm: 65, // smaller than widthCm (110)
      },
      { id: DEFAULT_LEVEL_ID, name: 'EG', index: 0, elevationCm: 0, ceilingHeightCm: 250, slabThicknessCm: 22 },
      { id: 'lvl-og', name: 'OG', index: 1, elevationCm: 272, ceilingHeightCm: 250, slabThicknessCm: 22 }
    );
    expect(geom.landings[0].depthCm).toBeGreaterThanOrEqual(110);
  });

  it('Package 3: worker client resolves pending promises with null on worker error instead of hanging', async () => {
    let errorListener: ((e: MessageEvent) => void) | null = null;
    const fakeWorker: WorkerLike = {
      postMessage: () => {
        setTimeout(() => {
          errorListener?.(new MessageEvent('error'));
        }, 5);
      },
      addEventListener: (type, fn) => {
        if (type === 'error') errorListener = fn;
      },
      removeEventListener: () => {},
      terminate: () => {},
    };
    const client = createErgonomicsWorkerClient({
      workerFactory: () => fakeWorker,
      debounceMs: 0,
    });
    const res = await client.evaluateErgonomicsAsync(makeMinimalPlan(), {
      immediate: true,
    });
    expect(res).toBeNull();
  });

  it('Package 3: variant mutations are undoable and planImport rejects invalid stair level refs', () => {
    const plan = makeMinimalPlan();
    plan.stairs = [
      {
        id: 'st-bad',
        type: 'straight',
        fromLevelId: DEFAULT_LEVEL_ID,
        toLevelId: 'non-existent-level',
        x: 100,
        z: 100,
        rotationYDeg: 0,
        widthCm: 90,
        treadDepthCm: 25,
      },
    ];
    useFloorplanStore.getState().importJson(JSON.stringify(plan));
    expect(useFloorplanStore.getState().stairs).toHaveLength(0);

    const vId = useFloorplanStore.getState().saveLayoutVariant('Option A');
    expect(useFloorplanStore.getState().layoutVariants.some((v) => v.id === vId)).toBe(true);
    useFloorplanStore.getState().undo();
    expect(useFloorplanStore.getState().layoutVariants.some((v) => v.id === vId)).toBe(false);
  });
});
