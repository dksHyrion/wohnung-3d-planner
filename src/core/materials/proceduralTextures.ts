import * as THREE from 'three';

/**
 * Procedural PBR Canvas Texture Generators for Three.js
 *
 * Generates seamless architectural textures directly via HTML5 2D Canvas:
 * - Microcement / Limestone Flooring
 * - Scandinavian Light Oak Parquet Planks
 * - Large-Format Stone Bathroom Tiles with Grout Lines
 * - Woven Wool / Bouclé Area Rug Fabric
 * - Oak Acoustic Slats on Dark Felt (Feature Walls)
 *
 * Includes automatic texture caching and SSR/Node.js environment fallback.
 */

const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Disposes and clears all cached canvas textures.
 */
export function clearTextureCache(): void {
  for (const tex of textureCache.values()) {
    tex.dispose();
  }
  textureCache.clear();
}

/**
 * Creates an HTMLCanvasElement in browser environments or a lightweight mock canvas
 * in Node/Vitest test environments to allow safe offline headless execution.
 */
function createProceduralCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  // Headless / Node fallback for Vitest and SSR
  const noop = () => {};
  const mockCtx: Partial<CanvasRenderingContext2D> = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    fill: noop,
    arc: noop,
    save: noop,
    restore: noop,
    createLinearGradient: () =>
      ({
        addColorStop: noop,
      } as unknown as CanvasGradient),
    getImageData: () =>
      ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
        colorSpace: 'srgb',
      } as ImageData),
    putImageData: noop,
  };

  return {
    width,
    height,
    getContext: () => mockCtx,
  } as unknown as HTMLCanvasElement;
}

/**
 * Configures repeat wrapping, color space and mipmaps on a CanvasTexture.
 */
