import type {
  Corner,
  FloorplanData,
  FurnitureCategory,
  FurnitureItem,
  FurnitureVisualType,
  OpeningType,
  Wall,
  WallOpening,
} from '../types';
import { buildWallGraphFromSegments } from './importTopology';

interface RoomPlanElement {
  identifier?: string;
  parentIdentifier?: string | null;
  dimensions?: number[];
  transform?: number[];
  category?: Record<string, unknown> | string;
}

interface RoomPlanPayload {
  walls?: RoomPlanElement[];
  doors?: RoomPlanElement[];
  windows?: RoomPlanElement[];
  openings?: RoomPlanElement[];
  objects?: RoomPlanElement[];
}

export interface RoomPlanImportResult {
  data: FloorplanData;
  wallCount: number;
  openingCount: number;
  objectCount: number;
}

function readMatrixTransform(t: number[] | undefined): {
  cxCm: number;
  cyCm: number;
  czCm: number;
  tx: number;
  tz: number;
  rotYDeg: number;
} | null {
  if (!Array.isArray(t) || t.length < 16 || !t.every((n) => Number.isFinite(n))) {
    return null;
  }
  // Apple RoomPlan 4x4 column-major matrix (meters, Y-up)
  const txRaw = t[0];
  const tzRaw = t[2];
  const len = Math.hypot(txRaw, tzRaw) || 1;
  const tx = txRaw / len;
  const tz = tzRaw / len;
  const rotYDeg = Number(
    ((((Math.atan2(-tz, tx) * 180) / Math.PI) % 360 + 360) % 360).toFixed(1)
  );
  return {
    cxCm: t[12] * 100,
    cyCm: t[13] * 100,
    czCm: t[14] * 100,
    tx,
    tz,
    rotYDeg,
  };
}

function mapRoomPlanObjectCategory(cat: unknown): {
  name: string;
  category: FurnitureCategory;
  visual: FurnitureVisualType;
  color: string;
} {
  const key =
    typeof cat === 'string'
      ? cat.toLowerCase()
      : cat && typeof cat === 'object'
      ? Object.keys(cat)[0]?.toLowerCase() ?? 'box'
      : 'box';

  if (key.includes('sofa') || key.includes('couch')) {
    return { name: 'Sofa', category: 'living', visual: 'sofa', color: '#64748b' };
  }
  if (key.includes('bed')) {
    return { name: 'Bett', category: 'bedroom', visual: 'bed', color: '#78716c' };
  }
  if (key.includes('table')) {
    return { name: 'Tisch', category: 'living', visual: 'dining-table', color: '#94a3b8' };
  }
  if (key.includes('chair')) {
    return { name: 'Stuhl', category: 'living', visual: 'generic-seating', color: '#64748b' };
  }
  if (key.includes('storage') || key.includes('cabinet') || key.includes('wardrobe')) {
    return { name: 'Schrank', category: 'storage', visual: 'wardrobe', color: '#94a3b8' };
  }
  if (key.includes('bathtub')) {
    return { name: 'Badewanne', category: 'bathroom', visual: 'bathtub', color: '#f8fafc' };
  }
  if (key.includes('toilet')) {
    return { name: 'WC', category: 'bathroom', visual: 'toilet', color: '#f8fafc' };
  }
  if (key.includes('sink') || key.includes('vanity')) {
    return { name: 'Waschtisch', category: 'bathroom', visual: 'vanity', color: '#f8fafc' };
  }
  if (key.includes('washer') || key.includes('dryer')) {
    return { name: 'Waschmaschine', category: 'bathroom', visual: 'washing-machine', color: '#f8fafc' };
  }
  if (key.includes('stove') || key.includes('oven') || key.includes('refrigerator') || key.includes('dishwasher')) {
    return { name: 'Küchenzeile', category: 'kitchen', visual: 'kitchen-unit', color: '#475569' };
  }
  if (key.includes('television') || key.includes('screen')) {
    return { name: 'Monitor / TV', category: 'living', visual: 'desk-monitor', color: '#1e293b' };
  }
  return { name: 'Objekt', category: 'custom', visual: 'box', color: '#94a3b8' };
}

function projectPointToBestWall(
  xCm: number,
  zCm: number,
  walls: Wall[],
  cornerMap: Map<string, Corner>
): { wall: Wall; offsetFromStartCm: number; distCm: number } | null {
  let best: { wall: Wall; offsetFromStartCm: number; distCm: number } | null = null;
  for (const wall of walls) {
    const start = cornerMap.get(wall.startCornerId);
    const end = cornerMap.get(wall.endCornerId);
    if (!start || !end) continue;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const len = Math.hypot(dx, dz);
    if (len < 1) continue;
    const ux = dx / len;
    const uz = dz / len;
    const proj = (xCm - start.x) * ux + (zCm - start.z) * uz;
    if (proj < -20 || proj > len + 20) continue;
    const clampedProj = Math.max(0, Math.min(len, proj));
    const px = start.x + ux * clampedProj;
    const pz = start.z + uz * clampedProj;
    const distCm = Math.hypot(xCm - px, zCm - pz);
    if (!best || distCm < best.distCm) {
      best = { wall, offsetFromStartCm: clampedProj, distCm };
    }
  }
  return best && best.distCm <= 60 ? best : null;
}

