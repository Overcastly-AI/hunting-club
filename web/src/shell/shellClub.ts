import type { Club, Member, Subscription } from '@huntclub/shared';
import { createContext, useContext } from 'react';
import type { ClubApi } from '../api/types';
import { isOffline, useAsync, type AsyncResult } from '../components/useAsync';

/**
 * What the shell shows about the club: its name, status pill and the Billing warning dot, and
 * the signed-in person's own name and initials in it (the account menu).
 */
export interface ShellClub {
  club: Club | null;
  subscription: Subscription | null;
  me: Member | null;
}

/** Loads the club and its subscription for the shell (null club: none yet). */
export function useShellClub(api: ClubApi): AsyncResult<ShellClub> {
  return useAsync(
    async () => {
      const club = await api.getClub();
      if (!club) return { club: null, subscription: null, me: null };
      // The shell still names the club when the subscription or membership cannot be read.
      const [subscription, me] = await Promise.all([
        api.getSubscription().catch(() => null),
        api.getMyMembership().catch(() => null),
      ]);
      return { club, subscription, me };
    },
    [api],
    { keepLastOn: isOffline },
  );
}

/** Lets a page tell the shell the club changed (e.g. just created), so it reloads. */
export const ShellReloadContext = createContext<() => void>(() => undefined);

export const useReloadShell = () => useContext(ShellReloadContext);
