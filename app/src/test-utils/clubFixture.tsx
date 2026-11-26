import type { ReactNode } from 'react';

import { type ClubServices, ClubStateProvider } from '../club/ClubProvider';
import { migrate } from '../db/migrate';
import { migrations } from '../db/migrations';
import { ProfileProvider } from '../profile/ProfileProvider';
import { createTestDatabase } from './nodeSqlite';

/**
 * A migrated in-memory database and a wrapper giving club screens the profile and club
 * state they read (no network, no native modules).
 */
export async function clubWrapper(services: ClubServices, now?: () => number) {
  const db = createTestDatabase();
  await migrate(db, migrations);
  const wrap = (children: ReactNode) => (
    <ProfileProvider db={db}>
      <ClubStateProvider db={db} services={services} {...(now ? { now } : {})}>
        {children}
      </ClubStateProvider>
    </ProfileProvider>
  );
  return { db, wrap };
}
