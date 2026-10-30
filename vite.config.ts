import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { planAutosavePlugin } from './src/server/planAutosavePlugin';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react(), planAutosavePlugin(root)],
  resolve: {
    dedupe: ['three'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  // @ts-expect-error vitest config field
  test: {
    testTimeout: 15000,
  },
});
