// @vitest-environment jsdom
import { assets } from './fixtures';
import { DAWN_CLASS, DAWN_PAUSE_BUTTON_CLASS } from '@huntclub/design/dawnControl';
import { channelSetWithKey, decodeJoinUrl, encodeJoinUrl, type JoinTarget } from '@huntclub/mesh';
import { renderJoin } from '../render';
import { showInvite } from '../join/show';
import { JOIN_HOOKS, JOIN_QR_LABEL, JOIN_STATES } from '../join/states';
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

  it('never shows the dawn scene, its stylesheet or its pause button', () => {
    open('https://example.com/join');
    expect(document.querySelector(`.${DAWN_CLASS}`)).toBeNull();
    expect(document.querySelector(`.${DAWN_PAUSE_BUTTON_CLASS}`)).toBeNull();
    expect(html).not.toContain(assets.dawn.cssUrl);
    expect(html).not.toContain(assets.dawn.scriptUrl);
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

  it('says an incomplete invite is not complete, with no app link or QR code', () => {
    const page = open('https://example.com/join#cs=AAAA');
    expect(page.state).toBe('invalid');
    expect(page.heading).toBe('This invite link is not complete');
    expect(document.querySelector('[role="alert"]')?.closest('[hidden]')).toBeNull();
    expect(page.open).toBeNull();
    expect(page.qr).toBeNull();
  });

  it('reads as a general invite when opened with no invite', () => {
    const page = open('https://example.com/join');
    expect(page.state).toBe('generic');
    expect(page.open).toBeNull();
    expect(page.text).toMatch(/Install the app/);
  });
});
