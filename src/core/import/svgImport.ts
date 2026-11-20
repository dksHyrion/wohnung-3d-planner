import type { FloorplanData } from '../types';
import {
  buildWallGraphFromSegments,
  type RawWallSegment,
} from './importTopology';

export interface SvgImportOptions {
  cmPerUnit?: number;
  weldToleranceCm?: number;
}

export interface SvgImportResult {
  data: FloorplanData;
  segmentCount: number;
}

function extractAttr(tag: string, attrName: string): string | null {
  const re = new RegExp(`(?:^|\\s)${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = re.exec(tag);
  return match ? (match[1] ?? match[2] ?? '') : null;
}

function isWallContext(meta: string): boolean {
  return /(wall|wand|arch-wall)/i.test(meta);
}

function isNonWallContext(meta: string): boolean {
  return /(furniture|moebel|möbel|rug|text|dim|label|stair|door|window|opening|fixture)/i.test(
    meta
  );
}

function parsePointsList(raw: string): Array<{ x: number; y: number }> {
  const nums = raw.match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
  if (!nums || nums.length < 4) return [];
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = Number.parseFloat(nums[i]);
    const y = Number.parseFloat(nums[i + 1]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      pts.push({ x, y });
    }
  }
  return pts;
}

function parseSvgPathSegments(
  d: string,
  scale: number
): RawWallSegment[] {
  const segments: RawWallSegment[] = [];
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
  if (!tokens) return segments;

  let cmd = '';
  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;
  let idx = 0;

  const nextNum = (): number | null => {
    if (idx >= tokens.length) return null;
    const val = Number.parseFloat(tokens[idx]);
    if (!Number.isFinite(val)) return null;
    idx++;
    return val;
  };

  while (idx < tokens.length) {
    const tok = tokens[idx];
    if (/^[a-zA-Z]$/.test(tok)) {
      cmd = tok;
      idx++;
      if (cmd === 'Z' || cmd === 'z') {
        segments.push({
          x1: curX * scale,
          z1: curY * scale,
          x2: startX * scale,
          z2: startY * scale,
        });
        curX = startX;
        curY = startY;
        continue;
      }
    }

    if (!cmd) {
      idx++;
      continue;
    }

    if (cmd === 'M' || cmd === 'm') {
      const x = nextNum();
      const y = nextNum();
      if (x === null || y === null) break;
      curX = cmd === 'm' ? curX + x : x;
      curY = cmd === 'm' ? curY + y : y;
      startX = curX;
      startY = curY;
      // Subsequent coordinate pairs after M are implicit L
      cmd = cmd === 'm' ? 'l' : 'L';
      continue;
    }

    if (cmd === 'L' || cmd === 'l') {
      const x = nextNum();
      const y = nextNum();
      if (x === null || y === null) break;
      const nx = cmd === 'l' ? curX + x : x;
      const ny = cmd === 'l' ? curY + y : y;
      segments.push({
        x1: curX * scale,
        z1: curY * scale,
        x2: nx * scale,
        z2: ny * scale,
      });
      curX = nx;
      curY = ny;
      continue;
    }

    if (cmd === 'H' || cmd === 'h') {
      const x = nextNum();
      if (x === null) break;
      const nx = cmd === 'h' ? curX + x : x;
      segments.push({
        x1: curX * scale,
        z1: curY * scale,
        x2: nx * scale,
        z2: curY * scale,
      });
      curX = nx;
      continue;
    }

    if (cmd === 'V' || cmd === 'v') {
      const y = nextNum();
      if (y === null) break;
      const ny = cmd === 'v' ? curY + y : y;
      segments.push({
        x1: curX * scale,
        z1: curY * scale,
        x2: curX * scale,
        z2: ny * scale,
      });
      curY = ny;
      continue;
    }

    // Advance curX/curY on curve commands so subsequent relative commands & Z stay aligned
    if (cmd === 'C' || cmd === 'c') {
      const nums = [nextNum(), nextNum(), nextNum(), nextNum(), nextNum(), nextNum()];
      if (nums.some((n) => n === null)) break;
      const ex = nums[4] as number;
      const ey = nums[5] as number;
      curX = cmd === 'c' ? curX + ex : ex;
      curY = cmd === 'c' ? curY + ey : ey;
      continue;
    }
    if (cmd === 'S' || cmd === 's' || cmd === 'Q' || cmd === 'q') {
      const nums = [nextNum(), nextNum(), nextNum(), nextNum()];
      if (nums.some((n) => n === null)) break;
      const ex = nums[2] as number;
      const ey = nums[3] as number;
      const isRel = cmd === 's' || cmd === 'q';
      curX = isRel ? curX + ex : ex;
      curY = isRel ? curY + ey : ey;
      continue;
    }
    if (cmd === 'T' || cmd === 't') {
      const ex = nextNum();
      const ey = nextNum();
      if (ex === null || ey === null) break;
      curX = cmd === 't' ? curX + ex : ex;
      curY = cmd === 't' ? curY + ey : ey;
      continue;
    }
    if (cmd === 'A' || cmd === 'a') {
      const nums = [
        nextNum(),
        nextNum(),
        nextNum(),
        nextNum(),
        nextNum(),
        nextNum(),
        nextNum(),
      ];
      if (nums.some((n) => n === null)) break;
      const ex = nums[5] as number;
      const ey = nums[6] as number;
      curX = cmd === 'a' ? curX + ex : ex;
      curY = cmd === 'a' ? curY + ey : ey;
      continue;
    }

    // Skip any unknown token gracefully
    idx++;
  }

  return segments;
}

export function parseSvgFloorplan(
  svgText: string,
  options: SvgImportOptions = {}
): SvgImportResult {
  const scale = options.cmPerUnit && options.cmPerUnit > 0 ? options.cmPerUnit : 1;

  interface TaggedSegment extends RawWallSegment {
    wallHint: boolean;
    nonWallHint: boolean;
  }

  const taggedSegments: TaggedSegment[] = [];
  const groupStack: string[] = [];
  const SKIP_SUBTREE_TAGS = new Set(['defs', 'pattern', 'clippath', 'mask']);
  let skipDepth = 0;

  const tagRe = /<\/?([a-zA-Z0-9:-]+)([^>]*)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(svgText)) !== null) {
    const full = match[0];
    const tagName = match[1].toLowerCase();
    const attrs = match[2] ?? '';
    const isClosing = full.startsWith('</');
    const isSelfClosing = full.endsWith('/>');

    if (SKIP_SUBTREE_TAGS.has(tagName)) {
      if (isClosing) {
        skipDepth = Math.max(0, skipDepth - 1);
      } else if (!isSelfClosing) {
        skipDepth++;
      }
      continue;
    }
    if (skipDepth > 0) continue;

    if (tagName === 'g') {
      if (isClosing) {
        groupStack.pop();
      } else if (!isSelfClosing) {
        const cls = extractAttr(attrs, 'class') ?? '';
        const id = extractAttr(attrs, 'id') ?? '';
        groupStack.push(`${cls} ${id}`.trim());
      }
      continue;
    }

    if (isClosing) continue;

    const ownMeta = `${extractAttr(attrs, 'class') ?? ''} ${extractAttr(attrs, 'id') ?? ''}`;
    const fullMeta = `${groupStack.join(' ')} ${ownMeta}`;
    const wallHint = isWallContext(fullMeta);
    const nonWallHint = isNonWallContext(fullMeta);

    const pushSeg = (seg: RawWallSegment) => {
      taggedSegments.push({ ...seg, wallHint, nonWallHint });
    };

    if (tagName === 'line') {
      const x1 = Number.parseFloat(extractAttr(attrs, 'x1') ?? '');
      const y1 = Number.parseFloat(extractAttr(attrs, 'y1') ?? '');
      const x2 = Number.parseFloat(extractAttr(attrs, 'x2') ?? '');
      const y2 = Number.parseFloat(extractAttr(attrs, 'y2') ?? '');
      if (
        Number.isFinite(x1) &&
        Number.isFinite(y1) &&
        Number.isFinite(x2) &&
        Number.isFinite(y2)
      ) {
        pushSeg({
          x1: x1 * scale,
          z1: y1 * scale,
          x2: x2 * scale,
          z2: y2 * scale,
        });
      }
    } else if (tagName === 'polyline' || tagName === 'polygon') {
      const pts = parsePointsList(extractAttr(attrs, 'points') ?? '');
      for (let k = 0; k + 1 < pts.length; k++) {
        pushSeg({
          x1: pts[k].x * scale,
          z1: pts[k].y * scale,
          x2: pts[k + 1].x * scale,
          z2: pts[k + 1].y * scale,
        });
      }
      if (tagName === 'polygon' && pts.length >= 3) {
        pushSeg({
          x1: pts[pts.length - 1].x * scale,
          z1: pts[pts.length - 1].y * scale,
          x2: pts[0].x * scale,
          z2: pts[0].y * scale,
        });
      }
    } else if (tagName === 'rect') {
      const x = Number.parseFloat(extractAttr(attrs, 'x') ?? '0');
      const y = Number.parseFloat(extractAttr(attrs, 'y') ?? '0');
      const w = Number.parseFloat(extractAttr(attrs, 'width') ?? '');
      const h = Number.parseFloat(extractAttr(attrs, 'height') ?? '');
      if (
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(w) &&
        Number.isFinite(h) &&
        w > 0 &&
        h > 0
      ) {
        // Long thin rects represent single wall bars; normal rects represent room/box outlines
        if (w >= h * 3 && h * scale <= 45) {
          pushSeg({
            x1: x * scale,
            z1: (y + h / 2) * scale,
            x2: (x + w) * scale,
            z2: (y + h / 2) * scale,
            thicknessCm: Math.max(5, h * scale),
          });
        } else if (h >= w * 3 && w * scale <= 45) {
          pushSeg({
            x1: (x + w / 2) * scale,
            z1: y * scale,
            x2: (x + w / 2) * scale,
            z2: (y + h) * scale,
            thicknessCm: Math.max(5, w * scale),
          });
        } else {
          pushSeg({ x1: x * scale, z1: y * scale, x2: (x + w) * scale, z2: y * scale });
          pushSeg({
            x1: (x + w) * scale,
            z1: y * scale,
            x2: (x + w) * scale,
            z2: (y + h) * scale,
          });
          pushSeg({
            x1: (x + w) * scale,
            z1: (y + h) * scale,
            x2: x * scale,
            z2: (y + h) * scale,
          });
          pushSeg({ x1: x * scale, z1: (y + h) * scale, x2: x * scale, z2: y * scale });
        }
      }
    } else if (tagName === 'path') {
      const d = extractAttr(attrs, 'd');
      if (d) {
        for (const seg of parseSvgPathSegments(d, scale)) {
          pushSeg(seg);
        }
      }
    }
  }

  const wallHints = taggedSegments.filter((s) => s.wallHint);
  const selected =
    wallHints.length >= 2
      ? wallHints
      : taggedSegments.filter((s) => !s.nonWallHint);

  const graph = buildWallGraphFromSegments(selected, {
    weldToleranceCm: options.weldToleranceCm ?? 5,
  });

  return {
    data: {
      corners: graph.corners,
      walls: graph.walls,
      openings: [],
      furniture: [],
    },
    segmentCount: selected.length,
  };
}
