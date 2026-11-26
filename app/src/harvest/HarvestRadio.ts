import type { HarvestSharer } from '@huntclub/core';
import { createContext } from 'react';

import type { SqlDatabase } from '../db/types';
import type { Audience } from '../domain/audience';
import { harvestToShare } from './form';
import { markShared, type LocalHarvest } from './harvests';

/**
 * What sharing a harvest needs from the radio. RadioProvider provides it;
 * logging works without it (harvests are private and saved on the phone).
 */
export type HarvestRadio = {
  sharer: Pick<HarvestSharer, 'share'>;
  audience: Audience;
  /** Radio channel index for the party or club. */
  channelOf: (target: Audience) => number;
};

export const HarvestRadioContext = createContext<HarvestRadio | null>(null);

/** Sends the harvest and, once the radio has sent it, marks it shared. Returns whether it went out. */
export async function shareHarvest(
  radio: HarvestRadio,
  db: SqlDatabase,
  harvest: LocalHarvest,
  target: Audience,
  now: () => number = Date.now,
): Promise<boolean> {
  const handle = radio.sharer.share(harvestToShare(harvest), radio.channelOf(target));
  const result = await handle.result;
  if (result.status !== 'sent' && result.status !== 'acked') return false;
  await markShared(db, harvest.id, target, now());
  return true;
}
