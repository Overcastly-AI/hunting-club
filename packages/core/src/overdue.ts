/**
 * Overdue alert (docs/SPEC.md "Safety"): fires at sunset plus the grace
 * time (default 30 minutes; club admins can change it). Never uses legal
 * shooting hours.
 *
 * Sunrise/sunset is computed on the device by the map work (PR #6,
 * app/src/conditions/sun.ts). It is injected here as `SunApi` instead of
 * copied; the backlog moves it into this package once #6 merges.
 */
import {
  AppMessageType,
  Emitter,
  randomUint32,
  type LatLon,
  type MeshClient,
  type OverdueAlert,
  type Unsubscribe,
} from '@huntclub/mesh';
import type { CheckInController } from './checkIn';
import type { CheckInBoard, MemberCheckIn } from './checkIn';
import {
  randomFraction,
  resolveContext,
  unixSeconds,
  type CoreContext,
  type ResolvedContext,
} from './context';

export const DEFAULT_OVERDUE_GRACE_MINUTES = 30;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

/** Shape of app/src/conditions/sun.ts (structurally typed so that module can be passed as-is). */
export interface SunApi {
  sunTimes(
    day: CalendarDay,
    lat: number,
    lon: number,
  ): { kind: 'normal'; sunset: Date } | { kind: 'polarDay' | 'polarNight' };
  localCalendarDay(date: Date): CalendarDay;
}

/**
 * When a check-in becomes overdue: the first sunset + grace after the
 * check-in time, at the given place. Undefined when the sun doesn't set
 * (polar day/night), so no alert can be computed.
 */
export function overdueAt(
  checkedInAt: number,
  place: LatLon,
  graceMinutes: number,
  sun: SunApi,
): number | undefined {
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const day = sun.localCalendarDay(new Date(checkedInAt + dayOffset * DAY_MS));
    const times = sun.sunTimes(day, place.lat, place.lon);
    if (times.kind !== 'normal') return undefined;
    const at = times.sunset.getTime() + graceMinutes * MINUTE_MS;
    // Checked in after this evening's deadline (a night hunt): use tomorrow's.
    if (at > checkedInAt) return at;
  }
  return undefined;
}

export interface OverdueEvent {
  /** Node number of the hunter who is overdue. */
  subject: number;
  /** True when it is us. */
  self: boolean;
  checkInId: number;
  overdueAt: number;
  /** Who raised it: our own detection, or an OverdueAlert heard from someone else. */
  source: 'detected' | 'heard';
}

export interface OverdueOptions {
  checkIns: CheckInController;
  board: CheckInBoard;
  sun: SunApi;
  /** Default DEFAULT_OVERDUE_GRACE_MINUTES. */
  graceMinutes?: number;
  /** How often to check. Default 60 s. */
  intervalMs?: number;
  /**
   * Before alerting about someone else, wait a random delay up to this long;
   * if another phone's OverdueAlert arrives first, don't send ours (saves
   * airtime when the whole party detects it). Default 60 s.
   */
  alertJitterMs?: number;
  /** Best known location of a node, for its sunset. Defaults to the node DB / our radio. */
  locationOf?: (node: number) => LatLon | undefined;
}

/**
 * Watches our own check-in and everyone else's, raises `overdue` once per
 * check-in, and sends an OverdueAlert to the party or club.
 */
export class OverdueMonitor extends Emitter<{ overdue: OverdueEvent }> {
  private readonly ctx: ResolvedContext;
  private readonly opts: Required<Omit<OverdueOptions, 'locationOf'>> &
    Pick<OverdueOptions, 'locationOf'>;
  /** "subject:checkInId" already raised. */
  private readonly raised = new Set<string>();
  /** "subject:checkInId" for which some phone already sent an OverdueAlert. */
  private readonly alerted = new Set<string>();
  private readonly pending = new Map<string, unknown>();
  private timer: unknown;
  private offs: Unsubscribe[] = [];

  constructor(ctx: CoreContext, opts: OverdueOptions) {
    super();
    this.ctx = resolveContext(ctx);
    this.opts = {
      graceMinutes: DEFAULT_OVERDUE_GRACE_MINUTES,
      intervalMs: MINUTE_MS,
      alertJitterMs: MINUTE_MS,
      ...opts,
    };
  }

  start(): this {
    this.offs.push(
      this.ctx.client.on('appMessage', ({ message }) => {
        if (message.type === AppMessageType.OverdueAlert) this.onHeard(message);
      }),
    );
    const loop = () => {
      this.check();
      this.timer = this.ctx.timers.setTimeout(loop, this.opts.intervalMs);
    };
    loop();
    return this;
  }

