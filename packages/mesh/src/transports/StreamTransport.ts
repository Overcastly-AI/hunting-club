/**
 * Transport over a framed byte stream (TCP to meshtasticd, or serial).
 * Pure TypeScript: the platform supplies a ByteStream (see src/node/tcp.ts
 * for Node's TCP socket). Frames are 0x94 0xC3 + u16 length + protobuf
 * (codec/streamFraming.ts).
 *
 * With `reconnect`, a dropped stream is reopened with backoff and the
 * transport reports connecting → connected again, so MeshClient re-runs
 * its handshake (meshtasticd restarts itself after some config changes).
 */
import { FrameDecoder, encodeFrame, wakeSequence } from '../codec/streamFraming';
import { defaultTimers, type TimerHandle, type Timers } from '../runtime';
import type { LinkStatus, Transport, Unsubscribe } from '../transport';

export interface ByteStream {
  write(bytes: Uint8Array): Promise<void>;
  onData(cb: (chunk: Uint8Array) => void): Unsubscribe;
  /** Called once when the stream ends or fails. */
  onClose(cb: () => void): Unsubscribe;
  close(): Promise<void>;
}

export type StreamOpener = () => Promise<ByteStream>;

export interface StreamTransportOptions {
  /** Send the 32-byte wake sequence after opening (as the official clients do). Default true. */
  wake?: boolean;
  /** Reopen after a drop. Default: on, 1 s doubling to 30 s. `false` turns it off. */
  reconnect?: { initialMs: number; maxMs: number } | false;
  timers?: Timers;
}

const DEFAULT_RECONNECT = { initialMs: 1_000, maxMs: 30_000 };

export class StreamTransport implements Transport {
  private stream: ByteStream | undefined;
  private readonly decoder = new FrameDecoder();
  private readonly statusListeners = new Set<(s: LinkStatus) => void>();
  private readonly dataListeners = new Set<(b: Uint8Array) => void>();
  private readonly timers: Timers;
  private readonly reconnect: { initialMs: number; maxMs: number } | false;
  private readonly wake: boolean;
  private closedByUser = false;
  private retryTimer: TimerHandle | undefined;
  private retryDelay: number;
  private offs: Unsubscribe[] = [];

  constructor(
    private readonly open: StreamOpener,
    opts: StreamTransportOptions = {},
  ) {
    this.timers = opts.timers ?? defaultTimers;
    this.reconnect = opts.reconnect === undefined ? DEFAULT_RECONNECT : opts.reconnect;
    this.wake = opts.wake ?? true;
    this.retryDelay = this.reconnect ? this.reconnect.initialMs : 0;
  }

  get connected(): boolean {
    return this.stream !== undefined;
  }

  async connect(): Promise<void> {
    this.closedByUser = false;
    if (this.stream) return;
    await this.attempt(true);
  }

  async write(toRadio: Uint8Array): Promise<void> {
    if (!this.stream) throw new Error('StreamTransport: not connected');
    await this.stream.write(encodeFrame(toRadio));
  }

  onFromRadio(cb: (bytes: Uint8Array) => void): Unsubscribe {
    this.dataListeners.add(cb);
    return () => this.dataListeners.delete(cb);
  }

  onStatus(cb: (status: LinkStatus) => void): Unsubscribe {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  async disconnect(): Promise<void> {
    this.closedByUser = true;
    if (this.retryTimer !== undefined) this.timers.clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const s = this.stream;
    this.detach();
    if (s) {
      await s.close();
      this.emit('disconnected');
    }
  }

  private async attempt(first: boolean): Promise<void> {
    this.emit('connecting');
    let stream: ByteStream;
    try {
      stream = await this.open();
    } catch (e) {
      this.emit('disconnected');
      this.scheduleRetry();
      if (first) throw e;
      return;
    }
    if (this.closedByUser) {
      await stream.close();
      return;
    }
    this.stream = stream;
    this.decoder.reset();
    this.offs = [
      stream.onData((chunk) => {
        for (const frame of this.decoder.push(chunk)) {
          for (const cb of [...this.dataListeners]) cb(frame);
        }
      }),
      stream.onClose(() => {
        if (this.stream !== stream) return;
        this.detach();
        this.emit('disconnected');
        this.scheduleRetry();
      }),
    ];
    if (this.reconnect) this.retryDelay = this.reconnect.initialMs;
    if (this.wake) await stream.write(wakeSequence());
    this.emit('connected');
  }

  private scheduleRetry(): void {
    if (!this.reconnect || this.closedByUser || this.retryTimer !== undefined) return;
    const delay = this.retryDelay;
    this.retryDelay = Math.min(this.retryDelay * 2, this.reconnect.maxMs);
    this.retryTimer = this.timers.setTimeout(() => {
      this.retryTimer = undefined;
      if (!this.closedByUser && !this.stream) void this.attempt(false);
    }, delay);
  }

  private detach(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
    this.stream = undefined;
  }

  private emit(s: LinkStatus): void {
    for (const cb of [...this.statusListeners]) cb(s);
  }
}
