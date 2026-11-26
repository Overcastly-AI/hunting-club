// Stamps each build with an id: defined in the bundle and written to version.json,
// so an open tab can tell when a newer build is live (src/buildVersion.ts).
import { randomUUID } from 'node:crypto';
import type { Plugin } from 'vite';
import { BUILD_ID_GLOBAL, BUILD_VERSION_FILE } from './src/buildVersion';

export function buildVersion(buildId: string = randomUUID()): Plugin {
  return {
    name: 'huntclub-build-version',
    config: () => ({ define: { [BUILD_ID_GLOBAL]: JSON.stringify(buildId) } }),
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: BUILD_VERSION_FILE,
        source: JSON.stringify({ buildId }),
      });
    },
  };
}
