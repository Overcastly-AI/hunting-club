import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { PAGE_CONTENT } from './pages';
import { Join } from './pages/Join';
import { NotFound } from './pages/NotFound';
import {
  HASH_FORWARD_SCRIPT,
  JOIN_PAGE,
  NOT_FOUND_PAGE,
  ogImagePath,
  ROUTES,
  type SitePath,
} from './routes';
import { STRUCTURED_DATA } from './structuredData';
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
  const meta: PageMeta = {
    ...route,
    ogImage: ogImagePath(path),
    ...(STRUCTURED_DATA[path] ? { structuredData: STRUCTURED_DATA[path] } : {}),
    ...(script ? { script } : {}),
  };
  return html(meta, assets, PAGE_CONTENT[path]());
}

/** The branded 404 page (noindex, no canonical). */
export function renderNotFound(assets: PageAssets): string {
  return html(NOT_FOUND_PAGE, assets, <NotFound />);
}

/**
 * The /join invite page, with its self-hosted script: noindex with no canonical, no
 * referrer, and one generic preview card (social scrapers never see the fragment).
 */
export function renderJoin(assets: PageAssets, scriptSrc: string): string {
  const { path, title, description } = JOIN_PAGE;
  const meta = { path, title, description, scriptSrc, noindex: true, noReferrer: true };
  return html({ ...meta, ogImage: ogImagePath(path) }, assets, <Join />);
}
