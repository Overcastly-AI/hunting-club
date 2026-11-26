/**
 * Club state for the whole app: the clubs saved on this phone, the signed-in
 * session, and sync. Provides the cached entitlement to club-only screens.
 * Nothing here runs for a free user until they join a club or tap Sign in.
 */
import type { ClubApiClient, ClubSession, MemberJoin } from '@huntclub/shared';
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

import type { MyProfile } from '../db/appState';
import type { SqlDatabase } from '../db/types';
import { useProfile } from '../profile/ProfileProvider';
import { ClubEntitlementContext, entitlementOf } from './entitlement';
import type { RadioClub } from '../radio/RadioServices';
import type { SecureStorage } from '../storage/secure';
import { type LocalClub, loadClubs, loadRadioClub } from './store';
import { type LocalClubMapPack, type MapPackSync, loadClubMapPacks } from './mapPacks';
import { joinClubFromLink, syncAllClubs } from './sync';

export type ClubServices = {
  session: ClubSession;
  api: ClubApiClient | undefined;
  /** Where the Club QR link (with the channel key) is kept: the app's secure storage. */
  secrets: SecureStorage;
  /** Downloads the club's map packs during sync (absent in tests that don't need them). */
  mapPacks?: MapPackSync;
};

export type ClubState = {
  clubs: LocalClub[];
  signedIn: boolean;
  /** The hunter's own name and initials from onboarding (prefills joining a club). */
  myProfile: MyProfile | null;
  /** False until the club API is deployed and configured. */
  cloudAvailable: boolean;
  session: ClubSession;
  /** The club this phone hunts with on the radio (the first one joined), or null. */
  radioClub: RadioClub | null;
  /** Saves a club from a Club QR code / invite link (offline), then syncs if possible. */
  join(url: string, profile: MemberJoin): Promise<string>;
  /** Redeems pending invites and refreshes every club. Needs sign-in and internet. */
  sync(): Promise<{ failed: number }>;
  /** Re-reads clubs and sign-in state (after signing in or out). */
  reload(): Promise<void>;
};

const ClubContext = createContext<ClubState | null>(null);

/** Club map packs on this phone; empty outside ClubProvider (free users) and before the first sync. */
const ClubMapPacksContext = createContext<readonly LocalClubMapPack[]>([]);

export function useClubMapPacks(): readonly LocalClubMapPack[] {
  return useContext(ClubMapPacksContext);
}

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
  const { session, api, secrets, mapPacks: mapPackSync } = services;
  const [clubs, setClubs] = useState<LocalClub[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const myProfile: MyProfile | null = useProfile().profile ?? null;
  const [radioClub, setRadioClub] = useState<RadioClub | null>(null);
  const [mapPacks, setMapPacks] = useState<LocalClubMapPack[]>([]);

  const reload = useCallback(
    () =>
      Promise.all([loadClubs(db), session.isSignedIn(), loadClubMapPacks(db)]).then(
        async ([loaded, isSignedIn, packs]) => {
          const radio = loaded[0] ? await loadRadioClub(db, secrets, loaded[0]) : null;
          setClubs(loaded);
          setSignedIn(isSignedIn);
          setRadioClub(radio);
          setMapPacks(packs);
        },
      ),
    [db, secrets, session],
  );

  const sync = useCallback(async () => {
    if (!api || !(await session.isSignedIn())) return { failed: 0 };
    const { failed } = await syncAllClubs(db, api, now(), mapPackSync);
    await reload();
    return { failed: failed.length };
  }, [api, db, mapPackSync, now, reload, session]);

  const join = useCallback(
    async (url: string, profile: MemberJoin) => {
      const clubId = await joinClubFromLink(db, secrets, url, profile, now());
      await reload();
      await sync().catch(() => undefined); // offline is fine: it syncs later
      return clubId;
    },
    [db, now, reload, secrets, sync],
  );

  // Load once, then sync when signed in (silently: offline is normal in the field).
  useEffect(() => {
    void reload().then(() => sync().catch(() => undefined));
  }, [reload, sync]);

  const state = useMemo<ClubState>(
    () => ({
      clubs,
      signedIn,
      myProfile,
      radioClub,
      cloudAvailable: api !== undefined,
      session,
      join,
      sync,
      reload,
    }),
    [api, clubs, join, myProfile, radioClub, reload, session, signedIn, sync],
  );
  const firstPaid = clubs.map(entitlementOf).find((e) => e !== null) ?? null;

  return (
    <ClubContext.Provider value={state}>
      <ClubEntitlementContext.Provider value={firstPaid}>
        <ClubMapPacksContext.Provider value={mapPacks}>{children}</ClubMapPacksContext.Provider>
      </ClubEntitlementContext.Provider>
    </ClubContext.Provider>
  );
}