export function parseRoomPlanJson(jsonText: string): RoomPlanImportResult | null {
  let raw: RoomPlanPayload;
  try {
    raw = JSON.parse(jsonText) as RoomPlanPayload;
  } catch {
    return null;
  }

  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.walls) || raw.walls.length === 0) {
    return null;
  }

  const rawSegments: Array<{
    x1: number;
    z1: number;
    x2: number;
    z2: number;
    thicknessCm: number;
    heightCm: number;
  }> = [];

  for (const w of raw.walls) {
    const tr = readMatrixTransform(w.transform);
    const dims = w.dimensions;
    if (!tr || !Array.isArray(dims) || dims.length < 2) continue;
    const lengthCm = Math.max(10, dims[0] * 100);
    const heightCm = Math.max(50, (dims[1] ?? 2.5) * 100);
    const thicknessCm = Math.max(5, (dims[2] ?? 0.15) * 100);
    const halfLen = lengthCm / 2;
    rawSegments.push({
      x1: tr.cxCm - tr.tx * halfLen,
      z1: tr.czCm - tr.tz * halfLen,
      x2: tr.cxCm + tr.tx * halfLen,
      z2: tr.czCm + tr.tz * halfLen,
      thicknessCm: Number(thicknessCm.toFixed(1)),
      heightCm: Number(heightCm.toFixed(1)),
    });
  }

  if (rawSegments.length === 0) return null;

  // Compute shift to positive coordinates so openings and objects use the exact same shift
  let minX = Infinity;
  let minZ = Infinity;
  for (const s of rawSegments) {
    minX = Math.min(minX, s.x1, s.x2);
    minZ = Math.min(minZ, s.z1, s.z2);
  }
  const shiftX = 50 - minX;
  const shiftZ = 50 - minZ;

  const shiftedSegments = rawSegments.map((s) => ({
    ...s,
    x1: s.x1 + shiftX,
    z1: s.z1 + shiftZ,
    x2: s.x2 + shiftX,
    z2: s.z2 + shiftZ,
  }));

  const graph = buildWallGraphFromSegments(shiftedSegments, {
    weldToleranceCm: 8,
    preserveCoordinates: true,
  });
  const cornerMap = new Map(graph.corners.map((c) => [c.id, c]));

  const openings: WallOpening[] = [];
  let opSeq = 1;

  const addOpeningGroup = (
    items: RoomPlanElement[] | undefined,
    type: OpeningType
  ) => {
    if (!Array.isArray(items)) return;
    for (const op of items) {
      const tr = readMatrixTransform(op.transform);
      const dims = op.dimensions;
      if (!tr || !Array.isArray(dims) || dims.length < 2) continue;
      const widthCm = Math.max(20, Number((dims[0] * 100).toFixed(1)));
      const heightCm = Math.max(30, Number((dims[1] * 100).toFixed(1)));
      const hit = projectPointToBestWall(
        tr.cxCm + shiftX,
        tr.czCm + shiftZ,
        graph.walls,
        cornerMap
      );
      if (!hit) continue;
      const start = cornerMap.get(hit.wall.startCornerId)!;
      const end = cornerMap.get(hit.wall.endCornerId)!;
      const wallLen = Math.hypot(end.x - start.x, end.z - start.z);
      const clampedOffset = Math.max(
        0,
        Math.min(Math.max(0, wallLen - widthCm), hit.offsetFromStartCm - widthCm / 2)
      );
      const sillHeightCm =
        type === 'window'
          ? Math.max(0, Math.round(tr.cyCm - heightCm / 2))
          : 0;

      openings.push({
        id: `rp-op-${opSeq++}`,
        wallId: hit.wall.id,
        type,
        offsetFromStartCm: Number(clampedOffset.toFixed(1)),
        widthCm,
        heightCm,
        sillHeightCm,
        ...(type === 'door' ? { swingDirection: 'in-left' as const } : {}),
      });
    }
  };

  addOpeningGroup(raw.doors, 'door');
  addOpeningGroup(raw.windows, 'window');
  addOpeningGroup(raw.openings, 'passage');

  const furniture: FurnitureItem[] = [];
  let objSeq = 1;
  if (Array.isArray(raw.objects)) {
    for (const obj of raw.objects) {
      const tr = readMatrixTransform(obj.transform);
      const dims = obj.dimensions;
      if (!tr || !Array.isArray(dims) || dims.length < 3) continue;
      const mapped = mapRoomPlanObjectCategory(obj.category);
      const widthCm = Math.max(10, Math.round(dims[0] * 100));
      const heightCm = Math.max(10, Math.round(dims[1] * 100));
      const depthCm = Math.max(10, Math.round(dims[2] * 100));
      furniture.push({
        id: `rp-f-${objSeq++}`,
        name: mapped.name,
        category: mapped.category,
        widthCm,
        heightCm,
        depthCm,
        x: Number((tr.cxCm + shiftX).toFixed(1)),
        z: Number((tr.czCm + shiftZ).toFixed(1)),
        elevationCm: Math.max(0, Math.round(tr.cyCm - heightCm / 2)),
        rotationYDeg: tr.rotYDeg,
        color: mapped.color,
        visual: mapped.visual,
      });
    }
  }

  return {
    data: {
      corners: graph.corners,
      walls: graph.walls,
      openings,
      furniture,
    },
    wallCount: graph.walls.length,
    openingCount: openings.length,
    objectCount: furniture.length,
  };
}
