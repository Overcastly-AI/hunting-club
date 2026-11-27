import { MemberJoinSchema } from '@huntclub/shared';

import type { MyProfile } from '../db/appState';

/** The trimmed profile if it passes the shared member rules, else null. */
export function parseProfile(input: MyProfile): MyProfile | null {
  const result = MemberJoinSchema.safeParse(input);
  return result.success ? result.data : null;
}
