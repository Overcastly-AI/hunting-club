import { LEGAL_PATHS, type SignedInUser } from '@huntclub/shared';
import { FileText, LogOut, Shield } from 'lucide-react';
import { Avatar, Button, ButtonLink, Popover, ThemeToggle } from '../components/ui';

/** The account button's word, for screen readers (the email beside it may be hidden). */
export const ACCOUNT_LABEL = 'Account';

/**
 * The account menu's contents: who is signed in, Theme (System / Dark / Light), Privacy,
 * Terms and Sign out. Sign out lives only here (the sidebar's account menu, and the same
 * menu under Account in the phone's More sheet).
 */
export function AccountPanel(props: { user: SignedInUser | undefined; onSignOut: () => void }) {
  const email = props.user?.email;
  return (
    <div className="shell-account-panel">
      {email ? (
        <p className="shell-account-panel__who">
          <Avatar name={email} size="md" />
          <span className="shell-account-panel__email">{email}</span>
        </p>
      ) : null}
      <ThemeToggle block />
      <ul className="shell-menu">
        <li>
          <ButtonLink variant="tertiary" block icon={Shield} href={LEGAL_PATHS.privacy}>
            Privacy
          </ButtonLink>
        </li>
        <li>
          <ButtonLink variant="tertiary" block icon={FileText} href={LEGAL_PATHS.terms}>
            Terms
          </ButtonLink>
        </li>
        <li>
          <Button variant="tertiary" block icon={LogOut} onClick={props.onSignOut}>
            Sign out
          </Button>
        </li>
      </ul>
    </div>
  );
}

/** The account button (initials avatar and email) and its menu. */
export function AccountMenu(props: { user: SignedInUser | undefined; onSignOut: () => void }) {
  const email = props.user?.email;
  return (
    <Popover
      label={ACCOUNT_LABEL}
      className="shell-account"
      triggerClassName="shell-account__button"
      panelClassName="shell-account__panel"
      trigger={
        <>
          <Avatar name={email ?? '?'} size="sm" />
          <span className="visually-hidden">{ACCOUNT_LABEL} </span>
          {email ? <span className="shell-account__email">{email}</span> : null}
        </>
      }
    >
      {() => <AccountPanel {...props} />}
    </Popover>
  );
}
