import { afterEach, describe, expect, it, vi } from 'vitest';

describe('planFile in static production builds', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('skips the /api/plan requests when the dev server API is unavailable', async () => {
    vi.stubEnv('DEV', false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();

    const { readPlanFile, writePlanFile } = await import('../src/store/planFile');

    expect(await readPlanFile()).toBeNull();
    expect(await writePlanFile('{}')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still talks to /api/plan in the dev server', async () => {
    vi.stubEnv('DEV', true);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '{"a":1}' });
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();

    const { readPlanFile } = await import('../src/store/planFile');

    expect(await readPlanFile()).toBe('{"a":1}');
    expect(fetchMock).toHaveBeenCalledWith('/api/plan');
  });
});
