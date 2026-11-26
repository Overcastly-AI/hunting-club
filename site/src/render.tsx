import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { PAGE_CONTENT } from './pages';
import { NotFound } from './pages/NotFound';
import { HASH_FORWARD_SCRIPT, NOT_FOUND_PAGE, ROUTES, type SitePath } from './routes';
import { Document, type PageAssets, type PageMeta } from './Shell';

const html = (meta: PageMeta, assets: PageAssets, content: ReactNode) =>
  `<!doctype html>${renderToStaticMarkup(
    <Document meta={meta} assets={assets}>
      {content}
    </Document>,
  )}`;

/** One registered page as a complete static HTML document. */
export function renderPage(path: SitePath, assets: PageAssets): string {
  const route = ROUTES.find((r) => r.path === path);
  if (!route) throw new Error(`No route ${path}`);
  const script = path === '/' ? HASH_FORWARD_SCRIPT : undefined;
  return html({ ...route, ...(script ? { script } : {}) }, assets, PAGE_CONTENT[path]());
}

/** The branded 404 page (noindex, no canonical). */
export function renderNotFound(assets: PageAssets): string {
  return html(NOT_FOUND_PAGE, assets, <NotFound />);
}
