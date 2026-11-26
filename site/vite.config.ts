import { defineConfig } from 'vitest/config';

/** `vite build --mode client`: the one browser script (the /join page's). */
export const CLIENT_MODE = 'client';
/** Entry of the /join page script; the prerender finds its built file in the manifest. */
export const JOIN_SCRIPT_ENTRY = 'src/join/main.ts';

/**
 * Two builds. First `--mode client` bundles the /join script into dist/assets (with a
 * manifest). Then the default build compiles src/prerender.tsx for Node (SSR), emitting
 * the fingerprinted font into dist/assets, and `node dist/.server/prerender.js` writes one
 * static HTML file per page (see src/routes.ts).
 */
export default defineConfig(({ mode }) => ({
  build:
    mode === CLIENT_MODE
      ? {
          outDir: 'dist',
          emptyOutDir: true,
          manifest: true,
          rollupOptions: {
            input: JOIN_SCRIPT_ENTRY,
            output: { entryFileNames: 'assets/join-[hash].js' },
          },
        }
      : {
          ssr: 'src/prerender.tsx',
          outDir: 'dist',
          // Keep the client build's script and manifest.
          emptyOutDir: false,
          ssrEmitAssets: true,
          rollupOptions: {
            output: {
              entryFileNames: '.server/[name].js',
              assetFileNames: 'assets/[name]-[hash][extname]',
            },
          },
        },
  // Workspace packages are TypeScript sources: bundle them rather than import them at run time.
  ssr: { noExternal: [/^@huntclub\//] },
  test: { environment: 'node', globals: true },
}));
