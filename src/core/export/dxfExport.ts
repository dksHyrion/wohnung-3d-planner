import type { FloorplanData, Point2D } from '../types';
import { computeFloorPolygons, applyRoomLabels, getWallGeometry } from '../wallMath';
import { computeExteriorDimensionChains } from '../dimensionMath';
import { layoutFurnitureParts } from '../furnitureShapes';
import { doorHingeOnRight, doorSwingsInward } from '../doorLeaf';
import { computeWallPlanPolygons } from './wallExportPolygons';
import { computeWallFixtureBoxes } from '../mepFixtures';
import { DEFAULT_LEVEL_ID, normalizeLevels, scopeFloorplanToLevel } from '../levels';
import { computeStairGeometry } from '../stairsMath';
import type { Language } from '../../i18n/types';

export interface DxfExportOptions {
  includeFurniture?: boolean;
  includeDimensions?: boolean;
  language?: Language;
  levelId?: string;
}

const DXF_LAYERS: Array<{ name: string; color: number }> = [
  { name: 'WALLS', color: 7 },
  { name: 'OPENINGS', color: 4 },
  { name: 'STAIRS', color: 5 },
  { name: 'FURNITURE', color: 3 },
  { name: 'RUGS', color: 8 },
  { name: 'DIMENSIONS', color: 1 },
  { name: 'TEXT', color: 2 },
  { name: 'MEP', color: 6 },
];

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

function sanitizeText(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').trim();
}

/** Converts floorplan Z (downwards in 2D SVG) to CAD Y (upwards in DXF). */
function dxfY(z: number): number {
  return -z;
}

function pushPair(out: string[], code: number, value: string | number): void {
  out.push(String(code));
  out.push(String(value));
}

function addLine(
  out: string[],
  layer: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  pushPair(out, 0, 'LINE');
  pushPair(out, 8, layer);
  pushPair(out, 10, fmt(x1));
  pushPair(out, 20, fmt(y1));
  pushPair(out, 30, 0);
  pushPair(out, 11, fmt(x2));
  pushPair(out, 21, fmt(y2));
  pushPair(out, 31, 0);
}

function addClosedPolyline(out: string[], layer: string, pts: Point2D[]): void {
  if (pts.length < 3) return;
  pushPair(out, 0, 'POLYLINE');
  pushPair(out, 8, layer);
  pushPair(out, 66, 1);
  pushPair(out, 70, 1);
  for (const p of pts) {
    pushPair(out, 0, 'VERTEX');
    pushPair(out, 8, layer);
    pushPair(out, 10, fmt(p.x));
    pushPair(out, 20, fmt(dxfY(p.z)));
    pushPair(out, 30, 0);
  }
  pushPair(out, 0, 'SEQEND');
  pushPair(out, 8, layer);
}

function addArc(
  out: string[],
  layer: string,
  cx: number,
  cy: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number
): void {
  pushPair(out, 0, 'ARC');
  pushPair(out, 8, layer);
  pushPair(out, 10, fmt(cx));
  pushPair(out, 20, fmt(cy));
  pushPair(out, 30, 0);
  pushPair(out, 40, fmt(radius));
  pushPair(out, 50, fmt(startAngleDeg));
  pushPair(out, 51, fmt(endAngleDeg));
}

function addText(
  out: string[],
  layer: string,
  x: number,
  y: number,
  heightCm: number,
  text: string,
  rotationDeg = 0
): void {
  const clean = sanitizeText(text);
  if (!clean) return;
  pushPair(out, 0, 'TEXT');
  pushPair(out, 8, layer);
  pushPair(out, 10, fmt(x));
  pushPair(out, 20, fmt(y));
  pushPair(out, 30, 0);
  pushPair(out, 40, fmt(heightCm));
  pushPair(out, 1, clean);
  if (rotationDeg !== 0) {
    pushPair(out, 50, fmt(rotationDeg));
  }
  // Centered horizontal alignment (group 72 = 1) with alignment point (11, 21)
  pushPair(out, 72, 1);
  pushPair(out, 11, fmt(x));
  pushPair(out, 21, fmt(y));
  pushPair(out, 31, 0);
}

