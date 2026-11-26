import { decodeJoinUrl, JOIN_WEB_PATH } from '@huntclub/mesh';
import {
  ADMIN_PATH,
  APP_DESCRIPTION,
  APP_NAME,
  CHECKOUT_RETURN_PATHS,
  CLUB_PRICING,
  type ClubApiClient,
  emailCodeRules,
  INITIALS_MAX,
  LEGAL_PATHS,
  ClubApiRequestError,
  WEB_DOMAINS,
} from '@huntclub/shared';
import { ClubSession, memoryTokenStore, signInCopy } from '@huntclub/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { adminApi } from '../api/admin';
import { App, PAGES } from '../App';
import * as download from '../download';
import * as navigate from '../navigate';
import { Loading } from '../components/Loading';
import { Root } from '../Root';
import { globalCss } from '../theme/css';
import { pageTitle } from '../title';
import type { WebClubServices } from '../cloud';
import { fakeClubClient, fakeCognitoAuth, sampleData, testCode } from './fakeClubApi';

async function requestCode() {
  fireEvent.change(await screen.findByLabelText(signInCopy.email), {
    target: { value: 'dale@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: signInCopy.sendCode }));
  return screen.findByLabelText(signInCopy.code);
}

async function signIn() {
  fireEvent.change(await requestCode(), { target: { value: testCode() } });
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
    await screen.findByLabelText(signInCopy.email);
    await vi.waitFor(() => expect(document.title).toBe(`Sign in · ${APP_NAME}`));
    await signIn();
    // The title is set in an effect after the signed-in render commits.
    await vi.waitFor(() => expect(document.title).toBe(`My club · Club admin · ${APP_NAME}`));
    expect(screen.getByText('Signed in as dale@example.com')).toBeTruthy();
  });

  it('explains a wrong code and stays on the code step', async () => {
    renderApp();
    window.location.hash = '#/roster';
    fireEvent.change(await requestCode(), { target: { value: '99999999' } });
    fireEvent.click(screen.getByRole('button', { name: signInCopy.confirm }));
    expect((await screen.findByRole('alert')).textContent).toBe(signInCopy.errors.wrong_code);
    expect(screen.getByLabelText(signInCopy.code)).toBeTruthy();
    // The route asked for stays put on the sign-in screen, then opens once signed in.
    expect(window.location.hash).toBe('#/roster');
    fireEvent.change(screen.getByLabelText(signInCopy.code), { target: { value: testCode() } });
    fireEvent.click(screen.getByRole('button', { name: signInCopy.confirm }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Roster' })).toBeTruthy();
  });

  it.each(['signUp', 'signIn'] as const)(
    'expects the %s code length from the challenge, and never cuts a long paste',
    async (kind) => {
      const { length, validFor } = emailCodeRules(kind);
      renderApp(sampleData(), {
        session: new ClubSession(fakeCognitoAuth(kind), memoryTokenStore()),
        api: adminApi(fakeClubClient(sampleData())),
      });
      const input = (await requestCode()) as HTMLInputElement;
      expect(input.maxLength).toBe(-1);
      expect(screen.getByText(signInCopy.codeHelp(kind)).textContent).toContain(validFor);
      const tooLong = testCode(kind) + '9';
      fireEvent.change(input, { target: { value: tooLong.split('').join(' ') } });
      expect(input.value).toBe(tooLong);
      fireEvent.click(screen.getByRole('button', { name: signInCopy.confirm }));
      expectFieldError(input, signInCopy.codeIncomplete(kind));
      expect(signInCopy.codeIncomplete(kind)).toContain(String(length));
      fireEvent.change(input, { target: { value: testCode(kind) } });
      fireEvent.click(screen.getByRole('button', { name: signInCopy.confirm }));
      await screen.findByRole('navigation', { name: 'Club admin' });
    },
  );

  it('shows one message at a time', async () => {
    renderApp();
    const input = await requestCode();
    fireEvent.change(input, { target: { value: '99999999' } });
    fireEvent.click(screen.getByRole('button', { name: signInCopy.confirm }));
    await screen.findByRole('alert');
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: signInCopy.confirm }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(signInCopy.codeIncomplete('signIn'))).toBeTruthy();
  });

  it('keeps only digits, and asks for every digit on submit next to the field', async () => {
    renderApp();
    const input = (await requestCode()) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12a4' } });
    expect(input.value).toBe('124');
    const submit = screen.getByRole('button', { name: signInCopy.confirm }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    expectFieldError(input, signInCopy.codeIncomplete('signIn'));
    expect(input.getAttribute('aria-describedby')).toContain(
      screen.getByText(signInCopy.codeHelp('signIn')).id,
    );
  });

  it('checks the email on submit and explains a typo inline, without asking for a code', async () => {
    const auth = fakeCognitoAuth();
    const start = vi.spyOn(auth, 'requestCode');
    renderApp(sampleData(), { session: new ClubSession(auth, memoryTokenStore()), api: undefined });
    const email = (await screen.findByLabelText(signInCopy.email)) as HTMLInputElement;
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
    fireEvent.change(await screen.findByLabelText(signInCopy.email), {
      target: { value: 'dale@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: signInCopy.sendCode }));
    expect(screen.getByRole('button', { name: signInCopy.sending })).toBeTruthy();
    await screen.findByLabelText(signInCopy.code);
  });

  it('sends a new code on request, with the expiry and a spam hint', async () => {
    renderApp();
    await requestCode();
    expect(screen.getByText(signInCopy.codeHelp('signIn')).textContent).toMatch(/10 minutes.*spam/);
    fireEvent.click(screen.getByRole('button', { name: signInCopy.resend }));
    expect((await screen.findByRole('status')).textContent).toBe(signInCopy.resent);
    expect(screen.getByLabelText(signInCopy.code)).toBeTruthy();
  });

  it('shows the app name, logo, description and Privacy and Terms links', async () => {
    renderApp();
    await screen.findByLabelText(signInCopy.email);
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

  it('offers to create a club when there is none, checking the form on submit', async () => {
    renderApp({ ...sampleData(), club: null });
    await signIn();
    const name = await screen.findByLabelText('Club name');
    const create = screen.getByRole('button', { name: 'Create club' }) as HTMLButtonElement;
    expect(create.disabled).toBe(false);
    expect(
      screen.getByText(`Up to ${INITIALS_MAX} letters or numbers, shown on the map`),
    ).toBeTruthy();
    fireEvent.click(create);
    expectFieldError(name, 'Enter the club name.');
    expectFieldError(screen.getByLabelText('Your name'), 'Enter your name.');

    fireEvent.change(name, { target: { value: 'Pine Hollow' } });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Pat Lane' } });
    fireEvent.change(screen.getByLabelText('Your initials'), { target: { value: 'pl' } });
    fireEvent.click(create);
    expect(await screen.findByText('Pine Hollow')).toBeTruthy();
    const created = screen.getByRole('status');
    expect(created.textContent).toBe(
      `Club created. Start your ${CLUB_PRICING.trialDays}-day free trial on Billing.`,
    );
    expect(within(created).getByRole('link', { name: 'Billing' }).getAttribute('href')).toBe(
      '#/billing',
    );
  });

  it('shows the plans before there is a club, with the way to start the trial', async () => {
    renderApp({ ...sampleData(), club: null });
    await signIn();
    go('#/billing');
    const plans = await screen.findByRole('list');
    for (const { label, price } of Object.values(CLUB_PRICING.intervals)) {
      expect(plans.textContent).toContain(`${label}: ${price}`);
    }
    expect(screen.getByText(CLUB_PRICING.terms)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create your club' }).getAttribute('href')).toBe(
      '#/club',
    );
    expect(screen.getByText(/to start your free trial/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: CLUB_PRICING.cta })).toBeNull();
  });

  it('shows Page not found for an unknown page, with the way back to the app', async () => {
    renderApp();
    await signIn();
    go('#/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the app' }).getAttribute('href')).toBe(
      ADMIN_PATH,
    );
    await vi.waitFor(() =>
      expect(document.title).toBe(`Page not found · Club admin · ${APP_NAME}`),
    );
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

    it('offers no export, and no "0 harvests" line, for a season without harvests', async () => {
      await openHarvests();
      fireEvent.change(screen.getByLabelText('Season starts'), { target: { value: '2030-01-01' } });
      fireEvent.change(screen.getByLabelText('Season ends'), { target: { value: '2030-12-31' } });
      expect(await screen.findByText('No shared harvests in this season yet.')).toBeTruthy();
      const exportCsv = screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement;
      expect(exportCsv.disabled).toBe(true);
      expect(screen.getByText('Nothing to export yet').id).toBe(
        exportCsv.getAttribute('aria-describedby'),
      );
      expect(screen.queryByText(/harvests from/)).toBeNull();
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
    expect(screen.queryByRole('button', { name: CLUB_PRICING.cta })).toBeNull();
  });

  it('shows when a trial ends', async () => {
    const data = sampleData();
    renderApp({
      ...data,
      subscription: {
        ...data.subscription!,
        status: 'trialing',
        paidThrough: '2026-12-10T00:00:00.000Z',
      },
    });
    await signIn();
    go('#/billing');
    expect(await screen.findByText('Trial ends')).toBeTruthy();
    expect(screen.getByText('December 10, 2026')).toBeTruthy();
    expect(screen.queryByText('Paid through')).toBeNull();
  });

  it('offers the free trial, yearly by default or monthly, and sends the choice to Checkout', async () => {
    const goTo = vi.spyOn(navigate, 'navigateTo').mockImplementation(() => undefined);
    const open = async () => {
      const view = renderApp({ ...sampleData(), subscription: null });
      await signIn();
      go('#/billing');
      expect(await screen.findByText('No subscription yet.')).toBeTruthy();
      return view;
    };
    const first = await open();
    const yearly = screen.getByRole('radio', { name: /Yearly: \$100\/year · 2 months free/ });
    expect((yearly as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('radio', { name: /Monthly: \$10\/month/ })).toBeTruthy();
    expect(
      screen.getByText(
        "Then $100/year or $10/month. Cancel anytime before day 14 and you won't be charged.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start your 14-day free trial' }));
    await vi.waitFor(() => expect(goTo).toHaveBeenCalledTimes(1));
    expect(goTo.mock.calls[0]![0]).toMatch(/cs_test_club_standard_year_/);
    first.unmount();

    await open();
    fireEvent.click(screen.getByRole('radio', { name: /Monthly/ }));
    fireEvent.click(screen.getByRole('button', { name: CLUB_PRICING.cta }));
    await vi.waitFor(() => expect(goTo).toHaveBeenCalledTimes(2));
    expect(goTo.mock.calls[1]![0]).toMatch(/cs_test_club_standard_month_/);
    goTo.mockRestore();
  });

  it("says payments aren't set up while Stripe prices are unset", async () => {
    renderApp({ ...sampleData(), subscription: null, paymentsConfigured: false });
    await signIn();
    go('#/billing');
    fireEvent.click(await screen.findByRole('button', { name: CLUB_PRICING.cta }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Payments aren't set up yet/);
  });
});

describe('pages on their own paths (no sign-in)', () => {
  const services = { session: undefined, api: undefined };
  const at = (pathname: string, hash = '') => ({
    pathname,
    href: `https://${WEB_DOMAINS.dev}${pathname}${hash}`,
  });

  it('thanks the admin after Checkout, and reassures after a cancel', async () => {
    const { unmount } = render(<Root {...services} location={at(CHECKOUT_RETURN_PATHS.success)} />);
    expect(await screen.findByRole('heading', { name: 'Payment received' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to club admin' }).getAttribute('href')).toBe(
      `${ADMIN_PATH}#/billing`,
    );
    unmount();
    render(<Root {...services} location={at(CHECKOUT_RETURN_PATHS.cancel)} />);
    expect(await screen.findByText(/Nothing was charged/)).toBeTruthy();
  });

  it('shows the club admin at /app/, /app and /app/index.html', async () => {
    for (const path of [ADMIN_PATH, '/app', '/app/index.html']) {
      const { unmount } = render(<Root {...services} location={at(path)} />);
      expect(await screen.findByText(/not available yet/)).toBeTruthy();
      unmount();
    }
  });

  it('shows Page not found on any other path, with a way back to sign in', async () => {
    render(<Root {...services} location={at('/nope/deeper')} />);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to sign in' }).getAttribute('href')).toBe(
      ADMIN_PATH,
    );
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

  it('makes no invite when the radio key cannot be read (no orphan invites)', async () => {
    const client = fakeClubClient(sampleData());
    vi.spyOn(client, 'getClubSecret').mockRejectedValue(new ClubApiRequestError('not_found', 404));
    const createInvite = vi.spyOn(client, 'createInvite');
    renderApp(undefined, servicesFor(client));
    await signIn();
    go('#/roster');
    fireEvent.click(await screen.findByRole('button', { name: 'Make an invite' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Could not make the invite. Try again.',
    );
    expect(createInvite).not.toHaveBeenCalled();
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
    expect(
      await screen.findByText(
        'No other members yet. Make an invite below and share it with your hunters.',
      ),
    ).toBeTruthy();
    expect(screen.getByText(/The new member joins the club radio channel\./)).toBeTruthy();
    go('#/stands');
    expect(await screen.findByRole('heading', { level: 2, name: 'Stands (0)' })).toBeTruthy();
    expect(screen.getByText('No stands yet.')).toBeTruthy();
    expect(screen.getByText('No areas yet.')).toBeTruthy();
  });

  it('counts members other than the signed-in admin', async () => {
    const data = sampleData();
    // Only the signed-in admin and one other member: no "no other members" line.
    renderApp({ ...data, members: data.members.slice(0, 2) });
    await signIn();
    go('#/roster');
    expect(await screen.findByText('Ruth Keller')).toBeTruthy();
    expect(screen.queryByText(/No other members yet/)).toBeNull();
  });

  it('names the stands and areas tables by their counted headings', async () => {
    renderApp();
    await signIn();
    go('#/stands');
    const standsHeading = await screen.findByRole('heading', {
      level: 2,
      name: /^Stands \(\d+\)$/,
    });
    const stands = screen.getByRole('table', { name: standsHeading.textContent! });
    expect(stands.getAttribute('aria-labelledby')).toBe(standsHeading.id);
    expect(stands.querySelector('caption')).toBeNull();
    expect(
      within(stands).getByRole('columnheader', { name: 'Available for check-in' }),
    ).toBeTruthy();
    const areasHeading = screen.getByRole('heading', { level: 2, name: /^Areas \(\d+\)$/ });
    expect(screen.getByRole('table', { name: areasHeading.textContent! })).toBeTruthy();
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
    expect(
      (await screen.findByRole('table', { name: /^Stands \(/ })).classList.contains('stack'),
    ).toBe(true);
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
    const current = within(nav)
      .getAllByRole('link')
      .filter((link) => link.hasAttribute('aria-current'));
    expect(current.map((link) => link.textContent)).toEqual(['Stands and areas']);
    expect(globalCss()).toMatch(/\.nav a\[aria-current='page'\] \{[^}]*text-decoration: underline/);
  });

  it('keeps Sign out and who is signed in in the footer, and the nav one row on phones', async () => {
    renderApp();
    await signIn();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText('Signed in as dale@example.com')).toBeTruthy();
    expect(within(footer).getByRole('button', { name: 'Sign out' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Club admin' });
    expect(within(nav).queryByRole('button')).toBeNull();
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(PAGES.map((p) => p.label));
    const css = globalCss();
    expect(css).toMatch(/\.app-footer \{[^}]*margin-top: var\(--space-lg\)/);
    expect(css).toMatch(
      /@media \(max-width: 639px\) \{\s*\.nav \{ flex-wrap: nowrap; overflow-x: auto; \}/,
    );
    // The heading that takes focus on a route change shows its ring only for the keyboard.
    expect(css).toMatch(/h1:focus \{ outline: none; \}/);
    expect(css).toMatch(/h1:focus-visible \{ outline: 3px solid/);
  });

  it('announces loading as a status and offers a skip link to the page', async () => {
    renderApp();
    await signIn();
    expect(screen.getByRole('link', { name: 'Skip to content' }).getAttribute('href')).toBe(
      '#main',
    );
    expect(document.getElementById('main')?.tagName).toBe('MAIN');
    // Its own container: the signed-in page may still be showing its own loading status.
    const { container } = render(<Loading />);
    expect(within(container).getByRole('status').textContent).toBe('Loading…');
  });

  it('lays out each billing choice as a row', async () => {
    renderApp({ ...sampleData(), subscription: null });
    await signIn();
    go('#/billing');
    const yearly = await screen.findByRole('radio', { name: /Yearly/ });
    expect(yearly.parentElement?.classList.contains('row')).toBe(true);
  });
});
