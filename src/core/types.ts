export const EPSILON_CM = 0.05;

export type ViewMode = '2d' | 'split' | '3d-iso' | '3d-persp';
export type EditorTool = 'select' | 'draw-wall' | 'add-door' | 'add-window' | 'measure' | 'calibrate-scale';

export interface Point2D {
  x: number;
  z: number;
}

export interface MeasureResult {
  start: { x: number; z: number };
  end: { x: number; z: number };
  distanceCm: number;
  dxCm: number;
  dzCm: number;
  formattedDistance: string;
}

export interface FurnitureClearanceResult {
  clearanceCm: number;
  isOverlapping: boolean;
  closestPoint1: { x: number; z: number };
  closestPoint2: { x: number; z: number };
}

export interface Corner {
  id: string;
  x: number; // cm
  z: number; // cm
}

export interface Wall {
  id: string;
  startCornerId: string;
  endCornerId: string;
  thicknessCm: number;
  heightCm: number;
}

export type OpeningType =
  | 'door'
  | 'window'
  | 'sliding-door'
  | 'passage'
  | 'balcony-door';

export type AlignmentGuideKind = 'flush' | 'center' | 'edge';

export interface AlignmentGuide {
  id: string;
  axis: 'x' | 'z' | 'wall';
  kind: AlignmentGuideKind;
  start: { x: number; z: number };
  end: { x: number; z: number };
  targetFurnitureId: string;
  label: string;
}

export interface WallOpening {
  id: string;
  wallId: string;
  type: OpeningType;
  offsetFromStartCm: number;
  widthCm: number;
  heightCm: number;
  sillHeightCm: number;
  swingDirection?: 'in-left' | 'in-right' | 'out-left' | 'out-right';
}

export type FurnitureCategory =
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'office'
  | 'storage'
  | 'bathroom'
  | 'decor'
  | 'custom';

export type FurnitureVisualType =
  | 'sofa'
  | 'sectional-sofa'
  | 'dining-table'
  | 'bed'
  | 'wardrobe'
  | 'desk'
  | 'coffee-table'
  | 'bookcase'
  | 'sideboard'
  | 'vanity'
  | 'kitchen-unit'
  | 'kitchen-island'
  | 'bathtub'
  | 'shower'
  | 'toilet'
  | 'washing-machine'
  | 'plant'
  | 'wall-picture'
  | 'picture-rail'
  | 'boconcept-osaka'
  | 'vitsoe-606'
  | 'artemide-tolomeo'
  | 'musterring-sorrent'
  | 'inwerk-masterlift'
  | 'steelcase-gesture'
  | 'desk-monitor'
  | 'regalraum-lium'
  | 'neona-viva'
  | 'generic-seating'
  | 'generic-table'
  | 'generic-storage'
  | 'generic-bed'
  | 'box';

export interface FurnitureItem {
  id: string;
  name: string;
  category: FurnitureCategory;
  widthCm: number;
  heightCm: number;
  depthCm: number;
  x: number;
  z: number;
  elevationCm: number;
  rotationYDeg: number;
  color: string;
  snappedWallId?: string | null;
  isRealFurniture?: boolean;
  brand?: string;
  modelName?: string;
  articleNumber?: string;
  notes?: string;
  visual?: FurnitureVisualType;
  catalogWidthCm?: number;
  catalogHeightCm?: number;
  catalogDepthCm?: number;
  clearanceZoneCm?: number;
  hasNightstands?: boolean;
  /** Zugeklappt oder ausgeklappt. Fehlt das Feld, gilt der zugeklappte Zustand. */
  pose?: 'closed' | 'open';
  /** Optionale Verknüpfung mit einem Träger-Möbel (z. B. Monitor steht auf Schreibtisch). */
  attachedToId?: string | null;
}

export type CollisionIssueType =
  | 'wall-exceeded'
  | 'corner-overflow'
  | 'wall-intersection'
  | 'furniture-intersection'
  | 'opening-blocked'
  | 'clearance-blocked';

export interface CollisionIssue {
  type: CollisionIssueType;
  message: string;
  overflowCm?: number;
  targetId?: string;
}

export interface FurnitureCollisionReport {
  furnitureId: string;
  hasCollision: boolean;
  issues: CollisionIssue[];
  clearancesCm: {
    leftCm: number | null;
    rightCm: number | null;
  };
}

export type FlooringType = 'microcement' | 'parquet' | 'tile';

export interface RoomPolygon {
  id: string;
  corners: Corner[];
  areaSqM: number;
  centroid: { x: number; z: number };
  netCorners: { x: number; z: number }[];
  netAreaSqM: number;
  flooringType?: FlooringType;
  name?: string;
}

/** A name anchored inside a room. The point decides which computed room receives it. */
export interface RoomLabel {
  name: string;
  x: number;
  z: number;
  flooringType?: FlooringType;
}

export interface AreaRug {
  id: string;
  name?: string;
  widthCm: number;
  depthCm: number;
  x: number;
  z: number;
  rotationYDeg?: number;
  color?: string;
}

export interface BackgroundImageOverlay {
  id: string;
  /** Laufzeit-Adresse. Pixel liegen unter imageId, nicht in dieser Zeichenkette. */
  url: string;
  imageId?: string;
  filename: string;
  xCm: number;
  zCm: number;
  widthCm: number;
  heightCm: number;
  rotationDeg: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  naturalWidthPx: number;
  naturalHeightPx: number;
}

export type {
  PassageSeverity,
  PassageClearance,
  PassageClearanceReport,
} from './ergonomicsEngine';

export interface FloorplanData {
  corners: Corner[];
  walls: Wall[];
  openings: WallOpening[];
  furniture: FurnitureItem[];
  rugs?: AreaRug[];
  roomLabels?: RoomLabel[];
  backgroundImage?: BackgroundImageOverlay | null;
}

