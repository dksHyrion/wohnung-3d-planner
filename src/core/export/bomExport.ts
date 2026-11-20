import type {
  FlooringType,
  FloorplanData,
  FurnitureVisualType,
  RoomPolygon,
} from '../types';
import { applyRoomLabels, computeFloorPolygons, isPointInRoom } from '../wallMath';
import { resolveFurnitureVisual } from '../furnitureVisual';
import { layoutFurnitureParts } from '../furnitureShapes';
import { computeRoomWoFlVBreakdown, resolveRoofSlopePlanes } from '../roofSlopeMath';
import { normalizeLevels, scopeFloorplanToLevel } from '../levels';
import type { Language } from '../../i18n/types';

export interface FurnitureBomRow {
  id: string;
  name: string;
  category: string;
  visual: FurnitureVisualType;
  isRealFurniture: boolean;
  brand: string;
  modelName: string;
  articleNumber: string;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  catalogWidthCm: number | null;
  catalogDepthCm: number | null;
  catalogHeightCm: number | null;
  dimensionDeviates: boolean;
  roomName: string;
  levelName: string;
  pose: 'open' | 'closed' | '-';
  notes: string;
}

export interface RoomBalanceRow {
  id: string;
  name: string;
  levelName: string;
  flooringType: FlooringType;
  grossAreaSqM: number;
  netAreaSqM: number;
  woflvAreaSqM: number;
}