  stop(): void {
    if (this.timer !== undefined) this.ctx.timers.clearTimeout(this.timer);
    this.timer = undefined;
    for (const t of this.pending.values()) this.ctx.timers.clearTimeout(t);
    this.pending.clear();
    this.offs.forEach((off) => off());
    this.offs = [];
  }

  /** Evaluates every open check-in now. Called on the timer; callable directly. */
  check(): void {
    const { client, now } = this.ctx;
    const t = now();
    const mine = this.opts.checkIns.current;
    if (mine && client.myNodeNum) {
      const place = mine.placement.pin ?? this.locate(client.myNodeNum);
      const due =
        place && overdueAt(mine.checkedInAt, place, this.opts.graceMinutes, this.opts.sun);
      if (place && due !== undefined && t >= due) {
        this.raise(client.myNodeNum, mine.messageId, due, true, 'detected');
        this.sendAlert(client.myNodeNum, mine.messageId, place);
      }
    }
    for (const m of this.opts.board.all) this.checkMember(m, t);
  }

  private checkMember(m: MemberCheckIn, t: number): void {
    const place = m.pin ?? this.locate(m.node);
    if (!place) return;
    const due = overdueAt(m.since, place, this.opts.graceMinutes, this.opts.sun);
    if (due === undefined || t < due) return;
    const key = keyOf(m.node, m.checkInId);
    if (this.raised.has(key)) return;
    this.raise(m.node, m.checkInId, due, false, 'detected');
    // Let one phone speak for the party: wait a random moment, then alert
    // unless someone else already did.
    const delay = Math.floor(randomFraction(this.ctx.random) * this.opts.alertJitterMs);
    this.pending.set(
      key,
      this.ctx.timers.setTimeout(() => {
        this.pending.delete(key);
        if (!this.alerted.has(key) && this.opts.board.get(m.node)?.checkInId === m.checkInId) {
          this.sendAlert(m.node, m.checkInId, place);
        }
      }, delay),
    );
  }

  private onHeard(a: OverdueAlert): void {
    const key = keyOf(a.subject, a.checkInId ?? 0);
    this.alerted.add(key);
    const pending = this.pending.get(key);
    if (pending !== undefined) {
      this.ctx.timers.clearTimeout(pending);
      this.pending.delete(key);
    }
    if (a.subject === this.ctx.client.myNodeNum) return;
    this.raise(
      a.subject,
      a.checkInId ?? 0,
      a.time ? a.time * 1000 : this.ctx.now(),
      false,
      'heard',
    );
  }

  private raise(
    subject: number,
    checkInId: number,
    at: number,
    self: boolean,
    source: OverdueEvent['source'],
  ): void {
    const key = keyOf(subject, checkInId);
    if (this.raised.has(key)) return;
    this.raised.add(key);
    this.emit('overdue', { subject, self, checkInId, overdueAt: at, source });
  }

  private sendAlert(subject: number, checkInId: number, place: LatLon): void {
    const key = keyOf(subject, checkInId);
    if (this.alerted.has(key)) return;
    this.alerted.add(key);
    const { client, random, now } = this.ctx;
    const mode =
      subject === client.myNodeNum
        ? this.opts.checkIns.current?.placement.mode
        : this.opts.board.get(subject)?.mode;
    client.sendAppMessage({
      type: AppMessageType.OverdueAlert,
      id: randomUint32(random),
      sender: client.myNodeNum,
      time: unixSeconds(now()),
      subject,
      checkInId,
      pin: place,
      ...(mode ? { mode } : {}),
    });
  }

  private locate(node: number): LatLon | undefined {
    if (this.opts.locationOf) return this.opts.locationOf(node);
    return (
      nodeLocation(this.ctx.client, node) ??
      nodeLocation(this.ctx.client, this.ctx.client.myNodeNum)
    );
  }
}

const keyOf = (subject: number, checkInId: number) => `${subject >>> 0}:${checkInId >>> 0}`;

/** Last known position of a node from the radio's node DB. */
export function nodeLocation(client: MeshClient, node: number): LatLon | undefined {
  const p = client.nodes.get(node)?.position;
  if (p?.latitudeI === undefined || p.longitudeI === undefined) return undefined;
  if (p.latitudeI === 0 && p.longitudeI === 0) return undefined;
  return { lat: p.latitudeI / 1e7, lon: p.longitudeI / 1e7 };
}
