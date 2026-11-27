import { ICON_SIZE } from '@huntclub/design';
import type { SignedInUser } from '@huntclub/shared';
import { Ellipsis } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ClubApi } from '../api/types';
import { BILLING_ALERT_LABELS, billingAlert, type BillingAlert } from '../billingStatus';
import { cx } from '../components/ui/cx';
import { Dialog } from '../components/ui';
import { AccountMenu, AccountPanel } from './Account';
import { ClubBlock } from './ClubBlock';
import { Brand } from './PublicShell';
import { PAGES, pageHref, type AdminPage, type PagePath } from './routes';
import { ShellReloadContext, useShellClub } from './shellClub';

/** The phone tab bar's last slot, which opens the More sheet. */
export const MORE_LABEL = 'More';

/**
 * The signed-in admin's frame (docs/UI_REDESIGN.md section 5). One set of elements, laid out
 * by the stylesheet (shell/styles.ts): a 240 px sidebar from 1024 px, a 72 px icon rail
 * from 640 px, and below that a 56 px top bar (logo, club, account) with a 64 px tab bar
 * (My club, Roster, Stands, Harvests, More). Content is at most 1120 px wide.
 */
export function Shell(props: {
  api: ClubApi;
  user: SignedInUser | undefined;
  /** The page shown, or null for Page not found. */
  path: PagePath | null;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const club = useShellClub(props.api);
  const [moreOpen, setMoreOpen] = useState(false);
  const alert = club.status === 'ready' ? billingAlert(club.value.subscription) : undefined;
  const currentInMore = PAGES.find((p) => p.path === props.path && 'inMore' in p);
  const signOut = () => {
    setMoreOpen(false);
    props.onSignOut();
  };

  return (
    <ShellReloadContext.Provider value={club.reload}>
      <div className="shell">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="shell-side">
          <Brand />
          <ClubBlock state={club} />
          <nav className="shell-nav" aria-label="Club admin">
            <ul className="shell-nav__list">
              {PAGES.map((page) => (
                <li
                  key={page.path}
                  className={cx('shell-nav__slot', 'inMore' in page && 'shell-nav__slot--in-more')}
                >
                  <NavLink
                    page={page}
                    current={page.path === props.path}
                    alert={page.path === 'billing' ? alert : undefined}
                  />
                </li>
              ))}
              <li className="shell-nav__slot shell-nav__slot--more">
                <button
                  type="button"
                  className={cx('shell-nav__item', currentInMore && 'shell-nav__item--current')}
                  aria-haspopup="dialog"
                  onClick={() => setMoreOpen(true)}
                >
                  <span className="shell-nav__icon">
                    <Ellipsis size={ICON_SIZE.lg} aria-hidden />
                    {alert ? <AlertDot alert={alert} /> : null}
                  </span>
                  <span className="shell-nav__label">{MORE_LABEL}</span>
                  {/* The current page stays named on the tab bar when it lives in More. */}
                  {currentInMore ? (
                    <span className="visually-hidden">, current page: {currentInMore.label}</span>
                  ) : null}
                </button>
              </li>
            </ul>
          </nav>
          <AccountMenu user={props.user} onSignOut={signOut} />
        </header>
        <main id="main" className="shell-main">
          <div className="shell-content">{props.children}</div>
        </main>
        <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title={MORE_LABEL}>
          <nav aria-label="More pages">
            <ul className="shell-more">
              {PAGES.filter((p) => 'inMore' in p).map((page) => (
                <li key={page.path}>
                  <NavLink
                    page={page}
                    current={page.path === props.path}
                    alert={page.path === 'billing' ? alert : undefined}
                    wide
                    onClick={() => setMoreOpen(false)}
                  />
                </li>
              ))}
            </ul>
          </nav>
          <h3 className="shell-more__heading">Account</h3>
          <AccountPanel user={props.user} onSignOut={signOut} />
        </Dialog>
      </div>
    </ShellReloadContext.Provider>
  );
}

/** A nav item: icon and word; the current one is marked aria-current="page". */
function NavLink(props: {
  page: AdminPage;
  current: boolean;
  alert?: BillingAlert;
  /** In the More sheet: always the full label. */
  wide?: boolean;
  onClick?: () => void;
}) {
  const { page, current, alert } = props;
  const Icon = page.icon;
  const short = !props.wide && page.shortLabel && page.label.startsWith(page.shortLabel);
  return (
    <a
      className={cx('shell-nav__item', props.wide && 'shell-nav__item--wide')}
      href={pageHref(page.path as PagePath)}
      aria-current={current ? 'page' : undefined}
      onClick={props.onClick}
    >
      <span className="shell-nav__icon">
        <Icon size={ICON_SIZE.lg} aria-hidden />
        {alert ? <AlertDot alert={alert} /> : null}
      </span>
      <span className="shell-nav__label">
        {short ? (
          <>
            {page.shortLabel}
            {/* Desktop shows the whole name; the rail and the tab bar only its start. */}
            <span className="shell-nav__label-rest">
              {page.label.slice(page.shortLabel!.length)}
            </span>
          </>
        ) : (
          page.label
        )}
      </span>
    </a>
  );
}

/** The warning dot on Billing (and More), with its reason for screen readers. */
function AlertDot(props: { alert: BillingAlert }) {
  return (
    <span className={cx('shell-dot', `shell-dot--${props.alert}`)}>
      <span className="visually-hidden">, {BILLING_ALERT_LABELS[props.alert]}</span>
    </span>
  );
}
