/**
 * Writes the hunter's name and initials to their own radio as the Meshtastic
 * owner (User.long_name / short_name), so other phones see them in node info,
 * and reads a radio's owner back as a suggested name for a hunter who has none.
 * The name rules themselves (lengths, allowed characters, the radio's byte
 * limits) live in @huntclub/shared (names.ts); this module only applies them to
 * the radio.
 */
import { create } from '@bufbuild/protobuf';
import {
  displayNameProblem,
  fitUtf8,
  initialsSchema,
  normalizeDisplayName,
  RADIO_NAME_BYTES,
  suggestInitials,
} from '@huntclub/shared';

import { Admin } from './protobufs';
import type { AdminMessage } from './provisioning';

export { fitUtf8 };

/**
 * Wire limits from the Meshtastic protobufs: long_name max_size 40 and
 * short_name max_size 5, both counting the terminating NUL, in UTF-8 bytes.
 */
export const OWNER_WIRE_LIMITS = {
  longNameBytes: RADIO_NAME_BYTES.long,
  shortNameBytes: RADIO_NAME_BYTES.short,
} as const;

export type Owner = { longName: string; shortName: string };

/** A validated profile as the radio owner, cut to fit the radio. */
export function ownerFromProfile(profile: { displayName: string; initials: string }): Owner {
  return {
    longName: fitUtf8(profile.displayName, OWNER_WIRE_LIMITS.longNameBytes),
    shortName: fitUtf8(profile.initials, OWNER_WIRE_LIMITS.shortNameBytes),
  };
}

/**
 * Stock firmware names a new radio "Meshtastic 1a2b" (the last four hex digits
 * of its node number). That names the radio, not the hunter carrying it.
 */
const STOCK_LONG_NAME = /^Meshtastic [0-9a-f]{4}$/i;

/**
 * The name and initials a radio's owner suggests for the hunter's own profile:
 * the long name when someone set it (in our app or the Meshtastic app) and it
 * passes the shared name rules; its short name as initials when they pass too,
 * else initials from the name. Null for a stock name or none.
 */
export function profileFromOwner(
  owner: Partial<Owner> | null | undefined,
): { displayName: string; initials: string } | null {
  const displayName = normalizeDisplayName(owner?.longName ?? '');
  if (STOCK_LONG_NAME.test(displayName) || displayNameProblem(displayName)) return null;
  const short = (owner?.shortName ?? '').trim().toLocaleUpperCase();
  const initials = initialsSchema.safeParse(short).success ? short : suggestInitials(displayName);
  return { displayName, initials };
}

/** The AdminMessage that sets our radio's owner. */
export function buildSetOwnerMessage(owner: Owner): AdminMessage {
  return create(Admin.AdminMessageSchema, {
    payloadVariant: { case: 'setOwner', value: owner },
  });
}
