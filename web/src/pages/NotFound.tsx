import { ICON_SIZE } from '@huntclub/design';
import { ADMIN_PATH } from '@huntclub/shared/app';
import { MapPinOff } from 'lucide-react';
import { Page } from '../components/Page';
import { ButtonLink } from '../components/ui';
import { PAGES, pageHref, type PagePath } from '../shell/routes';
import { useDocumentTitle } from '../title';

export const NOT_FOUND_TITLE = 'Page not found';

/** Where Page not found leads a signed-in admin: the pages most people were heading for. */
export const NOT_FOUND_LINKS: readonly PagePath[] = ['club', 'roster'];

/**
 * Any path that is not a page: a map pin crossed out, then the way back. Inside the admin
 * (`signedIn`, in the shell) it links to My club and Roster; elsewhere, back to sign in.
 */
export function NotFound(props: { signedIn: boolean }) {
  useDocumentTitle(NOT_FOUND_TITLE);
  return (
    <Page title={NOT_FOUND_TITLE}>
      <div className="not-found">
        <span className="not-found__icon">
          <MapPinOff size={ICON_SIZE.empty} strokeWidth={1.5} aria-hidden />
        </span>
        <p className="form-note">
          {props.signedIn
            ? 'This page does not exist. Check the link, or go to one of these.'
            : 'This page does not exist. Check the link.'}
        </p>
        <div className="not-found__links">
          {props.signedIn ? (
            NOT_FOUND_LINKS.map((path, i) => {
              const page = PAGES.find((p) => p.path === path)!;
              return (
                <ButtonLink
                  key={path}
                  variant={i === 0 ? 'primary' : 'secondary'}
                  icon={page.icon}
                  // From any path: the admin's address with the page's hash route.
                  href={`${ADMIN_PATH}${pageHref(path)}`}
                >
                  {page.label}
                </ButtonLink>
              );
            })
          ) : (
            <ButtonLink variant="primary" href={ADMIN_PATH}>
              Back to sign in
            </ButtonLink>
          )}
        </div>
      </div>
    </Page>
  );
}
