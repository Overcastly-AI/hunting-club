import { defineConfig } from 'vitest/config';

/**
 * The site has no client bundle: Vite builds src/prerender.tsx for Node (SSR), emitting
 * the fingerprinted font into dist/assets, then `node dist/.server/prerender.js` writes
 * one static HTML file per registered route (see src/routes.ts).
 */
export default defineConfig({
  build: {
    ssr: 'src/prerender.tsx',
    outDir: 'dist',
    emptyOutDir: true,
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
});
