import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';
import {
  PLAN_AUTOSAVE_MAX_BYTES,
  PLAN_AUTOSAVE_RELATIVE,
  readPlanAutosave,
  writePlanAutosave,
} from './planAutosaveStore';

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        chunks.length = 0;
        req.resume();
        reject(new Error('too-large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks).toString('utf8'));
      }
    });
    req.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

export function planAutosavePlugin(root: string): Plugin {
  const filePath = path.join(root, PLAN_AUTOSAVE_RELATIVE);
  return {
    name: 'plan-autosave',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/api/plan') {
          next();
          return;
        }
        await handlePlanRequest(req, res, filePath);
      });
    },
  };
}

export function isRequestOriginAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  const secFetchSite = req.headers['sec-fetch-site'];

  if (secFetchSite === 'cross-site') {
    return false;
  }

  if (!origin) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const hostHeader = req.headers.host;
    if (!hostHeader) return false;

    if (originUrl.host === hostHeader) return true;

    const [originHostname, originPort = ''] = originUrl.host.split(':');
    const [hostHostname, hostPort = ''] = hostHeader.split(':');
    const isLocalOrigin = originHostname === 'localhost' || originHostname === '127.0.0.1';
    const isLocalHost = hostHostname === 'localhost' || hostHostname === '127.0.0.1';

    if (isLocalOrigin && isLocalHost && originPort === hostPort) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export async function handlePlanRequest(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string
): Promise<void> {
  try {
    await routePlanRequest(req, res, filePath);
  } catch {
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.end();
    }
  }
}

async function routePlanRequest(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string
): Promise<void> {
  if (!isRequestOriginAllowed(req)) {
    res.statusCode = 403;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    const text = await readPlanAutosave(filePath);
    if (!text) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('x-content-type-options', 'nosniff');
    res.end(text);
    return;
  }

  if (req.method === 'PUT') {
    const contentType = (req.headers['content-type'] ?? '').toLowerCase();
    if (!contentType.includes('application/json')) {
      res.statusCode = 415;
      res.end();
      return;
    }

    let body = '';
    try {
      body = await readBody(req, PLAN_AUTOSAVE_MAX_BYTES);
    } catch (err) {
      res.statusCode =
        err instanceof Error && err.message === 'too-large' ? 413 : 400;
      res.end();
      return;
    }
    const result = await writePlanAutosave(filePath, body);
    res.statusCode =
      result === 'ok' ? 204 : result === 'too-large' ? 413 : 400;
    res.end();
    return;
  }

  res.statusCode = 405;
  res.end();
}
