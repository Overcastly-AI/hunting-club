/**
 * Club state for the whole app: the clubs saved on this phone, the signed-in
 * session, and sync. Provides the cached entitlement to club-only screens.
 * Nothing here runs for a free user until they join a club or tap Sign in.
 */
import type { ClubApiClient, MemberJoin } from '@huntclub/shared';
import { useSQLiteContext } from 'expo-sqlite';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { SqlDatabase } from '../db/types';
import { ClubEntitlementContext, entitlementOf } from './entitlement';
import type { ClubSession } from './session';
import { type LocalClub, loadClubs } from './store';
import { joinClubFromLink, syncAllClubs } from './sync';

export type ClubServices = { session: ClubSession; api: ClubApiClient | undefined };

export type ClubState = {
  clubs: LocalClub[];
  signedIn: boolean;
  /** False until the club API is deployed and configured. */
  cloudAvailable: boolean;
  session: ClubSession;
  /** Saves a club from a Club QR code / invite link (offline), then syncs if possible. */
  join(url: string, profile: MemberJoin): Promise<string>;
  /** Redeems pending invites and refreshes every club. Needs sign-in and internet. */
  sync(): Promise<{ failed: number }>;
  /** Re-reads clubs and sign-in state (after signing in or out). */
  reload(): Promise<void>;
};

const ClubContext = createContext<ClubState | null>(null);

export function useClub(): ClubState {
  const state = useContext(ClubContext);
  if (!state) throw new Error('useClub must be used inside ClubProvider');
  return state;
}

export function ClubProvider({
  services,
  children,
  now = Date.now,
}: {
  services: ClubServices;
  children: ReactNode;
  now?: () => number;
}) {
  const db = useSQLiteContext();
  return (
    <ClubStateProvider db={db} services={services} now={now}>
      {children}
    </ClubStateProvider>
  );
}

/** ClubProvider without the expo-sqlite context (tests pass an in-memory database). */
export function ClubStateProvider({
  db,
  services,
  children,
  now = Date.now,
}: {
  db: SqlDatabase;
  services: ClubServices;
  children: ReactNode;
  now?: () => number;
}) {
  const { session, api } = services;
  const [clubs, setClubs] = useState<LocalClub[]>([]);
  const [signedIn, setSignedIn] = useState(false);

  const reload = useCallback(
    () =>
      Promise.all([loadClubs(db), session.isSignedIn()]).then(([loaded, isSignedIn]) => {
        setClubs(loaded);
        setSignedIn(isSignedIn);
      }),
    [db, session],
  );

  const sync = useCallback(async () => {
    if (!api || !(await session.isSignedIn())) return { failed: 0 };
    const { failed } = await syncAllClubs(db, api, now());
    await reload();
    return { failed: failed.length };
  }, [api, db, now, reload, session]);

  const join = useCallback(
    async (url: string, profile: MemberJoin) => {
      const clubId = await joinClubFromLink(db, url, profile, now());
      await reload();
      await sync().catch(() => undefined); // offline is fine: it syncs later
      return clubId;
    },
    [db, now, reload, sync],
  );

  // Load once, then sync when signed in (silently: offline is normal in the field).
  useEffect(() => {
    void reload().then(() => sync().catch(() => undefined));
  }, [reload, sync]);

  const state = useMemo<ClubState>(
    () => ({ clubs, signedIn, cloudAvailable: api !== undefined, session, join, sync, reload }),
    [api, clubs, join, reload, session, signedIn, sync],
  );
  const firstPaid = clubs.map(entitlementOf).find((e) => e !== null) ?? null;

  return (
    <ClubContext.Provider value={state}>
      <ClubEntitlementContext.Provider value={firstPaid}>
        {children}
      </ClubEntitlementContext.Provider>
    </ClubContext.Provider>
  );
}
