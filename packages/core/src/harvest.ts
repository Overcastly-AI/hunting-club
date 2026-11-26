/**
 * Sharing a harvest (docs/SPEC.md "Free vs Club": private by default,
 * optional share with the party or club). The phone keeps the full record;
 * this sends a compact HarvestShare app message that fits the spec's
 * 80-byte budget by shortening the note, never the species.
 */
import {
  AppMessageType,
  HARVEST_SEX_CODES,
  encodeAppMessage,
  isWithinBudget,
  randomUint32,
  type HarvestSexKey,
  type HarvestShare,
  type SendHandle,
} from '@huntclub/mesh';
import type { Placement } from './checkIn';
import { resolveContext, unixSeconds, type CoreContext, type ResolvedContext } from './context';

/** What gets shared: species, sex, where (from the check-in) and an optional note. */
export interface HarvestToShare {
  species: string;
  sex: HarvestSexKey;
  note?: string;
  placement?: Partial<Pick<Placement, 'mode'>> & {
    standId?: number;
    areaId?: number;
    pin?: { lat: number; lon: number };
  };
}

/** Builds the message, trimming the note (by characters) until it fits the budget. */
export function harvestShareMessage(
  harvest: HarvestToShare,
  base: Pick<HarvestShare, 'id' | 'sender' | 'time'>,
): HarvestShare {
  const p = harvest.placement ?? {};
  const message: HarvestShare = {
    type: AppMessageType.HarvestShare,
    ...base,
    species: harvest.species.trim(),
    sex: HARVEST_SEX_CODES[harvest.sex],
    ...(p.mode !== undefined ? { mode: p.mode } : {}),
    ...(p.standId ? { standId: p.standId } : {}),
    ...(p.areaId ? { areaId: p.areaId } : {}),
    ...(p.pin ? { pin: p.pin } : {}),
  };
  let note = [...(harvest.note?.trim() ?? '')];
  while (note.length > 0) {
    const candidate = { ...message, note: note.join('') };
    if (isWithinBudget(AppMessageType.HarvestShare, encodeAppMessage(candidate))) return candidate;
    note = note.slice(0, -1);
  }
  return message;
}

/** Sends HarvestShare messages for this phone. */
export class HarvestSharer {
  private readonly ctx: ResolvedContext;

  constructor(ctx: CoreContext) {
    this.ctx = resolveContext(ctx);
  }

  /** Shares on the given channel (party or club). Throws if the radio isn't connected. */
  share(harvest: HarvestToShare, channel?: number): SendHandle {
    const { client, random, now } = this.ctx;
    if (!client.myNodeNum) throw new Error('Radio not connected yet');
    const message = harvestShareMessage(harvest, {
      id: randomUint32(random),
      sender: client.myNodeNum,
      time: unixSeconds(now()),
    });
    return client.sendAppMessage(message, channel === undefined ? {} : { channel });
  }
}
