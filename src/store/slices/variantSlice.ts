import type { LayoutVariant } from '../../core/types';
import { cloneVariantPayload } from '../../core/layoutVariants';
import type { StoreDeps } from '../deps';
import type { FloorplanState } from '../state';

export type VariantActions = Pick<
  FloorplanState,
  | 'saveLayoutVariant'
  | 'switchLayoutVariant'
  | 'setGhostVariantId'
  | 'renameLayoutVariant'
  | 'deleteLayoutVariant'
>;

export function createVariantSlice(deps: StoreDeps): VariantActions {
  const { get, set, setWithCollisions, generateId } = deps;

  return {
    saveLayoutVariant: (name) => {
      const state = get();
      const id = generateId('var');
      const letter = String.fromCharCode(65 + (state.layoutVariants.length % 26));
      const fallbackName =
        state.language === 'en' ? `Variant ${letter}` : `Variante ${letter}`;
      const cleanName = name?.trim() || fallbackName;

      const snapshot = cloneVariantPayload({
        furniture: state.furniture,
        rugs: state.rugs,
      });

      const variant: LayoutVariant = {
        id,
        name: cleanName,
        createdAt: new Date().toISOString(),
        furniture: snapshot.furniture,
        rugs: snapshot.rugs,
      };

      setWithCollisions({
        layoutVariants: [...state.layoutVariants, variant],
        activeVariantId: id,
      });
      return id;
    },

    switchLayoutVariant: (variantId) => {
      const state = get();
      if (state.activeVariantId === variantId) return;
      const target = state.layoutVariants.find((v) => v.id === variantId);
      if (!target) return;

      // Preserve current layout edits back into the currently active variant before switching
      const updatedVariants = state.activeVariantId
        ? state.layoutVariants.map((v) => {
            if (v.id !== state.activeVariantId) return v;
            const synced = cloneVariantPayload({
              furniture: state.furniture,
              rugs: state.rugs,
            });
            return {
              ...v,
              furniture: synced.furniture,
              rugs: synced.rugs,
            };
          })
        : state.layoutVariants;

      const loaded = cloneVariantPayload({
        furniture: target.furniture,
        rugs: target.rugs,
      });

      setWithCollisions({
        layoutVariants: updatedVariants,
        activeVariantId: target.id,
        ghostVariantId:
          state.ghostVariantId === target.id ? null : state.ghostVariantId,
        furniture: loaded.furniture,
        rugs: loaded.rugs,
        selectedId: null,
        selectedType: null,
        activeAlignmentGuides: [],
      });
    },

    setGhostVariantId: (variantId) => {
      const state = get();
      if (variantId === null) {
        if (state.ghostVariantId !== null) set({ ghostVariantId: null });
        return;
      }
      if (variantId === state.activeVariantId) {
        set({ ghostVariantId: null });
        return;
      }
      const exists = state.layoutVariants.some((v) => v.id === variantId);
      set({ ghostVariantId: exists ? variantId : null });
    },

    renameLayoutVariant: (variantId, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const state = get();
      if (!state.layoutVariants.some((v) => v.id === variantId)) return;
      setWithCollisions({
        layoutVariants: state.layoutVariants.map((v) =>
          v.id === variantId ? { ...v, name: trimmed } : v
        ),
      });
    },

    deleteLayoutVariant: (variantId) => {
      const state = get();
      if (!state.layoutVariants.some((v) => v.id === variantId)) return;
      const next = state.layoutVariants.filter((v) => v.id !== variantId);
      setWithCollisions({
        layoutVariants: next,
        activeVariantId:
          state.activeVariantId === variantId ? null : state.activeVariantId,
        ghostVariantId:
          state.ghostVariantId === variantId ? null : state.ghostVariantId,
      });
    },
  };
}