function configureTexture(texture: THREE.CanvasTexture): THREE.CanvasTexture {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Simple pseudo-random deterministic number generator seeded by coordinates
 * to ensure seamless tiling across procedural texture edges.
 */
function pseudoNoise(x: number, y: number, seed: number = 42): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Generates a seamless warm light limestone / microcement stone texture.
 * Palette: Speckled warm neutrals (#edece8, #e5e4de, #dfded8).
 */
export function getMicrocementTexture(): THREE.CanvasTexture {
  const cacheKey = 'microcement';
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const size = 512;
  const canvas = createProceduralCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Base warm limestone fill
    ctx.fillStyle = '#edece8';
    ctx.fillRect(0, 0, size, size);

    // Fine speckled limestone noise via ImageData if supported
    try {
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = (y * size + x) * 4;

          // Multi-frequency smooth cloudiness
          const lowFreq =
            Math.sin((x / size) * Math.PI * 4) * Math.cos((y / size) * Math.PI * 4) * 4 +
            Math.sin((x / size) * Math.PI * 8 + (y / size) * Math.PI * 8) * 3;

          // Fine mineral grain
          const noise = (pseudoNoise(x, y, 101) - 0.5) * 8;

          // Occasional darker micro-mineral speckle
          const isSpeckle = pseudoNoise(x, y, 999) < 0.015;
          const speckleDrop = isSpeckle ? -18 : 0;

          const baseR = 237 + lowFreq + noise + speckleDrop;
          const baseG = 236 + lowFreq + noise + speckleDrop;
          const baseB = 232 + lowFreq + noise + speckleDrop;

          data[idx] = Math.max(0, Math.min(255, baseR));
          data[idx + 1] = Math.max(0, Math.min(255, baseG));
          data[idx + 2] = Math.max(0, Math.min(255, baseB));
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Fallback if direct pixel access is unavailable
      ctx.fillStyle = '#e5e4de';
      for (let i = 0; i < 400; i++) {
        const rx = pseudoNoise(i, 1) * size;
        const ry = pseudoNoise(i, 2) * size;
        ctx.fillRect(rx, ry, 2, 2);
      }
    }
  }

  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generates a Scandinavian light oak plank pattern (running bond parquet).
 * Plank width ~15-20 cm, length ~100-120 cm, natural wood tones (#e5d7c3, #ddcbb3) with subtle joints.
 */
export function getParquetTexture(): THREE.CanvasTexture {
  const cacheKey = 'parquet';
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const size = 512;
  const canvas = createProceduralCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 8 rows of planks (each 64px high)
    const numRows = 8;
    const rowHeight = size / numRows;
    const plankLength = 256; // 2 planks per row, staggered by 128px

    const oakColors = [
      '#e5d7c3',
      '#ddcbb3',
      '#e0ceb7',
      '#ebdcc9',
      '#decab0',
      '#dfceb6',
    ];

    for (let r = 0; r < numRows; r++) {
      const y = r * rowHeight;
      const xOffset = (r % 2) * (plankLength / 2);

      for (let p = -1; p < 3; p++) {
        const x = p * plankLength + xOffset;
        const colorIdx = Math.floor(pseudoNoise(r, p, 33) * oakColors.length);
        const plankColor = oakColors[colorIdx];

        ctx.fillStyle = plankColor;
        ctx.fillRect(x, y, plankLength, rowHeight);

        // Subtle horizontal wood grain lines
        ctx.strokeStyle = 'rgba(148, 126, 102, 0.12)';
        ctx.lineWidth = 1;
        for (let g = 6; g < rowHeight - 4; g += 8) {
          ctx.beginPath();
          ctx.moveTo(x, y + g);
          ctx.lineTo(x + plankLength, y + g);
          ctx.stroke();
        }

        // Plank end joint line
        ctx.strokeStyle = 'rgba(110, 94, 76, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + plankLength, y);
        ctx.lineTo(x + plankLength, y + rowHeight);
        ctx.stroke();
      }

      // Horizontal plank joint between rows
      ctx.strokeStyle = 'rgba(110, 94, 76, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y + rowHeight);
      ctx.lineTo(size, y + rowHeight);
      ctx.stroke();
    }
  }

  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generates large-format bathroom stone tiles with grout lines.
 * Palette: Fine travertine / limestone porcelain (#ecebe8, #e3e2dc, #dedcd6) with subtle grout (#b8b7b2).
 */
export function getStoneTileTexture(): THREE.CanvasTexture {
  const cacheKey = 'stone-tile';
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const size = 512;
  const canvas = createProceduralCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 2x2 large format tiles (each 256 x 256)
    const tileSize = size / 2;
    const groutWidth = 4;

    // Grout background
    ctx.fillStyle = '#b8b7b2';
    ctx.fillRect(0, 0, size, size);

    const tileColors = ['#ecebe8', '#e3e2dc', '#dedcd6', '#eae9e4'];

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const x = col * tileSize + groutWidth / 2;
        const y = row * tileSize + groutWidth / 2;
        const w = tileSize - groutWidth;
        const h = tileSize - groutWidth;

        const tileColor = tileColors[(row * 2 + col) % tileColors.length];
        ctx.fillStyle = tileColor;
        ctx.fillRect(x, y, w, h);

        // Subtle stone texture flecks inside tile
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (let i = 0; i < 40; i++) {
          const fx = x + pseudoNoise(i, 5) * w;
          const fy = y + pseudoNoise(i, 6) * h;
          ctx.fillRect(fx, fy, 4, 2);
        }
        ctx.fillStyle = 'rgba(150, 145, 138, 0.18)';
        for (let i = 0; i < 30; i++) {
          const fx = x + pseudoNoise(i, 7) * w;
          const fy = y + pseudoNoise(i, 8) * h;
          ctx.fillRect(fx, fy, 3, 2);
        }

        // Slight bevel inner shadow
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      }
    }
  }

  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generates a textured ribbed woven wool / bouclé rug fabric.
 * Palette: Ribbed woven wool (#d8d6ce, #cfccc2, #e5e3db).
 */
export function getWovenRugTexture(): THREE.CanvasTexture {
  const cacheKey = 'woven-rug';
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const size = 512;
  const canvas = createProceduralCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#d8d6ce';
    ctx.fillRect(0, 0, size, size);

    // Ribbed woven rows
    const ribStep = 8;
    for (let y = 0; y < size; y += ribStep) {
      // Darker weave groove
      ctx.fillStyle = '#c5c2b7';
      ctx.fillRect(0, y, size, 2);

      // Light bouclé loop ridge
      ctx.fillStyle = '#e5e3db';
      ctx.fillRect(0, y + 2, size, ribStep - 2);

      // Stippled wool fiber loops along the ridge
      for (let x = 0; x < size; x += 6) {
        const dotColor = (x / 6 + y / ribStep) % 2 === 0 ? '#ebe9e1' : '#cfccc2';
        ctx.fillStyle = dotColor;
        ctx.fillRect(x + 1, y + 3, 3, 3);
      }
    }
  }

  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generates vertical oak slats on dark acoustic felt for architectural feature walls.
 * Oak slats (#dfd2be / #d4c2ab) on dark felt (#1a1a1c).
 */
export function getWoodSlatTexture(): THREE.CanvasTexture {
  const cacheKey = 'wood-slat';
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const size = 512;
  const canvas = createProceduralCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Dark acoustic felt background
    ctx.fillStyle = '#1e1f22';
    ctx.fillRect(0, 0, size, size);

    // 8 vertical oak slats (period = 64px, slat width = 44px, felt gap = 20px)
    const period = 64;
    const slatWidth = 44;

    for (let x = 0; x < size; x += period) {
      // Oak slat fill
      ctx.fillStyle = '#dfd2be';
      ctx.fillRect(x, 0, slatWidth, size);

      // Fine vertical wood grain
      ctx.strokeStyle = 'rgba(145, 124, 98, 0.15)';
      ctx.lineWidth = 1;
      for (let g = 4; g < slatWidth; g += 5) {
        ctx.beginPath();
        ctx.moveTo(x + g, 0);
        ctx.lineTo(x + g, size);
        ctx.stroke();
      }

      // Slat edge highlight (left) and drop shadow (right onto felt gap)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(x, 0, 1.5, size);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(x + slatWidth - 2, 0, 2, size);
    }
  }

  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generates a natural Belgian linen canvas texture with organic slub yarn weave.
 * Palette: Natural oatmeal / cream linen (#f6f4ee, #eee9df, #e5dec9).
 */
export function getLinenTexture(): THREE.CanvasTexture {
  const cacheKey = 'natural-linen';
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const size = 512;
  const canvas = createProceduralCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Warm natural linen ground
    ctx.fillStyle = '#f6f4ee';
    ctx.fillRect(0, 0, size, size);

    // Fine organic slub weave: warp (vertical) threads
    const threadStep = 4;
    for (let x = 0; x < size; x += threadStep) {
      const alpha = 0.08 + pseudoNoise(x, 12, 101) * 0.12;
      ctx.strokeStyle = `rgba(180, 168, 150, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }

    // Weft (horizontal) threads with irregular slub yarn thickness
    for (let y = 0; y < size; y += threadStep) {
      const alpha = 0.08 + pseudoNoise(y, 14, 202) * 0.14;
      ctx.strokeStyle = `rgba(165, 150, 132, ${alpha.toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();

      // Occasional thicker horizontal slub accents
      if (pseudoNoise(y, 9, 303) > 0.75) {
        ctx.fillStyle = 'rgba(235, 226, 212, 0.45)';
        const slubStart = pseudoNoise(y, 3, 404) * (size - 60);
        const slubLen = 20 + pseudoNoise(y, 4, 505) * 40;
        ctx.fillRect(slubStart, y - 0.5, slubLen, 2.5);
      }
    }
  }

  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generates continuous natural light oak wood grain for architectural furniture
 * (dining tables, chair frames, coffee tables, plinths) without flooring plank seams.
 * Palette: Scandinavian white oak (#ebe0cf, #e2d3bf, #dbcaa9) with organic grain flow.
 */
export function getOakFurnitureTexture(): THREE.CanvasTexture {
  const cacheKey = 'oak-furniture';
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const size = 512;
  const canvas = createProceduralCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Warm natural oak background
    ctx.fillStyle = '#e5d7c3';
    ctx.fillRect(0, 0, size, size);

    // Flowing organic woodgrain lines with gentle wave undulations
    const grainBands = 36;
    const bandHeight = size / grainBands;

    for (let i = 0; i < grainBands; i++) {
      const baseY = i * bandHeight;
      const shadeNoise = pseudoNoise(i, 7, 77);
      const alpha = 0.06 + shadeNoise * 0.12;

      ctx.strokeStyle = `rgba(138, 115, 90, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.2 + shadeNoise * 1.5;

      ctx.beginPath();
      for (let x = 0; x <= size; x += 16) {
        // Subtle sinusoidal wave undulating across the wood slab
        const wave =
          Math.sin(x * 0.02 + i * 0.8) * 3.5 +
          Math.sin(x * 0.06 + i * 1.4) * 1.8;
        const y = baseY + wave;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Occasional faint medullary ray / wood pore fleck
      if (pseudoNoise(i, 11, 88) > 0.6) {
        ctx.fillStyle = 'rgba(160, 138, 112, 0.15)';
        const fleckX = pseudoNoise(i, 2, 99) * (size - 80);
        ctx.fillRect(fleckX, baseY - 1, 50, 1.2);
      }
    }
  }

  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generates polished white quartz/marble stone texture with delicate warm-grey veins
 * and subtle crystalline depth for kitchen waterfall islands, dining tops, and vanities.
 */
export function getMarbleQuartzTexture(): THREE.CanvasTexture {
  const cacheKey = 'marble-quartz';
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const size = 512;
  const canvas = createProceduralCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Pure luminous white-calacatta base
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, size, size);

    // Soft clouding / crystalline undertone
    for (let y = 0; y < size; y += 32) {
      for (let x = 0; x < size; x += 32) {
        const val = pseudoNoise(x, y, 42);
        if (val > 0.5) {
          ctx.fillStyle = `rgba(235, 230, 222, ${(val * 0.15).toFixed(3)})`;
          ctx.fillRect(x, y, 32, 32);
        }
      }
    }

    // Branching quartz veins across the surface
    const numVeins = 4;
    for (let v = 0; v < numVeins; v++) {
      let curX = pseudoNoise(v, 1, 12) * size;
      let curY = 0;
      const stepY = 12;

      ctx.strokeStyle = 'rgba(175, 168, 160, 0.18)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(curX, curY);

      while (curY < size) {
        curY += stepY;
        const drift = (pseudoNoise(curX, curY, v * 17) - 0.48) * 18;
        curX = (curX + drift + size) % size;
        ctx.lineTo(curX, curY);
      }
      ctx.stroke();

      // Delicate micro-feathering along the vein
      ctx.strokeStyle = 'rgba(195, 188, 180, 0.10)';
      ctx.lineWidth = 4.0;
      ctx.stroke();
    }
  }

  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  textureCache.set(cacheKey, texture);
  return texture;
}

function configureLinearBumpTexture(texture: THREE.CanvasTexture): THREE.CanvasTexture {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a subtle grayscale bump map for microcement / trowel-finished limestone.
 */
export function getMicrocementBumpTexture(): THREE.CanvasTexture {
  const cacheKey = 'microcement-bump';
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const size = 256;
  const canvas = createProceduralCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#cfcfcf';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 180; i++) {
      const rx = pseudoNoise(i, 11, 201) * size;
      const ry = pseudoNoise(i, 12, 202) * size;
      const rw = 8 + pseudoNoise(i, 13, 203) * 28;
      const rh = 4 + pseudoNoise(i, 14, 204) * 14;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(60,60,60,0.12)';
      ctx.fillRect(rx, ry, rw, rh);
    }
  }

  const texture = configureLinearBumpTexture(new THREE.CanvasTexture(canvas));
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generates a grayscale bump map for Scandinavian oak parquet (recessed plank joints & fine wood grain).
 */
export function getParquetBumpTexture(): THREE.CanvasTexture {
  const cacheKey = 'parquet-bump';
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const size = 512;
  const canvas = createProceduralCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const numRows = 8;
    const rowHeight = size / numRows;
    const plankLength = 256;

    // Raised plank surface base
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, size, size);

    for (let r = 0; r < numRows; r++) {
      const y = r * rowHeight;
      const xOffset = (r % 2) * (plankLength / 2);

      for (let p = -1; p < 3; p++) {
        const x = p * plankLength + xOffset;

        // Subtle grain relief lines
        ctx.strokeStyle = 'rgba(120, 120, 120, 0.28)';
        ctx.lineWidth = 1;
        for (let g = 6; g < rowHeight - 4; g += 8) {
          ctx.beginPath();
          ctx.moveTo(x, y + g);
          ctx.lineTo(x + plankLength, y + g);
          ctx.stroke();
        }

        // Recessed vertical end joint (dark = low)
        ctx.strokeStyle = '#383838';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(x + plankLength, y);
        ctx.lineTo(x + plankLength, y + rowHeight);
        ctx.stroke();
      }

      // Recessed horizontal plank joint
      ctx.strokeStyle = '#383838';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(0, y + rowHeight);
      ctx.lineTo(size, y + rowHeight);
      ctx.stroke();
    }
  }

  const texture = configureLinearBumpTexture(new THREE.CanvasTexture(canvas));
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generates a grayscale bump map for large-format stone tiles (deep grout lines & bevels).
 */
export function getStoneTileBumpTexture(): THREE.CanvasTexture {
  const cacheKey = 'stone-tile-bump';
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  const size = 512;
  const canvas = createProceduralCanvas(size, size);
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const tileSize = size / 2;
    const groutWidth = 4;

    // Deep recessed grout base
    ctx.fillStyle = '#262626';
    ctx.fillRect(0, 0, size, size);

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const x = col * tileSize + groutWidth / 2;
        const y = row * tileSize + groutWidth / 2;
        const w = tileSize - groutWidth;
        const h = tileSize - groutWidth;

        // Soft chamfer edge
        ctx.fillStyle = '#9a9a9a';
        ctx.fillRect(x, y, w, h);

        // Raised flat tile plateau
        ctx.fillStyle = '#efefef';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      }
    }
  }

  const texture = configureLinearBumpTexture(new THREE.CanvasTexture(canvas));
  textureCache.set(cacheKey, texture);
  return texture;
}


