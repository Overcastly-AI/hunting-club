import { decodeJoinUrl, JOIN_WEB_PATH } from '@huntclub/mesh';
import { WEB_DOMAINS } from '@huntclub/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { mockClubApi, sampleData } from '../api/mock';
import { App } from '../App';
import { DEMO_CODE, demoAuthClient } from '../auth/demo';

async function requestCode() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dale@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
  return screen.findByLabelText('6-digit code');
}

async function signIn() {
  fireEvent.change(await requestCode(), { target: { value: DEMO_CODE } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('navigation', { name: 'Club admin' });
}

function go(hash: string) {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function renderApp(api = mockClubApi()) {
  window.location.hash = '';
  return render(<App auth={demoAuthClient()} api={api} />);
}

describe('sign in', () => {
  it('signs in with an email and a 6-digit code (demo mode says so)', async () => {
    renderApp();
    expect(screen.getByText(/Demo mode/)).toBeTruthy();
    await signIn();
    expect(screen.getByText('Signed in as dale@example.com')).toBeTruthy();
  });

  it('explains a wrong code and stays on the code step', async () => {
    renderApp();
    fireEvent.change(await requestCode(), { target: { value: '999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/code did not work/);
    expect(screen.getByLabelText('6-digit code')).toBeTruthy();
  });

  it('keeps only digits and needs all six', async () => {
    renderApp();
    const input = (await requestCode()) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12a4' } });
    expect(input.value).toBe('124');
    const submit = screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});

describe('club pages', () => {
  it('shows the club, with every page in the navigation', async () => {
    renderApp();
    await signIn();
    expect(await screen.findByText('Oak Ridge Hunt Club')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Club admin' });
    for (const label of ['My club', 'Roster', 'Stands and areas', 'Billing']) {
      expect(within(nav).getByRole('link', { name: label })).toBeTruthy();
    }
  });

  it('offers to create a club when there is none', async () => {
    renderApp(mockClubApi({ ...sampleData(), club: null }));
    await signIn();
    fireEvent.change(await screen.findByLabelText('Club name'), {
      target: { value: 'Pine Hollow' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create club' }));
    expect(await screen.findByText('Pine Hollow')).toBeTruthy();
  });

  it('lists the roster and makes an invite QR carrying a club join link', async () => {
    renderApp();
    await signIn();
    go('#/roster');
    expect(await screen.findByText('Ruth Keller')).toBeTruthy();
    expect(screen.getByText('Guest')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Make an invite' }));
    expect(await screen.findByRole('img', { name: 'Club invite QR code' })).toBeTruthy();
    const link = screen.getByTestId('invite-link').textContent!;
    expect(link.startsWith(`https://${WEB_DOMAINS.dev}${JOIN_WEB_PATH}#`)).toBe(true);
    expect(decodeJoinUrl(link).target).toMatchObject({ kind: 'club', clubId: 'club-oak-ridge' });
  });

  it('lists stands with plain-language types, and areas', async () => {
    renderApp();
    await signIn();
    go('#/stands');
    expect(await screen.findByText('Big Oak Ladder')).toBeTruthy();
    expect(screen.getByText('Tree stand')).toBeTruthy();
    expect(screen.getAllByText('North 40').length).toBeGreaterThan(0);
  });

  it('shows billing status and paid-through date', async () => {
    renderApp();
    await signIn();
    go('#/billing');
    expect(await screen.findByText('Active')).toBeTruthy();
    expect(screen.getByText('August 1, 2027')).toBeTruthy();
  });
});
