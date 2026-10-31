import { FurnitureItem } from './types';
import { resolveFurnitureVisual } from './furnitureVisual';

/** Kasten im Modellraum. Ursprung ist die Möbelmitte, Y zeigt nach oben. */
export interface LocalPart {
  id: string;
  cx: number;
  cy: number;
  cz: number;
  widthCm: number;
  heightCm: number;
  depthCm: number;
}

export interface DiningChairPart extends LocalPart {
  seatSizeCm: number;
}

export const NIGHTSTAND_HEIGHT_CM = 35;
export const NIGHTSTAND_DEPTH_CM = 40;
/** Anhebung der Nachtkasten-Mitte über die reine halbe Höhe, wie bisher in der Kollision. */
export const NIGHTSTAND_LIFT_CM = 15;

export function bedHeadboardDepthCm(depthCm: number): number {
  return Math.max(10, Math.min(18, depthCm * 0.08));
}

export function bedHasNightstands(item: FurnitureItem): boolean {
  return (
    resolveFurnitureVisual(item) === 'bed' &&
    item.hasNightstands !== false &&
    (item.hasNightstands === true || item.widthCm >= 190)
  );
}

export function nightstandWidthCm(widthCm: number): number {
  return Math.min(30, widthCm * 0.15);
}

function bodyPart(item: FurnitureItem, id = 'body'): LocalPart {
  return {
    id,
    cx: 0,
    cy: 0,
    cz: 0,
    widthCm: item.widthCm,
    heightCm: item.heightCm,
    depthCm: item.depthCm,
  };
}

export function diningTableLayout(item: FurnitureItem): {
  top: LocalPart;
  chairs: DiningChairPart[];
} {
  const width = item.widthCm;
  const height = item.heightCm;
  const depth = item.depthCm;
  const legInsetX = Math.min(22, width * 0.12);
  const numChairsPerSide = width >= 210 ? 4 : width >= 170 ? 3 : 2;
  const chairSpacing = (width - legInsetX * 2) / numChairsPerSide;
  const seatSizeCm = Math.min(40, chairSpacing * 0.82);
  const chairHeight = Math.min(height, 75);
  const chairDepth = seatSizeCm * 0.95 + 4;
  const cy = chairHeight / 2 - height / 2;

  const chairs: DiningChairPart[] = [];
  for (const sideZ of [-1, 1]) {
    for (let cIdx = 0; cIdx < numChairsPerSide; cIdx++) {
      const cx = -width / 2 + legInsetX + (cIdx + 0.5) * chairSpacing;
      const cz = sideZ * (depth / 2 + 12);
      chairs.push({
        id: `chair-${sideZ}-${cIdx}`,
        cx,
        cy,
        cz,
        widthCm: seatSizeCm,
        heightCm: chairHeight,
        depthCm: chairDepth,
        seatSizeCm,
      });
    }
  }

  return { top: bodyPart(item, 'top'), chairs };
}

export function sectionalSofaLayout(item: FurnitureItem): {
  isSectional: boolean;
  chaiseWidth: number;
  regularWidth: number;
  regularDepth: number;
  main: LocalPart;
  chaise: LocalPart | null;
} {
  const width = item.widthCm;
  const height = item.heightCm;
  const depth = item.depthCm;
  const isSectional = resolveFurnitureVisual(item) === 'sectional-sofa';
  const chaiseWidth = isSectional ? Math.max(80, Math.min(105, width * 0.42)) : 0;
  const regularWidth = width - chaiseWidth;
  const regularDepth = isSectional ? Math.max(85, Math.min(100, depth * 0.6)) : depth;

  const main: LocalPart = {
    id: 'main',
    cx: isSectional ? -width / 2 + regularWidth / 2 : 0,
    cy: 0,
    cz: isSectional ? -depth / 2 + regularDepth / 2 : 0,
    widthCm: regularWidth,
    heightCm: height,
    depthCm: regularDepth,
  };

  const chaise: LocalPart | null = isSectional
    ? {
        id: 'chaise',
        cx: width / 2 - chaiseWidth / 2,
        cy: 0,
        cz: 0,
        widthCm: chaiseWidth,
        heightCm: height,
        depthCm: depth,
      }
    : null;

  return { isSectional, chaiseWidth, regularWidth, regularDepth, main, chaise };
}

