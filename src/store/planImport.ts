import { adoptOverlayImage } from '../core/overlayImageStore';
import { isFurnitureVisualType } from '../core/furnitureVisual';
import {
  AreaRug,
  BackgroundImageOverlay,
  Corner,
  FloorplanData,
  FurnitureCategory,
  FurnitureItem,
  RoomLabel,
  Wall,
  WallOpening,
} from '../core/types';

export interface ParsedPlan {
  corners: Corner[];
  walls: Wall[];
  openings: WallOpening[];
  furniture: FurnitureItem[];
  rugs: AreaRug[];
  roomLabels: RoomLabel[];
  backgroundImage: BackgroundImageOverlay | null;
  importedWasDataUrl: boolean;
}

const MAX_ENTITIES_PER_TYPE = 1000;
const MAX_DIMENSION_CM = 50000;

function finiteOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const VALID_CATEGORIES = new Set<FurnitureCategory>([
  'living',
  'bedroom',
  'kitchen',
  'office',
  'storage',
  'bathroom',
  'decor',
  'custom',
]);

const VALID_SWING_DIRECTIONS = new Set(['in-left', 'in-right', 'out-left', 'out-right']);

function dedupeId(rawId: string, seen: Set<string>, prefix: string): string {
  let id = typeof rawId === 'string' && rawId.trim().length > 0 ? rawId.trim() : `${prefix}-${seen.size + 1}`;
  if (!seen.has(id)) {
    seen.add(id);
    return id;
  }
  let counter = 1;
  while (seen.has(`${id}_dup${counter}`)) {
    counter++;
  }
  const newId = `${id}_dup${counter}`;
  seen.add(newId);
  return newId;
}

