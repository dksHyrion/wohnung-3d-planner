import { isPristinePlan } from './autosave';

export const PLAN_FILE_URL = '/api/plan';

export async function writePlanFile(json: string): Promise<boolean> {
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