export function bedLayout(item: FurnitureItem): {
  body: LocalPart;
  nightstands: LocalPart[];
} {
  if (!bedHasNightstands(item)) {
    return { body: bodyPart(item), nightstands: [] };
  }

  const nightstandW = nightstandWidthCm(item.widthCm);
  const headboardD = bedHeadboardDepthCm(item.depthCm);
  const cz = -item.depthCm / 2 + headboardD + 25;
  const centerX = item.widthCm / 2 + nightstandW / 2;
  const cy = NIGHTSTAND_HEIGHT_CM / 2 + NIGHTSTAND_LIFT_CM - item.heightCm / 2;

  const nightstand = (id: string, cx: number): LocalPart => ({
    id,
    cx,
    cy,
    cz,
    widthCm: nightstandW,
    heightCm: NIGHTSTAND_HEIGHT_CM,
    depthCm: NIGHTSTAND_DEPTH_CM,
  });

  return {
    body: bodyPart(item),
    nightstands: [nightstand('nightstand-left', -centerX), nightstand('nightstand-right', centerX)],
  };
}

export function osakaSofaBedLayout(item: FurnitureItem): { body: LocalPart; mattress: LocalPart } {
  const bodyDepth = Math.min(item.depthCm, 95);
  const backThickness = 18;
  const mattressDepth = Math.max(40, item.depthCm - backThickness);
  const mattressWidth = Math.max(40, item.widthCm - 32);

  const bodyCz = -item.depthCm / 2 + bodyDepth / 2;
  const mattressCz = -item.depthCm / 2 + backThickness + mattressDepth / 2;
  const mattressHeight = Math.min(item.heightCm * 0.45, 45);
  const mattressCy = -item.heightCm / 2 + mattressHeight / 2;

  const body: LocalPart = {
    id: 'sofa-body',
    cx: 0,
    cy: 0,
    cz: bodyCz,
    widthCm: item.widthCm,
    heightCm: item.heightCm,
    depthCm: bodyDepth,
  };

  const mattress: LocalPart = {
    id: 'mattress-open',
    cx: 0,
    cy: mattressCy,
    cz: mattressCz,
    widthCm: mattressWidth,
    heightCm: mattressHeight,
    depthCm: mattressDepth,
  };

  return { body, mattress };
}

/** Tragende Kästen, aus denen Bild und Kollision dieselbe Mitte lesen. */
export function layoutFurnitureParts(item: FurnitureItem): LocalPart[] {
  const visual = resolveFurnitureVisual(item);
  if (visual === 'boconcept-osaka' && (item.pose === 'open' || item.depthCm > 140)) {
    const layout = osakaSofaBedLayout(item);
    return [layout.body, layout.mattress];
  }
  if (visual === 'dining-table') {
    const layout = diningTableLayout(item);
    return [layout.top, ...layout.chairs];
  }
  if (visual === 'sectional-sofa') {
    const layout = sectionalSofaLayout(item);
    return layout.chaise ? [layout.main, layout.chaise] : [layout.main];
  }
  if (visual === 'bed') {
    const layout = bedLayout(item);
    return [layout.body, ...layout.nightstands];
  }
  return [bodyPart(item)];
}

/** Modellmitte in Weltkoordinaten, dieselbe Drehung wie die 3D-Gruppe. */
export function localPartWorldCenter(
  item: FurnitureItem,
  part: LocalPart
): { x: number; y: number; z: number } {
  const rad = (item.rotationYDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = part.cx * cos + part.cz * sin;
  const rz = -part.cx * sin + part.cz * cos;
  return {
    x: item.x + rx,
    y: item.elevationCm + item.heightCm / 2 + part.cy,
    z: item.z + rz,
  };
}
