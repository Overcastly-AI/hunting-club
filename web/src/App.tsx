import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import type { ClubApi } from './api/types';
import type { WebClubServices } from './cloud';
import { Billing } from './pages/Billing';
import { Harvests } from './pages/Harvests';
import { MapPacks } from './pages/MapPacks';
import { MyClub } from './pages/MyClub';
import { SignIn } from './pages/SignIn';
import { StandsAndAreas } from './pages/StandsAndAreas';

// The roster pulls in the mesh join-link codec and QR encoder: load it on first visit.
const Roster = lazy(() => import('./pages/Roster').then((m) => ({ default: m.Roster })));

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

/** Shown when part of the club cloud is not set up yet. */
const NOT_READY = 'The club service is not available yet. Check back soon.';

export function App(props: WebClubServices) {
  const { session, api } = props;
  const [email, setEmail] = useState<string | null>(null);
  const [path, setPath] = useState<PagePath>(currentPath);

  useEffect(() => {
    const onHash = () => setPath(currentPath());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!session || (email && !api)) {
    return (
      <main className="layout">
        <p className="banner">{NOT_READY}</p>
      </main>
    );
  }

  if (!email || !api) {
    return (
      <main className="layout">
        <SignIn session={session} onSignedIn={setEmail} />
      </main>
    );
  }

  const signOut = () => {
    setEmail(null);
    void session.signOut();
  };

  const page = PAGES.find((p) => p.path === path) ?? PAGES[0];
  return (
    <div className="layout">
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
      <main>
        <Suspense fallback={<p className="muted">Loading…</p>}>{page.render(api)}</Suspense>
      </main>
      <p className="muted">Signed in as {email}</p>
    </div>
  );
}
