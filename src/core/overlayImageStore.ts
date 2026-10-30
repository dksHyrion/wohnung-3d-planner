import { BackgroundImageOverlay } from './types';

export const OVERLAY_MAX_EDGE_PX = 1920;
export const OVERLAY_JPEG_QUALITY = 0.82;
export const OVERLAY_SVG_KEEP_BYTES = 400 * 1024;
const DB_NAME = 'wohnung-planer';
const DB_STORE = 'overlay-images';

export interface FitSize {
  width: number;
  height: number;
}

/** Längere Kante auf maxEdge begrenzen. Das Seitenverhältnis bleibt. */
export function fitSize(width: number, height: number, maxEdge = OVERLAY_MAX_EDGE_PX): FitSize {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const h = Number.isFinite(height) && height > 0 ? height : 1;
  const edge = Math.max(w, h);
  if (edge <= maxEdge) {
    return { width: Math.round(w), height: Math.round(h) };
  }
  const scale = maxEdge / edge;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

interface MemoryRecord {
  blob: Blob;
  url: string;
}

const memory = new Map<string, MemoryRecord>();

function makeObjectUrl(blob: Blob): string {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(blob);
  }
  return '';
}

export function rememberOverlayBlob(imageId: string, blob: Blob): string {
  const previous = memory.get(imageId);
  if (previous?.url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(previous.url);
  }
  const url = makeObjectUrl(blob);
  memory.set(imageId, { blob, url });
  return url;
}

export function memoryOverlayIds(): string[] {
  return [...memory.keys()];
}

export function runtimeUrlForOverlay(imageId: string | undefined): string {
  if (!imageId) return '';
  return memory.get(imageId)?.url ?? '';
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function putOverlayBlob(imageId: string, blob: Blob): Promise<void> {
  const existing = memory.get(imageId);
  if (!existing || existing.blob !== blob) {
    rememberOverlayBlob(imageId, blob);
  }
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(blob, imageId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

export async function getOverlayBlob(imageId: string): Promise<Blob | null> {
  const cached = memory.get(imageId);
  if (cached) return cached.blob;
  const db = await openDb();
  if (!db) return null;
  const blob = await new Promise<Blob | null>((resolve) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const request = tx.objectStore(DB_STORE).get(imageId);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result instanceof Blob ? result : null);
    };
    request.onerror = () => resolve(null);
  });
  db.close();
  if (blob) rememberOverlayBlob(imageId, blob);
  return blob;
}

export async function deleteOverlayBlobs(imageIds: string[]): Promise<void> {
  for (const imageId of imageIds) {
    const previous = memory.get(imageId);
    if (previous?.url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(previous.url);
    }
    memory.delete(imageId);
  }
  if (imageIds.length === 0) return;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    for (const imageId of imageIds) store.delete(imageId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

export function isHeavyImageUrl(url: string | undefined): boolean {
  return Boolean(url && (url.startsWith('data:') || url.startsWith('blob:')));
}

/** JSON, Undo und LocalStorage behalten die Lage, nicht die Pixel. */
export function backgroundImageForExport(
  image: BackgroundImageOverlay | null | undefined
): BackgroundImageOverlay | null {
  if (!image) return null;
  return {
    ...image,
    url: isHeavyImageUrl(image.url) ? '' : image.url,
  };
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  const mime = /data:([^;,]+)/.exec(header)?.[1] ?? 'application/octet-stream';
  try {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return new Blob([dataUrl], { type: mime });
  }
}

async function blobFromSource(file: File, dataUrl?: string): Promise<Blob> {
  if (dataUrl) return dataUrlToBlob(dataUrl) ?? new Blob([dataUrl], { type: file.type || 'application/octet-stream' });
  return file;
}

async function rasterize(
  blob: Blob,
  width: number,
  height: number
): Promise<{ blob: Blob; width: number; height: number } | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  const sourceUrl = makeObjectUrl(blob);
  if (!sourceUrl) return null;
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Bild nicht lesbar'));
      img.src = sourceUrl;
    });
    const fitted = fitSize(image.naturalWidth || width, image.naturalHeight || height);
    const canvas = document.createElement('canvas');
    canvas.width = fitted.width;
    canvas.height = fitted.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, fitted.width, fitted.height);
    const jpeg = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/jpeg', OVERLAY_JPEG_QUALITY);
    });
    if (!jpeg) return null;
    return { blob: jpeg, width: fitted.width, height: fitted.height };
  } catch {
    return null;
  } finally {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(sourceUrl);
    }
  }
}

