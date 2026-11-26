import { ADMIN_PATH } from '@huntclub/shared/app';
import { useDocumentTitle } from '../title';

export const NOT_FOUND_TITLE = 'Page not found';

/**
 * Any path that is not a page. Inside the admin (`signedIn`) it leads back to the app;
 * elsewhere, back to sign in.
 */
export function NotFound(props: { signedIn: boolean }) {
  useDocumentTitle(NOT_FOUND_TITLE);
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <h1 id="not-found-title">{NOT_FOUND_TITLE}</h1>
      <p className="muted">This page does not exist. Check the link.</p>
      <a className="button primary" href={ADMIN_PATH}>
        {props.signedIn ? 'Back to the app' : 'Back to sign in'}
      </a>
    </section>
  );
}
