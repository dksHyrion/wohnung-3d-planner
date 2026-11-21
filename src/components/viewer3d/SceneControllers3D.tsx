import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useFloorplanStore } from '../../store/useFloorplanStore';
import { getEntityLevelId } from '../../core/levels';
import { computeVariantDiff } from '../../core/layoutVariants';
import type { AreaRug, FlooringType } from '../../core/types';

declare global {
  interface Window {
    __DEBUG_THREE__?: {
      gl: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.Camera;
    };
  }
}

const EMPTY_ARRAY: readonly never[] = Object.freeze([]);

/** Minimal structural view of drei's OrbitControls instance (exposed as an EventDispatcher by useThree). */
export interface OrbitControlsLike {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export const CANVAS_GL_CONFIG = {
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance',
  toneMapping: THREE.NoToneMapping,
} as const;

export const getFloorMaterialProps = (
  flooringType: FlooringType,
  isStudio: boolean,
  texture: THREE.Texture | null,
  isBeauty: boolean = true,
  bumpMap: THREE.Texture | null = null
) => ({
  map: texture,
  bumpMap: isStudio ? bumpMap : null,
  bumpScale:
    isStudio && bumpMap
      ? flooringType === 'tile'
        ? 0.35
        : flooringType === 'parquet'
        ? 0.22
        : 0.08
      : 0,
  color: isStudio ? '#ffffff' : '#334155',
  roughness: flooringType === 'microcement' ? 0.85 : 0.38,
  metalness: 0.05,
  clearcoat: isStudio && isBeauty ? 0.18 : 0,
  clearcoatRoughness: 0.25,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});

export const DemandRenderController: React.FC = () => {
  const { invalidate, controls } = useThree();

  useEffect(() => {
    invalidate();
    const raf = requestAnimationFrame(() => invalidate());
    const unsub = useFloorplanStore.subscribe(() => invalidate());
    return () => {
      cancelAnimationFrame(raf);
      unsub();
    };
  }, [invalidate]);

  useEffect(() => {
    if (!controls || !('addEventListener' in controls)) return;
    const orbit = controls as unknown as OrbitControlsLike;
    const onChange = () => invalidate();
    orbit.addEventListener('change', onChange);
    return () => {
      orbit.removeEventListener('change', onChange);
    };
  }, [controls, invalidate]);

  return null;
};

export const RendererConfigController: React.FC<{
  isBeauty: boolean;
  exposure: number;
}> = ({ isBeauty, exposure }) => {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    gl.toneMapping = isBeauty ? THREE.NoToneMapping : THREE.AgXToneMapping;
    gl.toneMappingExposure = exposure;
    if (typeof window !== 'undefined') {
      window.__DEBUG_THREE__ = { gl, scene, camera };
    }

    const handleSnapshotRequest = (e: Event) => {
      const prevToneMapping = gl.toneMapping;
      try {
        if (isBeauty) {
          gl.toneMapping = THREE.AgXToneMapping;
        }
        gl.render(scene, camera);
        const detail = (e as CustomEvent<{ prefix?: string } | undefined>).detail;
        const prefix = detail?.prefix ?? 'wohnung-3d';
        const dataUrl = gl.domElement.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.png`;
        if (document.body) {
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          a.click();
        }
      } catch (err) {
        console.error('Failed to capture snapshot in render listener:', err);
      } finally {
        gl.toneMapping = prevToneMapping;
      }
    };

    window.addEventListener('wohnung-capture-snapshot', handleSnapshotRequest);
    return () => {
      window.removeEventListener('wohnung-capture-snapshot', handleSnapshotRequest);
    };
  }, [gl, scene, camera, isBeauty, exposure]);
  return null;
};

export const Export3DBridge: React.FC<{
  exportRootRef: React.RefObject<THREE.Group | null>;
}> = ({ exportRootRef }) => {
  useEffect(() => {
    const handleExport3d = (e: Event) => {
      const root = exportRootRef.current;
      if (!root) return;
      const detail = (
        e as CustomEvent<{ format?: 'glb' | 'usdz'; filename?: string } | undefined>
      ).detail;
      const format = detail?.format ?? 'glb';
      const filename =
        detail?.filename ?? (format === 'usdz' ? 'wohnung.usdz' : 'wohnung.glb');

      void (async () => {
        try {
          const { exportSceneToGlb, exportSceneToUsdz } = await import(
            '../../core/export/scene3dExport'
          );
          const blob =
            format === 'usdz'
              ? new Blob([new Uint8Array(await exportSceneToUsdz(root))], {
                  type: 'model/vnd.usdz+zip',
                })
              : new Blob([await exportSceneToGlb(root)], {
                  type: 'model/gltf-binary',
                });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          if (document.body) {
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } else {
            a.click();
          }
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
          console.error('Failed to export 3D model:', err);
        }
      })();
    };

    window.addEventListener('wohnung-export-3d', handleExport3d);
    return () => {
      window.removeEventListener('wohnung-export-3d', handleExport3d);
    };
  }, [exportRootRef]);

  return null;
};

export const GhostVariantOverlay3D: React.FC = () => {
  const ghostVariantId = useFloorplanStore((s) => s.ghostVariantId);
  const layoutVariants = useFloorplanStore((s) => s.layoutVariants);
  const furniture = useFloorplanStore((s) => s.furniture);
  const levels = useFloorplanStore((s) => s.levels);
  const rugs =
    useFloorplanStore((s) => s.rugs) ?? (EMPTY_ARRAY as unknown as AreaRug[]);

  const levelElevationMap = useMemo(
    () => new Map(levels.map((l) => [l.id, l.elevationCm])),
    [levels]
  );

  const ghostVariant = useMemo(
    () =>
      ghostVariantId
        ? layoutVariants.find((v) => v.id === ghostVariantId)
        : undefined,
    [ghostVariantId, layoutVariants]
  );

  const diff = useMemo(
    () => (ghostVariant ? computeVariantDiff({ furniture, rugs }, ghostVariant) : null),
    [ghostVariant, furniture, rugs]
  );

  if (!diff) return null;

  const ghostItems = [
    ...diff.ghostOnlyFurniture,
    ...diff.movedFurniture.map((m) => m.ghost),
  ];

  return (
    <group name="variant-ghost-overlay-3d" userData={{ exportIgnore: true }}>
      {ghostItems.map((item) => {
        const baseY = levelElevationMap.get(getEntityLevelId(item)) ?? 0;
        return (
          <mesh
            key={`ghost-3d-${item.id}`}
            position={[item.x, baseY + item.elevationCm + item.heightCm / 2, item.z]}
            rotation={[0, (item.rotationYDeg * Math.PI) / 180, 0]}
            raycast={() => null}
          >
            <boxGeometry args={[item.widthCm, item.heightCm, item.depthCm]} />
            <meshBasicMaterial
              color="#a855f7"
              transparent
              opacity={0.24}
              depthWrite={false}
              wireframe={false}
            />
          </mesh>
        );
      })}
      {diff.movedFurniture.map(({ ghost, active }) => {
        const baseY = levelElevationMap.get(getEntityLevelId(ghost)) ?? 0;
        return (
          <Line
            key={`ghost-3d-line-${ghost.id}`}
            points={[
              [ghost.x, baseY + 4, ghost.z],
              [active.x, baseY + 4, active.z],
            ]}
            color="#c084fc"
            lineWidth={2}
            dashed
            dashSize={8}
            gapSize={5}
          />
        );
      })}
    </group>
  );
};
