import { APP_NAME } from '@huntclub/shared/app';
import { useEffect } from 'react';

/** Where the club admin pages say they are, between the page name and the app name. */
export const ADMIN_TITLE = 'Club admin';

/** "Roster · Club admin · Hunt Club Mesh": most specific first, the app name last. */
export function pageTitle(...parts: readonly string[]): string {
  return [...parts, APP_NAME].join(' · ');
}

/** Sets the browser tab title while the calling screen is shown. */
export function useDocumentTitle(...parts: readonly string[]): void {
  const title = pageTitle(...parts);
  useEffect(() => {
    document.title = title;
  }, [title]);
}
