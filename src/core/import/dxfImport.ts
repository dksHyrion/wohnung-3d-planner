import type { FloorplanData } from '../types';
import {
  buildWallGraphFromSegments,
  type RawWallSegment,
} from './importTopology';

export type DxfUnit = 'mm' | 'cm' | 'm';

export interface DxfImportOptions {
  unit?: DxfUnit | 'auto';
  weldToleranceCm?: number;
}

export interface DxfImportResult {
  data: FloorplanData;
  detectedUnit: DxfUnit;
  segmentCount: number;
}

const UNIT_SCALE_TO_CM: Record<DxfUnit, number> = {
  mm: 0.1,
  cm: 1,
  m: 100,
};

function isWallLayer(layer: string): boolean {
  return /(^|[-_\s])(wall|walls|a-wall|wand|waende|wände)([-_\s]|$)/i.test(layer);
}

function isNonWallLayer(layer: string): boolean {
  return /(^|[-_\s])(dim|dimensions|text|furn|furniture|moebel|möbel|rug|rugs|mep|hatch|grid|frame|title)([-_\s]|$)/i.test(
    layer
  );
}

interface DxfPair {
  code: number;
  value: string;
}

function tokenizeDxf(content: string): DxfPair[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const pairs: DxfPair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number.parseInt(lines[i].trim(), 10);
    if (!Number.isFinite(code)) continue;
    pairs.push({ code, value: lines[i + 1].trim() });
  }
  return pairs;
}

interface LayerSegment extends RawWallSegment {
  layer: string;
}

