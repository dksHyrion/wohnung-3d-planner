import { FloorplanData, Corner, FurnitureItem, FurnitureVisualType } from '../types';
import { getWallGeometry, computeFloorPolygons, applyRoomLabels } from '../wallMath';
import { computeExteriorDimensionChains } from '../dimensionMath';
import { layoutFurnitureParts, bedHeadboardDepthCm, isOsakaOpen } from '../furnitureShapes';
import { doorHingeOnRight, doorSwingsInward } from '../doorLeaf';
import { resolveFurnitureVisual } from '../furnitureVisual';
import { computeWallPlanPolygons } from './wallExportPolygons';
import { computeWallFixtureBoxes } from '../mepFixtures';
import { DEFAULT_LEVEL_ID, normalizeLevels, scopeFloorplanToLevel } from '../levels';
import { computeStairGeometry } from '../stairsMath';
import type { Language } from '../../i18n/types';

export interface PlanExportOptions {
  scale: '1:50' | '1:100' | '1:200';
  paperSize?: 'A4' | 'A3';
  orientation?: 'landscape' | 'portrait';
  includeFurniture?: boolean;
  includeDimensions?: boolean;
  includeRoomStamps?: boolean;
  projectTitle?: string;
  authorName?: string;
  dateStr?: string;
  autoScale?: boolean;
  language?: Language;
  levelId?: string;
}

export interface PlanFitInfo {
  fits: boolean;
  requestedScale: '1:50' | '1:100' | '1:200';
  effectiveScale: '1:50' | '1:100' | '1:200';
  recommendedScale: '1:50' | '1:100' | '1:200';
  contentWidthCm: number;
  contentDepthCm: number;
  drawWidthMm: number;
  drawHeightMm: number;
  availWidthMm: number;
  availHeightMm: number;
}

export function computePlanBoundingBoxCm(
  data: FloorplanData,
  options?: Pick<PlanExportOptions, 'includeDimensions' | 'includeFurniture'>
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;

  if (data.corners.length > 0) {
    for (const c of data.corners) {
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.z < minZ) minZ = c.z;
      if (c.z > maxZ) maxZ = c.z;
    }
  } else {
    minX = 0;
    maxX = 400;
    minZ = 0;
    maxZ = 300;
  }

  // Account for maximum wall thickness (walls extend thickness/2 beyond centerline)
  let maxHalfWallThick = 10;
  for (const w of data.walls) {
    const half = (w.thicknessCm || 15) / 2;
    if (half > maxHalfWallThick) maxHalfWallThick = half;
  }
  minX -= maxHalfWallThick;
  maxX += maxHalfWallThick;
  minZ -= maxHalfWallThick;
  maxZ += maxHalfWallThick;

  // Account for exterior dimension chains (offsetCm = 35 + text height ~ 15 cm -> 50 cm)
  if (options?.includeDimensions !== false && data.walls.length > 0) {
    const dimMarginCm = 50;
    minX -= dimMarginCm;
    maxX += dimMarginCm;
    minZ -= dimMarginCm;
    maxZ += dimMarginCm;
  }

  return { minX, maxX, minZ, maxZ };
}

export function computePlanFit(
  data: FloorplanData,
  options: PlanExportOptions
): PlanFitInfo {
  const paper = options.paperSize ?? 'A4';
  const orientation = options.orientation ?? 'landscape';

  let paperW = paper === 'A3' ? 420 : 297;
  let paperH = paper === 'A3' ? 297 : 210;
  if (orientation === 'portrait') {
    const tmp = paperW;
    paperW = paperH;
    paperH = tmp;
  }

  const marginMm = 20;
  const titleBlockHMm = 32;
  const availWidthMm = paperW - marginMm * 2;
  const availHeightMm = paperH - marginMm * 2 - titleBlockHMm;

  const bounds = computePlanBoundingBoxCm(data, options);
  const contentWidthCm = Math.max(100, bounds.maxX - bounds.minX);
  const contentDepthCm = Math.max(100, bounds.maxZ - bounds.minZ);

  const scaleRatio50 = 0.2;
  const scaleRatio100 = 0.1;

  const fits50 =
    contentWidthCm * scaleRatio50 <= availWidthMm &&
    contentDepthCm * scaleRatio50 <= availHeightMm;
  const fits100 =
    contentWidthCm * scaleRatio100 <= availWidthMm &&
    contentDepthCm * scaleRatio100 <= availHeightMm;

  const recommendedScale: '1:50' | '1:100' | '1:200' = fits50
    ? '1:50'
    : fits100
    ? '1:100'
    : '1:200';

  const reqScale = options.scale;
  const reqRatio = reqScale === '1:200' ? 0.05 : reqScale === '1:100' ? 0.1 : 0.2;
  const fits =
    contentWidthCm * reqRatio <= availWidthMm &&
    contentDepthCm * reqRatio <= availHeightMm;

  const effectiveScale =
    options.autoScale === true ? (fits ? reqScale : recommendedScale) : reqScale;
  const effectiveRatio =
    effectiveScale === '1:200' ? 0.05 : effectiveScale === '1:100' ? 0.1 : 0.2;

  return {
    fits,
    requestedScale: reqScale,
    effectiveScale,
    recommendedScale,
    contentWidthCm,
    contentDepthCm,
    drawWidthMm: contentWidthCm * effectiveRatio,
    drawHeightMm: contentDepthCm * effectiveRatio,
    availWidthMm,
    availHeightMm,
  };
}

