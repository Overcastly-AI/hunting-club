/**
 * Writes the hunter's name and initials to their own radio as the Meshtastic
 * owner (User.long_name / short_name), so other phones see them in node info.
 * The name rules themselves (lengths, allowed characters) live in
 * @huntclub/shared (MemberJoinSchema); this module only fits an already
 * valid profile to the radio's byte limits.
 */
import { create } from '@bufbuild/protobuf';

import { Admin } from './protobufs';
import { encodeUtf8 } from './runtime';
import type { AdminMessage } from './provisioning';

/**
 * Wire limits from the Meshtastic protobufs: long_name max_size 40 and
 * short_name max_size 5, both counting the terminating NUL, in UTF-8 bytes.
 */
export const OWNER_WIRE_LIMITS = { longNameBytes: 39, shortNameBytes: 4 } as const;

export type Owner = { longName: string; shortName: string };

/** The longest prefix of `text` (whole characters) that fits in `maxBytes` of UTF-8. */
export function fitUtf8(text: string, maxBytes: number): string {
  let out = '';
  for (const ch of text) {
    if (encodeUtf8(out + ch).length > maxBytes) break;
    out += ch;
  }
  return out;
}

/** A validated profile as the radio owner, cut to fit the radio. */
export function ownerFromProfile(profile: { displayName: string; initials: string }): Owner {
  return {
    longName: fitUtf8(profile.displayName, OWNER_WIRE_LIMITS.longNameBytes),
    shortName: fitUtf8(profile.initials, OWNER_WIRE_LIMITS.shortNameBytes),
  };
}

/** The AdminMessage that sets our radio's owner. */
export function buildSetOwnerMessage(owner: Owner): AdminMessage {
  return create(Admin.AdminMessageSchema, {
    payloadVariant: { case: 'setOwner', value: owner },
  });
}
