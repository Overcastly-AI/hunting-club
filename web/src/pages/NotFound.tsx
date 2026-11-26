import { useDocumentTitle } from '../title';

export const NOT_FOUND_TITLE = 'Page not found';

/** Any path that is not a page (CloudFront sends every page path here; see infra web-pages). */
export function NotFound() {
  useDocumentTitle(NOT_FOUND_TITLE);
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <h1 id="not-found-title">{NOT_FOUND_TITLE}</h1>
      <p className="muted">This page does not exist. Check the link, or go back and sign in.</p>
      <a className="button primary" href="/">
        Back to sign in
      </a>
    </section>
  );
}
