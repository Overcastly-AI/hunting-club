import {
  decodeJoinUrl,
  defaultRandom,
  encodeJoinUrl,
  generatePartyChannelSet,
  JOIN_WEB_PATH,
} from '@huntclub/mesh';
import {
  APP_DESCRIPTION,
  APP_NAME,
  CHECKOUT_RETURN_PATHS,
  type ClubApiClient,
  LEGAL_DRAFT_NOTICE,
  LEGAL_PATHS,
  privacyPolicy,
  termsOfUse,
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
import { Loading } from '../components/Loading';
import { Root } from '../Root';
import { globalCss } from '../theme/css';
import { pageTitle } from '../title';
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

/** An inline field error: shown under the input, which is marked invalid and points to it. */
function expectFieldError(input: HTMLElement, message: string) {
  const error = screen.getByText(message);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(input.getAttribute('aria-describedby')).toContain(error.id);
}

/** Signed-in services over a fake club client, so a test can make one call fail. */
function servicesFor(client: ClubApiClient): WebClubServices {
  return {
    session: new ClubSession(fakeCognitoAuth(), memoryTokenStore()),
    api: adminApi(client),
  };
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
    expect(document.title).toBe(`Sign in · Club admin · ${APP_NAME}`);
    await signIn();
    expect(document.title).toBe(`My club · Club admin · ${APP_NAME}`);
    expect(screen.getByText('Signed in as dale@example.com')).toBeTruthy();
  });

  it('explains a wrong code and stays on the code step', async () => {
    renderApp();
    fireEvent.change(await requestCode(), { target: { value: '999999' } });
    fireEvent.click(screen.getByRole('button', { name: signInCopy.confirm }));
    expect((await screen.findByRole('alert')).textContent).toBe(signInCopy.errors.wrong_code);
    expect(screen.getByLabelText(signInCopy.code)).toBeTruthy();
  });

  it('keeps only digits, and asks for all six on submit next to the field', async () => {
    renderApp();
    const input = (await requestCode()) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12a4' } });
    expect(input.value).toBe('124');
    const submit = screen.getByRole('button', { name: signInCopy.confirm }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    expectFieldError(input, signInCopy.codeIncomplete);
    expect(input.getAttribute('aria-describedby')).toContain(
      screen.getByText(signInCopy.codeHelp).id,
    );
  });

  it('checks the email on submit and explains a typo inline, without asking for a code', async () => {
    const auth = fakeCognitoAuth();
    const start = vi.spyOn(auth, 'requestCode');
    renderApp(sampleData(), { session: new ClubSession(auth, memoryTokenStore()), api: undefined });
    const email = screen.getByLabelText(signInCopy.email) as HTMLInputElement;
    expect(email.getAttribute('inputmode')).toBe('email');
    expect(email.getAttribute('autocapitalize')).toBe('none');
    expect(email.getAttribute('spellcheck')).toBe('false');
    expect(email.placeholder).toBe(signInCopy.emailPlaceholder);
    fireEvent.change(email, { target: { value: 'dale@example' } });
    fireEvent.click(screen.getByRole('button', { name: signInCopy.sendCode }));
    expectFieldError(email, signInCopy.errors.invalid_email);
    expect(start).not.toHaveBeenCalled();
  });

  it('says Sending code while the code is on its way', async () => {
    renderApp();
    fireEvent.change(screen.getByLabelText(signInCopy.email), {
      target: { value: 'dale@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: signInCopy.sendCode }));
    expect(screen.getByRole('button', { name: signInCopy.sending })).toBeTruthy();
    await screen.findByLabelText(signInCopy.code);
  });

  it('sends a new code on request, with the expiry and a spam hint', async () => {
    renderApp();
    await requestCode();
    expect(screen.getByText(signInCopy.codeHelp).textContent).toMatch(/3 minutes.*spam/);
    fireEvent.click(screen.getByRole('button', { name: signInCopy.resend }));
    expect((await screen.findByRole('status')).textContent).toBe(signInCopy.resent);
    expect(screen.getByLabelText(signInCopy.code)).toBeTruthy();
  });

  it('shows the app name, logo, description and Privacy and Terms links', () => {
    renderApp();
    expect(screen.getByText(APP_NAME)).toBeTruthy();
    expect(screen.getByText(APP_DESCRIPTION)).toBeTruthy();
    expect(document.querySelector('.auth-brand img')?.getAttribute('src')).toMatch(
      /^data:image\/svg\+xml,/,
    );
    expect(screen.getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe(
      LEGAL_PATHS.privacy,
    );
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe(
      LEGAL_PATHS.terms,
    );
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
    const labels = ['My club', 'Roster', 'Stands and areas', 'Harvests', 'Map packs', 'Billing'];
    for (const label of labels) {
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

  describe('map packs', () => {
    async function openMaps(data = sampleData(), services?: WebClubServices) {
      renderApp(data, services);
      await signIn();
      go('#/maps');
    }
    const packRows = async () =>
      within(await screen.findByRole('table'))
        .getAllByRole('row')
        .slice(1)
        .map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent));
    const buildButton = () =>
      screen.getByRole('button', { name: 'Build map pack' }) as HTMLButtonElement;

    it('lists packs with their status, size and reason', async () => {
      await openMaps();
      expect(await packRows()).toEqual([
        ['Aerial', 'Failed: USGS did not answer', '—', 'November 12, 2026'],
        ['Topo', 'Ready', '12 MB', 'November 20, 2026'],
      ]);
    });

    it('shows the estimate, starts a build, and then shows it building', async () => {
      await openMaps();
      fireEvent.click(await screen.findByRole('radio', { name: 'Aerial' }));
      expect(screen.getByTestId('pack-estimate').textContent).toMatch(/^About [\d,]+ map tiles/);
      fireEvent.click(buildButton());
      await screen.findByText(/A map pack is being built/);
      expect((await packRows())[0]).toEqual(['Aerial', 'Being built', '—', 'November 13, 2026']);
      expect(buildButton().disabled).toBe(true); // one build at a time
    });

    it('explains a build refused because another one is running', async () => {
      const client = fakeClubClient(sampleData());
      vi.spyOn(client, 'requestMapPack').mockRejectedValue(
        new ClubApiRequestError('conflict', 409),
      );
      await openMaps(sampleData(), {
        session: new ClubSession(fakeCognitoAuth(), memoryTokenStore()),
        api: adminApi(client),
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Build map pack' }));
      expect((await screen.findByRole('alert')).textContent).toMatch(
        /already being built.*up to 15 minutes/,
      );
    });

    it('refuses a property too big for one pack before asking the club service', async () => {
      const data = sampleData();
      const huge = {
        type: 'Polygon' as const,
        coordinates: [
          [
            [-91, 40],
            [-91, 41],
            [-90, 41],
            [-91, 40],
          ],
        ],
      };
      await openMaps({ ...data, club: { ...data.club!, boundary: huge } });
      expect((await screen.findByRole('alert')).textContent).toMatch(/too big for one map pack/);
      expect(buildButton().disabled).toBe(true);
    });

    it('asks for the property line first', async () => {
      const data = sampleData();
      const { boundary: _none, ...club } = data.club!;
      await openMaps({ ...data, club });
      expect(await screen.findByText(/Set the club's property line first/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Build map pack' })).toBeNull();
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
    expect(document.title).toBe(`Club invite · ${APP_NAME}`);
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

  it('shows the club admin at / and /index.html', async () => {
    for (const path of ['/', '/index.html']) {
      const { unmount } = render(<Root {...services} location={at(path)} />);
      expect(await screen.findByText(/not available yet/)).toBeTruthy();
      unmount();
    }
  });

  it('shows Privacy and Terms from the shared copy, marked as drafts', async () => {
    for (const [path, doc] of [
      [LEGAL_PATHS.privacy, privacyPolicy],
      [LEGAL_PATHS.terms, termsOfUse],
    ] as const) {
      const { unmount } = render(<Root {...services} location={at(path)} />);
      expect(await screen.findByRole('heading', { level: 1, name: doc.title })).toBeTruthy();
      expect(screen.getByRole('note').textContent).toBe(LEGAL_DRAFT_NOTICE);
      for (const section of doc.sections) {
        expect(screen.getByRole('heading', { level: 2, name: section.heading })).toBeTruthy();
      }
      expect(document.title).toBe(pageTitle(doc.title));
      unmount();
    }
  });

  it('shows Page not found on any other path, with a way back to sign in', async () => {
    render(<Root {...services} location={at('/nope/deeper')} />);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to sign in' }).getAttribute('href')).toBe('/');
    expect(document.title).toBe(pageTitle('Page not found'));
  });
});

describe('errors, empty states and navigation', () => {
  const offline = () => new ClubApiRequestError('network', 0);

  it('explains a club that could not be created, and keeps the form', async () => {
    const client = fakeClubClient({ ...sampleData(), club: null });
    vi.spyOn(client, 'createClub').mockRejectedValue(offline());
    renderApp(undefined, servicesFor(client));
    await signIn();
    fireEvent.change(await screen.findByLabelText('Club name'), { target: { value: 'Pine' } });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Pat Lane' } });
    fireEvent.change(screen.getByLabelText('Your initials'), { target: { value: 'PL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create club' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/No connection/);
    expect((screen.getByLabelText('Club name') as HTMLInputElement).value).toBe('Pine');
  });

  it('says Making invite while it works, and explains an invite that failed', async () => {
    const client = fakeClubClient(sampleData());
    let fail!: (e: unknown) => void;
    vi.spyOn(client, 'createInvite').mockReturnValue(new Promise((_, reject) => (fail = reject)));
    renderApp(undefined, servicesFor(client));
    await signIn();
    go('#/roster');
    fireEvent.click(await screen.findByRole('button', { name: 'Make an invite' }));
    const busy = screen.getByRole('button', { name: 'Making invite…' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    fail(new ClubApiRequestError('forbidden', 403));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not make the invite. Try again.',
    );
    expect(screen.getByRole('button', { name: 'Make an invite' })).toBeTruthy();
  });

  describe('copying the invite link', () => {
    async function invite() {
      renderApp();
      await signIn();
      go('#/roster');
      fireEvent.click(await screen.findByRole('button', { name: 'Make an invite' }));
      await screen.findByTestId('invite-link');
      return screen.getByTestId('invite-link').textContent!;
    }
    const clipboard = (writeText?: (text: string) => Promise<void>) =>
      Object.defineProperty(navigator, 'clipboard', {
        value: writeText ? { writeText } : undefined,
        configurable: true,
      });

    it('says Copied only once the clipboard has it', async () => {
      const writeText = vi.fn(async () => undefined);
      clipboard(writeText);
      const link = await invite();
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
      expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
      expect(writeText).toHaveBeenCalledWith(link);
    });

    it('selects the link in a read-only field when the browser will not copy', async () => {
      clipboard(vi.fn(async () => Promise.reject(new Error('denied'))));
      const link = await invite();
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
      const field = (await screen.findByLabelText('Copy this link')) as HTMLInputElement;
      expect(field.readOnly).toBe(true);
      expect(field.value).toBe(link);
      expect(document.activeElement).toBe(field);
      expect([field.selectionStart, field.selectionEnd]).toEqual([0, link.length]);
      expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
      clipboard(undefined);
    });
  });

  it('offers Try again when a page cannot load, and loads on the retry', async () => {
    const client = fakeClubClient(sampleData());
    const list = vi.spyOn(client, 'listStands').mockRejectedValueOnce(offline());
    renderApp(undefined, servicesFor(client));
    await signIn();
    go('#/stands');
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Big Oak Ladder')).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('keeps the last roster, stands and map packs on screen when the connection drops', async () => {
    const client = fakeClubClient(sampleData());
    renderApp(undefined, servicesFor(client));
    await signIn();
    go('#/maps');
    expect(await screen.findByRole('table')).toBeTruthy();
    vi.spyOn(client, 'listMapPacks').mockRejectedValue(offline());
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect((await screen.findByRole('status')).textContent).toMatch(/No connection/);
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('says so when nobody but the admin has joined, and there are no stands or areas', async () => {
    const data = sampleData();
    const admin = data.members.filter((m) => m.role === 'admin');
    renderApp({ ...data, members: admin, stands: [], areas: [] });
    await signIn();
    go('#/roster');
    expect(await screen.findByText(/No members yet/)).toBeTruthy();
    go('#/stands');
    expect(await screen.findByText('No stands yet.')).toBeTruthy();
    expect(screen.getByText('No areas yet.')).toBeTruthy();
  });

  it('asks for a club before map packs', async () => {
    renderApp({ ...sampleData(), club: null });
    await signIn();
    go('#/maps');
    expect(await screen.findByText(/Create your club first/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to My club' }).getAttribute('href')).toBe('#/club');
  });

  it('puts each table in a labelled scroll region; roster and stands stack on phones', async () => {
    renderApp();
    await signIn();
    go('#/roster');
    const region = await screen.findByRole('region', { name: 'Club members' });
    expect(region.getAttribute('tabindex')).toBe('0');
    const table = within(region).getByRole('table', { name: 'Club members' });
    expect(table.classList.contains('stack')).toBe(true);
    expect(within(table).getAllByRole('cell')[0]!.getAttribute('data-label')).toBe('Name');
    go('#/stands');
    expect((await screen.findByRole('table', { name: 'Stands' })).classList.contains('stack')).toBe(
      true,
    );
  });

  it('focuses the new page heading on a route change and marks the current tab', async () => {
    renderApp();
    await signIn();
    go('#/stands');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Stands and areas' });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
    const nav = screen.getByRole('navigation', { name: 'Club admin' });
    expect(
      within(nav).getByRole('link', { name: 'Stands and areas' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(globalCss()).toMatch(/\.nav a\[aria-current='page'\] \{[^}]*text-decoration: underline/);
  });

  it('announces loading as a status and offers a skip link to the page', async () => {
    renderApp();
    await signIn();
    expect(screen.getByRole('link', { name: 'Skip to content' }).getAttribute('href')).toBe(
      '#main',
    );
    expect(document.getElementById('main')?.tagName).toBe('MAIN');
    render(<Loading />);
    expect(screen.getByRole('status').textContent).toBe('Loading…');
  });

  it('spaces the payment buttons apart', async () => {
    renderApp({ ...sampleData(), subscription: null });
    await signIn();
    go('#/billing');
    const pay = await screen.findByRole('button', { name: /Continue to payment/ });
    expect(pay.parentElement?.classList.contains('row')).toBe(true);
  });
});
