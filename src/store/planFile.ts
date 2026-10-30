import { isPristinePlan } from './autosave';

export const PLAN_FILE_URL = '/api/plan';

/**
 * Die Plan-Datei-API gibt es nur im Vite-Dev-Server (`planAutosavePlugin`).
 * In statischen Produktions-Builds (z. B. GitHub Pages) entfällt die Anfrage.
 */
const PLAN_FILE_API_AVAILABLE = import.meta.env.DEV;

export async function writePlanFile(json: string): Promise<boolean> {
  if (!PLAN_FILE_API_AVAILABLE) return false;
  try {
    const response = await fetch(PLAN_FILE_URL, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: json,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function readPlanFile(): Promise<string | null> {
  if (!PLAN_FILE_API_AVAILABLE) return null;
  try {
    const response = await fetch(PLAN_FILE_URL);
    if (!response.ok) return null;
    const text = await response.text();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Liegt im Browser nur die Beispielwohnung, übernimmt die Datei neben dem Programm.
 * Ein echter Plan im Browser bleibt stehen. Eine Änderung während des Lesens auch.
 */
export async function adoptPlanFileIfBrowserHasOnlyExample(args: {
  exportJson: () => string;
  importJson: (json: string) => boolean;
  save: (json: string) => void;
  read?: () => Promise<string | null>;
}): Promise<void> {
  const before = args.exportJson();
  if (!isPristinePlan(before)) return;
  const remote = await (args.read ?? readPlanFile)();
  if (!remote || isPristinePlan(remote)) return;
  if (args.exportJson() !== before) return;
  if (args.importJson(remote)) args.save(remote);
}
