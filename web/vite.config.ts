import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { ADMIN_PATH } from '@huntclub/shared/app';
import { buildVersion } from './build-version';
import { globalStylesheet } from './global-stylesheet';
import { noEvalEntry } from './no-eval-entry';
import { siteHead } from './site-head';
import { themeBootstrap } from './theme-bootstrap';

export default defineConfig({
  // Served under /app/ (the public site is at the root): asset URLs are /app/assets/….
  base: ADMIN_PATH,
  plugins: [
    react(),
    noEvalEntry(),
    globalStylesheet(),
    siteHead(),
    themeBootstrap(),
    buildVersion(),
  ],
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
