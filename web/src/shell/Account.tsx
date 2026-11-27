import { emailStandInName, LEGAL_PATHS, type Member, type SignedInUser } from '@huntclub/shared';
import { FileText, LogOut, Shield } from 'lucide-react';
import { Avatar, Button, ButtonLink, Popover, ThemeToggle } from '../components/ui';
import { ADMIN_TITLE } from '../title';

/** The account button's word, for screen readers (the name beside it may be hidden). */
export const ACCOUNT_LABEL = 'Account';

/** Who is signed in: the account, and their membership of the club when there is one. */
export interface AccountProps {
  user: SignedInUser | undefined;
  me: Pick<Member, 'displayName' | 'initials'> | null;
  onSignOut: () => void;
}

/**
 * How the account is named: the member's saved name and initials in the club. With no club yet,
 * the avatar's initials come from the email's stand-in by the shared rule (emailStandInName),
 * never a name made up from the email, and only the email is written.
 */
export function accountIdentity(props: Pick<AccountProps, 'user' | 'me'>): {
  name: string | undefined;
  avatar: { name: string; initials?: string };
} {
  if (props.me) {
    return {
      name: props.me.displayName,
      avatar: { name: props.me.displayName, initials: props.me.initials },
    };
  }
  const email = props.user?.email;
  return { name: undefined, avatar: { name: email ? emailStandInName(email) : '' } };
}

/**
 * The account menu's contents: who is signed in, Theme (System / Dark / Light), Privacy,
 * Terms and Sign out. Sign out lives only here (the sidebar's account menu, and the same
 * menu under Account in the phone's More sheet).
 */
export function AccountPanel(props: AccountProps) {
  const email = props.user?.email;
  const { name, avatar } = accountIdentity(props);
  return (
    <div className="shell-account-panel">
      {name || email ? (
        <p className="shell-account-panel__who">
          <Avatar {...avatar} size="md" />
          <span className="shell-account-panel__lines">
            {name ? <span className="shell-account-panel__name">{name}</span> : null}
            {email ? <span className="shell-account-panel__email">{email}</span> : null}
          </span>
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

/** The account button (initials, name or email, and "Club admin") and its menu. */
export function AccountMenu(props: AccountProps) {
  const { name, avatar } = accountIdentity(props);
  const who = name ?? props.user?.email;
  return (
    <Popover
      label={ACCOUNT_LABEL}
      className="shell-account"
      triggerClassName="shell-account__button"
      panelClassName="shell-account__panel"
      trigger={
        <>
          <Avatar {...avatar} size="md" />
          <span className="visually-hidden">{ACCOUNT_LABEL} </span>
          <span className="shell-account__who">
            {who ? <span className="shell-account__email">{who}</span> : null}
            <span className="shell-account__role" aria-hidden="true">
              {ADMIN_TITLE}
            </span>
          </span>
        </>
      }
    >
      {() => <AccountPanel {...props} />}
    </Popover>
  );
}
