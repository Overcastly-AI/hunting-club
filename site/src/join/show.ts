import { appJoinUrl, classifyJoinFragment, joinClubName } from '@huntclub/mesh/join-kind';
import { qrSvg } from '@huntclub/shared/qr';
import { JOIN_HOOKS, JOIN_QR_LABEL, joinClubHeading, type JoinState } from './states';

/** Which state a page URL's fragment puts the /join page in: no invite at all is invalid too. */
export function joinStateOf(hash: string): JoinState {
  return classifyJoinFragment(hash)?.kind ?? 'invalid';
}

/**
 * Shows the state for this invite, points "Open in Hunt Club Mesh" at the app link and
 * draws the QR code for a phone camera. Reads the URL only; never sends or logs it (the
 * fragment holds the radio channel key).
 */
export function showInvite(doc: Document, href: string): JoinState {
  const hashAt = href.indexOf('#');
  const hash = hashAt < 0 ? '' : href.slice(hashAt);
  const state = joinStateOf(hash);
  for (const el of doc.querySelectorAll<HTMLElement>(`[${JOIN_HOOKS.state}]`)) {
    el.hidden = !(el.getAttribute(JOIN_HOOKS.state) ?? '').split(' ').includes(state);
  }
  const clubName = state === 'club' ? joinClubName(hash) : null;
  if (clubName) {
    // textContent, never innerHTML: the name comes from the link and is shown as plain text.
    for (const el of doc.querySelectorAll<HTMLElement>(`[${JOIN_HOOKS.clubName}]`)) {
      el.textContent = joinClubHeading(clubName);
    }
  }
  const app = appJoinUrl(hash);
  if (app) {
    for (const link of doc.querySelectorAll<HTMLAnchorElement>(`[${JOIN_HOOKS.open}]`)) {
      link.href = app;
    }
    const qr = doc.querySelector<HTMLElement>(`[${JOIN_HOOKS.qr}]`);
    if (qr) qr.innerHTML = qrSvg(href, { label: JOIN_QR_LABEL, size: 240 });
  }
  return state;
}
