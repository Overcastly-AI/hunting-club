import { PartyFullError } from '@huntclub/core';
import { ChannelUrlError } from '@huntclub/mesh';

import { partyCopy } from './copy';

/** What to tell the hunter when joining a party from a scanned code fails (club codes go to the club join screen). */
export function joinErrorText(error: unknown): string {
  const copy = partyCopy.scan;
  if (error instanceof PartyFullError) return copy.full(error.limit);
  if (error instanceof ChannelUrlError) return copy.notACode;
  return copy.failed;
}