export function parsePlanJson(jsonStr: string): ParsedPlan | null {
  try {
    const parsed = JSON.parse(jsonStr) as Partial<FloorplanData>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.corners) ||
      !Array.isArray(parsed.walls) ||
      !Array.isArray(parsed.openings) ||
      !Array.isArray(parsed.furniture)
    ) {
      return null;
    }

    const seenCornerIds = new Set<string>();
    const corners: Corner[] = [];
    for (const c of parsed.corners.slice(0, MAX_ENTITIES_PER_TYPE)) {
      if (
        !c ||
        typeof c.id !== 'string' ||
        !Number.isFinite(c.x) ||
        !Number.isFinite(c.z)
      ) {
        return null;
      }
      const id = dedupeId(c.id, seenCornerIds, 'c');
      corners.push({
        id,
        x: clamp(Number(c.x), -MAX_DIMENSION_CM, MAX_DIMENSION_CM),
        z: clamp(Number(c.z), -MAX_DIMENSION_CM, MAX_DIMENSION_CM),
      });
    }

    const validCornerIds = new Set(corners.map((c) => c.id));

    const seenWallIds = new Set<string>();
    const walls: Wall[] = [];
    for (const w of parsed.walls.slice(0, MAX_ENTITIES_PER_TYPE)) {
      if (
        !w ||
        typeof w.id !== 'string' ||
        typeof w.startCornerId !== 'string' ||
        typeof w.endCornerId !== 'string' ||
        !Number.isFinite(w.thicknessCm) ||
        !Number.isFinite(w.heightCm)
      ) {
        return null;
      }
      // Filter walls with non-existent corner references
      if (!validCornerIds.has(w.startCornerId) || !validCornerIds.has(w.endCornerId)) {
        continue;
      }
      const id = dedupeId(w.id, seenWallIds, 'w');
      walls.push({
        id,
        startCornerId: w.startCornerId,
        endCornerId: w.endCornerId,
        thicknessCm: clamp(Number(w.thicknessCm), 5, 200),
        heightCm: clamp(Number(w.heightCm), 50, 1000),
      });
    }

    const validWallIds = new Set(walls.map((w) => w.id));

    const seenOpeningIds = new Set<string>();
    const openings: WallOpening[] = [];
    for (const o of parsed.openings.slice(0, MAX_ENTITIES_PER_TYPE)) {
      if (
        !o ||
        typeof o.id !== 'string' ||
        typeof o.wallId !== 'string' ||
        (o.type !== 'door' &&
          o.type !== 'window' &&
          o.type !== 'sliding-door' &&
          o.type !== 'passage' &&
          o.type !== 'balcony-door') ||
        !Number.isFinite(o.offsetFromStartCm) ||
        !Number.isFinite(o.widthCm) ||
        !Number.isFinite(o.heightCm) ||
        !Number.isFinite(o.sillHeightCm)
      ) {
        return null;
      }
      // Filter openings with non-existent wall references
      if (!validWallIds.has(o.wallId)) {
        continue;
      }
      const id = dedupeId(o.id, seenOpeningIds, 'op');
      const swingDirection =
        typeof o.swingDirection === 'string' && VALID_SWING_DIRECTIONS.has(o.swingDirection)
          ? o.swingDirection
          : undefined;

      openings.push({
        id,
        wallId: o.wallId,
        type: o.type,
        offsetFromStartCm: clamp(Number(o.offsetFromStartCm), 0, MAX_DIMENSION_CM),
        widthCm: clamp(Number(o.widthCm), 1, 1000),
        heightCm: clamp(Number(o.heightCm), 1, 1000),
        sillHeightCm: clamp(Number(o.sillHeightCm), 0, 1000),
        swingDirection,
      });
    }

    const seenFurnitureIds = new Set<string>();
    const furniture: FurnitureItem[] = [];
    for (const f of parsed.furniture.slice(0, MAX_ENTITIES_PER_TYPE)) {
      if (
        !f ||
        typeof f.id !== 'string' ||
        typeof f.name !== 'string' ||
        !Number.isFinite(f.widthCm) ||
        !Number.isFinite(f.heightCm) ||
        !Number.isFinite(f.depthCm) ||
        !Number.isFinite(f.x) ||
        !Number.isFinite(f.z)
      ) {
        return null;
      }
      const id = dedupeId(f.id, seenFurnitureIds, 'f');
      const visual =
        typeof f.visual === 'string' && isFurnitureVisualType(f.visual)
          ? f.visual
          : undefined;

      const category =
        typeof f.category === 'string' && VALID_CATEGORIES.has(f.category as FurnitureCategory)
          ? (f.category as FurnitureCategory)
          : 'custom';

      const snappedWallId =
        typeof f.snappedWallId === 'string' && validWallIds.has(f.snappedWallId)
          ? f.snappedWallId
          : null;

      furniture.push({
        id,
        name: f.name.slice(0, 200),
        category,
        widthCm: clamp(Number(f.widthCm), 1, MAX_DIMENSION_CM),
        heightCm: clamp(Number(f.heightCm), 1, MAX_DIMENSION_CM),
        depthCm: clamp(Number(f.depthCm), 1, MAX_DIMENSION_CM),
        x: clamp(Number(f.x), -MAX_DIMENSION_CM, MAX_DIMENSION_CM),
        z: clamp(Number(f.z), -MAX_DIMENSION_CM, MAX_DIMENSION_CM),
        elevationCm: clamp(finiteOr(f.elevationCm, 0), 0, MAX_DIMENSION_CM),
        rotationYDeg: finiteOr(f.rotationYDeg, 0),
        color: typeof f.color === 'string' ? f.color : '#6366f1',
        snappedWallId,
        isRealFurniture: Boolean(f.isRealFurniture),
        brand: typeof f.brand === 'string' ? f.brand.slice(0, 100) : undefined,
        modelName: typeof f.modelName === 'string' ? f.modelName.slice(0, 100) : undefined,
        articleNumber:
          typeof f.articleNumber === 'string' ? f.articleNumber.slice(0, 100) : undefined,
        notes: typeof f.notes === 'string' ? f.notes.slice(0, 1000) : undefined,
        visual,
        catalogWidthCm:
          Number.isFinite(f.catalogWidthCm) && Number(f.catalogWidthCm) > 0
            ? Number(f.catalogWidthCm)
            : undefined,
        catalogHeightCm:
          Number.isFinite(f.catalogHeightCm) && Number(f.catalogHeightCm) > 0
            ? Number(f.catalogHeightCm)
            : undefined,
        catalogDepthCm:
          Number.isFinite(f.catalogDepthCm) && Number(f.catalogDepthCm) > 0
            ? Number(f.catalogDepthCm)
            : undefined,
        clearanceZoneCm:
          Number.isFinite(f.clearanceZoneCm) && Number(f.clearanceZoneCm) > 0
            ? Number(f.clearanceZoneCm)
            : undefined,
        hasNightstands:
          typeof f.hasNightstands === 'boolean' ? f.hasNightstands : undefined,
        pose: f.pose === 'open' || f.pose === 'closed' ? f.pose : undefined,
        attachedToId:
          typeof f.attachedToId === 'string' && f.attachedToId.trim().length > 0
            ? f.attachedToId.trim()
            : f.attachedToId === null
            ? null
            : undefined,
      });
    }

    const validFurnitureIds = new Set(furniture.map((f) => f.id));
    for (const item of furniture) {
      if (item.attachedToId) {
        if (item.attachedToId === item.id || !validFurnitureIds.has(item.attachedToId)) {
          item.attachedToId = null;
        }
      }
    }
    const itemMap = new Map(furniture.map((f) => [f.id, f]));
    for (const item of furniture) {
      if (!item.attachedToId) continue;
      const seen = new Set<string>([item.id]);
      let cur: string | null | undefined = item.attachedToId;
      while (cur) {
        if (seen.has(cur)) {
          item.attachedToId = null;
          break;
        }
        seen.add(cur);
        cur = itemMap.get(cur)?.attachedToId;
      }
    }

    const seenRugIds = new Set<string>();
    const rugs: AreaRug[] = [];
    if (Array.isArray(parsed.rugs)) {
      for (const r of parsed.rugs.slice(0, 500)) {
        if (
          r &&
          typeof r.id === 'string' &&
          Number.isFinite(r.widthCm) &&
          Number.isFinite(r.depthCm) &&
          Number.isFinite(r.x) &&
          Number.isFinite(r.z)
        ) {
          const id = dedupeId(r.id, seenRugIds, 'r');
          rugs.push({
            id,
            name: typeof r.name === 'string' ? r.name.slice(0, 100) : undefined,
            widthCm: clamp(Number(r.widthCm), 1, MAX_DIMENSION_CM),
            depthCm: clamp(Number(r.depthCm), 1, MAX_DIMENSION_CM),
            x: clamp(Number(r.x), -MAX_DIMENSION_CM, MAX_DIMENSION_CM),
            z: clamp(Number(r.z), -MAX_DIMENSION_CM, MAX_DIMENSION_CM),
            rotationYDeg: finiteOr(r.rotationYDeg, 0),
            color: typeof r.color === 'string' ? r.color : undefined,
          });
        }
      }
    }

    const roomLabels: RoomLabel[] = [];
    if (Array.isArray(parsed.roomLabels)) {
      for (const label of parsed.roomLabels.slice(0, 200)) {
        if (
          label &&
          typeof label.name === 'string' &&
          label.name.trim().length > 0 &&
          Number.isFinite(label.x) &&
          Number.isFinite(label.z)
        ) {
          const flooringType =
            label.flooringType === 'microcement' ||
            label.flooringType === 'parquet' ||
            label.flooringType === 'tile'
              ? label.flooringType
              : undefined;
          roomLabels.push({
            name: label.name.trim().slice(0, 100),
            x: clamp(Number(label.x), -MAX_DIMENSION_CM, MAX_DIMENSION_CM),
            z: clamp(Number(label.z), -MAX_DIMENSION_CM, MAX_DIMENSION_CM),
            ...(flooringType ? { flooringType } : {}),
          });
        }
      }
    }

    let backgroundImage: BackgroundImageOverlay | null = null;
    let importedWasDataUrl = false;
    if (parsed.backgroundImage && typeof parsed.backgroundImage === 'object') {
      const bg = parsed.backgroundImage;
      if (
        typeof bg.id === 'string' &&
        Number.isFinite(bg.xCm) &&
        Number.isFinite(bg.zCm) &&
        Number.isFinite(bg.widthCm) &&
        Number.isFinite(bg.heightCm)
      ) {
        const rawUrl = typeof bg.url === 'string' ? bg.url : '';
        importedWasDataUrl = rawUrl.startsWith('data:');
        backgroundImage = adoptOverlayImage({
          id: bg.id,
          url: rawUrl,
          imageId: typeof bg.imageId === 'string' ? bg.imageId : undefined,
          filename: typeof bg.filename === 'string' ? bg.filename : 'plan.png',
          xCm: clamp(Number(bg.xCm), -MAX_DIMENSION_CM, MAX_DIMENSION_CM),
          zCm: clamp(Number(bg.zCm), -MAX_DIMENSION_CM, MAX_DIMENSION_CM),
          widthCm: clamp(Number(bg.widthCm), 1, MAX_DIMENSION_CM),
          heightCm: clamp(Number(bg.heightCm), 1, MAX_DIMENSION_CM),
          rotationDeg: finiteOr(bg.rotationDeg, 0),
          opacity: Number.isFinite(bg.opacity)
            ? Math.max(0, Math.min(1, Number(bg.opacity)))
            : 0.5,
          visible: typeof bg.visible === 'boolean' ? bg.visible : true,
          locked: typeof bg.locked === 'boolean' ? bg.locked : false,
          naturalWidthPx:
            Number.isFinite(bg.naturalWidthPx) && Number(bg.naturalWidthPx) > 0
              ? Number(bg.naturalWidthPx)
              : 1000,
          naturalHeightPx:
            Number.isFinite(bg.naturalHeightPx) && Number(bg.naturalHeightPx) > 0
              ? Number(bg.naturalHeightPx)
              : 1000,
        });
      }
    }

    return {
      corners,
      walls,
      openings,
      furniture,
      rugs,
      roomLabels,
      backgroundImage,
      importedWasDataUrl,
    };
  } catch {
    return null;
  }
}
