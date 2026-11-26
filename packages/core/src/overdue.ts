/**
 * Overdue alert (docs/SPEC.md "Safety"): fires at sunset plus the grace
 * time (default 30 minutes; club admins can change it). Never uses legal
 * shooting hours.
 *
 * - Our own phone prompts first at the deadline ("Still out? Extend 30 min /
 *   Check out"). With no answer for `selfPromptMinutes`, it broadcasts the
 *   OverdueAlert itself.
 * - Other phones wait `othersDelayMinutes` past someone's deadline (giving
 *   that hunter's phone the first chance), then one of them alerts: each
 *   waits a random moment and stays quiet if another alert was heard.
 * - An extension (CheckIn with `until`) moves the deadline for everyone.
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
import type { CheckInBoard, CheckInController, MemberCheckIn, OpenCheckIn } from './checkIn';
import { CORE_CONFIG, MINUTE_MS, type CoreConfig } from './config';
import {
  randomFraction,
  resolveContext,
  unixSeconds,
  type CoreContext,
  type ResolvedContext,
} from './context';

const DAY_MS = 86_400_000;

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
 * check-in time at the given place, or the hunter's extension (`until`) if
 * later. Undefined when neither is known (no sunset in polar day/night and
 * no extension).
 */
export function overdueAt(
  checkedInAt: number,
  place: LatLon,
  graceMinutes: number,
  sun: SunApi,
  until?: number,
): number | undefined {
  let deadline: number | undefined;
  for (let dayOffset = 0; dayOffset <= 1 && deadline === undefined; dayOffset++) {
    const day = sun.localCalendarDay(new Date(checkedInAt + dayOffset * DAY_MS));
    const times = sun.sunTimes(day, place.lat, place.lon);
    if (times.kind !== 'normal') break;
    const at = times.sunset.getTime() + graceMinutes * MINUTE_MS;
    // Checked in after this evening's deadline (a night hunt): use tomorrow's.
    if (at > checkedInAt) deadline = at;
  }
  if (until === undefined) return deadline;
  return deadline === undefined ? until : Math.max(deadline, until);
}

export interface OverdueEvent {
  /** Node number of the hunter who is overdue. */
  subject: number;
  /** True when it is us. */
  self: boolean;
  checkInId: number;
  overdueAt: number;
  /** Our own detection, or an OverdueAlert heard from someone else. */
  source: 'detected' | 'heard';
}

export interface SelfPromptEvent {
  /** Our deadline (ms). */
  overdueAt: number;
  /** When the alert goes out if we don't answer (ms). */
  alertAt: number;
}

export interface OverdueEvents {
  /** Someone (or we) is overdue and the party has been or is being alerted. */
  overdue: OverdueEvent;
  /** Our deadline passed: ask "Still out? Extend / Check out". */
  selfPrompt: SelfPromptEvent;
  /** We answered the prompt in time. */
  selfPromptCleared: { reason: 'extended' | 'checkedOut' };
}

export interface OverdueOptions {
  checkIns: CheckInController;
  board: CheckInBoard;
  sun: SunApi;
  /** Overrides of CORE_CONFIG.overdue (for example the club's grace minutes). */
  config?: Partial<CoreConfig['overdue']>;
  /** Best known location of a node, for its sunset. Defaults to the node DB / our radio. */
  locationOf?: (node: number) => LatLon | undefined;
}

interface SelfPrompt {
  key: string;
  overdueAt: number;
  timer: unknown;
}

export class OverdueMonitor extends Emitter<OverdueEvents> {
  private readonly ctx: ResolvedContext;
  private readonly opts: OverdueOptions;
  private readonly config: CoreConfig['overdue'];
  /** "subject:deadline" already raised as overdue. */
  private readonly raised = new Set<string>();
  /** "subject:deadline" some phone already sent an OverdueAlert for. */
  private readonly alerted = new Set<string>();
  private readonly pending = new Map<string, unknown>();
  private prompt: SelfPrompt | null = null;
  private timer: unknown;
  private offs: Unsubscribe[] = [];

  constructor(ctx: CoreContext, opts: OverdueOptions) {
    super();
    this.ctx = resolveContext(ctx);
    this.opts = opts;
    this.config = { ...CORE_CONFIG.overdue, ...opts.config };
  }

  start(): this {
    this.offs.push(
      this.ctx.client.on('appMessage', ({ message }) => {
        if (message.type === AppMessageType.OverdueAlert) this.onHeard(message);
      }),
      // Extend or check out answers the prompt right away.
      this.opts.checkIns.on('change', () => this.checkSelf(this.ctx.now())),
    );
    const loop = () => {
      this.check();
      this.timer = this.ctx.timers.setTimeout(loop, this.config.checkIntervalMs);
    };
    loop();
    return this;
  }

  stop(): void {
    if (this.timer !== undefined) this.ctx.timers.clearTimeout(this.timer);
    this.timer = undefined;
    this.clearPrompt();
    for (const t of this.pending.values()) this.ctx.timers.clearTimeout(t);
    this.pending.clear();
    this.offs.forEach((off) => off());
    this.offs = [];
  }

  /** Our current deadline (ms), if computable. */
  get selfDeadline(): number | undefined {
    const mine = this.opts.checkIns.current;
    return mine ? this.deadlineForSelf(mine) : undefined;
  }

