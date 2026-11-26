/**
 * App-level receipts (docs/SPEC.md "Mesh protocol" rules). A firmware ack on
 * a broadcast only proves one neighbour heard it, so every app that receives
 * a Text, CheckIn or HelpRequest answers with a tiny Receipt on our port.
 *
 * - ReceiptService sends receipts: de-duplicated per message, rate-limited
 *   per sender with a token bucket, and jittered so phones don't collide.
 * - DeliveryTracker counts "Delivered to N of M" for our own messages.
 */
import {
  AppMessageType,
  Emitter,
  randomUint32,
  type AppMessage,
  type MeshClient,
  type Receipt,
  type Unsubscribe,
} from '@huntclub/mesh';
import {
  randomFraction,
  resolveContext,
  unixSeconds,
  type CoreContext,
  type ResolvedContext,
} from './context';

/** Calls `cb` for every Receipt from another node (first copies and repeats). */
export function onReceipt(client: MeshClient, cb: (receipt: Receipt) => void): Unsubscribe {
  const handle = ({ message }: { message: AppMessage }) => {
    if (message.type === AppMessageType.Receipt && message.sender !== client.myNodeNum) {
      cb(message);
    }
  };
  const offs = [client.on('appMessage', handle), client.on('appMessageRepeat', handle)];
  return () => offs.forEach((off) => off());
}

/** App message types that get a Receipt. Text messages get one too. */
export const RECEIPTED_TYPES: readonly AppMessageType[] = [
  AppMessageType.CheckIn,
  AppMessageType.HelpRequest,
];

export interface ReceiptPolicy {
  /** Receipts a single sender can trigger in a burst. Default 3. */
  burst: number;
  /** One more receipt per sender is allowed every this many ms. Default 20 s. */
  refillMs: number;
  /** A repeat of the same message (a sender retry) is answered again at most this often. Default 60 s. */
  repeatMinMs: number;
  /** Random delay before sending, so phones that heard the same message don't collide. Default 3 s. */
  jitterMs: number;
}

export const DEFAULT_RECEIPT_POLICY: ReceiptPolicy = {
  burst: 3,
  refillMs: 20_000,
  repeatMinMs: 60_000,
  jitterMs: 3_000,
};

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class ReceiptService {
  private readonly ctx: ResolvedContext;
  private readonly policy: ReceiptPolicy;
  private readonly buckets = new Map<number, Bucket>();
  /** Last time we sent a receipt for "sender:messageId". */
  private readonly answered = new Map<string, number>();
  private offs: Unsubscribe[] = [];
  /** Receipts not sent because of the rate limit (for diagnostics). */
  suppressed = 0;
  /** Receipts sent. */
  sent = 0;

  constructor(ctx: CoreContext, policy: Partial<ReceiptPolicy> = {}) {
    this.ctx = resolveContext(ctx);
    this.policy = { ...DEFAULT_RECEIPT_POLICY, ...policy };
  }

  start(): this {
    const { client } = this.ctx;
    this.offs.push(
      client.on('text', (t) => this.consider(t.from, t.packetId, false)),
      client.on('appMessage', ({ message }) => this.considerApp(message, false)),
      client.on('appMessageRepeat', ({ message }) => this.considerApp(message, true)),
    );
    return this;
  }

  stop(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
  }

  private considerApp(message: AppMessage, repeat: boolean): void {
    if (RECEIPTED_TYPES.includes(message.type)) this.consider(message.sender, message.id, repeat);
  }

  private consider(sender: number, messageId: number, repeat: boolean): void {
    const { client, now } = this.ctx;
    if (sender === client.myNodeNum || sender === 0 || messageId === 0) return;
    const key = `${sender >>> 0}:${messageId >>> 0}`;
    const t = now();
    const last = this.answered.get(key);
    if (last !== undefined && (!repeat || t - last < this.policy.repeatMinMs)) return;
    if (!this.takeToken(sender, t)) {
      this.suppressed++;
      return;
    }
    this.answered.set(key, t);
    this.pruneAnswered(t);
    const delay = Math.floor(randomFraction(this.ctx.random) * this.policy.jitterMs);
    this.ctx.timers.setTimeout(() => this.send(messageId), delay);
  }

  private send(ackedId: number): void {
    const { client, random, now } = this.ctx;
    if (!client.myNodeNum) return;
    this.sent++;
    client.sendAppMessage(
      {
        type: AppMessageType.Receipt,
        id: randomUint32(random),
        sender: client.myNodeNum,
        ackedId,
        time: unixSeconds(now()),
      },
      // A receipt is itself the acknowledgement; don't spend airtime acking it.
      { wantAck: false },
    );
  }

  private takeToken(sender: number, t: number): boolean {
    const { burst, refillMs } = this.policy;
    const b = this.buckets.get(sender) ?? { tokens: burst, updatedAt: t };
    b.tokens = Math.min(burst, b.tokens + (t - b.updatedAt) / refillMs);
    b.updatedAt = t;
    this.buckets.set(sender, b);
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  private pruneAnswered(t: number): void {
    const horizon = Math.max(this.policy.repeatMinMs, 3_600_000);
    for (const [k, at] of this.answered) {
      if (t - at < horizon) break;
      this.answered.delete(k);
    }
  }
}

export interface DeliveryState {
  /** App message id (or Meshtastic packet id for a text). */
  id: number;
  /** Distinct members who sent a Receipt. */
  deliveredTo: number[];
  /** How many members should receive it (party/club size minus us). */
  expected: number;
}

/** Counts receipts for our own messages: "Delivered to N of M". */
export class DeliveryTracker extends Emitter<{ delivery: DeliveryState }> {
  private readonly tracked = new Map<number, { expected: number; from: Set<number> }>();
  private readonly off: Unsubscribe;

  constructor(client: MeshClient) {
    super();
    this.off = onReceipt(client, (r) => this.record(r));
  }

  /** Start counting receipts for a message we sent. */
  track(id: number, expected: number): void {
    if (!this.tracked.has(id)) this.tracked.set(id, { expected, from: new Set() });
  }

  get(id: number): DeliveryState | undefined {
    const t = this.tracked.get(id);
    return t && { id, deliveredTo: [...t.from], expected: t.expected };
  }

  forget(id: number): void {
    this.tracked.delete(id);
  }

  dispose(): void {
    this.off();
    this.tracked.clear();
  }

  private record(r: Receipt): void {
    const t = this.tracked.get(r.ackedId);
    if (!t || t.from.has(r.sender)) return;
    t.from.add(r.sender);
    this.emit('delivery', this.get(r.ackedId)!);
  }
}
