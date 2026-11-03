import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { planAutosavePlugin } from './src/server/planAutosavePlugin';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  plugins: [react(), planAutosavePlugin(root)],
  resolve: {
    dedupe: ['three'],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) {
            return 'three-core';
          }
          if (
            id.includes('node_modules/@react-three/drei') ||
            id.includes('node_modules/@react-three/fiber') ||
            id.includes('node_modules/three-stdlib') ||
            id.includes('node_modules/suspend-react') ||
            id.includes('node_modules/maath')
          ) {
            return 'r3f-ecosystem';
          }
          if (
            id.includes('node_modules/postprocessing') ||
            id.includes('node_modules/@react-three/postprocessing')
          ) {
            return 'postprocessing';
          }
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/') ||
            id.includes('node_modules/zustand/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'lucide';
          }
        },
      },
    },
  },
  test: {
    testTimeout: 15000,
  },
});
