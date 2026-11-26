/**
 * Ask for a Hand (docs/SPEC.md "Safety"): pings the party or club with our
 * current location and retries until at least one person acknowledges it
 * with a Receipt. It never stops on its own; only a receipt or `cancel()`
 * ends the retries. This is help from your party, not an emergency call.
 *
 * Retries reuse the message id (receivers de-duplicate and re-send their
 * receipt) under a new packet id, with exponential backoff to protect
 * shared airtime: a retry is skipped while the previous copy is still
 * waiting in the radio queue, and the delay doubles again when the radio
 * reports a duty-cycle or rate limit.
 */
import {
  AppMessageType,
  Emitter,
  Protobufs,
  randomUint32,
  type DeliveryResult,
  type HelpRequest,
  type LatLon,
  type Unsubscribe,
} from '@huntclub/mesh';
import type { CheckInController } from './checkIn';
import {
  randomFraction,
  resolveContext,
  unixSeconds,
  type CoreContext,
  type ResolvedContext,
} from './context';
import { onReceipt } from './receipts';
import { CORE_CONFIG, type CoreConfig } from './config';

export type HelpRetrySchedule = CoreConfig['help'];

/** Delay before retry number `attempt` (1 = first retry), without jitter. */
export function helpRetryDelay(attempt: number, s: HelpRetrySchedule = CORE_CONFIG.help): number {
  return Math.min(s.maxMs, s.initialMs * s.factor ** Math.max(0, attempt - 1));
}

export type HelpStatus = 'sending' | 'acknowledged' | 'cancelled';

export interface HelpState {
  /** Message id shared by every copy. */
  id: number;
  status: HelpStatus;
  /** Copies sent so far. */
  attempts: number;
  /** Members who sent a Receipt. */
  acknowledgedBy: number[];
  startedAt: number;
}

export interface HelpOptions {
  /** Our current location (GPS); spec: current location, not just the stand. */
  getLocation: () => LatLon | undefined;
  /** Adds the check-in mode/stand/area when checked in. */
  checkIns?: CheckInController;
  schedule?: Partial<HelpRetrySchedule>;
}

/** Radio errors that mean "too much airtime": back off harder. */
const AIRTIME_ERRORS: readonly number[] = [
  Protobufs.Mesh.Routing_Error.DUTY_CYCLE_LIMIT,
  Protobufs.Mesh.Routing_Error.RATE_LIMIT_EXCEEDED,
];

export class HelpRequester extends Emitter<{ change: HelpState }> {
  private readonly ctx: ResolvedContext;
  private readonly opts: HelpOptions;
  private readonly schedule: HelpRetrySchedule;
  private state: HelpState | null = null;
  private timer: unknown;
  private lastSend: Promise<DeliveryResult> | undefined;
  private lastSendSettled = true;
  private airtimePenalty = 0;
  private note: string | undefined;
  private readonly offReceipt: Unsubscribe;

  constructor(ctx: CoreContext, opts: HelpOptions) {
    super();
    this.ctx = resolveContext(ctx);
    this.opts = opts;
    this.schedule = { ...CORE_CONFIG.help, ...opts.schedule };
    this.offReceipt = onReceipt(this.ctx.client, (r) => {
      const s = this.state;
      if (!s || r.ackedId !== s.id || s.acknowledgedBy.includes(r.sender)) return;
      s.acknowledgedBy.push(r.sender);
      if (s.status === 'sending') {
        s.status = 'acknowledged';
        this.clearTimer();
      }
      this.emit('change', { ...s, acknowledgedBy: [...s.acknowledgedBy] });
    });
  }

  get current(): HelpState | null {
    return this.state && { ...this.state, acknowledgedBy: [...this.state.acknowledgedBy] };
  }

  /** Sends a HelpRequest and keeps retrying until a Receipt arrives. Idempotent while active. */
  ask(note?: string): HelpState {
    if (this.state?.status === 'sending') return this.current!;
    const { client, random, now } = this.ctx;
    if (!client.myNodeNum) throw new Error('Radio not connected yet');
    this.state = {
      id: randomUint32(random),
      status: 'sending',
      attempts: 0,
      acknowledgedBy: [],
      startedAt: now(),
    };
    this.note = note;
    this.airtimePenalty = 0;
    this.sendCopy();
    return this.current!;
  }

  /** Stops retrying (for example "I'm OK"). Receipts still update the state. */
  cancel(): void {
    if (!this.state || this.state.status !== 'sending') return;
    this.state.status = 'cancelled';
    this.clearTimer();
    this.emit('change', this.current!);
  }

  dispose(): void {
    this.clearTimer();
    this.offReceipt();
  }

  private sendCopy(): void {
    const s = this.state;
    if (!s || s.status !== 'sending') return;
    // Airtime: don't pile copies into the radio queue.
    if (this.lastSendSettled) {
      const message = this.buildMessage(s.id);
      const handle = this.ctx.client.sendAppMessage(message);
      s.attempts++;
      this.lastSendSettled = false;
      const p = handle.result;
      this.lastSend = p;
      void p.then((r) => {
        if (this.lastSend !== p) return;
        this.lastSendSettled = true;
        if (r.status === 'acked' || r.status === 'sent') this.airtimePenalty = 0;
        if (r.status === 'failed' && AIRTIME_ERRORS.includes(r.code)) {
          // The radio is out of airtime: push the pending retry further out.
          this.airtimePenalty++;
          if (this.timer !== undefined && this.state?.status === 'sending') {
            this.clearTimer();
            this.scheduleNext();
          }
        }
      });
      this.emit('change', this.current!);
    }
    this.scheduleNext();
  }

  private scheduleNext(): void {
    const s = this.state!;
    const base = helpRetryDelay(Math.max(1, s.attempts), this.schedule) * 2 ** this.airtimePenalty;
    const jitter = (randomFraction(this.ctx.random) * 2 - 1) * this.schedule.jitter;
    const delay = Math.round(Math.min(base, this.schedule.maxMs * 2) * (1 + jitter));
    this.timer = this.ctx.timers.setTimeout(() => {
      this.timer = undefined;
      this.sendCopy();
    }, delay);
  }

  private buildMessage(id: number): HelpRequest {
    const { client, now } = this.ctx;
    const msg: HelpRequest = {
      type: AppMessageType.HelpRequest,
      id,
      sender: client.myNodeNum,
      time: unixSeconds(now()),
    };
    const open = this.opts.checkIns?.current;
    if (open) {
      msg.mode = open.placement.mode;
      if ('standId' in open.placement && open.placement.standId)
        msg.standId = open.placement.standId;
      if ('areaId' in open.placement && open.placement.areaId) msg.areaId = open.placement.areaId;
    }
    const pin = this.opts.getLocation() ?? open?.placement.pin;
    if (pin) msg.pin = pin;
    if (this.note) msg.note = this.note;
    return msg;
  }

  private clearTimer(): void {
    if (this.timer !== undefined) this.ctx.timers.clearTimeout(this.timer);
    this.timer = undefined;
  }
}
