import { ADMIN_PATH, CHECKOUT_RETURN_PATHS } from '@huntclub/shared';
import { lazy, Suspense, type ReactNode } from 'react';
import type { WebClubServices } from './cloud';
import { Loading } from './components/Loading';
import { PublicShell } from './shell/PublicShell';

// Each entry path loads only its own code: the Checkout pages don't pull in the admin,
// and the admin doesn't pull in the mesh codec until an invite is made.
const App = lazy(() => import('./App').then((m) => ({ default: m.App })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));
const CheckoutReturn = lazy(() =>
  import('./pages/CheckoutReturn').then((m) => ({ default: m.CheckoutReturn })),
);

/**
 * The component kit (/app/#/_kit): every UI component in every state, for development and
 * review. Only `vite dev` and `npm run build:kit` (mode "kit") include it; a production
 * build drops this branch and never emits the kit's code.
 */
const KIT_ENABLED = import.meta.env.DEV || import.meta.env.MODE === 'kit';
export const KIT_HASH = '#/_kit';
const Kit = KIT_ENABLED ? lazy(() => import('./kit/Kit').then((m) => ({ default: m.Kit }))) : null;
/** The admin over sample data, for screenshots and review (/app/?demo=<scenario>): kit builds only. */
export const DEMO_PARAM = 'demo';
const Demo = KIT_ENABLED
  ? lazy(() => import('./demo/Demo').then((m) => ({ default: m.Demo })))
  : null;

/**
 * The page's real paths (WEB_PAGE_PATHS) need no sign-in; ADMIN_PATH (/app/) is the club
 * admin, with hash routes. The public site owns every other path; one that still lands
 * here gets Page not found.
 */
export function Root(
  props: WebClubServices & { location: Pick<Location, 'pathname' | 'href'> & { hash?: string } },
) {
  const { location, ...services } = props;
  const path = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, '') : '/';
  if (Kit && isAdminPath(path) && location.hash === KIT_HASH)
    return (
      <Suspense fallback={<Loading />}>
        <Kit />
      </Suspense>
    );
  const demo = new URL(location.href).searchParams.get(DEMO_PARAM);
  if (Demo && isAdminPath(path) && demo !== null)
    return (
      <Suspense fallback={<Loading />}>
        <Demo scenario={demo} />
      </Suspense>
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
  if (!isAdminPath(path))
    return (
      <Page>
        <NotFound signedIn={false} />
      </Page>
    );
  return (
    <Suspense fallback={<Loading />}>
      <App {...services} />
    </Suspense>
  );
}

/** The admin (ADMIN_PATH, served at /app/ with hash routes) and anything CloudFront sends under it. */
const ADMIN_ROOT = ADMIN_PATH.replace(/\/$/, '');
const isAdminPath = (path: string) => path === ADMIN_ROOT || path.startsWith(`${ADMIN_ROOT}/`);

function Page(props: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <PublicShell>{props.children}</PublicShell>
    </Suspense>
  );
}
