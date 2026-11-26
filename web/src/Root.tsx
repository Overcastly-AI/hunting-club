import { CHECKOUT_RETURN_PATHS, JOIN_PATH } from '@huntclub/shared';
import { lazy, Suspense, type ReactNode } from 'react';
import type { WebClubServices } from './cloud';

// Each entry path loads only its own code: the join page doesn't pull in the admin,
// and the admin doesn't pull in the mesh codec until an invite is made.
const App = lazy(() => import('./App').then((m) => ({ default: m.App })));
const Join = lazy(() => import('./pages/Join').then((m) => ({ default: m.Join })));
const CheckoutReturn = lazy(() =>
  import('./pages/CheckoutReturn').then((m) => ({ default: m.CheckoutReturn })),
);

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
  return (
    <Suspense fallback={<Loading />}>
      <App {...services} />
    </Suspense>
  );
}

function Loading() {
  return <p className="muted">Loading…</p>;
}

function Page(props: { children: ReactNode }) {
  return (
    <main className="layout">
      <Suspense fallback={<Loading />}>{props.children}</Suspense>
    </main>
  );
}
