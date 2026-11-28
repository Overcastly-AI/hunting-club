import { decodeJoinUrl, JOIN_WEB_PATH } from '@huntclub/mesh';
import {
  ADMIN_PATH,
  APP_DESCRIPTION,
  APP_NAME,
  BASEMAPS,
  CHECKOUT_RETURN_PATHS,
  CLUB_PRICING,
  type ClubApiClient,
  emailCodeRules,
  INITIALS_MAX,
  LEGAL_PATHS,
  ClubApiRequestError,
  WEB_DOMAINS,
} from '@huntclub/shared';
import {
  ClubSession,
  memoryTokenStore,
  RESEND_CODE_COOLDOWN_SECONDS,
  signInCopy,
} from '@huntclub/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { adminApi } from '../api/admin';
import { App } from '../App';
import { PAGES } from '../shell/routes';
import * as download from '../download';
import * as navigate from '../navigate';
import { Loading, LOADING_LABEL } from '../components/Loading';
import { Root } from '../Root';
import { globalCss } from '../theme/css';
import { pageTitle } from '../title';
import type { WebClubServices } from '../cloud';
import {
  fakeClubClient,
  fakeCognitoAuth,
  sampleData,
  SIGNED_IN,
  testCode,
} from '../testing/fakeClubApi';
import { go, renderSignedIn } from '../testing/app';
import { accountButton, requestCode, signIn } from '../testing/shell';
import { tableRows } from '../testing/tables';
import { SAMPLE_CAPTION } from '../pages/SignIn';
import { DRAW_LINE_FIRST, PLAN_NEEDED } from '../pages/MapPacks';
import {
  COPY_INVITE,
  CREATE_INVITE,
  INVITE_TITLE,
  NO_OTHER_MEMBERS,
  NO_RADIO,
} from '../pages/Roster';

/** The roster's invite section (which makes nothing until asked). */
const inviteSection = () => screen.findByRole('region', { name: INVITE_TITLE });

/** Asks the roster's invite section for the link; resolves to the section. */
async function createInviteLink() {
  const section = await inviteSection();
  fireEvent.click(within(section).getByRole('button', { name: CREATE_INVITE }));
  return section;
}

