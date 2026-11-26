import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { ADMIN_PATH } from '@huntclub/shared/app';
import { buildVersion } from './build-version';
import { siteHead } from './site-head';

export default defineConfig({
  // Served under /app/ (the public site is at the root): asset URLs are /app/assets/….
  base: ADMIN_PATH,
  plugins: [react(), siteHead(), buildVersion()],
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
