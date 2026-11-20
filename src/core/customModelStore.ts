import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_DB_NAME = 'wohnung-custom-models';
const MODEL_DB_STORE = 'custom-models';

interface MemoryModelRecord {
  blob: Blob;
  url: string;
}

const memoryModels = new Map<string, MemoryModelRecord>();

function makeObjectUrl(blob: Blob): string {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(blob);
  }
  return '';
}

export function rememberCustomModelBlob(modelId: string, blob: Blob): string {
  const prev = memoryModels.get(modelId);
  if (prev?.url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(prev.url);
  }
  const url = makeObjectUrl(blob);
  memoryModels.set(modelId, { blob, url });
  return url;
}

export function memoryCustomModelIds(): string[] {
  return [...memoryModels.keys()];
}

export function runtimeUrlForCustomModel(modelId: string | undefined): string {
  if (!modelId) return '';
  return memoryModels.get(modelId)?.url ?? '';
}

function openModelDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(MODEL_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(MODEL_DB_STORE)) {
          db.createObjectStore(MODEL_DB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putCustomModelBlob(modelId: string, blob: Blob): Promise<boolean> {
  const existing = memoryModels.get(modelId);
  if (!existing || existing.blob !== blob) {
    rememberCustomModelBlob(modelId, blob);
  }
  const db = await openModelDb();
  if (!db) return false;
  try {
    return await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(MODEL_DB_STORE, 'readwrite');
        tx.objectStore(MODEL_DB_STORE).put(blob, modelId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } finally {
    db.close();
  }
}

export async function getCustomModelBlob(modelId: string): Promise<Blob | null> {
  const cached = memoryModels.get(modelId);
  if (cached) return cached.blob;
  const db = await openModelDb();
  if (!db) return null;
  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        const tx = db.transaction(MODEL_DB_STORE, 'readonly');
        const request = tx.objectStore(MODEL_DB_STORE).get(modelId);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result instanceof Blob ? result : null);
        };
        request.onerror = () => resolve(null);
        tx.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    if (blob) rememberCustomModelBlob(modelId, blob);
    return blob;
  } finally {
    db.close();
  }
}

export async function hydrateCustomModelUrl(modelId: string): Promise<string> {
  const cached = runtimeUrlForCustomModel(modelId);
  if (cached) return cached;
  const blob = await getCustomModelBlob(modelId);
  if (!blob) return '';
  return runtimeUrlForCustomModel(modelId);
}

export async function deleteCustomModelBlobs(modelIds: string[]): Promise<void> {
  for (const id of modelIds) {
    const entry = memoryModels.get(id);
    if (entry?.url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(entry.url);
    }
    memoryModels.delete(id);
  }
  if (modelIds.length === 0) return;
  const db = await openModelDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(MODEL_DB_STORE, 'readwrite');
        const store = tx.objectStore(MODEL_DB_STORE);
        for (const id of modelIds) store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  } finally {
    db.close();
  }
}

export interface ParsedGlbResult {
  scene: THREE.Group;
  boundsMin: THREE.Vector3;
  boundsMax: THREE.Vector3;
  widthCm: number;
  heightCm: number;
  depthCm: number;
}

/**
 * Parses an ArrayBuffer containing binary .glb (or .gltf JSON) via Three.js GLTFLoader
 * and measures its bounding box converted from meters to centimeters.
 */
export async function parseGlbSceneAndDimensionsCm(
  buffer: ArrayBuffer
): Promise<ParsedGlbResult> {
  const loader = new GLTFLoader();
  const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
    loader.parse(
      buffer,
      '',
      (result) => resolve(result as unknown as { scene: THREE.Group }),
      (err) => reject(err)
    );
  });

  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = new THREE.Vector3();
  if (!box.isEmpty()) {
    box.getSize(size);
  }

  const toCm = (meters: number) =>
    Math.max(1, Math.min(5000, Math.round(meters * 100 * 10) / 10));

  return {
    scene: gltf.scene,
    boundsMin: box.isEmpty() ? new THREE.Vector3(-0.5, 0, -0.5) : box.min.clone(),
    boundsMax: box.isEmpty() ? new THREE.Vector3(0.5, 1, 0.5) : box.max.clone(),
    widthCm: box.isEmpty() ? 100 : toCm(size.x),
    heightCm: box.isEmpty() ? 100 : toCm(size.y),
    depthCm: box.isEmpty() ? 100 : toCm(size.z),
  };
}

/**
 * Computes scale and local offset so a loaded GLB bounding box fits cleanly
 * inside the furniture item's canonical [widthCm, heightCm, depthCm] box
 * centered at (0, 0, 0) (bottom flush at -targetHeightCm / 2).
 */
export function computeCustomModelFitTransform(
  boundsMin: THREE.Vector3,
  boundsMax: THREE.Vector3,
  targetWidthCm: number,
  targetHeightCm: number,
  targetDepthCm: number
): { scale: [number, number, number]; offset: [number, number, number] } {
  const rawW = Math.max(1e-4, boundsMax.x - boundsMin.x);
  const rawH = Math.max(1e-4, boundsMax.y - boundsMin.y);
  const rawD = Math.max(1e-4, boundsMax.z - boundsMin.z);

  const sx = targetWidthCm / rawW;
  const sy = targetHeightCm / rawH;
  const sz = targetDepthCm / rawD;

  const centerX = (boundsMin.x + boundsMax.x) / 2;
  const centerZ = (boundsMin.z + boundsMax.z) / 2;

  return {
    scale: [sx, sy, sz],
    offset: [
      -centerX * sx,
      -targetHeightCm / 2 - boundsMin.y * sy,
      -centerZ * sz,
    ],
  };
}
