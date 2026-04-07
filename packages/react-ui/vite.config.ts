import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [react(), dts({ tsconfigPath: './tsconfig.json', exclude: ['**/*.spec.*'] })],
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        map: 'src/map.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'maplibre-gl', 'pmtiles'],
    },
  },
});
