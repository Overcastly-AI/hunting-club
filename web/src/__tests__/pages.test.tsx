import {
  decodeJoinUrl,
  defaultRandom,
  encodeJoinUrl,
  generatePartyChannelSet,
  JOIN_WEB_PATH,
} from '@huntclub/mesh';
import {
  CHECKOUT_RETURN_PATHS,
  ClubApiRequestError,
  JOIN_PATH,
  WEB_DOMAINS,
} from '@huntclub/shared';
import { ClubSession, memoryTokenStore, signInCopy } from '@huntclub/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { adminApi } from '../api/admin';
import { App } from '../App';
import * as download from '../download';
import * as navigate from '../navigate';
import { Root } from '../Root';
import type { WebClubServices } from '../cloud';
import { fakeClubClient, fakeCognitoAuth, sampleData, TEST_CODE } from './fakeClubApi';

async function requestCode() {
  fireEvent.change(screen.getByLabelText(signInCopy.email), {
    target: { value: 'dale@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: signInCopy.sendCode }));
  return screen.findByLabelText(signInCopy.code);
}

async function signIn() {
  fireEvent.change(await requestCode(), { target: { value: TEST_CODE } });
  fireEvent.click(screen.getByRole('button', { name: signInCopy.confirm }));
  await screen.findByRole('navigation', { name: 'Club admin' });
}

function go(hash: string) {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function renderApp(
  data = sampleData(),
  services: WebClubServices = {
    session: new ClubSession(fakeCognitoAuth(), memoryTokenStore()),
    api: adminApi(fakeClubClient(data)),
  },
) {
  window.location.hash = '';
  return render(<App {...services} />);
}

describe('sign in', () => {
  it('signs in with an email and the emailed code', async () => {
    renderApp();
    await signIn();
    expect(screen.getByText('Signed in as dale@example.com')).toBeTruthy();
  });

  it('explains a wrong code and stays on the code step', async () => {
    renderApp();
    fireEvent.change(await requestCode(), { target: { value: '999999' } });
    fireEvent.click(screen.getByRole('button', { name: signInCopy.confirm }));
    expect((await screen.findByRole('alert')).textContent).toBe(signInCopy.errors.wrong_code);
    expect(screen.getByLabelText(signInCopy.code)).toBeTruthy();
  });

  it('keeps only digits and needs all six', async () => {
    renderApp();
    const input = (await requestCode()) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12a4' } });
    expect(input.value).toBe('124');
    const submit = screen.getByRole('button', { name: signInCopy.confirm }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('says the club service is not ready when the cloud ids are not set yet', () => {
    renderApp(sampleData(), { session: undefined, api: undefined });
    expect(screen.getByText(/not available yet/)).toBeTruthy();
  });
});

describe('club pages', () => {
  it('shows the club, with every page in the navigation', async () => {
    renderApp();
    await signIn();
    expect(await screen.findByText('Oak Ridge Hunt Club')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Club admin' });
    for (const label of ['My club', 'Roster', 'Stands and areas', 'Harvests', 'Billing']) {
      expect(within(nav).getByRole('link', { name: label })).toBeTruthy();
    }
  });

  it('offers to create a club when there is none', async () => {
    renderApp({ ...sampleData(), club: null });
    await signIn();
    fireEvent.change(await screen.findByLabelText('Club name'), {
      target: { value: 'Pine Hollow' },
    });
    const create = screen.getByRole('button', { name: 'Create club' }) as HTMLButtonElement;
    expect(create.disabled).toBe(true); // your name and initials are needed too
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Pat Lane' } });
    fireEvent.change(screen.getByLabelText('Your initials'), { target: { value: 'pl' } });
    fireEvent.click(create);
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
    expect(decodeJoinUrl(link).target).toMatchObject({
      kind: 'club',
      clubId: sampleData().club!.id,
    });
  });

  it('lists stands with plain-language types, and areas', async () => {
    renderApp();
    await signIn();
    go('#/stands');
    expect(await screen.findByText('Big Oak Ladder')).toBeTruthy();
    expect(screen.getByText('Tree stand')).toBeTruthy();
    expect(screen.getAllByText('North 40').length).toBeGreaterThan(0);
  });

  describe('harvests', () => {
    async function openHarvests(data = sampleData(), services?: WebClubServices) {
      renderApp(data, services);
      await signIn();
      go('#/harvests');
      fireEvent.change(await screen.findByLabelText('Season starts'), {
        target: { value: '2026-09-01' },
      });
      fireEvent.change(screen.getByLabelText('Season ends'), { target: { value: '2027-01-31' } });
    }
    const table = (title: string) =>
      screen.getByRole('heading', { name: title }).nextElementSibling as HTMLElement;
    const rows = (title: string) =>
      within(table(title))
        .getAllByRole('row')
        .slice(1)
        .map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent));

    it('summarizes the shared harvests of the season the admin picks', async () => {
      await openHarvests();
      // 7 sample harvests: one private and one from March are left out.
      expect(await screen.findByText('5')).toBeTruthy();
      expect(rows('By species')).toEqual([
        ['Deer', '4'],
        ['Turkey', '1'],
      ]);
      expect(rows('By sex')).toEqual([
        ['Male', '3'],
        ['Female', '2'],
        ['Not sure', '0'],
      ]);
      expect(rows('By member')).toEqual([
        ['Ruth Keller', '2'],
        ['Dale Morgan', '1'],
        ['Former member', '1'],
        ['Sam Ortiz', '1'],
      ]);
      expect(rows('By week')).toContainEqual(['November 15, 2026', '2']);
    });

    it('asks for a season that ends after it starts', async () => {
      await openHarvests();
      fireEvent.change(screen.getByLabelText('Season ends'), { target: { value: '2026-08-01' } });
      expect((await screen.findByRole('alert')).textContent).toMatch(/on or after its start/);
    });

    it('exports the season as CSV, safe for spreadsheets', async () => {
      const save = vi.spyOn(download, 'saveFile').mockImplementation(() => undefined);
      await openHarvests();
      fireEvent.click(await screen.findByRole('button', { name: 'Export CSV' }));
      const [name, text, type] = save.mock.calls[0]!;
      expect(name).toBe('harvests-2026-09-01-to-2027-01-31.csv');
      expect(type).toMatch(/^text\/csv/);
      const lines = text.split('\r\n');
      expect(lines[0]).toBe('Date,Species,Sex,Member,Stand,Area,Notes');
      expect(lines).toContain(
        `2026-11-15,Deer,Male,Dale Morgan,Big Oak Ladder,North 40,"'=8 point, ""big"" one"`,
      );
      expect(lines).toHaveLength(7); // header, 5 harvests, trailing newline
      save.mockRestore();
    });

    it('keeps showing the last loaded harvests when the connection drops', async () => {
      const client = fakeClubClient(sampleData());
      await openHarvests(sampleData(), {
        session: new ClubSession(fakeCognitoAuth(), memoryTokenStore()),
        api: adminApi(client),
      });
      expect(await screen.findByText('5')).toBeTruthy();
      vi.spyOn(client, 'listHarvests').mockRejectedValue(new ClubApiRequestError('network', 0));
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
      expect((await screen.findByRole('status')).textContent).toMatch(/No connection/);
      expect(rows('By species')[0]).toEqual(['Deer', '4']);
    });
  });

  it('shows billing status and paid-through date, with no payment button while active', async () => {
    renderApp();
    await signIn();
    go('#/billing');
    expect(await screen.findByText('Active')).toBeTruthy();
    expect(screen.getByText('August 1, 2027')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Continue to payment/ })).toBeNull();
  });

  it('sends a club with no subscription to Stripe Checkout for an active plan', async () => {
    const goTo = vi.spyOn(navigate, 'navigateTo').mockImplementation(() => undefined);
    renderApp({ ...sampleData(), subscription: null });
    await signIn();
    go('#/billing');
    expect(await screen.findByText('No subscription yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Old club plan/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to payment: Club' }));
    await vi.waitFor(() => expect(goTo).toHaveBeenCalledTimes(1));
    expect(goTo.mock.calls[0]![0]).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    goTo.mockRestore();
  });
});

describe('pages on their own paths (no sign-in)', () => {
  const services = { session: undefined, api: undefined };
  const at = (pathname: string, hash = '') => ({
    pathname,
    href: `https://${WEB_DOMAINS.dev}${pathname}${hash}`,
  });

  it('hands a web club invite to the app, without showing the key', async () => {
    const channelSet = generatePartyChannelSet({ random: defaultRandom, name: 'Club' });
    const web = encodeJoinUrl(
      {
        channelSet,
        target: { kind: 'club', clubId: sampleData().club!.id, inviteToken: 'ab'.repeat(32) },
      },
      { form: 'web' },
    );
    render(<Root {...services} location={at(JOIN_PATH, web.slice(web.indexOf('#')))} />);
    expect(await screen.findByRole('heading', { name: 'Club invite' })).toBeTruthy();
    const open = screen.getByRole('link', { name: 'Open in the app' }).getAttribute('href')!;
    expect(open.startsWith('huntclub://')).toBe(true);
    expect(decodeJoinUrl(open)).toEqual(decodeJoinUrl(web));
    expect(screen.getByRole('img', { name: 'Invite QR code' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/channel|key|LongFast/i);
  });

  it('explains a broken invite link', async () => {
    render(<Root {...services} location={at(`${JOIN_PATH}/`, '#cs=nope')} />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/not complete/);
  });

  it('thanks the admin after Checkout, and reassures after a cancel', async () => {
    const { unmount } = render(<Root {...services} location={at(CHECKOUT_RETURN_PATHS.success)} />);
    expect(await screen.findByRole('heading', { name: 'Payment received' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to club admin' }).getAttribute('href')).toBe(
      '/#/billing',
    );
    unmount();
    render(<Root {...services} location={at(CHECKOUT_RETURN_PATHS.cancel)} />);
    expect(await screen.findByText(/Nothing was charged/)).toBeTruthy();
  });

  it('shows the club admin on any other path', async () => {
    render(<Root {...services} location={at('/')} />);
    expect(await screen.findByText(/not available yet/)).toBeTruthy();
  });
});
