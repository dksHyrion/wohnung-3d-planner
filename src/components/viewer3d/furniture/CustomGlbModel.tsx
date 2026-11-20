import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { FurnitureItem } from '../../../core/types';
import {
  computeCustomModelFitTransform,
  getCustomModelBlob,
  parseGlbSceneAndDimensionsCm,
  type ParsedGlbResult,
} from '../../../core/customModelStore';

export interface CustomGlbModelProps {
  item: FurnitureItem;
  fallback: React.ReactNode;
}

function disposeMaterialWithTextures(
  material: THREE.Material,
  disposedTextures: Set<THREE.Texture>
): void {
  const matRecord = material as unknown as Record<string, unknown>;
  for (const value of Object.values(matRecord)) {
    if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
      disposedTextures.add(value);
      value.dispose();
    }
  }
  material.dispose();
}

export function disposeObjectSubtree(root: THREE.Object3D): void {
  const disposedTextures = new Set<THREE.Texture>();
  const disposedMaterials = new Set<THREE.Material>();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      for (const m of mats) {
        if (!disposedMaterials.has(m)) {
          disposedMaterials.add(m);
          disposeMaterialWithTextures(m, disposedTextures);
        }
      }
    }
  });
}

export const CustomGlbModel: React.FC<CustomGlbModelProps> = ({
  item,
  fallback,
}) => {
  const [parsed, setParsed] = useState<ParsedGlbResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadedScene: THREE.Group | null = null;
    const modelId = item.customModelId;

    if (!modelId) {
      setParsed(null);
      return;
    }

    void (async () => {
      try {
        const blob = await getCustomModelBlob(modelId);
        if (!blob || cancelled) {
          if (!cancelled) setParsed(null);
          return;
        }
        const buf = await blob.arrayBuffer();
        if (cancelled) return;
        const res = await parseGlbSceneAndDimensionsCm(buf);
        if (cancelled) {
          disposeObjectSubtree(res.scene);
          return;
        }
        res.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        loadedScene = res.scene;
        setParsed(res);
      } catch {
        if (!cancelled) setParsed(null);
      }
    })();

    return () => {
      cancelled = true;
      if (loadedScene) {
        disposeObjectSubtree(loadedScene);
      }
    };
  }, [item.customModelId]);

  const fit = useMemo(() => {
    if (!parsed) return null;
    return computeCustomModelFitTransform(
      parsed.boundsMin,
      parsed.boundsMax,
      item.widthCm,
      item.heightCm,
      item.depthCm
    );
  }, [parsed, item.widthCm, item.heightCm, item.depthCm]);

  if (!parsed || !fit) {
    return <>{fallback}</>;
  }

  return (
    <group position={fit.offset} scale={fit.scale}>
      <primitive object={parsed.scene} />
    </group>
  );
};
