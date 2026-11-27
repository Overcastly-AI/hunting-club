import {
  THEME_ATTRIBUTE,
  THEME_LABEL,
  THEME_PREFERENCE_LABELS,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
} from '@huntclub/design';
import { globalCss } from '../theme/css';
import { ADMIN_PATH, emailStandInName, LEGAL_PATHS, signInCopy } from '@huntclub/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SESSION_EXPIRED } from '../App';
import { BILLING_ALERT_LABELS } from '../billingStatus';
import { axeViolations } from '../components/ui/__tests__/axe';
import { accountAvatarName } from '../shell/Account';
import { MORE_LABEL } from '../shell/Shell';
import { PAGES, pageHref } from '../shell/routes';
import { go, renderSignedIn } from '../testing/app';
import { sampleData, SIGNED_IN } from '../testing/fakeClubApi';
import { accountButton, openAccountMenu, signOutFromMenu } from '../testing/shell';

const nav = () => screen.getByRole('navigation', { name: 'Club admin' });

describe('navigation', () => {
  it('lists every page in order, marks the current one, and keeps a More slot for phones', async () => {
    await renderSignedIn(sampleData(), '#/harvests');
    const links = within(nav()).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(PAGES.map((p) => p.label));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(PAGES.map((p) => pageHref(p.path)));
    expect(links.filter((a) => a.getAttribute('aria-current') === 'page')).toEqual([
      within(nav()).getByRole('link', { name: 'Harvests' }),
    ]);
    // The phone's fifth tab: it opens a sheet with the pages that do not fit and the account.
    expect(within(nav()).getByRole('button', { name: MORE_LABEL })).toBeTruthy();
  });

  it('opens the More sheet with Map packs, Billing and the account, and names a page inside it', async () => {
    await renderSignedIn(sampleData(), '#/maps');
    const more = within(nav()).getByRole('button', {
      name: new RegExp(`^${MORE_LABEL} ?, current page: Map packs$`),
    });
    fireEvent.click(more);
    const sheet = await screen.findByRole('dialog', { name: MORE_LABEL });
    const pages = within(
      within(sheet).getByRole('navigation', { name: 'More pages' }),
    ).getAllByRole('link');
    expect(pages.map((a) => a.textContent)).toEqual(['Map packs', 'Billing']);
    expect(within(sheet).getByRole('button', { name: 'Sign out' })).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('link', { name: 'Billing' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: MORE_LABEL })).toBeNull());
  });

  it('puts the warning dot on Billing (and More) with its reason when payment is past due', async () => {
    const data = sampleData();
    await renderSignedIn({ ...data, subscription: { ...data.subscription!, status: 'past_due' } });
    const reason = BILLING_ALERT_LABELS.pastDue;
    expect(
      await within(nav()).findByRole('link', { name: new RegExp(`^Billing ?, ${reason}$`) }),
    ).toBeTruthy();
    expect(
      within(nav()).getByRole('button', { name: new RegExp(`^${MORE_LABEL} ?, ${reason}$`) }),
    ).toBeTruthy();
  });
});

