// @vitest-environment jsdom
import { assets } from './fixtures';
import { channelSetWithKey, decodeJoinUrl, encodeJoinUrl, type JoinTarget } from '@huntclub/mesh';
import { renderJoin } from '../render';
import { showInvite } from '../join/show';
import { JOIN_HOOKS, JOIN_QR_LABEL, JOIN_STATES } from '../join/states';
import { JOIN_INVALID_HEADING, JOIN_INVALID_NEXT_STEP } from '../pages/Join';
import { CLUB_NAME_MAX } from '@huntclub/shared/limits';
import { JOIN_PAGE } from '../routes';

const SCRIPT = '/assets/join-test.js';
const html = renderJoin(assets, SCRIPT);
const channelSet = channelSetWithKey(new Uint8Array(32).fill(9));
const TARGETS: JoinTarget[] = [
  { kind: 'party', partyId: 'p-3f9a' },
  { kind: 'club', clubId: 'club-1', inviteToken: 'ab'.repeat(32) },
];

/** The text a visitor sees: hidden states removed. */
function visibleText(root: HTMLElement): string {
  const copy = root.cloneNode(true) as HTMLElement;
  for (const el of copy.querySelectorAll('[hidden]')) el.remove();
  return copy.textContent ?? '';
}

/** Loads the prerendered page, runs the script for this URL, and returns what shows. */
function open(href: string) {
  document.documentElement.innerHTML = html.replace(/^<!doctype html><html[^>]*>|<\/html>$/g, '');
  const state = showInvite(document, href);
  const visible = (el: Element) => !el.closest('[hidden]');
  const heading = [...document.querySelectorAll('h1 [data-join-state]')].find(visible);
  const openLink = document.querySelector<HTMLAnchorElement>(`[${JOIN_HOOKS.open}]`)!;
  return {
    state,
    heading: heading?.textContent,
    open: visible(openLink) ? openLink.getAttribute('href') : null,
    qr: document.querySelector(`[${JOIN_HOOKS.qr}] svg`),
    text: visibleText(document.body),
  };
}

describe('the /join page', () => {
  it('is noindex with no canonical, sends no referrer, and loads only its own script', () => {
    expect(html).toContain('<meta name="robots" content="noindex"/>');
    expect(html).toContain('<meta name="referrer" content="no-referrer"/>');
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain(`<title>${JOIN_PAGE.title}</title>`);
    expect(html.match(/<script[^>]*>/g)).toEqual([`<script type="module" src="${SCRIPT}">`]);
    // No third-party scripts, fonts, images or stylesheets.
    expect(html).not.toMatch(/(src|href)="(https?:)?\/\//);
  });

  it('never carries the home page map or its picture', () => {
    expect(html).not.toContain(assets.aerialUrl);
    expect(html).not.toContain('class="world"');
  });

  it('has the content for every state, with the general invite shown before the script runs', () => {
    for (const state of JOIN_STATES) expect(html).toContain(`data-join-state="${state}"`);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });
});

describe('the /join script', () => {
  it.each(TARGETS)('shows a $kind invite, opens it in the app and draws its QR code', (target) => {
    const web = encodeJoinUrl({ channelSet, target }, { form: 'web' });
    const page = open(web);
    expect(page.state).toBe(target.kind);
    expect(page.heading).toBe(
      target.kind === 'club' ? 'Join your hunting club' : 'Hunt with your party',
    );
    expect(page.open).toBe(encodeJoinUrl({ channelSet, target }));
    expect(decodeJoinUrl(page.open!)).toEqual(decodeJoinUrl(web));
    expect(page.qr?.getAttribute('aria-label')).toBe(JOIN_QR_LABEL);
    // The invite (and its key) is never written into the page's text.
    expect(page.text).not.toContain(web.slice(web.indexOf('#') + 1));
    expect(page.text).not.toMatch(/not complete/);
  });

  it.each([
    ['an incomplete invite', 'https://example.com/join#cs=AAAA'],
    ['no invite at all', 'https://example.com/join'],
    ['a fragment that is not an invite', 'https://example.com/join#hello'],
  ])('says %s is missing or invalid, with one next step and no app link or QR', (_what, href) => {
    const page = open(href);
    expect(page.state).toBe('invalid');
    expect(page.heading).toBe(JOIN_INVALID_HEADING);
    expect(page.text).toContain(JOIN_INVALID_NEXT_STEP);
    expect(page.text).not.toMatch(/You're invited|Install the app/);
    expect(document.querySelector('[role="alert"]')?.closest('[hidden]')).toBeNull();
    expect(page.open).toBeNull();
    expect(page.qr).toBeNull();
    // One next step: no buttons or links in the visible content besides the shell's own.
    const visibleLinks = [...document.querySelectorAll('.join a, .join button')].filter(
      (el) => !el.closest('[hidden]'),
    );
    expect(visibleLinks).toEqual([]);
  });
});

describe('the club name on /join', () => {
  const club = { kind: 'club', clubId: 'club-1', inviteToken: 'ab'.repeat(32) } as const;
  const linkFor = (clubName?: string) =>
    encodeJoinUrl(
      { channelSet, target: clubName === undefined ? club : { ...club, clubName } },
      { form: 'web' },
    );

  it('says "Join <club name>" when the link names the club', () => {
    const page = open(linkFor('Oak Ridge Hunt Club'));
    expect(page.state).toBe('club');
    expect(page.heading).toBe('Join Oak Ridge Hunt Club');
  });

  it('keeps the generic heading for an old link without the name', () => {
    expect(open(linkFor()).heading).toBe('Join your hunting club');
  });

  it('shows a malicious name as plain text, never as markup', () => {
    const evil = '<img src=x onerror="window.pwned=1"><b>Oak</b>';
    const page = open(linkFor(evil));
    expect(page.heading).toBe(`Join ${evil}`);
    const h1 = document.querySelector('h1')!;
    expect(h1.querySelector('img, b, script')).toBeNull();
    expect((window as unknown as { pwned?: number }).pwned).toBeUndefined();
  });

  it('ignores a name that is too long, and strips control characters', () => {
    const base = linkFor();
    expect(open(`${base}&name=${'x'.repeat(CLUB_NAME_MAX + 1)}`).heading).toBe(
      'Join your hunting club',
    );
    expect(open(`${base}&name=Oak%E2%80%AE%0ARidge`).heading).toBe('Join Oak Ridge');
  });
});
