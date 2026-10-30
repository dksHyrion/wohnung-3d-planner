import { FurnitureItem, FurnitureVisualType } from './types';
import { VALID_FURNITURE_VISUAL_TYPES } from './furnitureVisualCatalog';

export { VALID_FURNITURE_VISUAL_TYPES };

export function isFurnitureVisualType(value: string): value is FurnitureVisualType {
  return VALID_FURNITURE_VISUAL_TYPES.has(value);
}

/**
 * Ein gesetztes, gültiges visual entscheidet das Bild.
 * Fehlt das Feld oder ist es unbekannt, erscheint eine Kiste.
 * Name, Marke und Maße wählen das Modell nicht.
 */
export function resolveFurnitureVisual(item: FurnitureItem): FurnitureVisualType {
  if (item.visual && isFurnitureVisualType(item.visual)) {
    return item.visual;
  }
  return 'box';
}