export interface PreparedOverlay {
  imageId: string;
  url: string;
  naturalWidthPx: number;
  naturalHeightPx: number;
  compressed: boolean;
}

export async function prepareOverlayImage(
  file: File,
  dataUrl?: string,
  dimensions?: { naturalWidth: number; naturalHeight: number }
): Promise<PreparedOverlay> {
  const source = await blobFromSource(file, dataUrl);
  const naturalWidth = dimensions?.naturalWidth ?? OVERLAY_MAX_EDGE_PX;
  const naturalHeight = dimensions?.naturalHeight ?? OVERLAY_MAX_EDGE_PX;
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  let blob = source;
  let width = naturalWidth;
  let height = naturalHeight;
  let compressed = false;

  if (isSvg && source.size <= OVERLAY_SVG_KEEP_BYTES) {
    compressed = true;
  } else {
    const raster = await rasterize(source, naturalWidth, naturalHeight);
    if (raster) {
      blob = raster.blob;
      width = raster.width;
      height = raster.height;
      compressed = true;
    }
  }

  const imageId = `bg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await putOverlayBlob(imageId, blob);
  return {
    imageId,
    url: runtimeUrlForOverlay(imageId),
    naturalWidthPx: width,
    naturalHeightPx: height,
    compressed,
  };
}

/** Data-URL sofort in den Speicher legen. Die zurückgegebene url ist keine Data-URL. */
export function adoptOverlayImage(image: BackgroundImageOverlay): BackgroundImageOverlay {
  if (image.url.startsWith('data:')) {
    const blob = dataUrlToBlob(image.url) ?? new Blob([image.url]);
    const imageId = image.imageId || `bg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const url = rememberOverlayBlob(imageId, blob);
    void putOverlayBlob(imageId, blob);
    return { ...image, imageId, url };
  }
  if (image.imageId) {
    const url = runtimeUrlForOverlay(image.imageId);
    if (url) return { ...image, url };
  }
  if (isHeavyImageUrl(image.url)) return { ...image, url: '' };
  return image;
}

/** Blob aus IndexedDB in die Sitzung holen. Die zurückgegebene url ist keine Data-URL. */
export async function hydrateOverlayUrl(imageId: string): Promise<string> {
  await getOverlayBlob(imageId);
  return runtimeUrlForOverlay(imageId);
}

/**
 * Einmal beim Import einer Data-URL verkleinern.
 * Ohne document bleibt das Original liegen. Die Laufzeit-url ist danach keine Data-URL.
 */
export async function compressStoredOverlay(
  imageId: string,
  naturalWidthPx: number,
  naturalHeightPx: number
): Promise<string> {
  const blob = await getOverlayBlob(imageId);
  if (!blob) return '';
  const isSvg = blob.type === 'image/svg+xml';
  if (!(isSvg && blob.size <= OVERLAY_SVG_KEEP_BYTES)) {
    const raster = await rasterize(blob, naturalWidthPx, naturalHeightPx);
    if (raster) await putOverlayBlob(imageId, raster.blob);
  }
  return runtimeUrlForOverlay(imageId);
}

/** Alte Exporte mit Data-URL in den Bildspeicher legen. */
export async function ingestDataUrlOverlay(
  image: BackgroundImageOverlay
): Promise<BackgroundImageOverlay> {
  if (!image.url.startsWith('data:')) {
    const url = image.imageId ? runtimeUrlForOverlay(image.imageId) || image.url : image.url;
    return { ...image, url };
  }
  const blob = dataUrlToBlob(image.url) ?? new Blob([image.url]);
  const imageId = image.imageId || `bg-${Date.now().toString(36)}`;
  await putOverlayBlob(imageId, blob);
  return {
    ...image,
    imageId,
    url: runtimeUrlForOverlay(imageId),
  };
}
