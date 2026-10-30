import { adoptOverlayImage } from '../core/overlayImageStore';
import { isFurnitureVisualType } from '../core/furnitureVisual';
import {
  AreaRug,
  BackgroundImageOverlay,
  Corner,
  FloorplanData,
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

    const corners: Corner[] = [];
    for (const c of parsed.corners) {
      if (
        !c ||
        typeof c.id !== 'string' ||
        !Number.isFinite(c.x) ||
        !Number.isFinite(c.z)
      ) {
        return null;
      }
      corners.push({ id: c.id, x: Number(c.x), z: Number(c.z) });
    }

    const walls: Wall[] = [];
    for (const w of parsed.walls) {
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
      walls.push({
        id: w.id,
        startCornerId: w.startCornerId,
        endCornerId: w.endCornerId,
        thicknessCm: Math.max(5, Number(w.thicknessCm)),
        heightCm: Math.max(50, Number(w.heightCm)),
      });
    }

    const openings: WallOpening[] = [];
    for (const o of parsed.openings) {
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
      openings.push({
        id: o.id,
        wallId: o.wallId,
        type: o.type,
        offsetFromStartCm: Math.max(0, Number(o.offsetFromStartCm)),
        widthCm: Math.max(1, Number(o.widthCm)),
        heightCm: Math.max(1, Number(o.heightCm)),
        sillHeightCm: Math.max(0, Number(o.sillHeightCm)),
        swingDirection: o.swingDirection,
      });
    }

    const furniture: FurnitureItem[] = [];
    for (const f of parsed.furniture) {
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
      const visual =
        typeof f.visual === 'string' && isFurnitureVisualType(f.visual)
          ? f.visual
          : undefined;
      furniture.push({
        id: f.id,
        name: f.name,
        category: f.category ?? 'custom',
        widthCm: Math.max(1, Number(f.widthCm)),
        heightCm: Math.max(1, Number(f.heightCm)),
        depthCm: Math.max(1, Number(f.depthCm)),
        x: Number(f.x),
        z: Number(f.z),
        elevationCm: Math.max(0, Number(f.elevationCm ?? 0)),
        rotationYDeg: Number(f.rotationYDeg ?? 0),
        color: typeof f.color === 'string' ? f.color : '#6366f1',
        snappedWallId: f.snappedWallId ?? null,
        isRealFurniture: Boolean(f.isRealFurniture),
        brand: typeof f.brand === 'string' ? f.brand : undefined,
        modelName: typeof f.modelName === 'string' ? f.modelName : undefined,
        articleNumber:
          typeof f.articleNumber === 'string' ? f.articleNumber : undefined,
        notes: typeof f.notes === 'string' ? f.notes : undefined,
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

    const rugs: AreaRug[] = [];
    if (Array.isArray(parsed.rugs)) {
      for (const r of parsed.rugs) {
        if (
          r &&
          typeof r.id === 'string' &&
          Number.isFinite(r.widthCm) &&
          Number.isFinite(r.depthCm) &&
          Number.isFinite(r.x) &&
          Number.isFinite(r.z)
        ) {
          rugs.push({
            id: r.id,
            name: typeof r.name === 'string' ? r.name : undefined,
            widthCm: Math.max(1, Number(r.widthCm)),
            depthCm: Math.max(1, Number(r.depthCm)),
            x: Number(r.x),
            z: Number(r.z),
            rotationYDeg: Number(r.rotationYDeg ?? 0),
            color: typeof r.color === 'string' ? r.color : undefined,
          });
        }
      }
    }

    const roomLabels: RoomLabel[] = [];
    if (Array.isArray(parsed.roomLabels)) {
      for (const label of parsed.roomLabels) {
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
            name: label.name.trim(),
            x: Number(label.x),
            z: Number(label.z),
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
          xCm: Number(bg.xCm),
          zCm: Number(bg.zCm),
          widthCm: Math.max(1, Number(bg.widthCm)),
          heightCm: Math.max(1, Number(bg.heightCm)),
          rotationDeg: Number(bg.rotationDeg ?? 0),
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
