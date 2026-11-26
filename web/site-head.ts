// The page head that Vite writes into index.html at build (and dev) time: title,
// description, theme color, noindex and the favicons, all from the shared sources. The
// favicons themselves are served from the site root by the public site (site/).
import { colors, FAVICON_ICO, FAVICON_SVG, FONT_FILE_PATTERN, logoMarkSvg } from '@huntclub/design';
import { APP_DESCRIPTION, APP_NAME } from '@huntclub/shared/app';
import type { Plugin } from 'vite';

/** Tags added to <head>; index.html carries no copy of any of these values. */
export function siteHeadTags() {
  return [
    { tag: 'title', children: APP_NAME },
    { tag: 'meta', attrs: { name: 'description', content: APP_DESCRIPTION } },
    { tag: 'meta', attrs: { name: 'theme-color', content: colors.surface } },
    // The admin, /join and the Checkout pages are never search results.
    { tag: 'meta', attrs: { name: 'robots', content: 'noindex' } },
    { tag: 'link', attrs: { rel: 'icon', href: `/${FAVICON_ICO.file}`, sizes: '48x48' } },
    { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: `/${FAVICON_SVG}` } },
  ];
}

/** Vite plugin: injects siteHeadTags() and preloads the font (under the app's base path). */
export function siteHead(): Plugin {
  let base = '/';
  return {
    name: 'huntclub-site-head',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: (_html, ctx) => {
      const font = Object.keys(ctx.bundle ?? {}).find((name) => FONT_FILE_PATTERN.test(name));
      const preload = font
        ? [
            {
              tag: 'link',
              attrs: {
                rel: 'preload',
                as: 'font',
                type: 'font/woff2',
                href: `${base}${font}`,
                crossorigin: '',
              },
            },
          ]
        : [];
      return [...siteHeadTags(), ...preload].map((t) => ({ ...t, injectTo: 'head' as const }));
    },
    // `vite dev` has no public site beside it: serve the SVG favicon itself.
    configureServer(server) {
      server.middlewares.use(`/${FAVICON_SVG}`, (_req, res) => {
        res.setHeader('content-type', 'image/svg+xml');
        res.end(logoMarkSvg());
      });
    },
  };
}
