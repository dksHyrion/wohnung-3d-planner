import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { handlePlanRequest } from '../src/server/planAutosavePlugin';
import {
  isPlanDocument,
  readPlanAutosave,
  writePlanAutosave,
} from '../src/server/planAutosaveStore';
import { rememberPristinePlan, resetAutosaveRestoreForTests } from '../src/store/autosave';
import { adoptPlanFileIfBrowserHasOnlyExample } from '../src/store/planFile';

const plan = JSON.stringify({
  corners: [],
  walls: [],
  openings: [],
  furniture: [{ id: 'sofa', x: 10 }],
});

describe('Plansicherung als Datei', () => {
  const folders: string[] = [];

  afterEach(async () => {
    resetAutosaveRestoreForTests();
    await Promise.all(folders.splice(0).map((folder) => fs.rm(folder, { recursive: true, force: true })));
  });

  it('schreibt nur einen Plan und liest ihn wieder', async () => {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'plan-'));
    folders.push(folder);
    const file = path.join(folder, 'plan.json');

    expect(isPlanDocument({ corners: [], walls: [], openings: [], furniture: [] })).toBe(true);
    expect(await writePlanAutosave(file, 'kein plan')).toBe('invalid');
    expect(await writePlanAutosave(file, plan)).toBe('ok');
    expect(await readPlanAutosave(file)).toBe(plan);
  });

  it('legt die Datei über die Schnittstelle ab und gibt sie wieder heraus', async () => {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'plan-'));
    folders.push(folder);
    const file = path.join(folder, 'plan.json');

    const put = await callPlan('PUT', file, plan);
    expect(put.statusCode).toBe(204);
    const got = await callPlan('GET', file);
    expect(got.statusCode).toBe(200);
    expect(got.body).toBe(plan);

    const rejected = await callPlan('PUT', file, '{"hallo":true}');
    expect(rejected.statusCode).toBe(400);
    expect(await readPlanAutosave(file)).toBe(plan);
  });

  it('blockiert nicht-JSON PUT-Requests mit 415', async () => {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'plan-'));
    folders.push(folder);
    const file = path.join(folder, 'plan.json');

    const res = await callPlan('PUT', file, plan, { 'content-type': 'text/plain' });
    expect(res.statusCode).toBe(415);
  });

  it('blockiert Cross-Origin und böswillige Host/Origin Missmatches mit 403', async () => {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'plan-'));
    folders.push(folder);
    const file = path.join(folder, 'plan.json');

    const evilOrigin = await callPlan('PUT', file, plan, {
      'content-type': 'application/json',
      host: 'localhost:5173',
      origin: 'https://attacker.example.com',
    });
    expect(evilOrigin.statusCode).toBe(403);

    const crossSite = await callPlan('PUT', file, plan, {
      'content-type': 'application/json',
      'sec-fetch-site': 'cross-site',
    });
    expect(crossSite.statusCode).toBe(403);

    const validOrigin = await callPlan('PUT', file, plan, {
      'content-type': 'application/json',
      host: 'localhost:5173',
      origin: 'http://localhost:5173',
    });
    expect(validOrigin.statusCode).toBe(204);
  });

  it('holt die Datei nur, wenn im Browser die Beispielwohnung liegt', async () => {
    rememberPristinePlan('beispiel');
    const imported: string[] = [];
    await adoptPlanFileIfBrowserHasOnlyExample({
      exportJson: () => 'beispiel',
      importJson: (json) => {
        imported.push(json);
        return true;
      },
      save: () => {},
      read: async () => 'dein-plan',
    });
    expect(imported).toEqual(['dein-plan']);

    imported.length = 0;
    await adoptPlanFileIfBrowserHasOnlyExample({
      exportJson: () => 'schon-verschoben',
      importJson: (json) => {
        imported.push(json);
        return true;
      },
      save: () => {},
      read: async () => 'datei',
    });
    expect(imported).toEqual([]);
  });
});

async function callPlan(
  method: string,
  file: string,
  body?: string,
  headers: Record<string, string> = { 'content-type': 'application/json' }
): Promise<{ statusCode: number; body: string }> {
  const req = new EventEmitter() as IncomingMessage;
  req.method = method;
  req.headers = { ...headers };
  req.destroy = () => req;
  const response = {
    statusCode: 0,
    body: '',
    writableEnded: false,
    setHeader() {},
    end(data?: string) {
      this.body = data ?? '';
      this.writableEnded = true;
    },
  };
  const pending = handlePlanRequest(req, response as unknown as ServerResponse, file);
  if (body !== undefined) req.emit('data', Buffer.from(body));
  req.emit('end');
  await pending;
  return response;
}
