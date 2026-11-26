// The page head that Vite writes into index.html at build (and dev) time: title,
// description, theme color and favicon, all from the shared sources.
import { colors, logoMarkSvg } from '@huntclub/design';
import { APP_DESCRIPTION, APP_NAME } from '@huntclub/shared/app';
import type { Plugin } from 'vite';

/** The favicon's file name in web/dist (served from the site root). */
export const FAVICON_FILE = 'favicon.svg';

/** Tags added to <head>; index.html carries no copy of any of these values. */
export function siteHeadTags() {
  return [
    { tag: 'title', children: APP_NAME },
    { tag: 'meta', attrs: { name: 'description', content: APP_DESCRIPTION } },
    { tag: 'meta', attrs: { name: 'theme-color', content: colors.surface } },
    { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: `/${FAVICON_FILE}` } },
  ];
}

/** Vite plugin: injects siteHeadTags() and emits the favicon from the logo mark. */
export function siteHead(): Plugin {
  return {
    name: 'huntclub-site-head',
    transformIndexHtml: () => siteHeadTags().map((t) => ({ ...t, injectTo: 'head' as const })),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: FAVICON_FILE, source: logoMarkSvg() });
    },
    configureServer(server) {
      server.middlewares.use(`/${FAVICON_FILE}`, (_req, res) => {
        res.setHeader('content-type', 'image/svg+xml');
        res.end(logoMarkSvg());
      });
    },
  };
}
