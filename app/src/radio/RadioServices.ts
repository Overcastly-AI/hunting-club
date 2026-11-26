import {
  CORE_CONFIG,
  CheckInBoard,
  CheckInController,
  DeliveryTracker,
  HarvestSharer,
  HelpRequester,
  MemoryPartyStore,
  OverdueMonitor,
  PartyService,
  ReceiptService,
  FREE_PARTY_MAX_MEMBERS,
  type CoreConfig,
  type CoreContext,
  type PartyStore,
  type SunApi,
  applyChannelSet,
  radioHasChannelSet,
} from '@huntclub/core';
import type { ChannelSet, MeshClient } from '@huntclub/mesh';

import type { BoardRadio } from '../board/BoardRadio';
import type { ChatRadio } from '../chat/ChatRadio';
import type { CheckInRadio } from '../checkin/CheckInRadio';
import type { ClubArea, ClubStand } from '../checkin/placement';
import type { Audience } from '../domain/audience';
import type { HarvestRadio } from '../harvest/HarvestRadio';
import { nodePosition, type MapNames, type MapRadio } from '../map/meshMapData';
import type { SafetyRadio } from '../safety/SafetyRadio';
import { PRIMARY_CHANNEL } from './RadioController';

/**
 * The club this phone hunts with, from the club layer (app/src/club): stands and
 * areas with mesh ids, the admin's overdue grace time, and the club channels.
 */
export type RadioClub = {
  clubId: string;
  graceMinutes: number;
  stands: readonly ClubStand[];
  areas: readonly ClubArea[];
  /** From the Club QR code; put on the radio when its primary channel isn't the club's. */
  channelSet?: ChannelSet;
};

export type RadioServicesOptions = Omit<CoreContext, 'client'> & {
  /** Free party or club (a club given in `club` makes it 'club'). */
  audience: Audience;
  /** Overdue grace time (club: admin-set, taken from `club`). */
  graceMinutes: number;
  /** Set when the phone belongs to a club: club check-in, whole-club chat, the board. */
  club?: RadioClub;
  names?: MapNames;
  /** Test hooks: receipt policy and help retry schedule overrides. */
  receipts?: Partial<CoreConfig['receipts']>;
  helpSchedule?: Partial<CoreConfig['help']>;
  partyConfig?: Partial<CoreConfig['party']>;
  /** Sunrise and sunset for the overdue alert (default: calculated on the phone). */
  sun?: SunApi;
  /** Where the free party is kept (the app: SQLite). Default: in memory. */
  partyStore?: PartyStore;
};

export const DEFAULT_SERVICES_OPTIONS: RadioServicesOptions = {
  audience: 'party',
  graceMinutes: CORE_CONFIG.overdue.graceMinutes,
};

/**
 * Every core service for one radio link, created once in one place and
 * disposed when the link goes. The screens read them through the context
 * values below (CheckInRadio, SafetyRadio, ChatRadio, HarvestRadio, BoardRadio).
 */
export class RadioServices {
  readonly checkIns: CheckInController;
  readonly board: CheckInBoard;
  readonly help: HelpRequester;
  readonly overdue: OverdueMonitor;
  readonly receipts: ReceiptService;
  readonly delivery: DeliveryTracker;
  readonly sharer: HarvestSharer;
  readonly party: PartyService;

  readonly mapRadio: MapRadio;
  readonly checkInRadio: CheckInRadio;
  readonly safetyRadio: SafetyRadio;
  readonly chatRadio: ChatRadio;
  readonly harvestRadio: HarvestRadio;
  readonly boardRadio: BoardRadio;