describe('the account menu', () => {
  it('takes its initials from the shared email stand-in, never a name made up from the email', () => {
    const user = (email?: string) => ({ userId: SIGNED_IN.userId, ...(email ? { email } : {}) });
    expect(accountAvatarName(user('jane.doe@example.com'))).toBe(
      emailStandInName('jane.doe@example.com'),
    );
    // An underscore is no name: "?" in the avatar, not "JD".
    expect(accountAvatarName(user('jane_doe@example.com'))).toBe('');
    expect(accountAvatarName(user())).toBe('');
    expect(accountAvatarName(undefined)).toBe('');
  });

  it('is the only place with Sign out, and holds who is signed in, Theme, Privacy and Terms', async () => {
    await renderSignedIn();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    const button = await accountButton();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const menu = await openAccountMenu();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(within(menu).getByText(SIGNED_IN.email)).toBeTruthy();
    expect(within(menu).getByRole('group', { name: 'Theme' })).toBeTruthy();
    expect(within(menu).getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe(
      LEGAL_PATHS.privacy,
    );
    expect(within(menu).getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe(
      LEGAL_PATHS.terms,
    );
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);
    // Esc closes it and puts focus back on the button.
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });

  it('switches the theme at once and keeps the choice in this browser', async () => {
    await renderSignedIn();
    const menu = await openAccountMenu();
    fireEvent.click(within(menu).getByRole('radio', { name: 'Light' }));
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    fireEvent.click(within(menu).getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    // System: the device decides, so the attribute goes.
    fireEvent.click(within(menu).getByRole('radio', { name: 'System' }));
    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it('offers the same Theme control, with the same words, in the desktop menu and the phone More sheet', async () => {
    await renderSignedIn();
    const words = (group: HTMLElement) =>
      within(group)
        .getAllByRole('radio')
        .map((r) => r.closest('label')!.textContent);
    const expected = THEME_PREFERENCES.map((p) => THEME_PREFERENCE_LABELS[p]);
    const menu = await openAccountMenu();
    expect(words(within(menu).getByRole('group', { name: THEME_LABEL }))).toEqual(expected);
    fireEvent.keyDown(menu, { key: 'Escape' });
    fireEvent.click(within(nav()).getByRole('button', { name: MORE_LABEL }));
    const sheet = await screen.findByRole('dialog', { name: MORE_LABEL });
    expect(words(within(sheet).getByRole('group', { name: THEME_LABEL }))).toEqual(expected);
  });
});

describe('the club switcher', () => {
  it('opens 4 px under its button, as wide as the rail, and full width under the phone top bar', () => {
    const css = globalCss();
    expect(css).toContain(
      '.shell-club .ui-popover__panel.shell-club__panel { top: calc(100% + var(--space-1)); left: 0; right: 0; width: auto;',
    );
  });
});

describe('signing out', () => {
  it('goes back to sign in with no hash and no "session expired", and revokes the session', async () => {
    const { auth } = await renderSignedIn(sampleData(), '#/roster');
    const revoke = vi.spyOn(auth, 'revoke');
    await signOutFromMenu();
    expect(await screen.findByRole('heading', { level: 1, name: signInCopy.title })).toBeTruthy();
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe(ADMIN_PATH);
    expect(screen.queryByText(SESSION_EXPIRED)).toBeNull();
    await waitFor(() => expect(revoke).toHaveBeenCalledTimes(1));
  });
});

describe('dialogs', () => {
  it('open modally and take focus, so the page behind is inert until they close', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    await renderSignedIn(sampleData(), '#/roster');
    const more = within(nav()).getByRole('button', { name: MORE_LABEL });
    // The More tab says whether its sheet is open, and which element the sheet is.
    expect(more.getAttribute('aria-expanded')).toBe('false');
    const sheetId = more.getAttribute('aria-controls')!;
    expect(document.getElementById(sheetId)?.tagName).toBe('DIALOG');
    more.focus();
    fireEvent.click(more);
    const dialog = await screen.findByRole('dialog', { name: MORE_LABEL });
    expect(dialog.id).toBe(sheetId);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    // showModal() makes everything outside the dialog inert: Tab can only reach its controls
    // (checked in a real browser by scripts/shoot.ts). Focus moves into the sheet.
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Focus is back on the tab that opened it.
    expect(document.activeElement).toBe(more);
    expect(more.getAttribute('aria-expanded')).toBe('false');
    showModal.mockRestore();
  });
});

describe('accessibility of every page', () => {
  it.each(PAGES.map((p) => [p.label, p.path] as const))(
    '%s has no serious or critical axe issue',
    async (label, path) => {
      const { container } = await renderSignedIn(sampleData(), pageHref(path));
      await screen.findByRole('heading', { level: 1 });
      await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull());
      const serious = (await axeViolations(container)).filter((v) =>
        /\((serious|critical)\)/.test(v),
      );
      expect({ label, serious }).toEqual({ label, serious: [] });
    },
  );

  it('focuses the page heading after moving to another page', async () => {
    await renderSignedIn();
    go('#/billing');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Billing' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });
});