function normDeg(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

function rotateLocalPoint(
  cx: number,
  cz: number,
  rotDeg: number,
  lx: number,
  lz: number
): Point2D {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cx + lx * cos + lz * sin,
    z: cz - lx * sin + lz * cos,
  };
}

/**
 * Generates an AutoCAD R12 compatible ASCII DXF string.
 * Global CAD coordinate convention: 1 DXF unit = 1.0 cm, Y = -Z (top-down north-up).
 */
export function exportFloorplanDxf(
  rawData: FloorplanData,
  options: DxfExportOptions = {}
): string {
  const allLevels = normalizeLevels(rawData.levels);
  const targetLevelId =
    options.levelId ??
    allLevels.find((l) => l.index === 0)?.id ??
    allLevels[0]?.id ??
    DEFAULT_LEVEL_ID;
  const data =
    options.levelId || allLevels.length > 1
      ? scopeFloorplanToLevel(rawData, targetLevelId)
      : rawData;
  const includeFurniture = options.includeFurniture !== false;
  const includeDimensions = options.includeDimensions !== false;
  const isEn = options.language === 'en';
  const out: string[] = [];

  // HEADER
  pushPair(out, 0, 'SECTION');
  pushPair(out, 2, 'HEADER');
  pushPair(out, 9, '$ACADVER');
  pushPair(out, 1, 'AC1009');
  pushPair(out, 9, '$LUNITS');
  pushPair(out, 70, 2);
  pushPair(out, 0, 'ENDSEC');

  // TABLES -> LAYER
  pushPair(out, 0, 'SECTION');
  pushPair(out, 2, 'TABLES');
  pushPair(out, 0, 'TABLE');
  pushPair(out, 2, 'LAYER');
  pushPair(out, 70, DXF_LAYERS.length);
  for (const layer of DXF_LAYERS) {
    pushPair(out, 0, 'LAYER');
    pushPair(out, 2, layer.name);
    pushPair(out, 70, 0);
    pushPair(out, 62, layer.color);
    pushPair(out, 6, 'CONTINUOUS');
  }
  pushPair(out, 0, 'ENDTAB');
  pushPair(out, 0, 'ENDSEC');

  // ENTITIES
  pushPair(out, 0, 'SECTION');
  pushPair(out, 2, 'ENTITIES');

  const cornerMap = new Map(data.corners.map((c) => [c.id, c]));

  // 0b. Stairs touching this level
  const levelStairs = (rawData.stairs ?? []).filter(
    (st) => st.fromLevelId === targetLevelId || st.toLevelId === targetLevelId
  );
  if (levelStairs.length > 0) {
    const levelMap = new Map(allLevels.map((l) => [l.id, l]));
    for (const st of levelStairs) {
      const geom = computeStairGeometry(
        st,
        levelMap.get(st.fromLevelId),
        levelMap.get(st.toLevelId)
      );
      addClosedPolyline(out, 'STAIRS', geom.footprintPolygonXZ);
      for (const tl of geom.treadLines) {
        addLine(out, 'STAIRS', tl.x1, dxfY(tl.z1), tl.x2, dxfY(tl.z2));
      }
      for (let i = 1; i < geom.walkArrowPolylineXZ.length; i++) {
        const a = geom.walkArrowPolylineXZ[i - 1];
        const b = geom.walkArrowPolylineXZ[i];
        addLine(out, 'STAIRS', a.x, dxfY(a.z), b.x, dxfY(b.z));
      }
    }
  }

  // 1. Mitered & opening-cut wall polygons
  const wallPolygons = computeWallPlanPolygons(data.corners, data.walls, data.openings);
  for (const wp of wallPolygons) {
    addClosedPolyline(out, 'WALLS', wp.polygon);
  }

  // 2. Openings (Doors, Balcony Doors, Sliding Doors, Passages, Windows)
  for (const op of data.openings) {
    const wall = data.walls.find((w) => w.id === op.wallId);
    if (!wall) continue;
    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) continue;

    const geom = getWallGeometry(start, end);
    const opStartX = start.x + geom.tangent.x * op.offsetFromStartCm;
    const opStartZ = start.z + geom.tangent.z * op.offsetFromStartCm;
    const opEndX = start.x + geom.tangent.x * (op.offsetFromStartCm + op.widthCm);
    const opEndZ = start.z + geom.tangent.z * (op.offsetFromStartCm + op.widthCm);
    const halfT = wall.thicknessCm / 2;
    const nx = geom.normal.x * halfT;
    const nz = geom.normal.z * halfT;

    if (op.type === 'window') {
      addLine(out, 'OPENINGS', opStartX - nx, dxfY(opStartZ - nz), opEndX - nx, dxfY(opEndZ - nz));
      addLine(out, 'OPENINGS', opStartX + nx, dxfY(opStartZ + nz), opEndX + nx, dxfY(opEndZ + nz));
      addLine(out, 'OPENINGS', opStartX, dxfY(opStartZ), opEndX, dxfY(opEndZ));
    } else if (op.type === 'passage') {
      addLine(out, 'OPENINGS', opStartX - nx, dxfY(opStartZ - nz), opEndX - nx, dxfY(opEndZ - nz));
      addLine(out, 'OPENINGS', opStartX + nx, dxfY(opStartZ + nz), opEndX + nx, dxfY(opEndZ + nz));
    } else if (op.type === 'sliding-door') {
      const swingSign = doorSwingsInward(op.swingDirection) ? 1 : -1;
      const slideOffset = wall.thicknessCm * 0.45 * swingSign;
      const sx = geom.normal.x * slideOffset;
      const sz = geom.normal.z * slideOffset;
      addLine(out, 'OPENINGS', opStartX, dxfY(opStartZ), opEndX, dxfY(opEndZ));
      addLine(out, 'OPENINGS', opStartX + sx, dxfY(opStartZ + sz), opEndX + sx, dxfY(opEndZ + sz));
    } else {
      if (op.type === 'balcony-door') {
        addLine(out, 'OPENINGS', opStartX, dxfY(opStartZ), opEndX, dxfY(opEndZ));
      }
      const swingSign = doorSwingsInward(op.swingDirection) ? 1 : -1;
      const hingeOnRight = doorHingeOnRight(op.swingDirection);

      const hingeX = hingeOnRight ? opEndX : opStartX;
      const hingeZ = hingeOnRight ? opEndZ : opStartZ;
      const latchClosedX = hingeOnRight ? opStartX : opEndX;
      const latchClosedZ = hingeOnRight ? opStartZ : opEndZ;

      const leafOpenX = hingeX + geom.normal.x * swingSign * op.widthCm;
      const leafOpenZ = hingeZ + geom.normal.z * swingSign * op.widthCm;

      addLine(out, 'OPENINGS', hingeX, dxfY(hingeZ), leafOpenX, dxfY(leafOpenZ));

      const angleClosed = normDeg(
        (Math.atan2(dxfY(latchClosedZ) - dxfY(hingeZ), latchClosedX - hingeX) * 180) / Math.PI
      );
      const angleOpen = normDeg(
        (Math.atan2(dxfY(leafOpenZ) - dxfY(hingeZ), leafOpenX - hingeX) * 180) / Math.PI
      );
      const ccwSpan = normDeg(angleOpen - angleClosed);
      const startDeg = ccwSpan <= 180 ? angleClosed : angleOpen;
      const endDeg = ccwSpan <= 180 ? angleOpen : angleClosed;
      addArc(out, 'OPENINGS', hingeX, dxfY(hingeZ), op.widthCm, startDeg, endDeg);
    }
  }

  // 3. Rugs & Furniture
  if (includeFurniture) {
    for (const rug of data.rugs ?? []) {
      const hw = rug.widthCm / 2;
      const hd = rug.depthCm / 2;
      const rot = rug.rotationYDeg ?? 0;
      const poly = [
        rotateLocalPoint(rug.x, rug.z, rot, -hw, -hd),
        rotateLocalPoint(rug.x, rug.z, rot, hw, -hd),
        rotateLocalPoint(rug.x, rug.z, rot, hw, hd),
        rotateLocalPoint(rug.x, rug.z, rot, -hw, hd),
      ];
      addClosedPolyline(out, 'RUGS', poly);
    }

    for (const f of data.furniture) {
      const localParts = layoutFurnitureParts(f);
      for (const lp of localParts) {
        const hw = lp.widthCm / 2;
        const hd = lp.depthCm / 2;
        const poly = [
          rotateLocalPoint(f.x, f.z, f.rotationYDeg, lp.cx - hw, lp.cz - hd),
          rotateLocalPoint(f.x, f.z, f.rotationYDeg, lp.cx + hw, lp.cz - hd),
          rotateLocalPoint(f.x, f.z, f.rotationYDeg, lp.cx + hw, lp.cz + hd),
          rotateLocalPoint(f.x, f.z, f.rotationYDeg, lp.cx - hw, lp.cz + hd),
        ];
        addClosedPolyline(out, 'FURNITURE', poly);
      }
      addText(out, 'TEXT', f.x, dxfY(f.z), 10, f.name, f.rotationYDeg);
    }
  }

  // 4. Room labels & areas
  const rooms = applyRoomLabels(
    computeFloorPolygons(data.corners, data.walls),
    data.roomLabels
  );
  rooms.forEach((r, idx) => {
    const label = r.name || `${isEn ? 'Room' : 'Raum'} ${idx + 1}`;
    addText(out, 'TEXT', r.centroid.x, dxfY(r.centroid.z) + 10, 14, label);
    addText(out, 'TEXT', r.centroid.x, dxfY(r.centroid.z) - 10, 11, `${r.netAreaSqM.toFixed(2)} m2`);
  });

  // 4b. Wall MEP Fixtures (Radiators, Sockets, Switches, Shafts)
  if (data.fixtures && data.fixtures.length > 0) {
    const fixtureBoxes = computeWallFixtureBoxes(data.corners, data.walls, data.fixtures, rooms);
    for (const fx of fixtureBoxes) {
      const hw = fx.widthCm / 2;
      const hd = fx.depthCm / 2;
      const deg = (-fx.angleRad * 180) / Math.PI;
      const poly = [
        rotateLocalPoint(fx.center.x, fx.center.z, deg, -hw, -hd),
        rotateLocalPoint(fx.center.x, fx.center.z, deg, hw, -hd),
        rotateLocalPoint(fx.center.x, fx.center.z, deg, hw, hd),
        rotateLocalPoint(fx.center.x, fx.center.z, deg, -hw, hd),
      ];
      addClosedPolyline(out, 'MEP', poly);
    }
  }

  // 5. Exterior dimension chains
  if (includeDimensions && data.corners.length > 0 && data.walls.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const c of data.corners) {
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.z < minZ) minZ = c.z;
      if (c.z > maxZ) maxZ = c.z;
    }
    const dimChains = computeExteriorDimensionChains(
      data.corners,
      data.walls,
      {
        minX,
        maxX,
        minZ,
        maxZ,
        cx: (minX + maxX) / 2,
        cz: (minZ + maxZ) / 2,
      },
      { offsetCm: 35 }
    );
    for (const chain of dimChains.chains) {
      for (const seg of chain.segments) {
        addLine(out, 'DIMENSIONS', seg.start.x, dxfY(seg.start.z), seg.end.x, dxfY(seg.end.z));
        // Diagonal tick marks at endpoints (6 cm)
        addLine(
          out,
          'DIMENSIONS',
          seg.start.x - 4,
          dxfY(seg.start.z) - 4,
          seg.start.x + 4,
          dxfY(seg.start.z) + 4
        );
        addLine(
          out,
          'DIMENSIONS',
          seg.end.x - 4,
          dxfY(seg.end.z) - 4,
          seg.end.x + 4,
          dxfY(seg.end.z) + 4
        );
        addText(
          out,
          'DIMENSIONS',
          seg.textPosition.x,
          dxfY(seg.textPosition.z),
          10,
          seg.formattedLength
        );
      }
    }
  }

  pushPair(out, 0, 'ENDSEC');
  pushPair(out, 0, 'EOF');

  return out.join('\n') + '\n';
}
