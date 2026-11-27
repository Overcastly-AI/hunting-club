// Rendering the admin in tests: signed in already (a kept session restores), on a given page.
import { ClubSession, memoryTokenStore } from '@huntclub/shared';
import { render, screen } from '@testing-library/react';
import { adminApi } from '../api/admin';
import { App } from '../App';
import { fakeClubClient, fakeCognitoAuth, fakeTokens, sampleData } from './fakeClubApi';

/** Follows a hash link, as the browser does. */
export function go(hash: string) {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** The admin over `data`, already signed in, opened at `hash`; resolves once the page shows. */
export async function renderSignedIn(data = sampleData(), hash = '') {
  window.location.hash = hash;
  const auth = fakeCognitoAuth();
  const session = new ClubSession(auth, memoryTokenStore(fakeTokens()));
  const client = fakeClubClient(data);
  const view = render(<App session={session} api={adminApi(client)} />);
  await screen.findByRole('navigation', { name: 'Club admin' });
  // The page's heading takes focus when it mounts: wait for it, so a menu opened next stays open.
  await screen.findByRole('heading', { level: 1 });
  return { ...view, auth, session, client };
}
