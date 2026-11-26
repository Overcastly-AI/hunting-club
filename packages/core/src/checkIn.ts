/**
 * Check-in (docs/SPEC.md "Ways to hunt").
 *
 * - CheckInController: our own check-in. One open check-in at a time; the
 *   mode can change without checking out; each check-in or mode change sends
 *   a CheckIn app message, check-out sends CheckOut. Location is shared only
 *   while checked in (`sharingLocation`).
 * - CheckInBoard: everyone else's open check-ins, from the CheckIn/CheckOut
 *   messages we hear. Overdue detection and the map read it.
 *
 * Stands are optional: At a spot and On the move work without a stand list.
 */
import {
  AppMessageType,
  CheckInMode,
  Emitter,
  randomUint32,
  type AppMessage,
  type CheckIn,
  type LatLon,
  type SendHandle,
  type Unsubscribe,
} from '@huntclub/mesh';
import { resolveContext, unixSeconds, type CoreContext, type ResolvedContext } from './context';
import { CORE_CONFIG, MINUTE_MS } from './config';

/** Where the hunter is. Stand and area are club-only modes. */
export type Placement =
  | { mode: CheckInMode.Stand; standId: number; pin?: LatLon }
  | { mode: CheckInMode.Area; areaId: number; pin?: LatLon }
  | { mode: CheckInMode.Spot; pin: LatLon; name?: string }
  | { mode: CheckInMode.Moving; pin?: LatLon; areaId?: number };

/** Modes that need the club's stand or area list. */
export const CLUB_ONLY_MODES: readonly CheckInMode[] = [CheckInMode.Stand, CheckInMode.Area];

export interface OpenCheckIn {
  placement: Placement;
  /** Message id of the latest CheckIn we sent (the one CheckOut refers to). */
  messageId: number;
  /** When we first checked in (ms). Mode changes keep it. */
  checkedInAt: number;
  /** When the current mode started (ms). */
  modeSince: number;
  /** Set by extend(): we expect to be out until this time (ms). */
  until?: number;
}

export class CheckInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckInError';
  }
}

export interface CheckInEvents {
  change: OpenCheckIn | null;
  /** Location sharing switched on (checked in) or off (checked out). */
  locationSharing: boolean;
}

export interface CheckInOptions {
  /** Club members can use At a stand and In an area. Default false (free party). */
  clubModes?: boolean;
}

export class CheckInController extends Emitter<CheckInEvents> {
  private readonly ctx: ResolvedContext;
  private readonly clubModes: boolean;
  private open: OpenCheckIn | null = null;

  constructor(ctx: CoreContext, opts: CheckInOptions = {}) {
    super();
    this.ctx = resolveContext(ctx);
    this.clubModes = opts.clubModes ?? false;
  }

  get current(): OpenCheckIn | null {
    return this.open;
  }

  /** Location is shared only while checked in. */
  get sharingLocation(): boolean {
    return this.open !== null;
  }

  /**
   * Checks in, or switches mode if already checked in (no check-out in
   * between). Sends a CheckIn message and returns its send handle.
   */
  checkIn(placement: Placement): SendHandle {
    this.validate(placement);
    return this.send(placement, undefined);
  }

  /**
   * "Still out? Extend": keeps the check-in and mode, and tells the party we
   * expect to be out `minutes` longer, so no one raises an overdue alert
   * before then.
   */
  extend(minutes: number = CORE_CONFIG.overdue.extendMinutes): SendHandle {
    if (!this.open) throw new CheckInError('Not checked in');
    return this.send(this.open.placement, this.ctx.now() + minutes * MINUTE_MS);
  }

  private send(placement: Placement, until: number | undefined): SendHandle {
    const { client, random, now } = this.ctx;
    const t = now();
    const messageId = randomUint32(random);
    const message: CheckIn = {
      type: AppMessageType.CheckIn,
      id: messageId,
      sender: client.myNodeNum,
      time: unixSeconds(t),
      ...wirePlacement(placement),
      mode: placement.mode,
    };
    if (until !== undefined) message.until = unixSeconds(until);
    const handle = client.sendAppMessage(message);
    const prev = this.open;
    this.open = {
      placement,
      messageId,
      checkedInAt: prev?.checkedInAt ?? t,
      modeSince: prev && prev.placement.mode === placement.mode ? prev.modeSince : t,
    };
    if (until !== undefined) this.open.until = until;
    this.emit('change', this.open);
    if (!prev) this.emit('locationSharing', true);
    return handle;
  }

