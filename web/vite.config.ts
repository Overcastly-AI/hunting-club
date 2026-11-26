import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
// Environment identifiers have one source: infra's typed config (never retyped here).
import { dev } from '../infra/config/dev';
import type { WebConfig } from './src/config';

const webConfig: WebConfig = {
  envName: dev.name,
  region: dev.region,
  userPoolId: dev.cognito.userPoolId,
  webClientId: dev.cognito.webClientId ?? null,
};

export default defineConfig({
  plugins: [react()],
  define: { __WEB_CONFIG__: JSON.stringify(webConfig) },
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
