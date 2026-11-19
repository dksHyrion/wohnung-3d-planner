import { adoptOverlayImage } from '../core/overlayImageStore';
import { isFurnitureVisualType } from '../core/furnitureVisual';
import { normalizeLevels } from '../core/levels';
import { sanitizeWallSideFinish } from '../core/materials/wallFinishes';
import {
  AreaRug,
  BackgroundImageOverlay,
  BuildingLevel,
  Corner,
  FloorplanData,
  FurnitureCategory,
  FurnitureItem,
  LayoutVariant,
  RoofSlope,
  RoomLabel,
  Staircase,
  StaircaseType,
  Wall,
  WallFixture,
  WallFixtureType,
  WallOpening,
} from '../core/types';

export interface ParsedPlan {
  corners: Corner[];
  walls: Wall[];
  openings: WallOpening[];
  furniture: FurnitureItem[];
  rugs: AreaRug[];
  roomLabels: RoomLabel[];
  roofSlopes: RoofSlope[];
  fixtures: WallFixture[];
  levels?: BuildingLevel[];
  stairs?: Staircase[];
  variants: LayoutVariant[];
  activeVariantId: string | null;
  backgroundImage: BackgroundImageOverlay | null;
  importedWasDataUrl: boolean;
}

function optLevelId(raw: unknown): { levelId?: string } {
  return typeof raw === 'string' && raw.trim().length > 0
    ? { levelId: raw.trim().slice(0, 80) }
    : {};
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

function sanitizeFurnitureList(
  rawList: Partial<FurnitureItem>[],
  validWallIds: Set<string>
): FurnitureItem[] | null {
  const seenIds = new Set<string>();
  const out: FurnitureItem[] = [];
  for (const f of rawList.slice(0, MAX_ENTITIES_PER_TYPE)) {
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
    const id = dedupeId(f.id, seenIds, 'f');
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

    out.push({
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
      ...optLevelId(f.levelId),
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
      customModelId:
        typeof f.customModelId === 'string' && f.customModelId.trim().length > 0
          ? f.customModelId.trim().slice(0, 120)
          : undefined,
      customModelFilename:
        typeof f.customModelFilename === 'string' &&
        f.customModelFilename.trim().length > 0
          ? f.customModelFilename.trim().slice(0, 200)
          : undefined,
    });
  }

  const validFurnitureIds = new Set(out.map((f) => f.id));
  for (const item of out) {
    if (item.attachedToId) {
      if (item.attachedToId === item.id || !validFurnitureIds.has(item.attachedToId)) {
        item.attachedToId = null;
      }
    }
  }
  const itemMap = new Map(out.map((f) => [f.id, f]));
  for (const item of out) {
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
  return out;
}

function sanitizeRugsList(rawList: unknown): AreaRug[] {
  if (!Array.isArray(rawList)) return [];
  const seenRugIds = new Set<string>();
  const rugs: AreaRug[] = [];
  for (const r of rawList.slice(0, 500)) {
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
        ...optLevelId(r.levelId),
      });
    }
  }
  return rugs;
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
        ...optLevelId(c.levelId),
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
      const posFinish = sanitizeWallSideFinish(w.posFinish);
      const negFinish = sanitizeWallSideFinish(w.negFinish);
      walls.push({
        id,
        startCornerId: w.startCornerId,
        endCornerId: w.endCornerId,
        thicknessCm: clamp(Number(w.thicknessCm), 5, 200),
        heightCm: clamp(Number(w.heightCm), 50, 1000),
        ...(posFinish ? { posFinish } : {}),
        ...(negFinish ? { negFinish } : {}),
        ...optLevelId(w.levelId),
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
        ...optLevelId(o.levelId),
      });
    }

    const furniture = sanitizeFurnitureList(parsed.furniture, validWallIds);
    if (!furniture) return null;
    const rugs = sanitizeRugsList(parsed.rugs);

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
            ...optLevelId(label.levelId),
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

    const roofSlopes: RoofSlope[] = [];
    if (Array.isArray(parsed.roofSlopes)) {
      const seenSlopeIds = new Set<string>();
      const validWallIds = new Set(walls.map((w) => w.id));
      for (const s of parsed.roofSlopes.slice(0, MAX_ENTITIES_PER_TYPE)) {
        if (!s || typeof s.wallId !== 'string' || !validWallIds.has(s.wallId)) continue;
        const id = dedupeId(typeof s.id === 'string' ? s.id : '', seenSlopeIds, 'roof');
        const kneeWallHeightCm = clamp(finiteOr(s.kneeWallHeightCm, 100), 0, 250);
        const pitchDeg = clamp(finiteOr(s.pitchDeg, 45), 5, 75);
        const side = s.side === 'pos' || s.side === 'neg' ? s.side : undefined;
        roofSlopes.push({
          id,
          wallId: s.wallId,
          kneeWallHeightCm,
          pitchDeg,
          ...(side ? { side } : {}),
          ...optLevelId(s.levelId),
        });
      }
    }

    const VALID_FIXTURE_TYPES = new Set<WallFixtureType>([
      'radiator',
      'socket',
      'switch',
      'data-outlet',
      'water-outlet',
      'shaft',
    ]);
    const fixtures: WallFixture[] = [];
    if (Array.isArray(parsed.fixtures)) {
      const seenFixtureIds = new Set<string>();
      const validWallIds = new Set(walls.map((w) => w.id));
      for (const fx of parsed.fixtures.slice(0, MAX_ENTITIES_PER_TYPE)) {
        if (
          !fx ||
          typeof fx.wallId !== 'string' ||
          !validWallIds.has(fx.wallId) ||
          typeof fx.type !== 'string' ||
          !VALID_FIXTURE_TYPES.has(fx.type as WallFixtureType)
        ) {
          continue;
        }
        const id = dedupeId(typeof fx.id === 'string' ? fx.id : '', seenFixtureIds, 'fix');
        const side = fx.side === 'pos' || fx.side === 'neg' ? fx.side : undefined;
        fixtures.push({
          id,
          wallId: fx.wallId,
          type: fx.type as WallFixtureType,
          offsetFromStartCm: clamp(finiteOr(fx.offsetFromStartCm, 50), 0, MAX_DIMENSION_CM),
          widthCm: clamp(finiteOr(fx.widthCm, 20), 4, MAX_DIMENSION_CM),
          heightCm: clamp(finiteOr(fx.heightCm, 20), 4, 500),
          depthCm: clamp(finiteOr(fx.depthCm, 5), 1, 500),
          elevationCm: clamp(finiteOr(fx.elevationCm, 0), 0, 500),
          ...(side ? { side } : {}),
          ...(typeof fx.label === 'string' && fx.label.trim()
            ? { label: fx.label.trim().slice(0, 80) }
            : {}),
          ...optLevelId(fx.levelId),
        });
      }
    }

    const variants: LayoutVariant[] = [];
    if (Array.isArray(parsed.variants)) {
      const seenVariantIds = new Set<string>();
      const validWallIdSet = new Set(walls.map((w) => w.id));
      for (const v of parsed.variants.slice(0, 20)) {
        if (!v || typeof v.name !== 'string' || !Array.isArray(v.furniture)) continue;
        const vFurn = sanitizeFurnitureList(v.furniture, validWallIdSet);
        if (!vFurn) continue;
        const id = dedupeId(typeof v.id === 'string' ? v.id : '', seenVariantIds, 'var');
        variants.push({
          id,
          name: v.name.trim().slice(0, 80) || 'Variante',
          createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
          furniture: vFurn,
          rugs: sanitizeRugsList(v.rugs),
        });
      }
    }
    const activeVariantId =
      typeof parsed.activeVariantId === 'string' &&
      variants.some((v) => v.id === parsed.activeVariantId)
        ? parsed.activeVariantId
        : null;

    const levels = Array.isArray(parsed.levels)
      ? normalizeLevels(
          parsed.levels
            .filter(
              (lvl): lvl is BuildingLevel =>
                Boolean(lvl) &&
                typeof lvl === 'object' &&
                typeof lvl.id === 'string' &&
                lvl.id.trim().length > 0 &&
                Number.isFinite(lvl.index) &&
                Number.isFinite(lvl.ceilingHeightCm) &&
                Number.isFinite(lvl.slabThicknessCm),
            )
            .map((lvl) => ({
              id: lvl.id.trim().slice(0, 80),
              name:
                typeof lvl.name === 'string' && lvl.name.trim()
                  ? lvl.name.trim().slice(0, 80)
                  : lvl.id.trim(),
              index: Math.round(lvl.index),
              elevationCm: finiteOr(lvl.elevationCm, 0),
              ceilingHeightCm: clamp(lvl.ceilingHeightCm, 100, 600),
              slabThicknessCm: clamp(lvl.slabThicknessCm, 5, 100),
            })),
        )
      : undefined;

    const VALID_STAIR_TYPES = new Set<StaircaseType>([
      'straight',
      'l-shaped',
      'u-shaped',
    ]);
    const stairs: Staircase[] | undefined = Array.isArray(parsed.stairs)
      ? (() => {
          const seenStairIds = new Set<string>();
          const out: Staircase[] = [];
          for (const st of parsed.stairs.slice(0, 100)) {
            if (
              !st ||
              typeof st !== 'object' ||
              typeof st.fromLevelId !== 'string' ||
              typeof st.toLevelId !== 'string' ||
              !Number.isFinite(st.x) ||
              !Number.isFinite(st.z)
            ) {
              continue;
            }
            const id = dedupeId(typeof st.id === 'string' ? st.id : '', seenStairIds, 'stair');
            const type: StaircaseType = VALID_STAIR_TYPES.has(st.type)
              ? st.type
              : 'straight';
            out.push({
              id,
              type,
              fromLevelId: st.fromLevelId.trim().slice(0, 80),
              toLevelId: st.toLevelId.trim().slice(0, 80),
              x: clamp(Number(st.x), -MAX_DIMENSION_CM, MAX_DIMENSION_CM),
              z: clamp(Number(st.z), -MAX_DIMENSION_CM, MAX_DIMENSION_CM),
              rotationYDeg: finiteOr(st.rotationYDeg, 0),
              widthCm: clamp(finiteOr(st.widthCm, 100), 60, 300),
              treadDepthCm: clamp(finiteOr(st.treadDepthCm, 27), 18, 45),
              riserCount:
                typeof st.riserCount === 'number' && Number.isFinite(st.riserCount)
                  ? Math.round(clamp(st.riserCount, 3, 40))
                  : undefined,
              landingLengthCm:
                typeof st.landingLengthCm === 'number' && Number.isFinite(st.landingLengthCm)
                  ? clamp(st.landingLengthCm, 60, 300)
                  : undefined,
              turnDirection:
                st.turnDirection === 'left' || st.turnDirection === 'right'
                  ? st.turnDirection
                  : undefined,
              hasRailing: typeof st.hasRailing === 'boolean' ? st.hasRailing : true,
              color: typeof st.color === 'string' ? st.color.slice(0, 40) : undefined,
            });
          }
          return out;
        })()
      : undefined;

    return {
      corners,
      walls,
      openings,
      furniture,
      rugs,
      roomLabels,
      roofSlopes,
      fixtures,
      ...(levels ? { levels } : {}),
      ...(stairs ? { stairs } : {}),
      variants,
      activeVariantId,
      backgroundImage,
      importedWasDataUrl,
    };
  } catch {
    return null;
  }
}
