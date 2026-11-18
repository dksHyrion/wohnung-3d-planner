import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';

/** Global convention is 1 Three.js unit = 1 cm; glTF/USDZ/AR expect 1 unit = 1 meter. */
export const CM_TO_METERS_SCALE = 0.01;

export interface PrepareExportSceneOptions {
  scale?: number;
}

export interface PreparedExportScene {
  exportGroup: THREE.Group;
  dispose: () => void;
}

function isNonExportableNode(node: THREE.Object3D): boolean {
  if (!node.visible) return true;
  if (node.userData && node.userData.exportIgnore === true) return true;
  const typed = node as THREE.Object3D & {
    isLine?: boolean;
    isPoints?: boolean;
    isLight?: boolean;
    isCamera?: boolean;
    isSprite?: boolean;
  };
  return Boolean(
    typed.isLine || typed.isPoints || typed.isLight || typed.isCamera || typed.isSprite
  );
}

function coerceToStandardMaterial(
  mat: THREE.Material,
  disposables: THREE.Material[]
): THREE.MeshStandardMaterial {
  if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
    return mat as THREE.MeshStandardMaterial;
  }
  const source = mat as THREE.MeshBasicMaterial & {
    color?: THREE.Color;
    map?: THREE.Texture | null;
  };
  const converted = new THREE.MeshStandardMaterial({
    color: source.color ? source.color.clone() : new THREE.Color('#cbd5e1'),
    map: source.map ?? null,
    transparent: mat.transparent,
    opacity: mat.opacity,
    side: mat.side,
    roughness: 0.72,
    metalness: 0.04,
  });
  disposables.push(converted);
  return converted;
}

/**
 * Clones a Three.js subtree, strips editor helpers/invisible nodes, normalizes materials
 * for USDZ compatibility, and scales from centimeters to meters (0.01).
 */
export function prepareExportSceneGroup(
  sourceRoot: THREE.Object3D,
  options: PrepareExportSceneOptions = {}
): PreparedExportScene {
  const scale = options.scale ?? CM_TO_METERS_SCALE;
  const disposables: THREE.Material[] = [];

  const cloned = sourceRoot.clone(true);
  const toRemove: THREE.Object3D[] = [];

  cloned.traverse((node) => {
    if (node === cloned) return;
    if (isNonExportableNode(node)) {
      toRemove.push(node);
      return;
    }
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) {
      if (!mesh.geometry || !mesh.geometry.attributes?.position) {
        toRemove.push(node);
        return;
      }
      const checkInvisible = (mat: THREE.Material | undefined) =>
        Boolean(mat && mat.transparent && mat.opacity <= 0.001);
      if (Array.isArray(mesh.material)) {
        if (mesh.material.every(checkInvisible)) {
          toRemove.push(node);
          return;
        }
        const primary = mesh.material[0];
        mesh.material = primary
          ? coerceToStandardMaterial(primary, disposables)
          : coerceToStandardMaterial(new THREE.MeshStandardMaterial(), disposables);
      } else if (mesh.material) {
        if (checkInvisible(mesh.material)) {
          toRemove.push(node);
          return;
        }
        mesh.material = coerceToStandardMaterial(mesh.material, disposables);
      }
    }
  });

  for (const node of toRemove) {
    node.parent?.remove(node);
  }

  const exportGroup = new THREE.Group();
  exportGroup.name = 'wohnung-export-scene';
  exportGroup.scale.setScalar(scale);
  exportGroup.add(cloned);
  exportGroup.updateMatrixWorld(true);

  return {
    exportGroup,
    dispose: () => {
      for (const mat of disposables) {
        mat.dispose();
      }
    },
  };
}

/**
 * Exports a Three.js Object3D subtree as binary glTF (.glb) scaled to meters.
 */
export async function exportSceneToGlb(
  sourceRoot: THREE.Object3D,
  options: PrepareExportSceneOptions = {}
): Promise<ArrayBuffer> {
  const { exportGroup, dispose } = prepareExportSceneGroup(sourceRoot, options);
  try {
    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(exportGroup, {
      binary: true,
      onlyVisible: true,
    });
    if (result instanceof ArrayBuffer) {
      return result;
    }
    const jsonText = JSON.stringify(result);
    return new TextEncoder().encode(jsonText).buffer;
  } finally {
    dispose();
  }
}

/**
 * Exports a Three.js Object3D subtree as Apple AR Quick Look compatible .usdz (meters).
 */
export async function exportSceneToUsdz(
  sourceRoot: THREE.Object3D,
  options: PrepareExportSceneOptions = {}
): Promise<Uint8Array> {
  const { exportGroup, dispose } = prepareExportSceneGroup(sourceRoot, options);
  try {
    const exporter = new USDZExporter();
    return await exporter.parseAsync(exportGroup, {
      quickLookCompatible: true,
      includeAnchoringProperties: true,
      ar: {
        anchoring: { type: 'plane' },
        planeAnchoring: { alignment: 'horizontal' },
      },
    });
  } finally {
    dispose();
  }
}
