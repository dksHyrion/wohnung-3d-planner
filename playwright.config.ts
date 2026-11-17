import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

function resolveLocalChromiumPath(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  const candidates = [
    path.join(os.homedir(), '.cache/ms-playwright/chromium-1208/chrome-linux/chrome'),
    path.join(
      os.homedir(),
      '.cache/ms-playwright/chromium_headless_shell-1208/chrome-linux/headless_shell'
    ),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

const executablePath = resolveLocalChromiumPath();

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
      ],
    },
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
  },
});
