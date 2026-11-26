import { useEffect, useState, type ReactNode } from 'react';
import type { ClubApi } from './api/types';
import type { AuthClient, SignedIn } from './auth/types';
import { Billing } from './pages/Billing';
import { MyClub } from './pages/MyClub';
import { Roster } from './pages/Roster';
import { SignIn } from './pages/SignIn';
import { StandsAndAreas } from './pages/StandsAndAreas';

/** Pages reachable once signed in, in navigation order. Hash routes: no server rewrites. */
export const PAGES = [
  { path: 'club', label: 'My club', render: (api: ClubApi) => <MyClub api={api} /> },
  { path: 'roster', label: 'Roster', render: (api: ClubApi) => <Roster api={api} /> },
  {
    path: 'stands',
    label: 'Stands and areas',
    render: (api: ClubApi) => <StandsAndAreas api={api} />,
  },
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

export function App(props: { auth: AuthClient; api: ClubApi }) {
  const [user, setUser] = useState<SignedIn | null>(null);
  const [path, setPath] = useState<PagePath>(currentPath);

  useEffect(() => {
    const onHash = () => setPath(currentPath());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!user) {
    return (
      <main className="layout">
        <SignIn auth={props.auth} onSignedIn={setUser} />
      </main>
    );
  }

  const page = PAGES.find((p) => p.path === path) ?? PAGES[0];
  return (
    <div className="layout">
      <nav className="nav" aria-label="Club admin">
        {PAGES.map((p) => (
          <a key={p.path} href={`#/${p.path}`} aria-current={p.path === path ? 'page' : undefined}>
            {p.label}
          </a>
        ))}
        <button className="button" type="button" onClick={() => setUser(null)}>
          Sign out
        </button>
      </nav>
      <main>{page.render(props.api)}</main>
      <p className="muted">Signed in as {user.email}</p>
    </div>
  );
}
