// The page head that Vite writes into index.html at build (and dev) time: title,
// description, theme color and favicon, all from the shared sources.
import { colors, FAVICON_ICO, logoMarkSvg } from '@huntclub/design';
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
    // favicon.ico (web/public, from the design icons script) for browsers without SVG icons.
    { tag: 'link', attrs: { rel: 'icon', href: `/${FAVICON_ICO.file}`, sizes: '48x48' } },
    { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: `/${FAVICON_FILE}` } },
  ];
}

/** The web font file (web/src/theme/fonts), preloaded so text does not wait for the CSS. */
const FONT_FILE = /Archivo-Latin-[\w-]+\.woff2$/;

/** Vite plugin: injects siteHeadTags(), preloads the font and emits the favicon from the logo mark. */
export function siteHead(): Plugin {
  return {
    name: 'huntclub-site-head',
    transformIndexHtml: (_html, ctx) => {
      const font = Object.keys(ctx.bundle ?? {}).find((name) => FONT_FILE.test(name));
      const preload = font
        ? [
            {
              tag: 'link',
              attrs: {
                rel: 'preload',
                as: 'font',
                type: 'font/woff2',
                href: `/${font}`,
                crossorigin: '',
              },
            },
          ]
        : [];
      return [...siteHeadTags(), ...preload].map((t) => ({ ...t, injectTo: 'head' as const }));
    },
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