  /** Checks out and stops sharing location. */
  checkOut(): SendHandle {
    if (!this.open) throw new CheckInError('Not checked in');
    const { client, random, now } = this.ctx;
    const handle = client.sendAppMessage({
      type: AppMessageType.CheckOut,
      id: randomUint32(random),
      sender: client.myNodeNum,
      time: unixSeconds(now()),
      checkInId: this.open.messageId,
    });
    this.open = null;
    this.emit('change', null);
    this.emit('locationSharing', false);
    return handle;
  }

  private validate(p: Placement): void {
    if (!this.ctx.client.myNodeNum) throw new CheckInError('Radio not connected yet');
    if (CLUB_ONLY_MODES.includes(p.mode) && !this.clubModes) {
      throw new CheckInError('At a stand and In an area need a club');
    }
    if (p.mode === CheckInMode.Stand && !p.standId) throw new CheckInError('Pick a stand');
    if (p.mode === CheckInMode.Area && !p.areaId) throw new CheckInError('Pick an area');
    if (p.mode === CheckInMode.Spot && !p.pin) throw new CheckInError('A spot needs a location');
  }
}

/** The parts of a Placement that go on the wire (the spot name stays on the phone). */
function wirePlacement(p: Placement): Pick<CheckIn, 'standId' | 'areaId' | 'pin'> {
  const out: Pick<CheckIn, 'standId' | 'areaId' | 'pin'> = {};
  if ('standId' in p && p.standId) out.standId = p.standId;
  if ('areaId' in p && p.areaId) out.areaId = p.areaId;
  if (p.pin) out.pin = p.pin;
  return out;
}

/** Someone else's open check-in, as heard over the mesh. */
export interface MemberCheckIn {
  node: number;
  mode: CheckInMode;
  standId?: number;
  areaId?: number;
  pin?: LatLon;
  /** Message id of their latest CheckIn. */
  checkInId: number;
  /** When they checked in (ms): their timestamp if sent, else when we heard it. */
  since: number;
  /** They extended: expect them out until this time (ms). */
  until?: number;
}

/** Open check-ins of other members, kept from CheckIn / CheckOut messages. */
export class CheckInBoard extends Emitter<{ change: MemberCheckIn[] }> {
  private readonly ctx: ResolvedContext;
  private readonly entries = new Map<number, MemberCheckIn>();
  private offs: Unsubscribe[] = [];

  constructor(ctx: CoreContext) {
    super();
    this.ctx = resolveContext(ctx);
    this.offs.push(this.ctx.client.on('appMessage', ({ message }) => this.apply(message)));
  }

  get all(): MemberCheckIn[] {
    return [...this.entries.values()];
  }

  get(node: number): MemberCheckIn | undefined {
    return this.entries.get(node);
  }

  dispose(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
  }

  private apply(m: AppMessage): void {
    if (m.sender === this.ctx.client.myNodeNum) return;
    if (m.type === AppMessageType.CheckIn) {
      const prev = this.entries.get(m.sender);
      const heardAt = m.time ? m.time * 1000 : this.ctx.now();
      const entry: MemberCheckIn = {
        node: m.sender,
        mode: m.mode,
        checkInId: m.id,
        // A mode change keeps the original check-in time (unless the previous
        // check-in is from an earlier outing whose CheckOut we missed).
        since:
          prev && heardAt - prev.since < CORE_CONFIG.checkIn.sameOutingMs
            ? Math.min(prev.since, heardAt)
            : heardAt,
      };
      if (m.standId) entry.standId = m.standId;
      if (m.areaId) entry.areaId = m.areaId;
      if (m.pin) entry.pin = m.pin;
      if (m.until) entry.until = m.until * 1000;
      this.entries.set(m.sender, entry);
      this.emit('change', this.all);
    } else if (m.type === AppMessageType.CheckOut) {
      if (!this.entries.has(m.sender)) return;
      this.entries.delete(m.sender);
      this.emit('change', this.all);
    }
  }
}
