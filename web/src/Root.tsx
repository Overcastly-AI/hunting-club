import { CHECKOUT_RETURN_PATHS, JOIN_PATH } from '@huntclub/shared';
import type { ReactNode } from 'react';
import { App } from './App';
import type { WebClubServices } from './cloud';
import { CheckoutReturn } from './pages/CheckoutReturn';
import { Join } from './pages/Join';

/**
 * The page's real paths (WEB_PAGE_PATHS, served as index.html by CloudFront) need no
 * sign-in. Everything else is the club admin, with hash routes.
 */
export function Root(props: WebClubServices & { location: Pick<Location, 'pathname' | 'href'> }) {
  const { location, ...services } = props;
  const path = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, '') : '/';
  if (path === JOIN_PATH)
    return (
      <Page>
        <Join href={location.href} />
      </Page>
    );
  if (path === CHECKOUT_RETURN_PATHS.success)
    return (
      <Page>
        <CheckoutReturn outcome="done" />
      </Page>
    );
  if (path === CHECKOUT_RETURN_PATHS.cancel)
    return (
      <Page>
        <CheckoutReturn outcome="cancel" />
      </Page>
    );
  return <App {...services} />;
}

function Page(props: { children: ReactNode }) {
  return <main className="layout">{props.children}</main>;
}