  constructor(
    readonly client: MeshClient,
    readonly options: RadioServicesOptions = DEFAULT_SERVICES_OPTIONS,
  ) {
    const {
      names,
      receipts,
      helpSchedule,
      partyConfig,
      sun,
      partyStore,
      club: clubInfo,
      ...rest
    } = options;
    const { audience: partyAudience, graceMinutes: partyGrace, ...context } = rest;
    const ctx: CoreContext = { ...context, client };
    const club = clubInfo !== undefined;
    const audience: Audience = club ? 'club' : partyAudience;
    const graceMinutes = clubInfo?.graceMinutes ?? partyGrace;

    this.checkIns = new CheckInController(ctx, { clubModes: club });
    this.board = new CheckInBoard(ctx);
    this.receipts = new ReceiptService(ctx, receipts).start();
    this.delivery = new DeliveryTracker(client);
    this.sharer = new HarvestSharer(ctx);
    this.party = new PartyService(ctx, {
      store: partyStore ?? new MemoryPartyStore(),
      ...(partyConfig ? { config: partyConfig } : {}),
    });
    void this.party.restore();
    this.help = new HelpRequester(ctx, {
      getLocation: () => {
        const mine = client.nodes.get(client.myNodeNum);
        const at = mine ? nodePosition(mine) : undefined;
        return at ? { lat: at.lat, lon: at.lon } : undefined;
      },
      checkIns: this.checkIns,
      ...(helpSchedule ? { schedule: helpSchedule } : {}),
    });
    this.overdue = new OverdueMonitor(ctx, {
      checkIns: this.checkIns,
      board: this.board,
      config: { graceMinutes },
      ...(sun ? { sun } : {}),
    }).start();

    const withNames = names ? { names } : {};
    // The hunt channel is the radio's primary: the party's, or the club's in a club.
    // (A free party inside a club needs a second channel: a follow-up.)
    const channelOf = () => PRIMARY_CHANNEL;
    const groupSegment: 'club' | 'party' = club ? 'club' : 'party';
    this.mapRadio = { client, board: this.board };
    this.checkInRadio = {
      checkIns: this.checkIns,
      audience,
      graceMinutes,
      ...(clubInfo ? { club: { stands: clubInfo.stands, areas: clubInfo.areas } } : {}),
    };
    this.safetyRadio = {
      client,
      help: this.help,
      overdue: this.overdue,
      board: this.board,
      audience,
      ...withNames,
    };
    this.chatRadio = {
      client,
      delivery: this.delivery,
      board: this.board,
      audience,
      ...withNames,
      groupSize: () => {
        // A free party: the others in it, never more than the cap allows (a
        // radio refused as over capacity was heard, but isn't in the party).
        const party = this.party.current;
        if (!club && party) return Math.min(party.size, FREE_PARTY_MAX_MEMBERS) - 1;
        // Otherwise everyone else our radio knows on the channel.
        return [...client.nodes.keys()].filter((n) => n !== client.myNodeNum).length;
      },
      channelOf,
      segmentOfChannel: () => groupSegment,
    };
    this.harvestRadio = { sharer: this.sharer, audience, channelOf };
    this.boardRadio = {
      ...this.mapRadio,
      graceMinutes,
      stands: clubInfo?.stands ?? [],
      ...withNames,
    };
    if (clubInfo?.channelSet) this.clubChannel = this.ensureChannel(clubInfo.channelSet);
  }

  /** Settles once the club channel is on the radio (or failed: the radio keeps its old channels). */
  readonly clubChannel: Promise<'already' | 'applied' | 'failed'> = Promise.resolve('already');

  /** Puts the club channels on the radio unless its primary channel already has the key. */
  private async ensureChannel(channelSet: ChannelSet): Promise<'already' | 'applied' | 'failed'> {
    try {
      await this.client.waitUntilReady();
      if (radioHasChannelSet(this.client, channelSet)) return 'already';
      await applyChannelSet(this.client, channelSet);
      return 'applied';
    } catch {
      return 'failed';
    }
  }

  dispose(): void {
    this.party.dispose();
    this.overdue.stop();
    this.receipts.stop();
    this.help.dispose();
    this.delivery.dispose();
    this.board.dispose();
  }
}
