// Writes the theme bootstrap (themeBootstrapJs from @huntclub/design) to its own file and
// loads it first in <head>, as a classic (blocking) script: it sets data-theme on <html>
// from the reader's stored choice before first paint, so there is no flash of the wrong
// theme. A file, not an inline script, so the Content-Security-Policy stays script-src 'self'.
import { createHash } from 'node:crypto';
import { themeBootstrapJs } from '@huntclub/design';
import type { Plugin } from 'vite';

/** Served as is by `vite dev`; the build writes a fingerprinted copy under assets/. */
const DEV_FILE = 'theme-bootstrap.js';

/** The fingerprinted file name the build writes. */
export function themeBootstrapFileName(js = themeBootstrapJs()): string {
  const hash = createHash('sha256').update(js).digest('hex').slice(0, 10);
  return `assets/theme-${hash}.js`;
}

export function themeBootstrap(): Plugin {
  let base = '/';
  let file = DEV_FILE;
  return {
    name: 'huntclub-theme-bootstrap',
    configResolved(config) {
      base = config.base;
      // The name is a pure function of the script, so index.html can link it before it is written.
      if (config.command === 'build') file = themeBootstrapFileName();
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: file, source: themeBootstrapJs() });
    },
    configureServer(server) {
      server.middlewares.use(`${base}${DEV_FILE}`, (_req, res) => {
        res.setHeader('content-type', 'text/javascript');
        res.end(themeBootstrapJs());
      });
    },
    transformIndexHtml: () => [
      { tag: 'script', attrs: { src: `${base}${file}` }, injectTo: 'head' as const },
    ],
  };
}
