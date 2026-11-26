import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import type { ClubApi } from './api/types';
import { bundleBuildId, newerBuildIsLive } from './buildVersion';
import type { WebClubServices } from './cloud';
import { Loading } from './components/Loading';
import { SignIn } from './pages/SignIn';
import { ADMIN_TITLE, useDocumentTitle } from './title';
import { signedInEmail } from './tokenStore';

// Each admin page loads on first visit (the roster also pulls in the mesh codec and QR encoder).
const MyClub = lazy(() => import('./pages/MyClub').then((m) => ({ default: m.MyClub })));
const Roster = lazy(() => import('./pages/Roster').then((m) => ({ default: m.Roster })));
const StandsAndAreas = lazy(() =>
  import('./pages/StandsAndAreas').then((m) => ({ default: m.StandsAndAreas })),
);
const Harvests = lazy(() => import('./pages/Harvests').then((m) => ({ default: m.Harvests })));
const MapPacks = lazy(() => import('./pages/MapPacks').then((m) => ({ default: m.MapPacks })));
const Billing = lazy(() => import('./pages/Billing').then((m) => ({ default: m.Billing })));

/** Pages reachable once signed in, in navigation order. Hash routes: no server rewrites. */
export const PAGES = [
  { path: 'club', label: 'My club', render: (api: ClubApi) => <MyClub api={api} /> },
  { path: 'roster', label: 'Roster', render: (api: ClubApi) => <Roster api={api} /> },
  {
    path: 'stands',
    label: 'Stands and areas',
    render: (api: ClubApi) => <StandsAndAreas api={api} />,
  },
  { path: 'harvests', label: 'Harvests', render: (api: ClubApi) => <Harvests api={api} /> },
  { path: 'maps', label: 'Map packs', render: (api: ClubApi) => <MapPacks api={api} /> },
  { path: 'billing', label: 'Billing', render: (api: ClubApi) => <Billing api={api} /> },
] as const satisfies readonly {
  path: string;
  label: string;
  render: (api: ClubApi) => ReactNode;
}[];

type PagePath = (typeof PAGES)[number]['path'];

function currentPath(): PagePath {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return PAGES.find((p) => p.path === hash)?.path ?? PAGES[0].path;
}

const SIGN_IN_TITLE = 'Sign in';

/** Shown when part of the club cloud is not set up yet. */
const NOT_READY = 'The club service is not available yet. Check back soon.';

/** Shown on the sign-in screen when a kept session could not be refreshed. */
export const SESSION_EXPIRED = 'Your session expired. Sign in again.';

/**
 * - restoring: a refresh token was kept (browser storage); refreshing it first.
 * - signedOut: show sign-in (with `expired` when the kept session could not be refreshed).
 * - signedIn: `email` is undefined when the token does not say who it is.
 */
type Auth =
  | { kind: 'restoring' }
  | { kind: 'signedOut'; expired: boolean }
  | { kind: 'signedIn'; email: string | undefined };

export function App(props: WebClubServices) {
  const { session, api } = props;
  const [auth, setAuth] = useState<Auth>({ kind: 'restoring' });
  // The route asked for (deep link or reload). Sign-in never changes it, so the admin
  // lands on that page once signed in.
  const [path, setPath] = useState<PagePath>(currentPath);

  useEffect(() => {
    const onHash = () => {
      setPath(currentPath());
      // Reload into the new build (same hash route) so an old tab never shows an old page.
      void newerBuildIsLive(bundleBuildId()).then((stale) => stale && window.location.reload());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!session) return;
    let live = true;
    void (async () => {
      let next: Auth = { kind: 'signedOut', expired: false };
      if (await session.isSignedIn()) {
        next = (await session.refresh())
          ? { kind: 'signedIn', email: signedInEmail(await session.accessToken()) }
          : { kind: 'signedOut', expired: true };
      }
      if (live) setAuth(next);
    })();
    return () => {
      live = false;
    };
  }, [session]);

  const notReady = !session || (auth.kind === 'signedIn' && !api);
  const page = PAGES.find((p) => p.path === path) ?? PAGES[0];
  useDocumentTitle(
    ...(notReady || auth.kind === 'restoring'
      ? []
      : auth.kind === 'signedIn'
        ? [page.label, ADMIN_TITLE]
        : [SIGN_IN_TITLE]),
  );

  if (notReady) {
    return (
      <main className="layout">
        <p className="banner">{NOT_READY}</p>
      </main>
    );
  }

  if (auth.kind === 'restoring') {
    return (
      <main className="layout">
        <Loading />
      </main>
    );
  }

  if (auth.kind === 'signedOut' || !api) {
    return (
      <main className="layout">
        <SignIn
          session={session}
          notice={auth.kind === 'signedOut' && auth.expired ? SESSION_EXPIRED : undefined}
          onSignedIn={(email) => setAuth({ kind: 'signedIn', email })}
        />
      </main>
    );
  }

  // Revokes the refresh token and clears it from this browser.
  const signOut = () => {
    setAuth({ kind: 'signedOut', expired: false });
    void session.signOut();
  };

  return (
    <div className="layout">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="nav" aria-label="Club admin">
        {PAGES.map((p) => (
          <a key={p.path} href={`#/${p.path}`} aria-current={p.path === path ? 'page' : undefined}>
            {p.label}
          </a>
        ))}
        <button className="button" type="button" onClick={signOut}>
          Sign out
        </button>
      </nav>
      <main id="main">
        {/* Keyed by page: each page mounts fresh, and its heading takes focus. */}
        <Suspense key={page.path} fallback={<Loading />}>
          {page.render(api)}
        </Suspense>
      </main>
      {auth.email ? <p className="muted">Signed in as {auth.email}</p> : null}
    </div>
  );
}
