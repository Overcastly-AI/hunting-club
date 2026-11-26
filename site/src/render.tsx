import { renderToStaticMarkup } from 'react-dom/server';
import { PAGE_CONTENT } from './pages';
import { ROUTES, type SitePath } from './routes';
import { Document, type PageAssets } from './Shell';

/** One registered page as a complete static HTML document (no client JavaScript). */
export function renderPage(path: SitePath, assets: PageAssets): string {
  const route = ROUTES.find((r) => r.path === path);
  if (!route) throw new Error(`No route ${path}`);
  return `<!doctype html>${renderToStaticMarkup(
    <Document route={route} assets={assets}>
      {PAGE_CONTENT[path]()}
    </Document>,
  )}`;
}
