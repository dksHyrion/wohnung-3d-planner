export const AUTOSAVE_DELAY_MS = 400;

export interface PlanSlice {
  corners: unknown;
  walls: unknown;
  openings: unknown;
  furniture: unknown;
  rugs: unknown;
  roomLabels: unknown;
  backgroundImage: unknown;
}

export function planContentChanged(prev: PlanSlice, next: PlanSlice): boolean {
  return (
    prev.corners !== next.corners ||
    prev.walls !== next.walls ||
    prev.openings !== next.openings ||
    prev.furniture !== next.furniture ||
    prev.rugs !== next.rugs ||
    prev.roomLabels !== next.roomLabels ||
    prev.backgroundImage !== next.backgroundImage
  );
}

let pristinePlanJson: string | null = null;

const generationHost = globalThis as {
  __wohnungStoreGeneration?: number;
  __wohnungAutosaveLoadedGeneration?: number;
};

/** true, wenn das Beispiel einen anderen, schon gespeicherten Plan ersetzen würde. */
export function wouldClobberSavedPlan(existingJson: string | null, nextJson: string): boolean {
  return Boolean(
    existingJson &&
      pristinePlanJson &&
      nextJson === pristinePlanJson &&
      existingJson !== nextJson
  );
}

export function rememberPristinePlan(json: string): void {
  pristinePlanJson = json;
}

export function isPristinePlan(json: string): boolean {
  return pristinePlanJson !== null && json === pristinePlanJson;
}

export function nextFloorplanStoreGeneration(): number {
  const next = (generationHost.__wohnungStoreGeneration ?? 0) + 1;
  generationHost.__wohnungStoreGeneration = next;
  return next;
}

/**
 * Liest den gespeicherten Plan, wenn der Speicher neu erzeugt wurde.
 * Ein erneuter Aufruf für dieselbe Erzeugung lässt den offenen Plan stehen.
 */
export function restoreAutosaveForGeneration(generation: number, load: () => boolean): boolean {
  if (generationHost.__wohnungAutosaveLoadedGeneration === generation) return false;
  generationHost.__wohnungAutosaveLoadedGeneration = generation;
  return load();
}

export function resetAutosaveRestoreForTests(): void {
  delete generationHost.__wohnungAutosaveLoadedGeneration;
  pristinePlanJson = null;
}

export function createAutosaveScheduler(
  save: (json: string) => void,
  delayMs = AUTOSAVE_DELAY_MS
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingJson: string | null = null;

  const writePending = () => {
    const json = pendingJson;
    pendingJson = null;
    if (json) save(json);
  };

  return {
    /**
     * Der Text wird beim Ändern festgehalten. Ein späterer Flush schreibt diesen Text,
     * auch wenn der offene Plan inzwischen auf das Beispiel zurückgefallen ist.
     */
    notify(prev: PlanSlice, next: PlanSlice, toJson: () => string) {
      if (!planContentChanged(prev, next)) return;
      pendingJson = toJson();
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        writePending();
      }, delayMs);
    },
    /** Schreibt sofort, wenn noch ein verzögertes Speichern wartet. */
    flush() {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
      writePending();
    },
  };
}
