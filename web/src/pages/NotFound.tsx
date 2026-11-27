import { ADMIN_PATH } from '@huntclub/shared/app';
import { Page } from '../components/Page';
import { ButtonLink } from '../components/ui';
import { useDocumentTitle } from '../title';

export const NOT_FOUND_TITLE = 'Page not found';

/**
 * Any path that is not a page. Inside the admin (`signedIn`, in the shell) it leads back to
 * the app; elsewhere, back to sign in.
 */
export function NotFound(props: { signedIn: boolean }) {
  useDocumentTitle(NOT_FOUND_TITLE);
  return (
    <Page
      title={NOT_FOUND_TITLE}
      description="This page does not exist. Check the link."
      actions={
        <ButtonLink variant="primary" href={ADMIN_PATH}>
          {props.signedIn ? 'Back to the app' : 'Back to sign in'}
        </ButtonLink>
      }
    />
  );
}
