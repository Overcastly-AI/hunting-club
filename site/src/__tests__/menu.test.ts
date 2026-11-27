// @vitest-environment jsdom
// The header menu script on the prerendered home page: open, close, scroll lock and ARIA.
import { assets } from './fixtures';
import {
  MENU_LABELS,
  MENU_OPEN_CLASS,
  MENU_SHEET_ID,
  MENU_TOGGLE_CLASS,
  setUpMenu,
} from '../menu/menu';
import { renderPage } from '../render';

const html = renderPage('/', assets);

/** A stand-in for matchMedia's list: `grow()` fires what a browser fires past the phone width. */
function fakeMedia() {
  const target = new EventTarget();
  const media = target as unknown as MediaQueryList;
  const grow = () => target.dispatchEvent(Object.assign(new Event('change'), { matches: false }));
  return { media, grow };
}

/** Loads the prerendered page and runs the menu script on it. */
function load() {
  document.documentElement.className = '';
  document.documentElement.innerHTML = html.replace(/^<!doctype html><html[^>]*>|<\/html>$/g, '');
  const { media, grow } = fakeMedia();
  setUpMenu(document, media);
  const toggle = document.querySelector<HTMLButtonElement>(`.${MENU_TOGGLE_CLASS}`)!;
  const sheet = document.getElementById(MENU_SHEET_ID)!;
  const state = () => ({
    expanded: toggle.getAttribute('aria-expanded'),
    word: toggle.textContent,
    hidden: sheet.hidden,
    locked: document.documentElement.classList.contains(MENU_OPEN_CLASS),
  });
  return { toggle, sheet, state, grow };
}

const CLOSED = { expanded: 'false', word: MENU_LABELS.closed, hidden: true, locked: false };
const OPEN = { expanded: 'true', word: MENU_LABELS.open, hidden: false, locked: true };

describe('the header menu', () => {
  it('starts closed, and its toggle names the sheet it controls', () => {
    const { toggle, state } = load();
    expect(state()).toEqual(CLOSED);
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-controls')).toBe(MENU_SHEET_ID);
  });

  it('opens on a tap, says Close, and locks the page scroll; a second tap closes it', () => {
    const { toggle, state } = load();
    toggle.click();
    expect(state()).toEqual(OPEN);
    toggle.click();
    expect(state()).toEqual(CLOSED);
  });

  it('closes on Escape and gives focus back to the toggle', () => {
    const { toggle, state } = load();
    toggle.click();
    document.body.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(state()).toEqual(CLOSED);
    expect(document.activeElement).toBe(toggle);
  });

  it('closes when a link in it is tapped, but not on a tap between links', () => {
    const { toggle, sheet, state } = load();
    toggle.click();
    sheet.querySelector('ul')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(state()).toEqual(OPEN);
    const link = sheet.querySelector('a')!;
    link.addEventListener('click', (e) => e.preventDefault());
    link.click();
    expect(state()).toEqual(CLOSED);
  });

  it('closes when the window grows past the phone header', () => {
    const { toggle, state, grow } = load();
    toggle.click();
    grow();
    expect(state()).toEqual(CLOSED);
  });

  it('does nothing on a page without the menu', () => {
    document.documentElement.innerHTML = '<body></body>';
    expect(setUpMenu(document)).toBeUndefined();
  });
});
