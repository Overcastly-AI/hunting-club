/**
 * The phone header's menu: one button (Menu / Close) that opens the site links as a sheet
 * fixed under the header. Shared by the header (Shell.tsx renders the hooks) and the
 * self-hosted script (./main.ts); never inline, under the strict CSP.
 */

/** Phones and small tablets: the header is the logo and the one Menu button. */
export const PHONE_HEADER_MAX_WIDTH = 860;
export const PHONE_HEADER_MEDIA = `(max-width: ${PHONE_HEADER_MAX_WIDTH}px)`;
/** The phone header: one row this tall; the sheet opens right under it. */
export const PHONE_HEADER_HEIGHT = 64;

/** The sheet's id: the toggle's aria-controls. */
export const MENU_SHEET_ID = 'site-menu';
/** The toggle button's class. */
export const MENU_TOGGLE_CLASS = 'menu-toggle';
/** On <html> while the sheet is open: locks the page's scroll under it. */
export const MENU_OPEN_CLASS = 'menu-open';
/** The toggle's word while the sheet is closed, and while it is open. */
export const MENU_LABELS = { closed: 'Menu', open: 'Close' } as const;

/**
 * Wires the toggle: opens and closes the sheet, keeps aria-expanded and the word in step,
 * locks the page's scroll while open, and closes on Escape, on a link tap, and when the
 * window grows past `phoneMedia` (where the header shows its own nav). Returns `close`.
 */
export function setUpMenu(doc: Document, phoneMedia?: MediaQueryList): (() => void) | undefined {
  const toggle = doc.querySelector<HTMLButtonElement>(`.${MENU_TOGGLE_CLASS}`);
  const sheet = doc.getElementById(MENU_SHEET_ID);
  if (!toggle || !sheet) return undefined;

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  const set = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? MENU_LABELS.open : MENU_LABELS.closed;
    sheet.hidden = !open;
    doc.documentElement.classList.toggle(MENU_OPEN_CLASS, open);
  };
  const close = () => set(false);

  toggle.addEventListener('click', () => set(!isOpen()));
  sheet.addEventListener('click', (event) => {
    if ((event.target as Element | null)?.closest('a')) close();
  });
  doc.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    close();
    toggle.focus();
  });
  phoneMedia?.addEventListener('change', (event) => {
    if (!event.matches) close();
  });
  return close;
}
