import fs from 'node:fs/promises';
import path from 'node:path';

/** Liegt neben dem Programm, nicht im Ordner der abgepausten Grundrisse. */
export const PLAN_AUTOSAVE_RELATIVE = '.autosave/plan.json';
export const PLAN_AUTOSAVE_MAX_BYTES = 1_500_000;

export function isPlanDocument(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Record<string, unknown>;
  return (
    Array.isArray(plan.corners) &&
    Array.isArray(plan.walls) &&
    Array.isArray(plan.openings) &&
    Array.isArray(plan.furniture)
  );
}

export async function readPlanAutosave(filePath: string): Promise<string | null> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

export async function writePlanAutosave(
  filePath: string,
  body: string
): Promise<'ok' | 'invalid' | 'too-large'> {
  if (Buffer.byteLength(body) > PLAN_AUTOSAVE_MAX_BYTES) return 'too-large';
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return 'invalid';
  }
  if (!isPlanDocument(parsed)) return 'invalid';
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await fs.writeFile(temporary, body);
  await fs.rename(temporary, filePath);
  return 'ok';
}
