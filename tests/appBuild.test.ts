import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { useFloorplanStore } from '../src/store/useFloorplanStore';
import { FURNITURE_CATALOG, PRESET_FLOORPLANS } from '../src/core/presets';

const ROOT = path.resolve(__dirname, '..');

describe('Application UI Files & Component Integration', () => {
  const requiredFiles = [
    'index.html',
    'public/favicon.svg',
    'public/og-image.png',
    'src/index.css',
    'src/main.tsx',
    'src/App.tsx',
    'src/components/layout/TopBar.tsx',
    'src/components/editor2d/FloorplanCanvas2D.tsx',
    'src/components/viewer3d/Scene3D.tsx',
    'src/components/viewer3d/StudioStage3D.tsx',
    'src/components/viewer3d/WallMesh3D.tsx',
    'src/components/viewer3d/FurnitureMesh3D.tsx',
    'src/components/viewer3d/RugMesh3D.tsx',
    'src/components/viewer3d/ArchitecturalDimensionLines3D.tsx',
    'src/core/dimensionMath.ts',
    'src/core/materials/proceduralTextures.ts',
    'src/components/sidebar/InspectorSidebar.tsx',
  ];

  it('contains all required HTML, CSS, entry, and UI component files', () => {
    for (const relPath of requiredFiles) {
      const fullPath = path.join(ROOT, relPath);
      expect(fs.existsSync(fullPath), `Expected ${relPath} to exist`).toBe(true);
    }
  });

  it('exports all UI components and integrates with store actions', async () => {
    const topBarMod = await import('../src/components/layout/TopBar');
    const canvas2DMod = await import('../src/components/editor2d/FloorplanCanvas2D');
    const wallMeshMod = await import('../src/components/viewer3d/WallMesh3D');
    const furnitureMeshMod = await import('../src/components/viewer3d/FurnitureMesh3D');
    const studioStageMod = await import('../src/components/viewer3d/StudioStage3D');
    const rugMeshMod = await import('../src/components/viewer3d/RugMesh3D');
    const dimLinesMod = await import(
      '../src/components/viewer3d/ArchitecturalDimensionLines3D'
    );
    const scene3DMod = await import('../src/components/viewer3d/Scene3D');
    const sidebarMod = await import('../src/components/sidebar/InspectorSidebar');
    const appMod = await import('../src/App');

    expect(typeof topBarMod.TopBar).toBe('function');
    expect(typeof canvas2DMod.FloorplanCanvas2D).toBe('function');
    expect(['function', 'object']).toContain(typeof wallMeshMod.WallMesh3D);
    expect(typeof wallMeshMod.computeWallSubSegments).toBe('function');
    expect(typeof furnitureMeshMod.FurnitureMesh3D).toBe('function');
    expect(typeof studioStageMod.StudioStage3D).toBe('function');
    expect(typeof rugMeshMod.RugMesh3D).toBe('function');
    expect(typeof dimLinesMod.ArchitecturalDimensionLines3D).toBe('function');
    expect(typeof scene3DMod.Scene3D).toBe('function');
    expect(typeof sidebarMod.InspectorSidebar).toBe('function');
    expect(typeof appMod.default).toBe('function');

    // Verify wall sub-segment calculation for a wall with a window and door
    const segments = wallMeshMod.computeWallSubSegments(450, 250, [
      {
        id: 'op-win',
        wallId: 'w1',
        type: 'window',
        offsetFromStartCm: 100,
        widthCm: 120,
        heightCm: 130,
        sillHeightCm: 90,
      },
    ]);
    // Should produce: left full-height segment (0..100), sill (100..220, y:0..90), lintel (100..220, y:220..250), right full-height segment (220..450)
    expect(segments.length).toBe(4);

    // Verify store integration with presets and catalog
    const store = useFloorplanStore.getState();
    store.loadPreset('rectangular-room');
    expect(useFloorplanStore.getState().walls.length).toBe(
      PRESET_FLOORPLANS['rectangular-room'].data.walls.length
    );

    const template = FURNITURE_CATALOG[0];
    const newId = store.addFurniture({
      ...template,
      x: 200,
      z: 180,
      rotationYDeg: 0,
      snappedWallId: null,
    });
    expect(useFloorplanStore.getState().selectedId).toBe(newId);
    expect(useFloorplanStore.getState().selectedType).toBe('furniture');

    // Regression check: FurnitureMesh3D and PassageClearance3D must not set distanceFactor on <Html>,
    // because @react-three/drei multiplies distanceFactor by camera.zoom in OrthographicCamera
    const furnitureMeshSrc = fs.readFileSync(
      path.join(ROOT, 'src/components/viewer3d/FurnitureMesh3D.tsx'),
      'utf-8'
    );
    expect(furnitureMeshSrc).not.toContain('distanceFactor=');

    const passageClearanceSrc = fs.readFileSync(
      path.join(ROOT, 'src/components/viewer3d/PassageClearance3D.tsx'),
      'utf-8'
    );
    expect(passageClearanceSrc).not.toContain('distanceFactor=');
  });
});