export interface RoomBalanceSummary {
  rooms: RoomBalanceRow[];
  totalGrossSqM: number;
  totalNetSqM: number;
  totalWoFlVSqM: number;
  hasRoofSlopes: boolean;
  furnitureFootprintSqM: number;
  occupiedPercent: number;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function resolveRoomsWithNames(
  data: FloorplanData,
  language: Language
): Array<{ room: RoomPolygon; displayName: string }> {
  const isEn = language === 'en';
  const rawRooms = applyRoomLabels(
    computeFloorPolygons(data.corners, data.walls),
    data.roomLabels
  );
  return rawRooms.map((room, index) => ({
    room,
    displayName: room.name?.trim() || `${isEn ? 'Room' : 'Raum'} ${index + 1}`,
  }));
}

function findRoomNameForPoint(
  x: number,
  z: number,
  rooms: Array<{ room: RoomPolygon; displayName: string }>,
  fallback: string
): string {
  for (const entry of rooms) {
    if (isPointInRoom(x, z, entry.room)) {
      return entry.displayName;
    }
  }
  return fallback;
}

export function buildFurnitureBomRows(
  data: FloorplanData,
  language: Language = 'de'
): FurnitureBomRow[] {
  const isEn = language === 'en';
  const unassignedLabel = isEn ? 'Unassigned' : 'Nicht zugeordnet';
  const levels = normalizeLevels(data.levels);
  const rows: FurnitureBomRow[] = [];

  for (const lvl of levels) {
    const scoped =
      levels.length > 1 ? scopeFloorplanToLevel(data, lvl.id) : data;
    const rooms = resolveRoomsWithNames(scoped, language);
    for (const f of scoped.furniture) {
      const visual = resolveFurnitureVisual(f);
      const cw = f.catalogWidthCm ?? null;
      const cd = f.catalogDepthCm ?? null;
      const ch = f.catalogHeightCm ?? null;
      const deviates =
        (cw !== null && Math.abs(f.widthCm - cw) > 0.5) ||
        (cd !== null && Math.abs(f.depthCm - cd) > 0.5) ||
        (ch !== null && Math.abs(f.heightCm - ch) > 0.5);

      rows.push({
        id: f.id,
        name: f.name,
        category: f.category,
        visual,
        isRealFurniture: Boolean(f.isRealFurniture),
        brand: f.brand ?? '',
        modelName: f.modelName ?? '',
        articleNumber: f.articleNumber ?? '',
        widthCm: round1(f.widthCm),
        depthCm: round1(f.depthCm),
        heightCm: round1(f.heightCm),
        catalogWidthCm: cw !== null ? round1(cw) : null,
        catalogDepthCm: cd !== null ? round1(cd) : null,
        catalogHeightCm: ch !== null ? round1(ch) : null,
        dimensionDeviates: deviates,
        roomName: findRoomNameForPoint(f.x, f.z, rooms, unassignedLabel),
        levelName: lvl.name,
        pose: f.pose === 'open' ? 'open' : f.pose === 'closed' ? 'closed' : '-',
        notes: f.notes ?? '',
      });
    }
  }
  return rows;
}

export function computeRoomBalanceSummary(
  data: FloorplanData,
  language: Language = 'de'
): RoomBalanceSummary {
  const levels = normalizeLevels(data.levels);
  let hasRoofSlopes = false;
  const rooms: RoomBalanceRow[] = [];

  for (const lvl of levels) {
    const scoped =
      levels.length > 1 ? scopeFloorplanToLevel(data, lvl.id) : data;
    const labeledRooms = resolveRoomsWithNames(scoped, language);
    const rawRooms = labeledRooms.map((r) => r.room);
    const planes = resolveRoofSlopePlanes(
      scoped.corners,
      scoped.walls,
      scoped.roofSlopes,
      rawRooms
    );
    const maxCeilingCm =
      scoped.walls.length > 0
        ? Math.max(lvl.ceilingHeightCm, ...scoped.walls.map((w) => w.heightCm))
        : lvl.ceilingHeightCm;

    for (const { room, displayName } of labeledRooms) {
      const woflv = computeRoomWoFlVBreakdown(room, planes, maxCeilingCm);
      if (woflv.hasRoofSlopes) hasRoofSlopes = true;
      rooms.push({
        id: `${lvl.id}:${room.id}`,
        name: displayName,
        levelName: lvl.name,
        flooringType: room.flooringType ?? 'microcement',
        grossAreaSqM: round2(room.areaSqM),
        netAreaSqM: round2(room.netAreaSqM),
        woflvAreaSqM: round2(woflv.woflvAreaSqM),
      });
    }
  }

  const totalGrossSqM = round2(rooms.reduce((sum, r) => sum + r.grossAreaSqM, 0));
  const totalNetSqM = round2(rooms.reduce((sum, r) => sum + r.netAreaSqM, 0));
  const totalWoFlVSqM = round2(rooms.reduce((sum, r) => sum + r.woflvAreaSqM, 0));

  let footprintCm2 = 0;
  for (const f of data.furniture) {
    // Wall-mounted decor or items sitting on top of another piece do not consume floor area
    if (f.attachedToId || f.elevationCm >= 100) continue;
    const parts = layoutFurnitureParts(f);
    for (const part of parts) {
      footprintCm2 += part.widthCm * part.depthCm;
    }
  }
  const furnitureFootprintSqM = round2(footprintCm2 / 10000);
  const occupiedPercent =
    totalNetSqM > 0 ? round1((furnitureFootprintSqM / totalNetSqM) * 100) : 0;

  return {
    rooms,
    totalGrossSqM,
    totalNetSqM,
    totalWoFlVSqM,
    hasRoofSlopes,
    furnitureFootprintSqM,
    occupiedPercent,
  };
}

function escapeCsvCell(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Prevent CSV formula / DDE injection in Excel and other spreadsheet apps
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports a UTF-8 BOM RFC-4180 CSV BOM list for Excel / spreadsheet import.
 */
export function exportFurnitureBomCsv(
  data: FloorplanData,
  options: { language?: Language } = {}
): string {
  const language = options.language ?? 'de';
  const isEn = language === 'en';
  const rows = buildFurnitureBomRows(data, language);

  const headers = isEn
    ? [
        'Room',
        'Name',
        'Type',
        'RealCatalog',
        'Brand',
        'Model',
        'ArticleNumber',
        'Category',
        'Visual',
        'WidthCm',
        'DepthCm',
        'HeightCm',
        'CatalogWidthCm',
        'CatalogDepthCm',
        'CatalogHeightCm',
        'DimensionDeviates',
        'Pose',
        'Notes',
        'Level',
      ]
    : [
        'Raum',
        'Bezeichnung',
        'Status',
        'Echtmöbel',
        'Hersteller',
        'Modell',
        'Artikelnummer',
        'Kategorie',
        'Visual',
        'Breite_cm',
        'Tiefe_cm',
        'Höhe_cm',
        'Katalog_Breite_cm',
        'Katalog_Tiefe_cm',
        'Katalog_Höhe_cm',
        'Maßabweichung',
        'Zustand',
        'Notizen',
        'Geschoss',
      ];

  const lines: string[] = [headers.map(escapeCsvCell).join(',')];

  for (const r of rows) {
    const statusLabel = r.isRealFurniture
      ? isEn
        ? 'Catalog'
        : 'Bestand/Katalog'
      : isEn
      ? 'Placeholder'
      : 'Platzhalter';
    lines.push(
      [
        r.roomName,
        r.name,
        statusLabel,
        r.isRealFurniture,
        r.brand,
        r.modelName,
        r.articleNumber,
        r.category,
        r.visual,
        r.widthCm,
        r.depthCm,
        r.heightCm,
        r.catalogWidthCm,
        r.catalogDepthCm,
        r.catalogHeightCm,
        r.dimensionDeviates,
        r.pose,
        r.notes,
        r.levelName,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

function escapeMd(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

function formatDims(w: number, d: number, h: number): string {
  return `${w} × ${d} × ${h} cm`;
}

/**
 * Exports a structured Markdown BOM & Room Area Balance report.
 */
export function exportFurnitureBomMarkdown(
  data: FloorplanData,
  options: { projectTitle?: string; language?: Language } = {}
): string {
  const language = options.language ?? 'de';
  const isEn = language === 'en';
  const rows = buildFurnitureBomRows(data, language);
  const balance = computeRoomBalanceSummary(data, language);
  const title =
    options.projectTitle?.trim() || (isEn ? 'Bill of Materials & Area Schedule' : 'Stück- & Flächenbilanz');

  const realCount = rows.filter((r) => r.isRealFurniture).length;
  const placeholderCount = rows.length - realCount;

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  if (isEn) {
    lines.push(
      `- **Total Interior Net Area:** ${balance.totalNetSqM.toFixed(2)} m² (Gross: ${balance.totalGrossSqM.toFixed(2)} m²)`
    );
    lines.push(
      `- **Furniture Footprint:** ${balance.furnitureFootprintSqM.toFixed(2)} m² (${balance.occupiedPercent.toFixed(1)}% of net area)`
    );
    lines.push(
      `- **Items:** ${rows.length} total (${realCount} catalog/real, ${placeholderCount} placeholder)`
    );
  } else {
    lines.push(
      `- **Lichte Innenfläche gesamt:** ${balance.totalNetSqM.toFixed(2)} m² (Brutto: ${balance.totalGrossSqM.toFixed(2)} m²)`
    );
    lines.push(
      `- **Möbel-Stellfläche:** ${balance.furnitureFootprintSqM.toFixed(2)} m² (${balance.occupiedPercent.toFixed(1)}% der lichten Innenfläche)`
    );
    lines.push(
      `- **Positionen:** ${rows.length} gesamt (${realCount} Katalog/Bestand, ${placeholderCount} Platzhalter)`
    );
  }
  lines.push('');

  lines.push(isEn ? '## Furniture List' : '## Stückliste Möbel');
  lines.push('');
  lines.push(
    isEn
      ? '| Room | Item | Type | Brand / Model | Article No. | Actual (W×D×H) | Catalog (W×D×H) | Delta | Level |'
      : '| Raum | Bezeichnung | Status | Hersteller / Modell | Artikel-Nr. | Ist-Maß (B×T×H) | Katalog-Maß (B×T×H) | Abweichung | Geschoss |'
  );
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');

  for (const r of rows) {
    const typeText = r.isRealFurniture
      ? isEn
        ? 'Catalog'
        : 'Katalog'
      : isEn
      ? 'Placeholder'
      : 'Platzhalter';
    const brandModel = [r.brand, r.modelName].filter(Boolean).join(' ') || '-';
    const artNo = r.articleNumber || '-';
    const actualDims = formatDims(r.widthCm, r.depthCm, r.heightCm);
    const catalogDims =
      r.catalogWidthCm !== null && r.catalogDepthCm !== null && r.catalogHeightCm !== null
        ? formatDims(r.catalogWidthCm, r.catalogDepthCm, r.catalogHeightCm)
        : '-';
    const deltaText = r.dimensionDeviates ? (isEn ? 'Yes' : 'Ja') : '-';

    lines.push(
      `| ${escapeMd(r.roomName)} | ${escapeMd(r.name)} | ${typeText} | ${escapeMd(brandModel)} | ${escapeMd(artNo)} | ${actualDims} | ${catalogDims} | ${deltaText} | ${escapeMd(r.levelName)} |`
    );
  }

  lines.push('');
  lines.push(isEn ? '## Room Area Balance' : '## Flächenbilanz Räume');
  lines.push('');
  lines.push(
    isEn
      ? '| Room | Level | Flooring | Net Area (m²) | Gross Area (m²) |'
      : '| Raum | Geschoss | Bodenbelag | Lichte Fläche (m²) | Bruttofläche (m²) |'
  );
  lines.push('| --- | --- | --- | ---: | ---: |');
  for (const rm of balance.rooms) {
    lines.push(
      `| ${escapeMd(rm.name)} | ${escapeMd(rm.levelName)} | ${rm.flooringType} | ${rm.netAreaSqM.toFixed(2)} | ${rm.grossAreaSqM.toFixed(2)} |`
    );
  }
  lines.push(
    `| **${isEn ? 'Total' : 'Summe'}** | - | - | **${balance.totalNetSqM.toFixed(2)}** | **${balance.totalGrossSqM.toFixed(2)}** |`
  );
  if (balance.hasRoofSlopes) {
    lines.push('');
    lines.push(
      isEn
        ? `- **WoFlV Living Area (incl. Roof Slopes):** ${balance.totalWoFlVSqM.toFixed(2)} m²`
        : `- **WoFlV-Wohnfläche (inkl. Dachschrägen):** ${balance.totalWoFlVSqM.toFixed(2)} m²`
    );
  }
  lines.push('');

  return lines.join('\n');
}