  /** "Still out? Extend": convenience for the prompt's button. */
  extend(minutes: number = this.config.extendMinutes): void {
    this.opts.checkIns.extend(minutes);
  }

  /** Evaluates every open check-in now. Called on the timer; callable directly. */
  check(): void {
    const t = this.ctx.now();
    this.checkSelf(t);
    for (const m of this.opts.board.all) this.checkMember(m, t);
  }

  // ---- Our own check-in: prompt first, alert if no answer ----

  private checkSelf(t: number): void {
    const me = this.ctx.client.myNodeNum;
    const mine = this.opts.checkIns.current;
    if (!mine || !me) {
      if (this.prompt) this.clearPrompt('checkedOut');
      return;
    }
    const due = this.deadlineForSelf(mine);
    if (this.prompt && this.prompt.overdueAt !== due) this.clearPrompt('extended');
    if (due === undefined || t < due) return;
    const key = keyOf(me, due);
    if (this.prompt || this.raised.has(key) || this.alerted.has(key)) return;
    const alertAt = t + this.config.selfPromptMinutes * MINUTE_MS;
    this.prompt = {
      key,
      overdueAt: due,
      timer: this.ctx.timers.setTimeout(() => {
        const p = this.prompt;
        this.prompt = null;
        const still = this.opts.checkIns.current;
        if (!p || !still || this.deadlineForSelf(still) !== p.overdueAt) return;
        this.raise(me, still.messageId, p.overdueAt, true, 'detected');
        const place = still.placement.pin ?? this.locate(me);
        this.sendAlert(me, still.messageId, p.key, place);
      }, alertAt - t),
    };
    this.emit('selfPrompt', { overdueAt: due, alertAt });
  }

  private clearPrompt(reason?: 'extended' | 'checkedOut'): void {
    if (!this.prompt) return;
    this.ctx.timers.clearTimeout(this.prompt.timer);
    this.prompt = null;
    if (reason) this.emit('selfPromptCleared', { reason });
  }

  private deadlineForSelf(mine: OpenCheckIn): number | undefined {
    const place = mine.placement.pin ?? this.locate(this.ctx.client.myNodeNum);
    return place
      ? overdueAt(mine.checkedInAt, place, this.config.graceMinutes, this.opts.sun, mine.until)
      : mine.until;
  }

  // ---- Other members: wait, then one phone alerts ----

  private deadlineForMember(m: MemberCheckIn): number | undefined {
    const place = m.pin ?? this.locate(m.node);
    return place
      ? overdueAt(m.since, place, this.config.graceMinutes, this.opts.sun, m.until)
      : m.until;
  }

  private checkMember(m: MemberCheckIn, t: number): void {
    const due = this.deadlineForMember(m);
    if (due === undefined || t < due + this.config.othersDelayMinutes * MINUTE_MS) return;
    const key = keyOf(m.node, due);
    if (this.raised.has(key)) return;
    this.raise(m.node, m.checkInId, due, false, 'detected');
    const delay = Math.floor(randomFraction(this.ctx.random) * this.config.alertJitterMs);
    this.pending.set(
      key,
      this.ctx.timers.setTimeout(() => {
        this.pending.delete(key);
        const now = this.opts.board.get(m.node);
        // Still out, and not extended or checked out meanwhile.
        if (now && this.deadlineForMember(now) === due) {
          this.sendAlert(m.node, now.checkInId, key, now.pin ?? this.locate(m.node));
        }
      }, delay),
    );
  }

  // ---- Alerts on the air ----

  private onHeard(a: OverdueAlert): void {
    const me = this.ctx.client.myNodeNum;
    const mine = this.opts.checkIns.current;
    const member = this.opts.board.get(a.subject);
    const due =
      a.subject === me
        ? mine
          ? this.deadlineForSelf(mine)
          : undefined
        : member
          ? this.deadlineForMember(member)
          : undefined;
    const key =
      due !== undefined ? keyOf(a.subject, due) : `${a.subject >>> 0}:id${a.checkInId ?? 0}`;
    this.alerted.add(key);
    const pending = this.pending.get(key);
    if (pending !== undefined) {
      this.ctx.timers.clearTimeout(pending);
      this.pending.delete(key);
    }
    if (a.subject === me) return;
    this.raise(a.subject, a.checkInId ?? 0, due ?? this.ctx.now(), false, 'heard', key);
  }

  private raise(
    subject: number,
    checkInId: number,
    at: number,
    self: boolean,
    source: OverdueEvent['source'],
    key = keyOf(subject, at),
  ): void {
    if (this.raised.has(key)) return;
    this.raised.add(key);
    this.emit('overdue', { subject, self, checkInId, overdueAt: at, source });
  }

  private sendAlert(
    subject: number,
    checkInId: number,
    key: string,
    place: LatLon | undefined,
  ): void {
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
      ...(place ? { pin: place } : {}),
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

const keyOf = (subject: number, deadline: number) => `${subject >>> 0}:${deadline}`;

/** Last known position of a node from the radio's node DB. */
export function nodeLocation(client: MeshClient, node: number): LatLon | undefined {
  const p = client.nodes.get(node)?.position;
  if (p?.latitudeI === undefined || p.longitudeI === undefined) return undefined;
  if (p.latitudeI === 0 && p.longitudeI === 0) return undefined;
  return { lat: p.latitudeI / 1e7, lon: p.longitudeI / 1e7 };
}
