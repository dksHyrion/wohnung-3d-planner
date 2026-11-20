import type { FloorplanData } from '../types';

export const PLAN_HASH_PREFIX = '#plan=';
export const DEFAULT_MAX_SHARE_HASH_LENGTH = 32768;
export const MAX_DECODE_HASH_LENGTH = 262_144;
export const MAX_DECOMPRESSED_BYTES = 1_500_000;

export type ShareUrlResult =
  | { ok: true; url: string; hashLength: number }
  | { ok: false; reason: 'too-large'; hashLength: number; maxHashLength: number };

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array | null {
  if (!b64url || !/^[A-Za-z0-9\-_]+$/.test(b64url)) {
    return null;
  }
  const padded =
    b64url.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (b64url.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function pipeBytesThroughTransform(
  bytes: Uint8Array,
  transform: ReadableWritablePair<Uint8Array, BufferSource>,
  maxOutputBytes: number = MAX_DECOMPRESSED_BYTES
): Promise<Uint8Array> {
  const readable = new Blob([new Uint8Array(bytes)])
    .stream()
    .pipeThrough(transform);
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxOutputBytes) {
          await reader.cancel();
          throw new Error('Decompressed payload exceeds safety limit');
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function gzipCompressBytes(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    return await pipeBytesThroughTransform(bytes, new CompressionStream('gzip'));
  } catch {
    return null;
  }
}

async function gzipDecompressBytes(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    return await pipeBytesThroughTransform(bytes, new DecompressionStream('gzip'));
  } catch {
    return null;
  }
}

/**
 * Strips non-portable runtime fields (like local IndexedDB underlay references)
 * before encoding a floorplan into a shareable URL hash.
 */
export function stripTransientForUrl(data: FloorplanData): FloorplanData {
  return {
    ...(data.levels ? { levels: data.levels } : {}),
    ...(data.stairs ? { stairs: data.stairs } : {}),
    corners: data.corners,
    walls: data.walls,
    openings: data.openings,
    furniture: data.furniture,
    rugs: data.rugs ?? [],
    roomLabels: data.roomLabels ?? [],
    roofSlopes: data.roofSlopes ?? [],
    fixtures: data.fixtures ?? [],
    variants: data.variants ?? [],
    activeVariantId: data.activeVariantId ?? null,
  };
}

export function extractPlanHashParam(hash: string): string | null {
  if (!hash) return null;
  const clean = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!clean) return null;
  for (const part of clean.split('&')) {
    if (part.startsWith('plan=')) {
      return part.slice('plan='.length);
    }
  }
  return null;
}

export async function encodeFloorplanToUrlHash(data: FloorplanData): Promise<string> {
  const portable = stripTransientForUrl(data);
  const rawBytes = new TextEncoder().encode(JSON.stringify(portable));
  const gzBytes = await gzipCompressBytes(rawBytes);

  if (gzBytes && gzBytes.length < rawBytes.length) {
    return `${PLAN_HASH_PREFIX}gz:${bytesToBase64Url(gzBytes)}`;
  }
  return `${PLAN_HASH_PREFIX}b64:${bytesToBase64Url(rawBytes)}`;
}

function isValidFloorplanShape(parsed: unknown): parsed is FloorplanData {
  if (!parsed || typeof parsed !== 'object') return false;
  const obj = parsed as Record<string, unknown>;
  return (
    Array.isArray(obj.corners) &&
    Array.isArray(obj.walls) &&
    Array.isArray(obj.openings) &&
    Array.isArray(obj.furniture)
  );
}

export async function decodeFloorplanFromUrlHash(
  hash: string
): Promise<FloorplanData | null> {
  if (!hash || hash.length > MAX_DECODE_HASH_LENGTH) return null;
  const payload = extractPlanHashParam(hash);
  if (!payload || payload.length > MAX_DECODE_HASH_LENGTH) return null;

  let jsonBytes: Uint8Array | null = null;

  if (payload.startsWith('gz:')) {
    const compressed = base64UrlToBytes(payload.slice(3));
    if (!compressed) return null;
    jsonBytes = await gzipDecompressBytes(compressed);
  } else if (payload.startsWith('b64:')) {
    jsonBytes = base64UrlToBytes(payload.slice(4));
    if (jsonBytes && jsonBytes.byteLength > MAX_DECOMPRESSED_BYTES) return null;
  } else {
    return null;
  }

  if (!jsonBytes) return null;

  try {
    const text = new TextDecoder().decode(jsonBytes);
    const parsed: unknown = JSON.parse(text);
    if (!isValidFloorplanShape(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function buildSharePlanUrl(
  baseUrl: string,
  data: FloorplanData,
  options: { maxHashLength?: number } = {}
): Promise<ShareUrlResult> {
  const maxHashLength = options.maxHashLength ?? DEFAULT_MAX_SHARE_HASH_LENGTH;
  const hash = await encodeFloorplanToUrlHash(data);
  if (hash.length > maxHashLength) {
    return {
      ok: false,
      reason: 'too-large',
      hashLength: hash.length,
      maxHashLength,
    };
  }
  const baseWithoutHash = baseUrl.split('#')[0] ?? baseUrl;
  return {
    ok: true,
    url: `${baseWithoutHash}${hash}`,
    hashLength: hash.length,
  };
}
