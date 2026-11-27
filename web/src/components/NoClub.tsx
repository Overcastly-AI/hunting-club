import { UserX, Users } from 'lucide-react';
import { HOME_PATH, pageHref } from '../shell/routes';
import { useReloadShell } from '../shell/shellClub';
import { ButtonLink, EmptyState } from './ui';

/** Pages that need a club, before there is one (the same words everywhere). */
export function NoClub() {
  return (
    <EmptyState
      icon={Users}
      title="Create your club first"
      action={
        <ButtonLink variant="primary" href={pageHref(HOME_PATH)}>
          Go to My club
        </ButtonLink>
      }
    >
      Stands, areas, the roster and map packs all belong to a club.
    </EmptyState>
  );
}

export const NO_ACCESS_TITLE = "You don't have access to this club";

/**
 * The club service refused the selected club (403) and this account runs no other, e.g.
 * someone else chose it on this browser. The choice is already dropped: "Start a club"
 * opens My club (reloading, so it offers to create one); Sign out is in Account.
 */
export function NoClubAccess(props: { onStart: () => void }) {
  const reloadShell = useReloadShell();
  return (
    <EmptyState
      icon={UserX}
      title={NO_ACCESS_TITLE}
      action={
        <ButtonLink
          variant="primary"
          href={pageHref(HOME_PATH)}
          onClick={() => {
            props.onStart();
            reloadShell();
          }}
        >
          Start a club
        </ButtonLink>
      }
    >
      This account isn&apos;t an admin of it. If you run your club with another email, sign out from
      Account and sign in with that one.
    </EmptyState>
  );
}
