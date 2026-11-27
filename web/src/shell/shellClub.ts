import type { Club, Subscription } from '@huntclub/shared';
import { createContext, useContext } from 'react';
import type { ClubApi } from '../api/types';
import { isOffline, useAsync, type AsyncResult } from '../components/useAsync';

/** What the shell shows about the club: its name, status pill and the Billing warning dot. */
export interface ShellClub {
  club: Club | null;
  subscription: Subscription | null;
}

/** Loads the club and its subscription for the shell (null club: none yet). */
export function useShellClub(api: ClubApi): AsyncResult<ShellClub> {
  return useAsync(
    async () => {
      const club = await api.getClub();
      if (!club) return { club: null, subscription: null };
      // The shell still names the club when the subscription cannot be read.
      const subscription = await api.getSubscription().catch(() => null);
      return { club, subscription };
    },
    [api],
    { keepLastOn: isOffline },
  );
}

/** Lets a page tell the shell the club changed (e.g. just created), so it reloads. */
export const ShellReloadContext = createContext<() => void>(() => undefined);

export const useReloadShell = () => useContext(ShellReloadContext);
