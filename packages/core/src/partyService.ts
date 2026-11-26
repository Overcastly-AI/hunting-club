/**
 * Free hunting party lifecycle (docs/SPEC.md "Free vs Club", Milestone 3):
 * create a party, join from a scanned QR link, leave, and keep the member
 * roster from what the radio hears on the party channel.
 *
 * - The QR link is built and parsed by mesh's single join-link codec
 *   (encodeJoinUrl / decodeJoinUrl; app and web forms).
 * - The 3-person cap is enforced by the app: the QR code is hidden when the
 *   party is full, and a phone that joins and finds 3 others already there
 *   refuses (leaves again) with PartyFullError. Existing members get an
 *   `overCapacity` event if a 4th radio is heard anyway (a soft limit:
 *   a stock Meshtastic client with the key can still listen).
 * - The roster comes from live packets on the party channel (`heard`:
 *   node info, check-ins, positions, texts), not the radio's node DB, which
 *   may hold radios from before we joined.
 * - Leaving moves our radio to a fresh private channel nobody else has, so
 *   positions never fall back to a public channel.
 */
import {
  Emitter,
  base64UrlEncode,
  decodeJoinUrl,
  encodeJoinUrl,
  generatePartyChannelSet,
  type ChannelSet,
  type HeardEvent,
  type JoinLinkForm,
  type Unsubscribe,
} from '@huntclub/mesh';
import { CORE_CONFIG, type CoreConfig } from './config';
import { resolveContext, type CoreContext, type ResolvedContext } from './context';
import { FREE_PARTY_MAX_MEMBERS, PartyFullError, canJoinParty } from './party';
import type { PartyMember, PartyStore, StoredParty } from './partyStore';
import { ChannelApplyError, applyChannelSet } from './radioChannels';

/** Random bytes in a party id (base64url, 8 characters). */
export const PARTY_ID_BYTES = 6;
/** Channel name of the private channel our radio moves to when we leave. */
export const SOLO_CHANNEL_NAME = 'Solo';

export type PartyErrorCode =
  | 'already-in-party'
  | 'not-in-party'
  | 'club-link'
  | 'radio-not-connected'
  | 'radio-rejected'
  | 'busy';

export class PartyError extends Error {
  constructor(
    readonly code: PartyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PartyError';
  }
}

export interface PartyMemberView extends PartyMember {
  /** Long name from the radio's node info, when known. */
  name?: string;
}

export interface PartyView {
  id: string;
  role: StoredParty['role'];
  joinedAt: number;
  /** Other members (not us). */
  members: PartyMemberView[];
  /** People in the party, including us. */
  size: number;
  /** No one else may join (size ≥ the cap): hide the QR code. */
  isFull: boolean;
  /** More radios than the cap were heard on the channel. */
  overCapacity: boolean;
}

export interface PartyServiceEvents {
  change: PartyView | null;
  /** A radio beyond the cap was heard on our party channel. */
  overCapacity: PartyView;
}

export interface PartyServiceOptions {
  store: PartyStore;
  config?: Partial<CoreConfig['party']>;
  /** Cap for this group; default FREE_PARTY_MAX_MEMBERS. */
  maxMembers?: number;
}

export class PartyService extends Emitter<PartyServiceEvents> {
  private readonly ctx: ResolvedContext;
  private readonly store: PartyStore;
  private readonly config: CoreConfig['party'];
  private readonly maxMembers: number;
  private party: StoredParty | null = null;
  private readonly lastSaved = new Map<number, number>();
  private readonly offHeard: Unsubscribe;
  private busy = false;

  constructor(ctx: CoreContext, opts: PartyServiceOptions) {
    super();
    this.ctx = resolveContext(ctx);
    this.store = opts.store;
    this.config = { ...CORE_CONFIG.party, ...opts.config };
    this.maxMembers = opts.maxMembers ?? FREE_PARTY_MAX_MEMBERS;
    this.offHeard = this.ctx.client.on('heard', (e) => this.onHeard(e));
  }

  /** The current party, or null. */
  get current(): PartyView | null {
    return this.party && this.view(this.party);
  }

  /** Loads the saved party (app start). */
  async restore(): Promise<PartyView | null> {
    this.party = await this.store.load();
    this.emit('change', this.current);
    return this.current;
  }

  /**
   * The link for the Party QR code, or null when there is no party or it is
   * full (spec: the QR code stops being shown). Contains the channel key.
   */
  qrLink(form: JoinLinkForm = 'app'): string | null {
    if (!this.party || !canJoinParty(this.sizeOf(this.party), this.maxMembers)) return null;
    return encodeJoinUrl(decodeJoinUrl(this.party.joinLink), { form });
  }

