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
} from '@huntclub/core';
import type { MeshClient } from '@huntclub/mesh';

import type { BoardRadio } from '../board/BoardRadio';
import type { ChatRadio } from '../chat/ChatRadio';
import type { CheckInRadio } from '../checkin/CheckInRadio';
import type { Audience } from '../domain/audience';
import type { HarvestRadio } from '../harvest/HarvestRadio';
import { nodePosition, type MapNames, type MapRadio } from '../map/meshMapData';
import type { SafetyRadio } from '../safety/SafetyRadio';
import { PRIMARY_CHANNEL } from './RadioController';

export type RadioServicesOptions = Omit<CoreContext, 'client'> & {
  /** Free party or club. Free parties use one channel (the primary). */
  audience: Audience;
  /** Overdue grace time (club: admin-set). */
  graceMinutes: number;
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
      audience,
      graceMinutes,
      names,
      receipts,
      helpSchedule,
      partyConfig,
      sun,
      partyStore,
      ...context
    } = options;
    const ctx: CoreContext = { ...context, client };
    const club = audience === 'club';

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
    // Free parties hunt on the primary channel; club channels arrive with Milestone 10.
    const channelOf = () => PRIMARY_CHANNEL;
    this.mapRadio = { client, board: this.board };
    this.checkInRadio = { checkIns: this.checkIns, audience, graceMinutes };
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
      segmentOfChannel: () => 'party',
    };
    this.harvestRadio = { sharer: this.sharer, audience, channelOf };
    this.boardRadio = { ...this.mapRadio, graceMinutes, stands: [], ...withNames };
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
