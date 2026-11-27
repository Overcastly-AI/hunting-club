import { ADMIN_PATH, type SignedInUser } from '@huntclub/shared';
import { Suspense, useEffect, useState } from 'react';
import { bundleBuildId, newerBuildIsLive } from './buildVersion';
import type { WebClubServices } from './cloud';
import { Loading } from './components/Loading';
import { Banner } from './components/ui';
import { SignIn } from './pages/SignIn';
import { NOT_FOUND_TITLE, NotFound } from './pages/NotFound';
import { Shell } from './shell/Shell';
import { currentPath, HOME_PATH, PAGES, type PagePath } from './shell/routes';
import { ADMIN_TITLE, useDocumentTitle } from './title';
import { SignedInUserContext } from './signedInUser';

const SIGN_IN_TITLE = 'Sign in';

/** Shown when part of the club cloud is not set up yet. */
const NOT_READY = 'The club service is not available yet. Check back soon.';

/** Shown on the sign-in screen when a kept session could not be refreshed. */
export const SESSION_EXPIRED = 'Your session expired. Sign in again.';

/**
 * - restoring: a refresh token was kept (browser storage); refreshing it first.
 * - signedOut: show sign-in (with `expired` only when the kept session could not be
 *   refreshed on load; a deliberate sign-out never says the session expired).
 * - signedIn: `email` is undefined when the token does not say who it is.
 */
type Auth =
  | { kind: 'restoring' }
  | { kind: 'signedOut'; expired: boolean }
  | { kind: 'signedIn'; user: SignedInUser | undefined };

export function App(props: WebClubServices) {
  const { session, api } = props;
  const [auth, setAuth] = useState<Auth>({ kind: 'restoring' });
  // The route asked for (deep link or reload). Sign-in never changes it, so the admin
  // lands on that page once signed in.
  const [path, setPath] = useState<PagePath | null>(currentPath);

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
          ? { kind: 'signedIn', user: await session.user() }
          : { kind: 'signedOut', expired: true };
      }
      // Only the first answer counts: a sign-in or sign-out meanwhile wins.
      if (live) setAuth((current) => (current.kind === 'restoring' ? next : current));
    })();
    return () => {
      live = false;
    };
  }, [session]);

  const notReady = !session || (auth.kind === 'signedIn' && !api);
  const page = PAGES.find((p) => p.path === path);
  useDocumentTitle(
    ...(notReady || auth.kind === 'restoring'
      ? []
      : auth.kind === 'signedIn'
        ? [page?.label ?? NOT_FOUND_TITLE, ADMIN_TITLE]
        : [SIGN_IN_TITLE]),
  );

  if (notReady) {
    return (
      <main className="layout">
        <Banner tone="warning">{NOT_READY}</Banner>
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
      <main id="main">
        <SignIn
          session={session}
          notice={auth.kind === 'signedOut' && auth.expired ? SESSION_EXPIRED : undefined}
          onSignedIn={() => void session.user().then((user) => setAuth({ kind: 'signedIn', user }))}
        />
      </main>
    );
  }

  // Back to /app/ with no hash (the next sign-in starts on the first page), then revoke the
  // refresh token and clear it from this browser. Never "session expired": this was asked for.
  const signOut = () => {
    window.history.replaceState(null, '', ADMIN_PATH);
    setPath(HOME_PATH);
    setAuth({ kind: 'signedOut', expired: false });
    void session.signOut();
  };

  return (
    <Shell api={api} user={auth.user} path={page ? page.path : null} onSignOut={signOut}>
      {/* Keyed by page: each page mounts fresh, and its heading takes focus. */}
      <SignedInUserContext.Provider value={auth.user}>
        <Suspense key={page?.path ?? ''} fallback={<Loading />}>
          {page ? page.render(api) : <NotFound signedIn />}
        </Suspense>
      </SignedInUserContext.Provider>
    </Shell>
  );
}