  /** Starts a new party: a fresh channel with a random 256-bit key, applied to our radio. */
  async create(): Promise<PartyView> {
    return this.exclusive(async () => {
      this.assertNoParty();
      const channelSet = generatePartyChannelSet({ random: this.ctx.random });
      const id = base64UrlEncode(this.ctx.random(PARTY_ID_BYTES));
      await this.provision(channelSet);
      return this.enter({
        id,
        joinLink: encodeJoinUrl({ channelSet, target: { kind: 'party', partyId: id } }),
        role: 'creator',
        joinedAt: this.ctx.now(),
        channelIndex: 0,
        members: [],
      });
    });
  }

  /**
   * Joins from a scanned link (huntclub:// or https). Applies the channel to
   * our radio, asks who is there, and refuses with PartyFullError (moving
   * our radio off the channel again) if the party already has the maximum.
   */
  async join(link: string): Promise<PartyView> {
    return this.exclusive(async () => {
      const parsed = decodeJoinUrl(link); // throws mesh's ChannelUrlError on a bad link
      if (parsed.target.kind !== 'party') {
        throw new PartyError('club-link', 'This is a club code: sign in to the club to join');
      }
      if (this.party?.id === parsed.target.partyId) return this.view(this.party);
      this.assertNoParty();
      await this.provision(parsed.channelSet);
      const view = await this.enter({
        id: parsed.target.partyId,
        joinLink: encodeJoinUrl(parsed),
        role: 'member',
        joinedAt: this.ctx.now(),
        channelIndex: 0,
        members: [],
      });
      // Ask everyone on the channel to answer with their node info.
      this.ctx.client.sendNodeInfo({ channel: 0, wantResponse: true });
      await this.sleep(this.config.discoveryMs);
      const party = this.party!;
      if (party.members.length >= this.maxMembers) {
        await this.leaveNow();
        throw new PartyFullError(this.maxMembers);
      }
      return this.current ?? view;
    });
  }

  /** Leaves the party: our radio moves to a fresh private channel and the saved party is cleared. */
  async leave(): Promise<void> {
    return this.exclusive(() => this.leaveNow());
  }

  dispose(): void {
    this.offHeard();
  }

  // ---- Internals ----

  private async leaveNow(): Promise<void> {
    if (!this.party) throw new PartyError('not-in-party', 'Not in a party');
    const solo = generatePartyChannelSet({ random: this.ctx.random, name: SOLO_CHANNEL_NAME });
    this.party = null;
    this.lastSaved.clear();
    await this.store.clear();
    this.emit('change', null);
    await this.provision(solo);
  }

  private async enter(party: StoredParty): Promise<PartyView> {
    this.party = party;
    await this.store.save(party);
    this.emit('change', this.current);
    return this.view(party);
  }

  private onHeard(e: HeardEvent): void {
    const party = this.party;
    if (!party || e.channel !== party.channelIndex || e.from === this.ctx.client.myNodeNum) return;
    const t = this.ctx.now();
    const existing = party.members.find((m) => m.node === e.from);
    if (existing) {
      existing.lastHeard = t;
      const saved = this.lastSaved.get(e.from) ?? 0;
      if (t - saved >= this.config.lastHeardSaveMs) this.persist(e.from, t);
      return;
    }
    party.members.push({ node: e.from, firstHeard: t, lastHeard: t });
    this.persist(e.from, t);
    const view = this.view(party);
    this.emit('change', view);
    if (view.overCapacity) this.emit('overCapacity', view);
  }

  private persist(node: number, t: number): void {
    this.lastSaved.set(node, t);
    if (this.party) void this.store.save(this.party);
  }

  private async provision(channelSet: ChannelSet): Promise<void> {
    try {
      await applyChannelSet(this.ctx.client, channelSet);
    } catch (error) {
      if (error instanceof ChannelApplyError) throw new PartyError(error.code, error.message);
      throw error;
    }
  }

  private view(p: StoredParty): PartyView {
    const size = this.sizeOf(p);
    return {
      id: p.id,
      role: p.role,
      joinedAt: p.joinedAt,
      members: p.members.map((m) => {
        const name = this.ctx.client.nodes.get(m.node)?.user?.longName;
        return name ? { ...m, name } : { ...m };
      }),
      size,
      isFull: !canJoinParty(size, this.maxMembers),
      overCapacity: size > this.maxMembers,
    };
  }

  private sizeOf(p: StoredParty): number {
    return p.members.length + 1;
  }

  private assertNoParty(): void {
    if (this.party) throw new PartyError('already-in-party', 'Leave your current party first');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => this.ctx.timers.setTimeout(resolve, ms));
  }

  /** One lifecycle operation at a time (create/join/leave all reprogram the radio). */
  private async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (this.busy) throw new PartyError('busy', 'A party change is already in progress');
    this.busy = true;
    try {
      return await fn();
    } finally {
      this.busy = false;
    }
  }
}
