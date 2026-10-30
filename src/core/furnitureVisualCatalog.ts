import type { FurnitureVisualType } from './types';
import type {
  ArchitecturalModelType,
  GenericFurnitureSubType,
} from '../components/viewer3d/furniture/ArchitecturalFurniture3D';

export interface FurnitureVisualCatalogEntry {
  label: string;
  modelType: ArchitecturalModelType;
  genericSubType: GenericFurnitureSubType;
}

export const FURNITURE_VISUAL_CATALOG = {
  sofa: { label: 'Sofa (Linear)', modelType: 'sofa', genericSubType: 'box' },
  'sectional-sofa': { label: 'Ecksofa / L-Form', modelType: 'sofa', genericSubType: 'box' },
  'dining-table': {
    label: 'Esstisch mit Stühlen',
    modelType: 'dining-table',
    genericSubType: 'box',
  },
  bed: { label: 'Bett / Doppelbett', modelType: 'bed', genericSubType: 'box' },
  wardrobe: {
    label: 'Kleiderschrank (PAX)',
    modelType: 'generic',
    genericSubType: 'wardrobe',
  },
  desk: { label: 'Schreibtisch', modelType: 'generic', genericSubType: 'desk' },
  'coffee-table': {
    label: 'Couchtisch',
    modelType: 'generic',
    genericSubType: 'coffee-table',
  },
  sideboard: {
    label: 'Sideboard / Kommode',
    modelType: 'generic',
    genericSubType: 'sideboard',
  },
  bookcase: { label: 'Bücherregal', modelType: 'generic', genericSubType: 'wardrobe' },
  'kitchen-unit': { label: 'Küchenzeile', modelType: 'kitchen-unit', genericSubType: 'box' },
  'kitchen-island': { label: 'Kochinsel', modelType: 'kitchen-island', genericSubType: 'box' },
  'boconcept-osaka': {
    label: 'Designer: BoConcept Osaka',
    modelType: 'boconcept-osaka',
    genericSubType: 'box',
  },
  'vitsoe-606': {
    label: 'Designer: Vitsœ 606 Regal',
    modelType: 'vitsoe-606',
    genericSubType: 'box',
  },
  'artemide-tolomeo': {
    label: 'Designer: Artemide Tolomeo',
    modelType: 'artemide-tolomeo',
    genericSubType: 'box',
  },
  'musterring-sorrent': {
    label: 'Musterring Sorrent 200, Schiebetüren',
    modelType: 'musterring-sorrent',
    genericSubType: 'box',
  },
  'inwerk-masterlift': {
    label: 'Inwerk Masterlift 2, weiße Platte',
    modelType: 'inwerk-masterlift',
    genericSubType: 'box',
  },
  'steelcase-gesture': {
    label: 'Steelcase Gesture, Kopfstütze',
    modelType: 'steelcase-gesture',
    genericSubType: 'box',
  },
  'desk-monitor': {
    label: 'Monitor auf der Tischplatte',
    modelType: 'desk-monitor',
    genericSubType: 'box',
  },
  'regalraum-lium': {
    label: 'Regalraum LIUM L-1x4',
    modelType: 'regalraum-lium',
    genericSubType: 'box',
  },
  'neona-viva': { label: 'Neona Viva', modelType: 'neona-viva', genericSubType: 'box' },
  bathtub: { label: 'Badewanne', modelType: 'bathtub', genericSubType: 'box' },
  shower: { label: 'Duschkabine', modelType: 'shower', genericSubType: 'box' },
  toilet: { label: 'Wand-WC', modelType: 'toilet', genericSubType: 'box' },
  'washing-machine': {
    label: 'Waschmaschine',
    modelType: 'washing-machine',
    genericSubType: 'box',
  },
  plant: { label: 'Zimmerpflanze', modelType: 'plant', genericSubType: 'box' },
  'wall-picture': { label: 'Wandbild', modelType: 'wall-picture', genericSubType: 'box' },
  'picture-rail': { label: 'Galerieschiene', modelType: 'picture-rail', genericSubType: 'box' },
  'generic-table': {
    label: 'Generischer Tisch (Architektur)',
    modelType: 'generic',
    genericSubType: 'table',
  },
  'generic-seating': {
    label: 'Generischer Sessel/Sitz (Architektur)',
    modelType: 'generic',
    genericSubType: 'seating',
  },
  'generic-storage': {
    label: 'Generischer Schrank/Regal (Architektur)',
    modelType: 'generic',
    genericSubType: 'storage',
  },
  'generic-bed': {
    label: 'Generisches Bett (Architektur)',
    modelType: 'generic',
    genericSubType: 'bed',
  },
  vanity: { label: 'Waschtisch', modelType: 'generic', genericSubType: 'vanity' },
  box: { label: 'Schlichter Quader (Box)', modelType: 'generic', genericSubType: 'box' },
} satisfies Record<FurnitureVisualType, FurnitureVisualCatalogEntry>;

export const VALID_FURNITURE_VISUAL_TYPES: ReadonlySet<string> = new Set(
  Object.keys(FURNITURE_VISUAL_CATALOG)
);

export const FURNITURE_VISUAL_OPTIONS: { value: FurnitureVisualType; label: string }[] = (
  Object.entries(FURNITURE_VISUAL_CATALOG) as [FurnitureVisualType, FurnitureVisualCatalogEntry][]
).map(([value, entry]) => ({ value, label: entry.label }));
