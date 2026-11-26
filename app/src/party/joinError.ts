import { PartyError, PartyFullError } from '@huntclub/core';
import { ChannelUrlError } from '@huntclub/mesh';

import { partyCopy } from './copy';

/** What to tell the hunter when joining from a scanned code fails. */
export function joinErrorText(error: unknown): string {
  const copy = partyCopy.scan;
  if (error instanceof PartyFullError) return copy.full(error.limit);
  if (error instanceof ChannelUrlError) return copy.notACode;
  if (error instanceof PartyError && error.code === 'club-link') return copy.clubCode;
  return copy.failed;
}