export function parseDxfFloorplan(
  dxfText: string,
  options: DxfImportOptions = {}
): DxfImportResult {
  const pairs = tokenizeDxf(dxfText);

  let detectedUnit: DxfUnit = 'cm';
  let inHeader = false;
  let lastHeaderVar = '';

  for (let i = 0; i < pairs.length; i++) {
    const { code, value } = pairs[i];
    if (code === 0 && value === 'SECTION') {
      if (pairs[i + 1]?.code === 2 && pairs[i + 1].value === 'HEADER') {
        inHeader = true;
      }
      continue;
    }
    if (code === 0 && value === 'ENDSEC') {
      inHeader = false;
      lastHeaderVar = '';
      continue;
    }
    if (inHeader) {
      if (code === 9) {
        lastHeaderVar = value;
      } else if (lastHeaderVar === '$INSUNITS' && code === 70) {
        const ins = Number.parseInt(value, 10);
        if (ins === 4) detectedUnit = 'mm';
        else if (ins === 5) detectedUnit = 'cm';
        else if (ins === 6) detectedUnit = 'm';
        lastHeaderVar = '';
      }
    }
  }

  const effectiveUnit: DxfUnit =
    options.unit && options.unit !== 'auto' ? options.unit : detectedUnit;
  const scale = UNIT_SCALE_TO_CM[effectiveUnit];

  const rawSegments: LayerSegment[] = [];
  let inEntities = false;

  let i = 0;
  while (i < pairs.length) {
    const p = pairs[i];
    if (p.code === 0 && p.value === 'SECTION') {
      inEntities = pairs[i + 1]?.code === 2 && pairs[i + 1].value === 'ENTITIES';
      i++;
      continue;
    }
    if (p.code === 0 && p.value === 'ENDSEC') {
      inEntities = false;
      i++;
      continue;
    }

    if (!inEntities || p.code !== 0) {
      i++;
      continue;
    }

    const entityType = p.value;
    i++;

    if (entityType === 'LINE') {
      let layer = '0';
      let x1 = NaN;
      let y1 = NaN;
      let x2 = NaN;
      let y2 = NaN;
      while (i < pairs.length && pairs[i].code !== 0) {
        const { code, value } = pairs[i];
        if (code === 8) layer = value;
        else if (code === 10) x1 = Number.parseFloat(value);
        else if (code === 20) y1 = Number.parseFloat(value);
        else if (code === 11) x2 = Number.parseFloat(value);
        else if (code === 21) y2 = Number.parseFloat(value);
        i++;
      }
      if (
        Number.isFinite(x1) &&
        Number.isFinite(y1) &&
        Number.isFinite(x2) &&
        Number.isFinite(y2)
      ) {
        rawSegments.push({
          layer,
          x1: x1 * scale,
          z1: -y1 * scale,
          x2: x2 * scale,
          z2: -y2 * scale,
        });
      }
      continue;
    }

    if (entityType === 'LWPOLYLINE') {
      let layer = '0';
      let closed = false;
      const pts: Array<{ x: number; y: number }> = [];
      let pendingX: number | null = null;
      while (i < pairs.length && pairs[i].code !== 0) {
        const { code, value } = pairs[i];
        if (code === 8) layer = value;
        else if (code === 70) closed = (Number.parseInt(value, 10) & 1) === 1;
        else if (code === 10) pendingX = Number.parseFloat(value);
        else if (code === 20 && pendingX !== null) {
          const y = Number.parseFloat(value);
          if (Number.isFinite(pendingX) && Number.isFinite(y)) {
            pts.push({ x: pendingX, y });
          }
          pendingX = null;
        }
        i++;
      }
      for (let k = 0; k + 1 < pts.length; k++) {
        rawSegments.push({
          layer,
          x1: pts[k].x * scale,
          z1: -pts[k].y * scale,
          x2: pts[k + 1].x * scale,
          z2: -pts[k + 1].y * scale,
        });
      }
      if (closed && pts.length >= 3) {
        rawSegments.push({
          layer,
          x1: pts[pts.length - 1].x * scale,
          z1: -pts[pts.length - 1].y * scale,
          x2: pts[0].x * scale,
          z2: -pts[0].y * scale,
        });
      }
      continue;
    }

    if (entityType === 'POLYLINE') {
      let layer = '0';
      let closed = false;
      while (i < pairs.length && pairs[i].code !== 0) {
        const { code, value } = pairs[i];
        if (code === 8) layer = value;
        else if (code === 70) closed = (Number.parseInt(value, 10) & 1) === 1;
        i++;
      }
      const pts: Array<{ x: number; y: number }> = [];
      while (i < pairs.length) {
        const sub = pairs[i];
        if (sub.code === 0 && sub.value === 'SEQEND') {
          i++;
          while (i < pairs.length && pairs[i].code !== 0) i++;
          break;
        }
        if (sub.code === 0 && sub.value === 'VERTEX') {
          i++;
          let vx = NaN;
          let vy = NaN;
          while (i < pairs.length && pairs[i].code !== 0) {
            if (pairs[i].code === 10) vx = Number.parseFloat(pairs[i].value);
            else if (pairs[i].code === 20) vy = Number.parseFloat(pairs[i].value);
            i++;
          }
          if (Number.isFinite(vx) && Number.isFinite(vy)) {
            pts.push({ x: vx, y: vy });
          }
          continue;
        }
        break;
      }
      for (let k = 0; k + 1 < pts.length; k++) {
        rawSegments.push({
          layer,
          x1: pts[k].x * scale,
          z1: -pts[k].y * scale,
          x2: pts[k + 1].x * scale,
          z2: -pts[k + 1].y * scale,
        });
      }
      if (closed && pts.length >= 3) {
        rawSegments.push({
          layer,
          x1: pts[pts.length - 1].x * scale,
          z1: -pts[pts.length - 1].y * scale,
          x2: pts[0].x * scale,
          z2: -pts[0].y * scale,
        });
      }
      continue;
    }
  }

  const wallLayered = rawSegments.filter((s) => isWallLayer(s.layer));
  const selectedSegments =
    wallLayered.length > 0
      ? wallLayered
      : rawSegments.filter((s) => !isNonWallLayer(s.layer));

  const graph = buildWallGraphFromSegments(selectedSegments, {
    weldToleranceCm: options.weldToleranceCm ?? 5,
  });

  return {
    data: {
      corners: graph.corners,
      walls: graph.walls,
      openings: [],
      furniture: [],
    },
    detectedUnit,
    segmentCount: selectedSegments.length,
  };
}
