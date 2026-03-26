import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4200,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  resolve: {
    alias: {
      '@aspect/design-system': path.resolve(
        __dirname,
        '../../packages/design-system/index.css',
      ),
    },
    preserveSymlinks: true,
  },
});