/** Every call that changes club data on the server: none may run just from opening a page. */
const WRITES = [
  'createClub',
  'createInvite',
  'requestMapPack',
  'startCheckout',
  'openBillingPortal',
  'redeemInvite',
] as const;

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
    // The account button names the signed-in admin by their club name.
    const me = sampleData().members.find((m) => m.userId === SIGNED_IN.userId)!;
    const button = await accountButton();
    await vi.waitFor(() => expect(button.textContent).toContain(me.displayName));
  });

  it('floats the form over a sample property, captioned as a sample', async () => {
    renderApp();
    await screen.findByLabelText(signInCopy.email);
    const map = screen.getByRole('img', { name: new RegExp(`^${SAMPLE_CAPTION}`) });
    expect(map.querySelectorAll('.plan__stand')).toHaveLength(3);
    expect(screen.getByText(SAMPLE_CAPTION)).toBeTruthy();
    await signIn();
    // Signed-in pages draw only the club's own map.
    expect(screen.queryByText(SAMPLE_CAPTION)).toBeNull();
  });

  it('explains a wrong code and stays on the code step', async () => {
    renderApp();
    window.location.hash = '#/roster';
    // The code goes as soon as its last digit lands.
    fireEvent.change(await requestCode(), { target: { value: '99999999' } });
    expect((await screen.findByRole('alert')).textContent).toBe(signInCopy.errors.wrong_code);
    expect(screen.getByLabelText(signInCopy.code('signIn'))).toBeTruthy();
    // The route asked for stays put on the sign-in screen, then opens once signed in.
    expect(window.location.hash).toBe('#/roster');
    fireEvent.change(screen.getByLabelText(signInCopy.code('signIn')), {
      target: { value: testCode() },
    });
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
      const input = (await requestCode(kind)) as HTMLInputElement;
      // The label, the field's limit and the check all come from the one length rule.
      expect(screen.getByLabelText(`${length}-digit code`)).toBe(input);
      expect(input.maxLength).toBe(length);
      expect(screen.getByText(signInCopy.codeHelp(kind)).textContent).toContain(validFor);
      // A paste is read whole: one digit too many is refused on submit, never cut short.
      const tooLong = testCode(kind) + '9';
      fireEvent.paste(input, {
        clipboardData: { getData: () => tooLong.split('').join(' ') },
      });
      expect(input.value).toBe(tooLong);
      fireEvent.click(screen.getByRole('button', { name: signInCopy.confirm }));
      expectFieldError(input, signInCopy.codeIncomplete(kind));
      expect(signInCopy.codeIncomplete(kind)).toContain(String(length));
      fireEvent.change(input, { target: { value: testCode(kind) } });
      await screen.findByRole('navigation', { name: 'Club admin' });
    },
  );

  it('shows one message at a time', async () => {
    renderApp();
    const input = await requestCode();
    fireEvent.change(input, { target: { value: '99999999' } });
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
    await screen.findByLabelText(signInCopy.code('signIn'));
  });

  it('sends a new code on request after the cooldown, with the expiry and a spam hint', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderApp();
    await requestCode();
    expect(screen.getByText(signInCopy.codeHelp('signIn')).textContent).toMatch(/10 minutes.*spam/);
    const wait = screen.getByRole('button', {
      name: signInCopy.resendIn(RESEND_CODE_COOLDOWN_SECONDS),
    }) as HTMLButtonElement;
    expect(wait.disabled).toBe(true);
    // One tick a second, as the countdown runs.
    for (let i = 0; i <= RESEND_CODE_COOLDOWN_SECONDS; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }
    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: signInCopy.resend }));
    expect((await screen.findByRole('status')).textContent).toBe(signInCopy.resent);
    expect(screen.getByLabelText(signInCopy.code('signIn'))).toBeTruthy();
  });

  it('shows the app name, logo, description and Privacy and Terms links', async () => {
    renderApp();
    await screen.findByLabelText(signInCopy.email);
    expect(screen.getByText(APP_NAME)).toBeTruthy();
    expect(screen.getByText(APP_DESCRIPTION)).toBeTruthy();
    expect(document.querySelector('.signin__brand img')?.getAttribute('src')).toMatch(
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
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Oak Ridge Hunt Club' }),
    ).toBeTruthy();
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
    expect(await screen.findByRole('heading', { level: 1, name: 'Pine Hollow' })).toBeTruthy();
    const created = screen.getByText('Club created').closest('[role="status"]') as HTMLElement;
    expect(created.textContent).toContain(
      `Start your ${CLUB_PRICING.trialDays}-day free trial on Billing.`,
    );
    expect(within(created).getByRole('link', { name: 'Billing' }).getAttribute('href')).toBe(
      '#/billing',
    );
  });

  it('sums up the club: members, stands, areas and subscription, each linking to its page', async () => {
    const data = sampleData();
    renderApp({ ...data, club: { ...data.club!, acreage: undefined } });
    await signIn();
    const summary = await screen.findByRole('list', { name: 'Club summary' });
    const links = within(summary)
      .getAllByRole('link')
      .map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      [`Members ${data.members.length}`, '#/roster'],
      [`Stands ${data.stands.length}`, '#/stands'],
      [`Areas ${data.areas.length}`, '#/stands'],
      ['Subscription Active', '#/billing'],
    ]);
    expect(screen.queryByText(/Acreage/)).toBeNull();
  });

  it('shows the plans before there is a club, with the way to start the trial', async () => {
    renderApp({ ...sampleData(), club: null });
    await signIn();
    go('#/billing');
    const plans = await screen.findByRole('list', { name: 'Prices' });
    for (const { label, price } of Object.values(CLUB_PRICING.intervals)) {
      expect(plans.textContent).toContain(label);
      expect(plans.textContent).toContain(price);
    }
    expect(screen.getByText(CLUB_PRICING.terms)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create your club' }).getAttribute('href')).toBe(
      '#/club',
    );
    expect(screen.getByText(/then start the free trial here/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: CLUB_PRICING.cta })).toBeNull();
  });

  it('shows Page not found for an unknown page, with the way back to the app', async () => {
    renderApp();
    await signIn();
    go('#/nope');
    const heading = await screen.findByRole('heading', { name: 'Page not found' });
    // A crossed-out map pin, then links to My club and Roster.
    expect(heading.closest('section')!.querySelector('.not-found__icon svg')).toBeTruthy();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: 'My club' }).getAttribute('href')).toBe(
      `${ADMIN_PATH}#/club`,
    );
    expect(within(main).getByRole('link', { name: 'Roster' }).getAttribute('href')).toBe(
      `${ADMIN_PATH}#/roster`,
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
    expect(screen.getByText('Guest until December 31, 2026')).toBeTruthy();
    expect(screen.getByText('!db01a2c4')).toBeTruthy();
    expect(screen.getAllByText(NO_RADIO).length).toBeGreaterThan(0);

    const dialog = await createInviteLink();
    expect(await within(dialog).findByRole('img', { name: 'Club invite QR code' })).toBeTruthy();
    const link = (screen.getByTestId('invite-link') as HTMLInputElement).value;
    expect(within(dialog).getByText(/^Works until /)).toBeTruthy();
    expect(link.startsWith(`https://${WEB_DOMAINS.dev}${JOIN_WEB_PATH}#`)).toBe(true);
    expect(decodeJoinUrl(link).target).toMatchObject({
      kind: 'club',
      clubId: sampleData().club!.id,
      // The invite page names the club ("Join <club name>").
      clubName: sampleData().club!.name,
    });
  });

  it("draws each roster avatar with the member's saved initials, else ones from the name", async () => {
    const data = sampleData();
    const ruth = data.members.find((m) => m.displayName === 'Ruth Keller')!;
    ruth.initials = 'RUK';
    await renderSignedIn(data, '#/roster');
    const avatar = (name: string) =>
      screen.getByText(name).closest('tr')?.querySelector('.ui-avatar')?.textContent;
    expect(await screen.findByText('Ruth Keller')).toBeTruthy();
    expect(avatar('Ruth Keller')).toBe('RUK');
  });

  it('makes no invite until the admin asks: opening the roster or going to its invite writes nothing', async () => {
    const client = fakeClubClient(sampleData());
    const writes = WRITES.filter((name) => name in client).map((name) =>
      vi.spyOn(client, name as keyof ClubApiClient),
    );
    renderApp(undefined, servicesFor(client));
    await signIn();
    go('#/roster');
    // "Invite members" takes the admin to the invite section, and makes nothing.
    fireEvent.click(await screen.findByRole('button', { name: 'Invite members' }));
    const section = await inviteSection();
    expect(document.activeElement).toBe(within(section).getByRole('heading', { level: 2 }));
    await act(async () => new Promise((done) => setTimeout(done, 50)));
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    expect(within(section).queryByRole('img', { name: 'Club invite QR code' })).toBeNull();
    expect(screen.queryByTestId('invite-link')).toBeNull();
    // Asking makes exactly one, and the page shows its QR code and the copy action.
    await createInviteLink();
    await screen.findByTestId('invite-link');
    expect(within(section).getByRole('img', { name: 'Club invite QR code' })).toBeTruthy();
    expect(within(section).getByRole('button', { name: COPY_INVITE })).toBeTruthy();
    expect(client.createInvite).toHaveBeenCalledTimes(1);
  });

  it('lists stands with plain-language types, and areas', async () => {
    renderApp();
    await signIn();
    go('#/stands');
    expect(await screen.findByText('Big Oak Ladder')).toBeTruthy();
    expect(screen.getByText('Tree stand')).toBeTruthy();
    expect(screen.getAllByText('North 40').length).toBeGreaterThan(0);
  });

  it('draws the stands and areas on the same basemap as My club: live aerial tiles, no chrome', async () => {
    renderApp();
    await signIn();
    go('#/stands');
    const map = await screen.findByRole('img', { name: /^Map of the club/ });
    const tiles = [...map.querySelectorAll('.plan__basemap--live image')];
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      expect(tile.getAttribute('href')!.startsWith(BASEMAPS.aerial.tileUrl.split('{z}')[0]!)).toBe(
        true,
      );
    }
    expect(map.querySelector('.plan__credit')!.textContent).toBe(BASEMAPS.aerial.credit);
    // A map beside a list: no Layers or zoom controls over it.
    expect(screen.queryByRole('button', { name: 'Layers' })).toBeNull();
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
    const rows = (title: string) => tableRows(screen.getByRole('region', { name: title }));

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
      expect(await screen.findByText('No shared harvests in this season yet')).toBeTruthy();
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
    const packRows = async () => tableRows(await screen.findByRole('table'));
    const buildButton = () =>
      screen.getByRole('button', { name: 'Build map pack' }) as HTMLButtonElement;

    it('lists packs with their status, size and reason', async () => {
      await openMaps();
      expect(await packRows()).toEqual([
        ['Aerial', 'Failed USGS did not answer', '—', 'November 12, 2026'],
        ['Topo', 'Ready', '12 MB', 'November 20, 2026'],
      ]);
    });

    it('shows the estimate, starts a build, and then shows it building', async () => {
      await openMaps();
      fireEvent.click(await screen.findByRole('radio', { name: 'Aerial' }));
      expect(screen.getByRole('list', { name: 'Estimate' }).textContent).toMatch(
        /Map tilesAbout [\d,]+DownloadAbout [\d.]+ [KM]B/,
      );
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
      expect((await screen.findByRole('alert')).textContent).toMatch(/Too big for one map pack/);
      expect(buildButton().disabled).toBe(true);
    });

    it('shows the paid state up front, with the way to Billing, for a club with no plan', async () => {
      await openMaps({ ...sampleData(), subscription: null });
      const plate = (await screen.findByText(PLAN_NEEDED.title)).closest('.ui-empty')!;
      expect(plate.textContent).toMatch(/Start the 14-day free trial in Billing/);
      expect(
        within(plate as HTMLElement)
          .getByRole('link', { name: 'Go to Billing' })
          .getAttribute('href'),
      ).toBe('#/billing');
      expect(screen.queryByRole('button', { name: 'Build map pack' })).toBeNull();
      expect(screen.queryByText(/Build one above/)).toBeNull();
    });

    it('asks a lapsed club to renew, and keeps the packs it built', async () => {
      const data = sampleData();
      await openMaps({ ...data, subscription: { ...data.subscription!, status: 'canceled' } });
      expect(
        (await screen.findByText(PLAN_NEEDED.title)).closest('.ui-empty')!.textContent,
      ).toMatch(/Renew the club plan in Billing/);
      expect((await packRows()).length).toBe(2);
    });

    it('turns a 403 club_inactive from the build into the same paid state, keeping the club', async () => {
      const client = fakeClubClient(sampleData());
      const listMyClubs = vi.spyOn(client, 'listMyClubs');
      vi.spyOn(client, 'requestMapPack').mockRejectedValue(
        new ClubApiRequestError(
          'club_inactive',
          403,
          'new map packs need an active club subscription',
        ),
      );
      await openMaps(sampleData(), {
        session: new ClubSession(fakeCognitoAuth(), memoryTokenStore()),
        api: adminApi(client),
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Build map pack' }));
      const plate = (await screen.findByText(PLAN_NEEDED.title)).closest('.ui-empty')!;
      expect(plate.textContent).toMatch(/Renew the club plan in Billing/);
      expect(screen.queryByText(/Could not start the map pack/)).toBeNull();
      expect(screen.queryByText(/access to this club/)).toBeNull();
      // Not an access refusal: the club stays chosen (no fresh lookup of the account's clubs).
      const lookups = listMyClubs.mock.calls.length;
      go('#/maps');
      await screen.findByRole('table');
      expect(listMyClubs.mock.calls.length).toBe(lookups);
    });

    it('asks for the property line first', async () => {
      const data = sampleData();
      const { boundary: _none, ...club } = data.club!;
      await openMaps({ ...data, club });
      const ask = (await screen.findByText('Draw the property line first')).closest('.ui-empty')!;
      // It points to the draw tool on My club's map.
      expect(within(ask as HTMLElement).getByText(DRAW_LINE_FIRST)).toBeTruthy();
      expect(
        within(ask as HTMLElement)
          .getByRole('link', { name: 'Go to My club' })
          .getAttribute('href'),
      ).toBe('#/club');
      expect(screen.queryByRole('button', { name: 'Build map pack' })).toBeNull();
    });

    it('tells an empty list to draw the property line when there is no build control', async () => {
      const data = sampleData();
      const { boundary: _none, ...club } = data.club!;
      await openMaps({ ...data, club, mapPacks: [] });
      expect(
        await screen.findByText(/Draw the property line on the My club map first/),
      ).toBeTruthy();
      expect(screen.queryByText(/Build one above/)).toBeNull();
    });

    it('tells an empty list to build one above when the build control is there', async () => {
      await openMaps({ ...sampleData(), mapPacks: [] });
      expect(await screen.findByText(/Build one above/)).toBeTruthy();
      expect(screen.queryByText(/Draw the property line on the My club map first/)).toBeNull();
    });
  });

  it('shows the plan, price and renewal date, the grace period, and no payment button', async () => {
    const data = sampleData();
    renderApp({ ...data, subscription: { ...data.subscription!, interval: 'year' } });
    await signIn();
    go('#/billing');
    expect(await screen.findByText('Active')).toBeTruthy();
    const yearly = CLUB_PRICING.intervals.year;
    expect(screen.getByText(yearly.price)).toBeTruthy();
    expect(screen.getByText('Club plan, billed yearly')).toBeTruthy();
    expect(screen.getByText('Renews on')).toBeTruthy();
    expect(screen.getByText('August 1, 2027')).toBeTruthy();
    // The grace period is said only once a payment is past due.
    expect(screen.queryByText(/grace period/i)).toBeNull();
    expect(screen.queryByRole('button', { name: CLUB_PRICING.cta })).toBeNull();
  });

  it.each([
    ['a free trial', { status: 'trialing' as const }, 'Free trial ends'],
    ['a plan set to end', { cancelAtPeriodEnd: true }, 'Ends on'],
  ])('dates %s', async (_name, change, label) => {
    const data = sampleData();
    renderApp({ ...data, subscription: { ...data.subscription!, ...change } });
    await signIn();
    go('#/billing');
    expect(await screen.findByText(label)).toBeTruthy();
    expect(screen.queryByText('Renews on')).toBeNull();
  });

  it("opens Stripe's portal from Manage subscription, or says payments aren't set up", async () => {
    const navigateTo = vi.spyOn(navigate, 'navigateTo').mockImplementation(() => undefined);
    const { unmount } = renderApp();
    await signIn();
    go('#/billing');
    fireEvent.click(await screen.findByRole('button', { name: 'Manage subscription' }));
    await vi.waitFor(() =>
      expect(navigateTo).toHaveBeenCalledWith('https://billing.stripe.com/p/session/cus_sample'),
    );
    unmount();
    renderApp({ ...sampleData(), paymentsConfigured: false });
    await signIn();
    go('#/billing');
    fireEvent.click(await screen.findByRole('button', { name: 'Manage subscription' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Payments aren't set up yet/);
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
    const dialog = await createInviteLink();
    expect(within(dialog).getByRole('status').textContent).toBe('Making invite…');
    fail(new ClubApiRequestError('forbidden', 403));
    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'Could not make the invite. Try again.',
    );
    expect(within(dialog).getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('makes no invite when the radio key cannot be read (no orphan invites)', async () => {
    const client = fakeClubClient(sampleData());
    vi.spyOn(client, 'getClubSecret').mockRejectedValue(new ClubApiRequestError('not_found', 404));
    const createInvite = vi.spyOn(client, 'createInvite');
    renderApp(undefined, servicesFor(client));
    await signIn();
    go('#/roster');
    await createInviteLink();
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not make the invite. Try again.',
    );
    expect(createInvite).not.toHaveBeenCalled();
  });

  describe('copying the invite link', () => {
    async function invite() {
      renderApp();
      await signIn();
      go('#/roster');
      await createInviteLink();
      return ((await screen.findByTestId('invite-link')) as HTMLInputElement).value;
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
      fireEvent.click(screen.getByRole('button', { name: COPY_INVITE }));
      expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
      expect(writeText).toHaveBeenCalledWith(link);
    });

    it('keeps the link in a read-only field to copy by hand when the browser will not copy', async () => {
      clipboard(vi.fn(async () => Promise.reject(new Error('denied'))));
      const link = await invite();
      fireEvent.click(screen.getByRole('button', { name: COPY_INVITE }));
      expect(await screen.findByRole('button', { name: 'Could not copy' })).toBeTruthy();
      const field = screen.getByLabelText('Or send this link') as HTMLInputElement;
      expect(field.readOnly).toBe(true);
      expect(field.value).toBe(link);
      fireEvent.focus(field);
      expect([field.selectionStart, field.selectionEnd]).toEqual([0, link.length]);
      expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
      clipboard(undefined);
    });
  });

  it('offers Try again when a page cannot load, and loads on the retry', async () => {
    const client = fakeClubClient(sampleData());
    renderApp(undefined, servicesFor(client));
    await signIn();
    // My club's summary loads the stands too: fail only the Stands page's first load.
    await screen.findByRole('list', { name: 'Club summary' });
    const list = vi.spyOn(client, 'listStands').mockRejectedValueOnce(offline());
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
      await screen.findByRole('heading', { level: 2, name: NO_OTHER_MEMBERS.title }),
    ).toBeTruthy();
    expect(screen.getByText(NO_OTHER_MEMBERS.line)).toBeTruthy();
    // One clear path: the header's "Invite members" is hidden while the empty state and the
    // invite section show.
    expect(screen.getByRole('heading', { level: 2, name: INVITE_TITLE })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Invite members' })).toBeNull();
    // Its action leads to the invite section's QR code (still made only on request).
    fireEvent.click(screen.getByRole('button', { name: INVITE_TITLE }));
    expect(document.activeElement?.textContent).toBe(INVITE_TITLE);
    go('#/stands');
    expect(await screen.findByRole('heading', { level: 2, name: 'Stands 0' })).toBeTruthy();
    expect(screen.getByText('No stands yet')).toBeTruthy();
    expect(screen.getByText('No areas yet')).toBeTruthy();
  });

  it('counts members other than the signed-in admin', async () => {
    const data = sampleData();
    // Only the signed-in admin and one other member: no "no other members" line.
    renderApp({ ...data, members: data.members.slice(0, 2) });
    await signIn();
    go('#/roster');
    expect(await screen.findByText('Ruth Keller')).toBeTruthy();
    expect(screen.queryByText(/No other members yet/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Invite members' })).toBeTruthy();
  });

  it('names the stands and areas tables by their counted headings', async () => {
    renderApp();
    await signIn();
    go('#/stands');
    await screen.findByRole('heading', { level: 2, name: 'Stands 3' });
    const stands = screen.getByRole('table', { name: 'Stands (3)' });
    expect(within(stands).getByRole('columnheader', { name: 'Check-in' })).toBeTruthy();
    expect(tableRows(stands)).toContainEqual(['Field Blind', 'Ground blind', 'North 40', 'Closed']);
    expect(screen.getByRole('heading', { level: 2, name: 'Areas 2' })).toBeTruthy();
    expect(tableRows(screen.getByRole('table', { name: 'Areas (2)' }))).toEqual([
      ['Creek Bottom', '1'],
      ['North 40', '2'],
    ]);
  });

  it('asks for a club before map packs', async () => {
    renderApp({ ...sampleData(), club: null });
    await signIn();
    go('#/maps');
    expect(await screen.findByText(/Create your club first/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to My club' }).getAttribute('href')).toBe('#/club');
  });

  it('puts each table in a labelled scroll region that becomes labelled rows at 390 px', async () => {
    renderApp();
    await signIn();
    for (const [hash, name] of [
      ['#/roster', 'Club members'],
      ['#/stands', 'Stands (3)'],
      ['#/maps', 'Club map packs, newest first'],
    ] as const) {
      go(hash);
      const region = await screen.findByRole('region', { name });
      expect(region.getAttribute('tabindex')).toBe('0');
      const table = within(region).getByRole('table', { name });
      // Under 640 px each row is a card: every cell after the first carries its column's word.
      const headers = within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent);
      const cells = [...table.querySelectorAll('tbody tr:first-child td')].slice(1);
      expect(cells.map((td) => td.querySelector('.ui-table__label')?.textContent)).toEqual(
        headers.slice(1),
      );
    }
    // At 390 px (the phone query) the head is hidden and rows stack; nothing scrolls sideways.
    const phone = globalCss().split('@media (max-width: 639px)').slice(1).join('');
    expect(phone).toMatch(/\.ui-table thead \{ position: absolute; width: 1px/);
    expect(phone).toMatch(
      /\.ui-table, \.ui-table tbody, \.ui-table tr, \.ui-table td \{ display: block; \}/,
    );
    expect(phone).toMatch(/\.ui-table-wrap \{ overflow-x: visible; \}/);
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
    // The selected item is raised with the orange edge, never a colour alone.
    expect(globalCss()).toMatch(
      /\.shell-nav__item\[aria-current='page'\], \.shell-nav__item--current \{[^}]*box-shadow: inset 3px 0 0 var\(--theme-accent\)/,
    );
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
    expect(within(container).getByRole('status').textContent).toBe(LOADING_LABEL);
  });

  it('lays out each billing choice as a row of one list', async () => {
    renderApp({ ...sampleData(), subscription: null });
    await signIn();
    go('#/billing');
    const yearly = await screen.findByRole('radio', { name: /Yearly/ });
    expect(yearly.closest('label')?.classList.contains('ui-radio--card')).toBe(true);
    expect(yearly.closest('.ui-radio-list')?.querySelectorAll('input[type="radio"]')).toHaveLength(
      2,
    );
  });
});
