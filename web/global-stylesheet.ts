// Writes the admin's stylesheet (src/theme/global.ts) and its font to fingerprinted files
// at build time and links the stylesheet from index.html: no inline <style>, so the
// Content-Security-Policy (infra/src/security-headers.ts) needs no 'unsafe-inline'.
// `vite dev` injects the same stylesheet at run time instead (src/main.tsx).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Plugin } from 'vite';
import { globalCssFor } from './src/theme/global';

const FONT = '@huntclub/design/fonts/Archivo-Latin.woff2';

export function globalStylesheet(): Plugin {
  let base = '/';
  let cssFile: string | undefined;
  return {
    name: 'huntclub-global-stylesheet',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      base = config.base;
    },
    generateBundle() {
      const fontRef = this.emitFile({
        type: 'asset',
        name: 'Archivo-Latin.woff2',
        source: readFileSync(createRequire(import.meta.url).resolve(FONT)),
      });
      const css = globalCssFor(`${base}${this.getFileName(fontRef)}`);
      const hash = createHash('sha256').update(css).digest('hex').slice(0, 10);
      cssFile = `assets/global-${hash}.css`;
      this.emitFile({ type: 'asset', fileName: cssFile, source: css });
    },
    transformIndexHtml: () =>
      cssFile
        ? [
            {
              tag: 'link',
              attrs: { rel: 'stylesheet', href: `${base}${cssFile}` },
              injectTo: 'head' as const,
            },
          ]
        : [],
  };
}
