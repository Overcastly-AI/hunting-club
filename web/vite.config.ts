import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { siteHead } from './site-head';

export default defineConfig({
  plugins: [react(), siteHead()],
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