export function exportScaledFloorplanSvg(
  rawData: FloorplanData,
  options: PlanExportOptions
): string {
  const allLevels = normalizeLevels(rawData.levels);
  const targetLevelId =
    options.levelId ??
    allLevels.find((l) => l.index === 0)?.id ??
    allLevels[0]?.id ??
    DEFAULT_LEVEL_ID;
  const targetLevel = allLevels.find((l) => l.id === targetLevelId) ?? allLevels[0];
  const data =
    options.levelId || allLevels.length > 1
      ? scopeFloorplanToLevel(rawData, targetLevelId)
      : rawData;
  const fitInfo = computePlanFit(data, options);
  const effectiveScale = fitInfo.effectiveScale;
  const scaleRatio = effectiveScale === '1:200' ? 0.05 : effectiveScale === '1:100' ? 0.1 : 0.2; // mm per cm
  const paper = options.paperSize ?? 'A4';
  const orientation = options.orientation ?? 'landscape';

  // Paper dimensions in mm
  let paperW = paper === 'A3' ? 420 : 297;
  let paperH = paper === 'A3' ? 297 : 210;
  if (orientation === 'portrait') {
    const tmp = paperW;
    paperW = paperH;
    paperH = tmp;
  }

  // Calculate bounding box in cm
  const bounds = computePlanBoundingBoxCm(data, options);
  const minX = bounds.minX;
  const maxX = bounds.maxX;
  const minZ = bounds.minZ;
  const maxZ = bounds.maxZ;

  const contentWidthCm = Math.max(100, maxX - minX);
  const contentDepthCm = Math.max(100, maxZ - minZ);

  const drawWidthMm = contentWidthCm * scaleRatio;
  const drawHeightMm = contentDepthCm * scaleRatio;

  // Plan placement on paper (leave margin for title block in bottom right)
  const marginMm = 20;
  const titleBlockHMm = 32;
  const availWMm = paperW - marginMm * 2;
  const availHMm = paperH - marginMm * 2 - titleBlockHMm;

  const originX = marginMm + (availWMm - drawWidthMm) / 2 - minX * scaleRatio;
  const originY = marginMm + (availHMm - drawHeightMm) / 2 - minZ * scaleRatio;

  const toPaperX = (cmX: number) => Number((originX + cmX * scaleRatio).toFixed(2));
  const toPaperY = (cmZ: number) => Number((originY + cmZ * scaleRatio).toFixed(2));

  // Compute rooms and total interior area
  const rooms = applyRoomLabels(
    computeFloorPolygons(data.corners, data.walls),
    data.roomLabels
  );
  const totalNetArea = rooms.reduce((sum, r) => sum + (r.netAreaSqM ?? r.areaSqM), 0);

  const cornerMap = new Map<string, Corner>(data.corners.map((c) => [c.id, c]));
  const isEn = options.language === 'en';

  // SVG elements collector
  const parts: string[] = [];

  // Header & Styles
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${paperW}mm" height="${paperH}mm" viewBox="0 0 ${paperW} ${paperH}" data-scale="${effectiveScale}" data-fits="${fitInfo.fits}">`
  );
  parts.push(`  <defs>
    <pattern id="arch-wall-hatch" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="2.4" height="2.4" fill="#cbd5e1" />
      <line x1="0" y1="0" x2="0" y2="2.4" stroke="#475569" stroke-width="0.45" />
    </pattern>
    <style>
      .arch-paper-bg { fill: #ffffff; }
      .arch-frame { fill: none; stroke: #0f172a; stroke-width: 0.5; }
      .arch-wall { fill: url(#arch-wall-hatch); stroke: #0f172a; stroke-width: 0.35; stroke-linejoin: miter; }
      .arch-door-leaf { stroke: #0f172a; stroke-width: 0.5; fill: none; }
      .arch-door-arc { stroke: #64748b; stroke-width: 0.35; stroke-dasharray: 1 1; fill: none; }
      .arch-window-frame { stroke: #0f172a; stroke-width: 0.4; }
      .arch-window-glass { stroke: #0284c7; stroke-width: 0.3; }
      .arch-rug-rect { fill: #f8fafc; stroke: #94a3b8; stroke-width: 0.3; stroke-dasharray: 1.2 0.8; }
      .arch-fixture { fill: #e2e8f0; stroke: #0f172a; stroke-width: 0.35; }
      .arch-stair { fill: #f1f5f9; stroke: #0f172a; stroke-width: 0.4; }
      .arch-stair-tread { stroke: #475569; stroke-width: 0.25; fill: none; }
      .arch-stair-arrow { stroke: #0f172a; stroke-width: 0.4; fill: none; }
      .arch-furniture-rect { fill: #f1f5f9; stroke: #475569; stroke-width: 0.4; }
      .arch-furniture-detail { fill: none; stroke: #475569; stroke-width: 0.25; }
      .arch-furniture-detail-fill { fill: #ffffff; stroke: #475569; stroke-width: 0.25; }
      .arch-furniture-text { font-family: system-ui, -apple-system, sans-serif; font-size: 2.2px; fill: #334155; text-anchor: middle; font-weight: 500; }
      .arch-room-polygon { fill: #f8fafc; stroke: none; }
      .arch-room-badge { fill: #ffffff; stroke: #94a3b8; stroke-width: 0.3; }
      .arch-room-text-title { font-family: system-ui, -apple-system, sans-serif; font-size: 2.8px; font-weight: 700; fill: #0f172a; text-anchor: middle; }
      .arch-room-text-sub { font-family: system-ui, -apple-system, sans-serif; font-size: 2.2px; font-weight: 500; fill: #475569; text-anchor: middle; }
      .arch-titleblock-bg { fill: #ffffff; stroke: #0f172a; stroke-width: 0.5; }
      .arch-titleblock-text-bold { font-family: system-ui, -apple-system, sans-serif; font-size: 2.8px; font-weight: 700; fill: #0f172a; }
      .arch-titleblock-text { font-family: system-ui, -apple-system, sans-serif; font-size: 2.0px; fill: #334155; }
      .arch-dim-line { stroke: #475569; stroke-width: 0.3; fill: none; }
      .arch-dim-tick { stroke: #0f172a; stroke-width: 0.45; fill: none; }
      .arch-dim-text { font-family: system-ui, -apple-system, sans-serif; font-size: 2.0px; font-weight: 600; fill: #0f172a; text-anchor: middle; }
    </style>
  </defs>`);

  // Background and Sheet Border
  parts.push(`  <!-- Sheet Border -->`);
  parts.push(`  <rect class="arch-paper-bg" x="0" y="0" width="${paperW}" height="${paperH}" />`);
  parts.push(
    `  <rect class="arch-frame" x="10" y="10" width="${paperW - 20}" height="${paperH - 20}" />`
  );

  // Room floor polygons
  if (rooms.length > 0) {
    parts.push(`  <!-- Room Polygons -->`);
    for (const r of rooms) {
      if (r.holes && r.holes.length > 0) {
        const d = [
          `M ${r.corners.map((c) => `${toPaperX(c.x)},${toPaperY(c.z)}`).join(' L ')} Z`,
          ...r.holes.map(
            (hole) => `M ${hole.map((c) => `${toPaperX(c.x)},${toPaperY(c.z)}`).join(' L ')} Z`
          ),
        ].join(' ');
        parts.push(`  <path class="arch-room-polygon" fill-rule="evenodd" d="${d}" />`);
      } else {
        const pts = r.corners
          .map((c) => `${toPaperX(c.x)},${toPaperY(c.z)}`)
          .join(' ');
        parts.push(`  <polygon class="arch-room-polygon" points="${pts}" />`);
      }
    }
  }

  // Walls (mitered & split around openings so room floors remain visible inside doorways)
  parts.push(`  <!-- Walls -->`);
  const wallPolygons = computeWallPlanPolygons(data.corners, data.walls, data.openings);
  for (const wp of wallPolygons) {
    const pts = wp.polygon.map((p) => `${toPaperX(p.x)},${toPaperY(p.z)}`).join(' ');
    parts.push(`  <polygon class="arch-wall" data-wall-id="${escapeXml(wp.wallId)}" points="${pts}" />`);
  }

  // Openings (Doors & Windows)
  parts.push(`  <!-- Openings -->`);
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

    const pStartX = toPaperX(opStartX);
    const pStartY = toPaperY(opStartZ);
    const pEndX = toPaperX(opEndX);
    const pEndY = toPaperY(opEndZ);
    const wallThickMm = Number((wall.thicknessCm * scaleRatio).toFixed(2));

    if (op.type === 'window') {
      parts.push(`  <g class="arch-window">`);
      // Window frame lines (outer and inner jamb lines)
      const nx = geom.normal.x * (wallThickMm / 2);
      const ny = geom.normal.z * (wallThickMm / 2);
      parts.push(
        `    <line class="arch-window-frame" x1="${pStartX - nx}" y1="${pStartY - ny}" x2="${pEndX - nx}" y2="${pEndY - ny}" />`
      );
      parts.push(
        `    <line class="arch-window-frame" x1="${pStartX + nx}" y1="${pStartY + ny}" x2="${pEndX + nx}" y2="${pEndY + ny}" />`
      );
      // Centerline glass
      parts.push(
        `    <line class="arch-window-glass" x1="${pStartX}" y1="${pStartY}" x2="${pEndX}" y2="${pEndY}" />`
      );
      parts.push(`  </g>`);
    } else if (op.type === 'passage') {
      const nx = geom.normal.x * (wallThickMm / 2);
      const ny = geom.normal.z * (wallThickMm / 2);
      parts.push(`  <g class="arch-passage">`);
      parts.push(
        `    <line class="arch-door-arc" x1="${pStartX - nx}" y1="${pStartY - ny}" x2="${pEndX - nx}" y2="${pEndY - ny}" />`
      );
      parts.push(
        `    <line class="arch-door-arc" x1="${pStartX + nx}" y1="${pStartY + ny}" x2="${pEndX + nx}" y2="${pEndY + ny}" />`
      );
      parts.push(`  </g>`);
    } else if (op.type === 'sliding-door') {
      const swingSign = doorSwingsInward(op.swingDirection) ? 1 : -1;
      const offsetMm = (wallThickMm * 0.45) * swingSign;
      const nx = geom.normal.x * offsetMm;
      const ny = geom.normal.z * offsetMm;
      parts.push(`  <g class="arch-sliding-door">`);
      parts.push(
        `    <line class="arch-door-arc" x1="${pStartX}" y1="${pStartY}" x2="${pEndX}" y2="${pEndY}" />`
      );
      parts.push(
        `    <line class="arch-door-leaf" x1="${pStartX + nx}" y1="${pStartY + ny}" x2="${pEndX + nx}" y2="${pEndY + ny}" />`
      );
      parts.push(`  </g>`);
    } else {
      // Door or Balcony Door
      const cls = op.type === 'balcony-door' ? 'arch-door arch-balcony-door' : 'arch-door';
      parts.push(`  <g class="${cls}">`);
      if (op.type === 'balcony-door') {
        parts.push(
          `    <line class="arch-window-glass" x1="${pStartX}" y1="${pStartY}" x2="${pEndX}" y2="${pEndY}" />`
        );
      }

      const swingSign = doorSwingsInward(op.swingDirection) ? 1 : -1;
      const hingeOnRight = doorHingeOnRight(op.swingDirection);

      const hingeX = hingeOnRight ? pEndX : pStartX;
      const hingeY = hingeOnRight ? pEndY : pStartY;
      const latchClosedX = hingeOnRight ? pStartX : pEndX;
      const latchClosedY = hingeOnRight ? pStartY : pEndY;

      const doorW_mm = op.widthCm * scaleRatio;
      const leafOpenX = hingeX + geom.normal.x * swingSign * doorW_mm;
      const leafOpenY = hingeY + geom.normal.z * swingSign * doorW_mm;

      // Door Leaf
      parts.push(
        `    <line class="arch-door-leaf" x1="${hingeX}" y1="${hingeY}" x2="${leafOpenX}" y2="${leafOpenY}" />`
      );
      // 90-degree swing arc (quarter circle centered at hinge)
      // Sweep flag: clockwise (1) for in-left / out-right; counter-clockwise (0) for in-right / out-left.
      const sweepFlag = swingSign > 0 ? (hingeOnRight ? 0 : 1) : (hingeOnRight ? 1 : 0);
      parts.push(
        `    <path class="arch-door-arc" d="M ${latchClosedX} ${latchClosedY} A ${doorW_mm} ${doorW_mm} 0 0 ${sweepFlag} ${leafOpenX} ${leafOpenY}" />`
      );
      parts.push(`  </g>`);
    }
  }

  // Haustechnik / Wall Fixtures (Radiators, Outlets, Switches, Shafts)
  if (data.fixtures && data.fixtures.length > 0) {
    const fixtureBoxes = computeWallFixtureBoxes(data.corners, data.walls, data.fixtures, rooms);
    if (fixtureBoxes.length > 0) {
      parts.push(`  <!-- MEP Wall Fixtures -->`);
      for (const fx of fixtureBoxes) {
        const fxPaperX = toPaperX(fx.center.x);
        const fxPaperY = toPaperY(fx.center.z);
        const wMm = fmtMm(Math.max(1.6, fx.widthCm * scaleRatio));
        const dMm = fmtMm(Math.max(1.0, fx.depthCm * scaleRatio));
        const deg = fmtMm((fx.angleRad * 180) / Math.PI);
        parts.push(
          `  <g class="arch-fixture" data-fixture-id="${escapeXml(fx.fixtureId)}" data-fixture-type="${escapeXml(fx.type)}" transform="translate(${fxPaperX}, ${fxPaperY}) rotate(${deg})">`
        );
        parts.push(
          `    <rect x="${fmtMm(-wMm / 2)}" y="${fmtMm(-dMm / 2)}" width="${wMm}" height="${dMm}" />`
        );
        if (fx.type === 'shaft') {
          parts.push(
            `    <line x1="${fmtMm(-wMm / 2)}" y1="${fmtMm(-dMm / 2)}" x2="${fmtMm(wMm / 2)}" y2="${fmtMm(dMm / 2)}" />`
          );
          parts.push(
            `    <line x1="${fmtMm(wMm / 2)}" y1="${fmtMm(-dMm / 2)}" x2="${fmtMm(-wMm / 2)}" y2="${fmtMm(dMm / 2)}" />`
          );
        }
        parts.push(`  </g>`);
      }
    }
  }

  // Area Rugs (Teppiche)
  if (options.includeFurniture !== false && data.rugs && data.rugs.length > 0) {
    parts.push(`  <!-- Area Rugs -->`);
    for (const r of data.rugs) {
      const rWidthMm = r.widthCm * scaleRatio;
      const rDepthMm = r.depthCm * scaleRatio;
      const rPaperX = toPaperX(r.x);
      const rPaperY = toPaperY(r.z);
      parts.push(
        `  <g class="arch-rug" data-rug-id="${escapeXml(r.id)}" data-rug-name="${escapeXml(r.name ?? 'Teppich')}" transform="translate(${rPaperX}, ${rPaperY}) rotate(${-(r.rotationYDeg ?? 0)})">`
      );
      parts.push(
        `    <rect class="arch-rug-rect" x="${-rWidthMm / 2}" y="${-rDepthMm / 2}" width="${rWidthMm}" height="${rDepthMm}" rx="${Math.min(1.5, rWidthMm * 0.02)}" />`
      );
      parts.push(`  </g>`);
    }
  }

  // Stairs touching this level
  const levelStairs = (rawData.stairs ?? []).filter(
    (st) => st.fromLevelId === targetLevelId || st.toLevelId === targetLevelId
  );
  if (levelStairs.length > 0) {
    const levelMap = new Map(allLevels.map((l) => [l.id, l]));
    parts.push(`  <!-- Stairs -->`);
    for (const st of levelStairs) {
      const geom = computeStairGeometry(
        st,
        levelMap.get(st.fromLevelId),
        levelMap.get(st.toLevelId)
      );
      const poly =
        st.toLevelId === targetLevelId && st.fromLevelId !== targetLevelId
          ? geom.openingPolygonXZ
          : geom.footprintPolygonXZ;
      const pts = poly.map((p) => `${toPaperX(p.x)},${toPaperY(p.z)}`).join(' ');
      parts.push(`  <g class="arch-stair-group" data-stair-id="${escapeXml(st.id)}">`);
      parts.push(`    <polygon class="arch-stair" points="${pts}" />`);
      for (const tl of geom.treadLines) {
        parts.push(
          `    <line class="arch-stair-tread" x1="${toPaperX(tl.x1)}" y1="${toPaperY(tl.z1)}" x2="${toPaperX(tl.x2)}" y2="${toPaperY(tl.z2)}" />`
        );
      }
      if (geom.walkArrowPolylineXZ.length >= 2) {
        const arrowPts = geom.walkArrowPolylineXZ
          .map((p) => `${toPaperX(p.x)},${toPaperY(p.z)}`)
          .join(' ');
        parts.push(`    <polyline class="arch-stair-arrow" points="${arrowPts}" />`);
      }
      parts.push(`  </g>`);
    }
  }

  // Furniture Outlines
  if (options.includeFurniture !== false && data.furniture.length > 0) {
    parts.push(`  <!-- Furniture -->`);
    for (const f of data.furniture) {
      const fWidthMm = f.widthCm * scaleRatio;
      const fDepthMm = f.depthCm * scaleRatio;
      const fPaperX = toPaperX(f.x);
      const fPaperY = toPaperY(f.z);
      const visual = resolveFurnitureVisual(f);
      const localParts = layoutFurnitureParts(f);

      parts.push(
        `  <g class="arch-furniture" data-furniture-id="${escapeXml(f.id)}" data-visual="${escapeXml(visual)}" transform="translate(${fPaperX}, ${fPaperY}) rotate(${-f.rotationYDeg})">`
      );

      for (const lp of localParts) {
        const pwMm = Number((lp.widthCm * scaleRatio).toFixed(2));
        const pdMm = Number((lp.depthCm * scaleRatio).toFixed(2));
        const pxMm = Number((lp.cx * scaleRatio - pwMm / 2).toFixed(2));
        const pyMm = Number((lp.cz * scaleRatio - pdMm / 2).toFixed(2));
        parts.push(
          `    <rect class="arch-furniture-rect" data-part="${escapeXml(lp.id)}" x="${pxMm}" y="${pyMm}" width="${pwMm}" height="${pdMm}" rx="1" />`
        );
      }

      parts.push(...renderFurnitureCadDetailsSvg(f, visual, scaleRatio));

      // Furniture front line indicator
      parts.push(
        `    <line x1="${-fWidthMm / 2 + 1}" y1="${fDepthMm / 2 - 0.8}" x2="${fWidthMm / 2 - 1}" y2="${fDepthMm / 2 - 0.8}" stroke="#94a3b8" stroke-width="0.3" />`
      );
      // Name label
      parts.push(
        `    <text class="arch-furniture-text" x="0" y="0.8">${escapeXml(f.name)}</text>`
      );
      parts.push(`  </g>`);
    }
  }

  // Room Area Stamps
  if (options.includeRoomStamps !== false && rooms.length > 0) {
    parts.push(`  <!-- Room Stamps -->`);
    rooms.forEach((r, idx) => {
      const cx = toPaperX(r.centroid.x);
      const cy = toPaperY(r.centroid.z);
      const netArea = (r.netAreaSqM ?? r.areaSqM).toLocaleString(isEn ? 'en-US' : 'de-DE', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      const roomTitle = r.name ?? (isEn ? `Room ${idx + 1}` : `Raum ${idx + 1}`);
      const areaLabel = isEn ? 'Interior Area:' : 'Innenfläche:';

      parts.push(`  <g class="arch-room-stamp" transform="translate(${cx}, ${cy})">`);
      parts.push(
        `    <rect class="arch-room-badge" x="-18" y="-5.5" width="36" height="11" rx="1.5" />`
      );
      parts.push(
        `    <text class="arch-room-text-title" x="0" y="-1.5">${escapeXml(roomTitle)}</text>`
      );
      parts.push(
        `    <text class="arch-room-text-sub" x="0" y="2.8">${areaLabel} ${netArea} m²</text>`
      );
      parts.push(`  </g>`);
    });
  }

  // Exterior Dimension Chains
  if (options.includeDimensions !== false && data.walls.length > 0 && data.corners.length > 0) {
    let rawMinX = Infinity;
    let rawMaxX = -Infinity;
    let rawMinZ = Infinity;
    let rawMaxZ = -Infinity;
    for (const c of data.corners) {
      if (c.x < rawMinX) rawMinX = c.x;
      if (c.x > rawMaxX) rawMaxX = c.x;
      if (c.z < rawMinZ) rawMinZ = c.z;
      if (c.z > rawMaxZ) rawMaxZ = c.z;
    }
    const roomBounds = {
      minX: rawMinX,
      maxX: rawMaxX,
      minZ: rawMinZ,
      maxZ: rawMaxZ,
      cx: (rawMinX + rawMaxX) / 2,
      cz: (rawMinZ + rawMaxZ) / 2,
    };
    const dimChains = computeExteriorDimensionChains(
      data.corners,
      data.walls,
      roomBounds,
      { offsetCm: 35 }
    );
    parts.push(`  <!-- Exterior Dimension Chains -->`);
    for (const chain of dimChains.chains) {
      for (const seg of chain.segments) {
        const sx = toPaperX(seg.start.x);
        const sy = toPaperY(seg.start.z);
        const ex = toPaperX(seg.end.x);
        const ey = toPaperY(seg.end.z);
        const tx = toPaperX(seg.textPosition.x);
        const ty = toPaperY(seg.textPosition.z);

        parts.push(`  <g class="arch-dimension">`);
        parts.push(
          `    <line class="arch-dim-line" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" />`
        );
        // Ticks at start and end
        parts.push(
          `    <line class="arch-dim-tick" x1="${sx - 1}" y1="${sy + 1}" x2="${sx + 1}" y2="${sy - 1}" />`
        );
        parts.push(
          `    <line class="arch-dim-tick" x1="${ex - 1}" y1="${ey + 1}" x2="${ex + 1}" y2="${ey - 1}" />`
        );
        // Text
        parts.push(
          `    <text class="arch-dim-text" x="${tx}" y="${ty + 0.7}">${escapeXml(seg.formattedLength)}</text>`
        );
        parts.push(`  </g>`);
      }
    }
  }

  // Title Block (Plankopf) in bottom right corner
  const tbWidth = 80;
  const tbHeight = 24;
  const tbX = paperW - 10 - tbWidth;
  const tbY = paperH - 10 - tbHeight;
  const baseTitle = options.projectTitle || (isEn ? 'Floorplan Layout' : 'Grundriss-Stellprobe');
  const projectTitle =
    (options.levelId || allLevels.length > 1) && targetLevel?.name
      ? `${baseTitle} (${targetLevel.name})`
      : baseTitle;
  const scaleText = effectiveScale === '1:200' ? '1 : 200' : effectiveScale === '1:100' ? '1 : 100' : '1 : 50';
  const dateStr = options.dateStr || new Date().toLocaleDateString(isEn ? 'en-US' : 'de-DE');
  const areaTotalFormatted = totalNetArea.toLocaleString(isEn ? 'en-US' : 'de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const scaleLabel = isEn ? 'Scale:' : 'Maßstab:';
  const dateLabel = isEn ? 'Date:' : 'Datum:';
  const netAreaLabel = isEn ? 'Interior Net Area:' : 'Lichte Innenfläche:';
  const scaleBarLabel = isEn ? `Scale Bar (${scaleText})` : `Maßstabsleiste (${scaleText})`;

  parts.push(`  <!-- Title Block (Plankopf) -->`);
  parts.push(`  <g class="arch-titleblock">`);
  parts.push(
    `    <rect class="arch-titleblock-bg" x="${tbX}" y="${tbY}" width="${tbWidth}" height="${tbHeight}" />`
  );
  parts.push(
    `    <line x1="${tbX}" y1="${tbY + 7}" x2="${tbX + tbWidth}" y2="${tbY + 7}" stroke="#0f172a" stroke-width="0.3" />`
  );
  parts.push(
    `    <line x1="${tbX}" y1="${tbY + 15}" x2="${tbX + tbWidth}" y2="${tbY + 15}" stroke="#0f172a" stroke-width="0.3" />`
  );
  parts.push(
    `    <line x1="${tbX + 48}" y1="${tbY + 7}" x2="${tbX + 48}" y2="${tbY + tbHeight}" stroke="#0f172a" stroke-width="0.3" />`
  );

  parts.push(
    `    <text class="arch-titleblock-text-bold" x="${tbX + 3}" y="${tbY + 4.8}">${escapeXml(projectTitle)}</text>`
  );
  parts.push(
    `    <text class="arch-titleblock-text" x="${tbX + 3}" y="${tbY + 11.2}">${scaleLabel} <tspan font-weight="700">${scaleText}</tspan></text>`
  );
  parts.push(
    `    <text class="arch-titleblock-text" x="${tbX + 3}" y="${tbY + 20}">${dateLabel} ${escapeXml(dateStr)}</text>`
  );
  parts.push(
    `    <text class="arch-titleblock-text" x="${tbX + 51}" y="${tbY + 11.2}">${netAreaLabel}</text>`
  );
  parts.push(
    `    <text class="arch-titleblock-text-bold" x="${tbX + 51}" y="${tbY + 17}">${areaTotalFormatted} m²</text>`
  );
  parts.push(`  </g>`);

  // Graphical Scale Bar (Maßstabsbalken)
  const barX = tbX - 45;
  const barY = tbY + 12;
  const unitM_width = 100 * scaleRatio; // 100 cm in mm: 20 mm for 1:50, 10 mm for 1:100, 5 mm for 1:200

  parts.push(`  <!-- Graphical Scale Bar -->`);
  parts.push(`  <g class="arch-scale-bar" transform="translate(${barX}, ${barY})">`);
  parts.push(
    `    <text class="arch-titleblock-text" x="${unitM_width}" y="-3" text-anchor="middle">${scaleBarLabel}</text>`
  );
  // Bar segment 1 (black)
  parts.push(
    `    <rect x="0" y="0" width="${unitM_width}" height="2" fill="#0f172a" stroke="#0f172a" stroke-width="0.2" />`
  );
  // Bar segment 2 (white)
  parts.push(
    `    <rect x="${unitM_width}" y="0" width="${unitM_width}" height="2" fill="#ffffff" stroke="#0f172a" stroke-width="0.2" />`
  );
  parts.push(
    `    <text class="arch-titleblock-text" x="0" y="6" text-anchor="middle">0</text>`
  );
  parts.push(
    `    <text class="arch-titleblock-text" x="${unitM_width}" y="6" text-anchor="middle">1 m</text>`
  );
  parts.push(
    `    <text class="arch-titleblock-text" x="${unitM_width * 2}" y="6" text-anchor="middle">2 m</text>`
  );
  parts.push(`  </g>`);

  parts.push(`</svg>`);

  return parts.join('\n');
}

export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtMm(v: number): number {
  return Number(v.toFixed(2));
}

function renderFurnitureCadDetailsSvg(
  f: FurnitureItem,
  visual: FurnitureVisualType,
  scaleRatio: number
): string[] {
  const out: string[] = [];
  const wMm = f.widthCm * scaleRatio;
  const dMm = f.depthCm * scaleRatio;
  const hw = wMm / 2;
  const hd = dMm / 2;

  switch (visual) {
    case 'bed': {
      const hbMm = bedHeadboardDepthCm(f.depthCm) * scaleRatio;
      const hbBottom = -hd + hbMm;
      out.push(
        `    <line class="arch-furniture-detail" data-cad="bed-headboard" x1="${fmtMm(-hw)}" y1="${fmtMm(hbBottom)}" x2="${fmtMm(hw)}" y2="${fmtMm(hbBottom)}" />`
      );
      const pillowH = Math.min(dMm * 0.2, 36 * scaleRatio);
      const pillowW = f.widthCm >= 130 ? (wMm - 6 * scaleRatio) / 2 - 2 * scaleRatio : wMm * 0.65;
      const pillowY = hbBottom + 3 * scaleRatio;
      if (f.widthCm >= 130) {
        const gap = 2 * scaleRatio;
        out.push(
          `    <rect class="arch-furniture-detail-fill" data-cad="bed-pillow" x="${fmtMm(-gap / 2 - pillowW)}" y="${fmtMm(pillowY)}" width="${fmtMm(pillowW)}" height="${fmtMm(pillowH)}" rx="0.5" />`
        );
        out.push(
          `    <rect class="arch-furniture-detail-fill" data-cad="bed-pillow" x="${fmtMm(gap / 2)}" y="${fmtMm(pillowY)}" width="${fmtMm(pillowW)}" height="${fmtMm(pillowH)}" rx="0.5" />`
        );
      } else {
        out.push(
          `    <rect class="arch-furniture-detail-fill" data-cad="bed-pillow" x="${fmtMm(-pillowW / 2)}" y="${fmtMm(pillowY)}" width="${fmtMm(pillowW)}" height="${fmtMm(pillowH)}" rx="0.5" />`
        );
      }
      const blanketY = fmtMm(pillowY + pillowH + 4 * scaleRatio);
      out.push(
        `    <line class="arch-furniture-detail" data-cad="bed-blanket" x1="${fmtMm(-hw)}" y1="${blanketY}" x2="${fmtMm(hw)}" y2="${blanketY}" />`
      );
      break;
    }
    case 'sofa':
    case 'sectional-sofa': {
      const backMm = Math.min(18, f.depthCm * 0.22) * scaleRatio;
      const armMm = Math.min(15, f.widthCm * 0.1) * scaleRatio;
      const backY = fmtMm(-hd + backMm);
      out.push(
        `    <line class="arch-furniture-detail" data-cad="sofa-backrest" x1="${fmtMm(-hw)}" y1="${backY}" x2="${fmtMm(hw)}" y2="${backY}" />`
      );
      out.push(
        `    <line class="arch-furniture-detail" data-cad="sofa-arm" x1="${fmtMm(-hw + armMm)}" y1="${backY}" x2="${fmtMm(-hw + armMm)}" y2="${fmtMm(hd)}" />`
      );
      if (visual === 'sofa') {
        out.push(
          `    <line class="arch-furniture-detail" data-cad="sofa-arm" x1="${fmtMm(hw - armMm)}" y1="${backY}" x2="${fmtMm(hw - armMm)}" y2="${fmtMm(hd)}" />`
        );
      }
      break;
    }
    case 'boconcept-osaka': {
      const backMm = 16 * scaleRatio;
      const armMm = 12 * scaleRatio;
      const open = isOsakaOpen(f);
      const seatTop = -hd + backMm;
      out.push(
        `    <line class="arch-furniture-detail" data-cad="osaka-backrest" x1="${fmtMm(-hw)}" y1="${fmtMm(seatTop)}" x2="${fmtMm(hw)}" y2="${fmtMm(seatTop)}" />`
      );
      out.push(
        `    <line class="arch-furniture-detail" data-cad="osaka-arm" x1="${fmtMm(-hw + armMm)}" y1="${fmtMm(seatTop)}" x2="${fmtMm(-hw + armMm)}" y2="${fmtMm(seatTop + 72 * scaleRatio)}" />`
      );
      out.push(
        `    <line class="arch-furniture-detail" data-cad="osaka-arm" x1="${fmtMm(hw - armMm)}" y1="${fmtMm(seatTop)}" x2="${fmtMm(hw - armMm)}" y2="${fmtMm(seatTop + 72 * scaleRatio)}" />`
      );
      if (open) {
        const foldY = fmtMm(seatTop + 72 * scaleRatio);
        out.push(
          `    <line class="arch-furniture-detail" data-cad="osaka-fold" stroke-dasharray="1 0.8" x1="${fmtMm(-hw + armMm)}" y1="${foldY}" x2="${fmtMm(hw - armMm)}" y2="${foldY}" />`
        );
      }
      break;
    }
    case 'toilet': {
      const cisternY = fmtMm(-hd + Math.min(18, f.depthCm * 0.28) * scaleRatio);
      out.push(
        `    <line class="arch-furniture-detail" data-cad="toilet-cistern" x1="${fmtMm(-hw)}" y1="${cisternY}" x2="${fmtMm(hw)}" y2="${cisternY}" />`
      );
      const bowlCy = fmtMm(cisternY + (hd - cisternY) * 0.52);
      const bowlRx = fmtMm(hw * 0.72);
      const bowlRy = fmtMm((hd - cisternY) * 0.42);
      out.push(
        `    <ellipse class="arch-furniture-detail-fill" data-cad="toilet-bowl" cx="0" cy="${bowlCy}" rx="${bowlRx}" ry="${bowlRy}" />`
      );
      break;
    }
    case 'bathtub': {
      const margin = Math.min(wMm, dMm) * 0.14;
      out.push(
        `    <rect class="arch-furniture-detail-fill" data-cad="bathtub-basin" x="${fmtMm(-hw + margin)}" y="${fmtMm(-hd + margin)}" width="${fmtMm(wMm - margin * 2)}" height="${fmtMm(dMm - margin * 2)}" rx="${fmtMm(Math.min(wMm, dMm) * 0.22)}" />`
      );
      const drainCy = fmtMm(-hd + dMm * 0.26);
      out.push(
        `    <circle class="arch-furniture-detail" data-cad="bathtub-drain" cx="0" cy="${drainCy}" r="${fmtMm(Math.max(0.45, 2.5 * scaleRatio))}" />`
      );
      break;
    }
    case 'shower': {
      const pad = 2 * scaleRatio;
      out.push(
        `    <line class="arch-furniture-detail" data-cad="shower-cross" x1="${fmtMm(-hw + pad)}" y1="${fmtMm(-hd + pad)}" x2="${fmtMm(hw - pad)}" y2="${fmtMm(hd - pad)}" />`
      );
      out.push(
        `    <line class="arch-furniture-detail" data-cad="shower-cross" x1="${fmtMm(hw - pad)}" y1="${fmtMm(-hd + pad)}" x2="${fmtMm(-hw + pad)}" y2="${fmtMm(hd - pad)}" />`
      );
      out.push(
        `    <circle class="arch-furniture-detail-fill" data-cad="shower-drain" cx="0" cy="0" r="${fmtMm(Math.max(0.5, 3 * scaleRatio))}" />`
      );
      break;
    }
    case 'vanity': {
      const basinW = Math.min(wMm * 0.65, 52 * scaleRatio);
      const basinD = Math.min(dMm * 0.62, 34 * scaleRatio);
      out.push(
        `    <rect class="arch-furniture-detail-fill" data-cad="vanity-basin" x="${fmtMm(-basinW / 2)}" y="${fmtMm(-basinD / 2 + 2 * scaleRatio)}" width="${fmtMm(basinW)}" height="${fmtMm(basinD)}" rx="0.6" />`
      );
      out.push(
        `    <circle class="arch-furniture-detail" data-cad="vanity-tap" cx="0" cy="${fmtMm(-hd + 4 * scaleRatio)}" r="${fmtMm(Math.max(0.35, 1.8 * scaleRatio))}" />`
      );
      break;
    }
    case 'kitchen-unit':
    case 'kitchen-island': {
      const sinkW = Math.min(wMm * 0.28, 48 * scaleRatio);
      const sinkD = dMm * 0.65;
      const sinkX = -hw + wMm * 0.08;
      out.push(
        `    <rect class="arch-furniture-detail-fill" data-cad="kitchen-sink" x="${fmtMm(sinkX)}" y="${fmtMm(-sinkD / 2)}" width="${fmtMm(sinkW)}" height="${fmtMm(sinkD)}" rx="0.5" />`
      );
      if (wMm >= 95 * scaleRatio) {
        const hobCx = hw - wMm * 0.22;
        const dx = Math.min(wMm * 0.08, 12 * scaleRatio);
        const dy = Math.min(dMm * 0.2, 11 * scaleRatio);
        const r = fmtMm(Math.max(0.5, 5.5 * scaleRatio));
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            out.push(
              `    <circle class="arch-furniture-detail" data-cad="kitchen-burner" cx="${fmtMm(hobCx + sx * dx)}" cy="${fmtMm(sy * dy)}" r="${r}" />`
            );
          }
        }
      }
      break;
    }
    case 'plant': {
      const r = fmtMm(Math.min(hw, hd) * 0.78);
      out.push(
        `    <circle class="arch-furniture-detail-fill" data-cad="plant-crown" cx="0" cy="0" r="${r}" />`
      );
      out.push(
        `    <line class="arch-furniture-detail" data-cad="plant-leaf" x1="${fmtMm(-r * 0.7)}" y1="0" x2="${fmtMm(r * 0.7)}" y2="0" />`
      );
      out.push(
        `    <line class="arch-furniture-detail" data-cad="plant-leaf" x1="0" y1="${fmtMm(-r * 0.7)}" x2="0" y2="${fmtMm(r * 0.7)}" />`
      );
      break;
    }
    default:
      break;
  }

  return out;
}
