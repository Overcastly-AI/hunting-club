// UI Director review, 2026-11-27, batch 2: the sign-in code step and backdrop, loading
// skeletons, empty states and wording.
import { opacity } from '@huntclub/design';
import {
  ClubSession,
  emailCodeRules,
  memoryTokenStore,
  polygonBounds,
  signInCopy,
} from '@huntclub/shared';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { adminApi } from '../api/admin';
import { App } from '../App';
import { Loading, type LoadingLayout } from '../components/Loading';
import { SKELETON_DELAY_MS } from '../components/ui';
import { STAND_STATUS_LABELS } from '../format';
import { SAMPLE_PACK } from '../map/samplePack';
import { SAMPLE_PROPERTY } from '../map/sampleProperty';
import { globalCss } from '../theme/css';
import { renderSignedIn } from '../testing/app';
import {
  fakeClubClient,
  fakeCognitoAuth,
  fakeTokens,
  sampleData,
  testCode,
} from '../testing/fakeClubApi';
import { packArchive, packFetch } from '../testing/packArchive';
import { requestCode } from '../testing/shell';

function renderSignInPage() {
  const auth = fakeCognitoAuth();
  const session = new ClubSession(auth, memoryTokenStore());
  window.location.hash = '';
  render(<App session={session} api={adminApi(fakeClubClient(sampleData()))} />);
  return { auth };
}

describe('sign-in code step', () => {
  it('labels the field by the code length, with the numeric keypad and one-time-code fill', async () => {
    renderSignInPage();
    const input = (await requestCode()) as HTMLInputElement;
    const { length } = emailCodeRules('signIn');
    expect(signInCopy.code('signIn')).toBe(`${length}-digit code`);
    expect(screen.getByLabelText(`${length}-digit code`)).toBe(input);
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.maxLength).toBe(length);
  });

  it('sends the code once when the last digit lands, even if Sign in is pressed too', async () => {
    const { auth } = renderSignInPage();
    const confirm = vi.spyOn(auth, 'confirmCode');
    const input = await requestCode();
    const code = testCode();
    fireEvent.change(input, { target: { value: code.slice(0, -1) } });
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: code } });
    fireEvent.click(screen.getByRole('button', { name: signInCopy.signingIn }));
    fireEvent.submit(input.closest('form')!);
    await screen.findByRole('navigation', { name: 'Club admin' });
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});

describe('sign-in page', () => {
  it("draws the sample property's aerial behind the form, read like a club's pack and dimmed", async () => {
    const fetch = packFetch(SAMPLE_PACK, packArchive(polygonBounds(SAMPLE_PROPERTY.boundary)));
    vi.stubGlobal('fetch', fetch);
    try {
      renderSignInPage();
      await screen.findByLabelText(signInCopy.email);
      const map = document.querySelector('.signin__map')!;
      await waitFor(() =>
        expect(map.querySelectorAll('.plan__basemap image').length).toBeGreaterThan(0),
      );
      for (const [url] of fetch.mock.calls) expect(url).toBe(`/${SAMPLE_PACK.s3Key}`);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(globalCss()).toContain(`.signin__map .plan__basemap { opacity: ${opacity.backdrop}; }`);
  });

  it('sizes the form plate to its contents, centred, with the field on the plate fill', () => {
    const css = globalCss();
    const door = /\.signin__door \{[^}]*\}/.exec(css)![0];
    expect(door).not.toMatch(/min-height/);
    expect(css).toMatch(/\.signin \{[^}]*display: flex; align-items: center;/);
    expect(css).toContain('.signin__door .ui-input { background: var(--theme-plate); }');
    // The control edge stays the field's own.
    expect(css).toMatch(
      /\.ui-input, \.ui-select, \.ui-textarea \{[^}]*border: var\(--control-border\) solid var\(--theme-border-control\)/,
    );
  });
});

describe('loading', () => {
  afterEach(() => vi.useRealTimers());

  it.each<[LoadingLayout, string]>([
    ['table', '.ui-table-wrap .ui-table tbody tr'],
    ['stats', '.ui-stat-grid .ui-skeleton--tile'],
    ['map', '.ui-skeleton--map'],
    ['page', '.ui-skeleton--title'],
  ])(
    'shows nothing for 200 ms, then the %s skeleton, with a polite status throughout',
    (layout, shape) => {
      vi.useFakeTimers();
      const { container } = render(<Loading layout={layout} />);
      const status = within(container).getByRole('status');
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(container.querySelector('.ui-skeleton')).toBeNull();
      act(() => vi.advanceTimersByTime(SKELETON_DELAY_MS - 1));
      expect(container.querySelector('.ui-skeleton')).toBeNull();
      act(() => vi.advanceTimersByTime(1));
      expect(container.querySelector(shape)).toBeTruthy();
      // The shapes are hidden from screen readers, which hear the status once.
      for (const el of container.querySelectorAll('.ui-skeleton'))
        expect(el.closest('[aria-hidden="true"]')).toBeTruthy();
    },
  );

  it('draws skeleton table rows at the table row height, and keeps every skeleton still under reduced motion', () => {
    const css = globalCss();
    expect(css).toMatch(/\.ui-table td \{ height: \d+px;/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{ \.ui-skeleton \{ animation: none; background-image: none; \} \}/,
    );
  });

  it('has no "Loading…" line left anywhere', async () => {
    const client = fakeClubClient(sampleData());
    const never = () => new Promise<never>(() => undefined);
    vi.spyOn(client, 'listMembers').mockImplementation(never);
    window.location.hash = '#/roster';
    const session = new ClubSession(fakeCognitoAuth(), memoryTokenStore(fakeTokens()));
    render(<App session={session} api={adminApi(client)} />);
    await screen.findByRole('heading', { level: 1, name: 'Roster' });
    await waitFor(() => expect(document.querySelector('.loading--table .ui-table')).toBeTruthy());
    expect(screen.queryByText(/Loading…/)).toBeNull();
  });
});

describe('wording', () => {
  it('calls an open stand Available, on the stands list and the map', async () => {
    expect(STAND_STATUS_LABELS.open).toBe('Available');
    await renderSignedIn(sampleData(), '#/stands');
    await screen.findByRole('heading', { level: 1, name: 'Stands and areas' });
    const table = await screen.findByRole('table', { name: /^Stands/ });
    expect(within(table).getAllByText('Available').length).toBeGreaterThan(0);
    expect(screen.queryByText('Open')).toBeNull();
  });

  it('gives the season dates the same field box as the other filters', async () => {
    await renderSignedIn(sampleData(), '#/harvests');
    const start = await screen.findByLabelText('Season starts');
    expect(start.closest('.ui-field')!.classList.contains('filters__date')).toBe(true);
    expect(start.classList.contains('ui-input')).toBe(true);
    expect(globalCss()).toContain('.filters__date { flex: 0 1 15rem; min-width: 10rem; }');
  });
});
