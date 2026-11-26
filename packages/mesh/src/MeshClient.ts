/**
 * MeshClient: talks to one Meshtastic radio through a Transport.
 *
 * - Runs the want_config_id handshake with a random nonce on every
 *   `connected` status (the radio forgets the phone on each disconnect).
 * - Keeps the radio's node DB, channels and config from the config dump.
 * - Sends through a queue that respects the radio's TX queue (QueueStatus,
 *   RADIO_TX_QUEUE_SIZE slots) and paces writes (~200 ms apart).
 * - Matches Routing acks/naks to sent packets by request_id.
 * - Drops duplicate packets by (from, packet id), and duplicate app-port
 *   messages by (sender, message id).
 *
 * Never logs message bodies or channel keys: the optional logger only gets
 * ids, port numbers, sizes and states.
 */
import { fromBinary, toBinary, type MessageInitShape } from '@bufbuild/protobuf';
import { Admin, Channel, Config, Mesh, ModuleConfig, Portnums, Telemetry } from './protobufs';
import {
  BROADCAST_ADDR,
  RADIO_TX_QUEUE_SIZE,
  SPECIAL_CONFIG_NONCES,
  decodeFromRadio,
  disconnectMessage,
  encodeAdmin,
  encodeToRadio,
  heartbeat,
  wantConfig,
  buildDataPacket,
  type DataPacketInit,
} from './codec/radio';
import {
  HUNTCLUB_PORT,
  appMessageKey,
  encodeAppMessage,
  tryDecodeAppMessage,
  type AppMessage,
} from './codec/appPort';
import { DedupCache, packetKey } from './dedup';
import { Emitter } from './emitter';
import { defaultRandom, randomUint32, type RandomSource } from './random';
import { decodeUtf8, defaultTimers, encodeUtf8, type TimerHandle, type Timers } from './runtime';
import type { LinkStatus, Transport, Unsubscribe } from './transport';
import { buildProvisioningMessages, type ProvisioningPlan } from './provisioning';
import { buildSetOwnerMessage, type Owner } from './owner';

export type ClientState = 'disconnected' | 'connecting' | 'configuring' | 'ready';

export interface NodeRecord {
  num: number;
  user?: Mesh.User;
  position?: Mesh.Position;
  deviceMetrics?: Telemetry.DeviceMetrics;
  /** Unix seconds, from the radio or the last packet heard. */
  lastHeard?: number;
  snr?: number;
  hopsAway?: number;
}

interface RxMeta {
  packetId: number;
  from: number;
  to: number;
  /** Channel index on our radio. */
  channel: number;
  /** Unix seconds the radio received it (0 if unknown). */
  rxTime: number;
  rxSnr: number;
  hopsAway?: number;
}

export interface TextEvent extends RxMeta {
  text: string;
  /** True when sent to our node rather than broadcast. */
  isDirect: boolean;
}

export interface PositionEvent extends RxMeta {
  position: Mesh.Position;
  /** Degrees, when the position has coordinates. */
  lat?: number;
  lon?: number;
}

export interface NodeInfoEvent {
  node: NodeRecord;
}

export interface HeardEvent extends RxMeta {
  portnum: number;
}

export interface AppMessageEvent extends RxMeta {
  message: AppMessage;
}

export interface AckEvent {
  /** Id of our packet that was acknowledged. */
  packetId: number;
  /** Who acked. Our own node = implicit ack (a neighbour was heard relaying a broadcast). */
  by: number;
  implicit: boolean;
}

export interface NakEvent {
  packetId: number;
  /** Routing error code from the radio (Mesh.Routing_Error), or QueueStatus.res. */
  code: number;
  reason: string;
}

export interface MeshClientEvents {
  state: ClientState;
  linkStatus: LinkStatus;
  /** Config dump finished; the client is ready to send. */
  ready: { myNodeNum: number };
  text: TextEvent;
  position: PositionEvent;
  nodeinfo: NodeInfoEvent;
  /**
   * Any live packet from another node (first copy only), on any port. Lets
   * the app see who is on a channel; a config-dump node DB entry is not
   * proof that a node is around now.
   */
  heard: HeardEvent;
  /** First copy of an app-port message. */
  appMessage: AppMessageEvent;
  /** Same app message id again under a new packet (a sender retry). Lets the app re-send a receipt. */
  appMessageRepeat: AppMessageEvent;
  ack: AckEvent;
  nak: NakEvent;
  queueStatus: { free: number; maxlen: number };
  rebooted: void;
}

export type DeliveryResult =
  | { status: 'acked'; by: number; implicit: boolean }
  /** No ack was requested and the radio accepted the packet. */
  | { status: 'sent' }
  | { status: 'failed'; code: number; reason: string }
  | { status: 'timeout' }
  | { status: 'cancelled' };

export interface SendHandle {
  /** Meshtastic packet id (also the request_id acks refer to). */
  id: number;
  /** Settles once; never rejects. */
  result: Promise<DeliveryResult>;
}

export interface SendOptions {
  to?: number;
  channel?: number;
  wantAck?: boolean;
  hopLimit?: number;
}

export type MeshLogger = (
  event: string,
  details?: Record<string, string | number | boolean>,
) => void;

export interface MeshClientOptions {
  transport: Transport;
  random?: RandomSource;
  timers?: Timers;
  now?: () => number;
  /** Minimum gap between writes to the radio. Default 200 ms. */
  pacingMs?: number;
  /** Give up waiting for an ack after this long. Default 120 s. */
  ackTimeoutMs?: number;
  /** If no QueueStatus arrives for a write, assume accepted after this long. Default 5 s. */
  queueStatusTimeoutMs?: number;
  /** When the radio says its TX queue is full and goes quiet, try one packet after this long. Default 30 s. */
  queueFullProbeMs?: number;
  /** Re-send want_config_id if the dump hasn't completed after this long. Default 30 s. */
  handshakeTimeoutMs?: number;
  /** Packet de-duplication window. Default 30 min. */
  dedupTtlMs?: number;
  log?: MeshLogger;
}

interface Outgoing {
  id: number;
  bytes: Uint8Array;
  /** Wait for a Routing reply (ack/nak) before settling. */
  wantAck: boolean;
  portnum: number;
  resolve: (r: DeliveryResult) => void;
  timer?: TimerHandle;
}

export class MeshClient extends Emitter<MeshClientEvents> {
  private readonly transport: Transport;
  private readonly random: RandomSource;
  private readonly timers: Timers;
  private readonly now: () => number;
  private readonly pacingMs: number;
  private readonly ackTimeoutMs: number;
  private readonly queueStatusTimeoutMs: number;
  private readonly queueFullProbeMs: number;
  private readonly handshakeTimeoutMs: number;
  private readonly log: MeshLogger;

  private _state: ClientState = 'disconnected';
  private linkUp = false;
  private configNonce = 0;
  private handshakeTimer: TimerHandle | undefined;
  private subscriptions: Unsubscribe[] = [];

  private _myNodeNum = 0;
  private _firmwareVersion: string | undefined;
  readonly nodes = new Map<number, NodeRecord>();
  readonly channels = new Map<number, Channel.Channel>();
  /** Config sections by name (device, position, lora, ...). */
  readonly config: Partial<{
    [K in NonNullable<Config.Config['payloadVariant']['case']>]: Extract<
      Config.Config['payloadVariant'],
      { case: K }
    >['value'];
  }> = {};
  readonly moduleConfig: Partial<Record<string, unknown>> = {};

  private readonly packetDedup: DedupCache;
  private readonly appDedup: DedupCache;

  private queue: Outgoing[] = [];
  private awaitingQueueStatus = new Map<number, Outgoing>();
  private awaitingAck = new Map<number, Outgoing>();
  private radioFree = RADIO_TX_QUEUE_SIZE;
  private lastWriteAt = Number.NEGATIVE_INFINITY;
  private writing = false;
  private pumpTimer: TimerHandle | undefined;

  constructor(opts: MeshClientOptions) {
    super();
    this.transport = opts.transport;
    this.random = opts.random ?? defaultRandom;
    this.timers = opts.timers ?? defaultTimers;
    this.now = opts.now ?? (() => Date.now());
    this.pacingMs = opts.pacingMs ?? 200;
    this.ackTimeoutMs = opts.ackTimeoutMs ?? 120_000;
    this.queueStatusTimeoutMs = opts.queueStatusTimeoutMs ?? 5_000;
    this.queueFullProbeMs = opts.queueFullProbeMs ?? 30_000;
    this.handshakeTimeoutMs = opts.handshakeTimeoutMs ?? 30_000;
    this.log = opts.log ?? (() => {});
    const ttlMs = opts.dedupTtlMs ?? 30 * 60_000;
    this.packetDedup = new DedupCache({ ttlMs, maxEntries: 2000, now: this.now });
    this.appDedup = new DedupCache({
      ttlMs: Math.max(ttlMs, 6 * 3600_000),
      maxEntries: 2000,
      now: this.now,
    });

    this.subscriptions.push(
      this.transport.onStatus((s) => this.handleStatus(s)),
      this.transport.onFromRadio((b) => this.handleFromRadio(b)),
    );
  }

  get state(): ClientState {
    return this._state;
  }

  /** Our radio's node number (0 until my_info arrives). */
  get myNodeNum(): number {
    return this._myNodeNum;
  }

  get firmwareVersion(): string | undefined {
    return this._firmwareVersion;
  }

  get isReady(): boolean {
    return this._state === 'ready';
  }

  /** Packets waiting to be written to the radio. */
  get pendingCount(): number {
    return this.queue.length;
  }

  async connect(): Promise<void> {
    if (!this.linkUp) this.setState('connecting');
    await this.transport.connect();
  }

  /** Sends a clean disconnect to the radio, closes the link and cancels everything pending. */
  async close(): Promise<void> {
    if (this.linkUp) {
      try {
        await this.transport.write(disconnectMessage());
      } catch {
        // Link already gone.
      }
    }
    this.cancelAll();
    await this.transport.disconnect();
    this.linkUp = false;
    this.clearHandshakeTimer();
    this.setState('disconnected');
    for (const off of this.subscriptions) off();
    this.subscriptions = [];
  }

  /** Resolves when the client is ready (immediately if it already is). */
  waitUntilReady(): Promise<void> {
    if (this.isReady) return Promise.resolve();
    return new Promise((resolve) => {
      this.once('ready', () => resolve());
    });
  }

  // ---- Sending ----

  sendText(text: string, opts: SendOptions = {}): SendHandle {
    return this.sendPacket({
      ...opts,
      portnum: Portnums.PortNum.TEXT_MESSAGE_APP,
      payload: encodeUtf8(text),
      wantAck: opts.wantAck ?? true,
    });
  }

  /** Encodes and sends an app-port message. Spec: app messages request an ack. */
  sendAppMessage(message: AppMessage, opts: SendOptions = {}): SendHandle {
    const payload = encodeAppMessage(message);
    // Our own message must not come back to us as "new" via a relay.
    this.appDedup.checkAndAdd(appMessageKey(message));
    return this.sendPacket({
      ...opts,
      portnum: HUNTCLUB_PORT,
      payload,
      wantAck: opts.wantAck ?? true,
    });
  }

  /** Sends an AdminMessage, by default to our own radio. */
  sendAdmin(
    admin: MessageInitShape<typeof Admin.AdminMessageSchema>,
    opts: { to?: number } = {},
  ): SendHandle {
    return this.sendPacket({
      portnum: Portnums.PortNum.ADMIN_APP,
      payload: encodeAdmin(admin),
      to: opts.to ?? this._myNodeNum,
      wantAck: false,
      wantResponse: true,
      // The radio answers an admin request with a Routing reply; wait for it like an ack.
      awaitRouting: true,
    });
  }

  /** Writes our name and initials to our radio (see owner.ts; validate first). */
  setOwner(owner: Owner): SendHandle {
    return this.sendAdmin(buildSetOwnerMessage(owner));
  }

  /**
   * Applies a provisioning plan to our radio, merging the radio's current
   * device/position/lora config so unrelated settings survive.
   */
  provision(plan: ProvisioningPlan): SendHandle[] {
    const current = {
      ...(this.config.device ? { device: this.config.device } : {}),
      ...(this.config.position ? { position: this.config.position } : {}),
      ...(this.config.lora ? { lora: this.config.lora } : {}),
    };
    const msgs = buildProvisioningMessages({
      ...plan,
      current: { ...current, ...(plan.current ?? {}) },
    });
    return msgs.map((m) => this.sendAdmin(m));
  }

  /** Low-level send. A random packet id is chosen unless one is given. */
  sendPacket(
    init: Omit<DataPacketInit, 'id'> & {
      id?: number;
      /** Settle on a Routing reply even without want_ack (local admin requests answer with one). */
      awaitRouting?: boolean;
    },
  ): SendHandle {
    const { awaitRouting, ...packetInit } = init;
    const id = init.id ?? randomUint32(this.random);
    const packet = buildDataPacket({ ...packetInit, id, to: init.to ?? BROADCAST_ADDR });
    const bytes = encodeToRadio({ payloadVariant: { case: 'packet', value: packet } });
    let resolve!: (r: DeliveryResult) => void;
    const result = new Promise<DeliveryResult>((r) => (resolve = r));
    const item: Outgoing = {
      id,
      bytes,
      wantAck: (init.wantAck ?? false) || (awaitRouting ?? false),
      portnum: Number(init.portnum),
      resolve,
    };
    this.queue.push(item);
    this.log('tx.queued', {
      id,
      portnum: item.portnum,
      size: init.payload.length,
      queued: this.queue.length,
    });
    this.pump();
    return { id, result };
  }

  /**
   * Broadcasts our radio's node info on a channel. With `wantResponse`,
   * every node that hears it answers with its own node info (stock firmware
   * behaviour): a quick way to learn who is on a channel. Costs one reply
   * per node, so use it once when joining, not periodically.
   */
  sendNodeInfo(opts: { channel?: number; wantResponse?: boolean } = {}): SendHandle {
    const user = this.nodes.get(this._myNodeNum)?.user;
    if (!user) throw new Error('Our node info is not known yet (handshake not complete)');
    return this.sendPacket({
      portnum: Portnums.PortNum.NODEINFO_APP,
      payload: toBinary(Mesh.UserSchema, user),
      channel: opts.channel ?? 0,
      wantResponse: opts.wantResponse ?? false,
    });
  }

  /** Keeps the BLE link alive. Bypasses the send queue. */
  async heartbeat(): Promise<void> {
    if (!this.linkUp) return;
    await this.transport.write(heartbeat(randomUint32(this.random)));
  }

  // ---- Link status and handshake ----

  private handleStatus(status: LinkStatus): void {
    this.emit('linkStatus', status);
    this.log('link', { status });
    if (status === 'connected') {
      this.linkUp = true;
      this.startHandshake();
    } else if (status === 'connecting') {
      this.linkUp = false;
      this.clearHandshakeTimer();
      this.setState('connecting');
    } else {
      this.linkUp = false;
      this.clearHandshakeTimer();
      this.onLinkLost();
      this.setState('disconnected');
    }
  }

  private startHandshake(): void {
    this.clearHandshakeTimer();
    let nonce: number;
    do {
      nonce = randomUint32(this.random);
    } while (SPECIAL_CONFIG_NONCES.includes(nonce) || nonce === this.configNonce);
    this.configNonce = nonce;
    this.channels.clear();
    this.setState('configuring');
    this.log('handshake.start', { nonce });
    this.transport.write(wantConfig(nonce)).catch(() => {
      this.log('handshake.writeFailed');
    });
    this.handshakeTimer = this.timers.setTimeout(() => {
      this.handshakeTimer = undefined;
      if (this.linkUp && this._state === 'configuring') {
        this.log('handshake.timeout');
        this.startHandshake();
      }
    }, this.handshakeTimeoutMs);
  }

  private clearHandshakeTimer(): void {
    if (this.handshakeTimer !== undefined) {
      this.timers.clearTimeout(this.handshakeTimer);
      this.handshakeTimer = undefined;
    }
  }

  private onLinkLost(): void {
    if (this.pumpTimer !== undefined) {
      this.timers.clearTimeout(this.pumpTimer);
      this.pumpTimer = undefined;
    }
    // Packets already written made it into the radio's mesh queue; the
    // firmware only drops its BLE queues. Treat them as accepted.
    for (const item of [...this.awaitingQueueStatus.values()]) {
      this.awaitingQueueStatus.delete(item.id);
      if (item.timer !== undefined) this.timers.clearTimeout(item.timer);
      item.timer = undefined;
      this.onAccepted(item);
    }
    this.radioFree = RADIO_TX_QUEUE_SIZE;
  }

  private setState(s: ClientState): void {
    if (this._state === s) return;
    this._state = s;
    this.emit('state', s);
  }

  // ---- Receiving ----

  private handleFromRadio(bytes: Uint8Array): void {
    if (bytes.length === 0) return; // Empty read = drained.
    const fr = decodeFromRadio(bytes);
    if (!fr) {
      this.log('rx.undecodable', { size: bytes.length });
      return;
    }
    const v = fr.payloadVariant;
    switch (v.case) {
      case 'myInfo':
        if (this._myNodeNum && this._myNodeNum !== v.value.myNodeNum) {
          // A different radio: forget the old one's node DB.
          this.nodes.clear();
        }
        this._myNodeNum = v.value.myNodeNum;
        break;
      case 'nodeInfo':
        this.updateNode(v.value.num, (n) => {
          if (v.value.user) n.user = v.value.user;
          if (v.value.position) n.position = v.value.position;
          if (v.value.deviceMetrics) n.deviceMetrics = v.value.deviceMetrics;
          if (v.value.lastHeard) n.lastHeard = v.value.lastHeard;
          if (v.value.snr) n.snr = v.value.snr;
          if (v.value.hopsAway !== undefined) n.hopsAway = v.value.hopsAway;
        });
        break;
      case 'channel':
        this.channels.set(v.value.index, v.value);
        break;
      case 'config': {
        const c = v.value.payloadVariant;
        if (c.case) (this.config as Record<string, unknown>)[c.case] = c.value;
        break;
      }
      case 'moduleConfig': {
        const c = (v.value as ModuleConfig.ModuleConfig).payloadVariant;
        if (c.case) this.moduleConfig[c.case] = c.value;
        break;
      }
      case 'metadata':
        this._firmwareVersion = v.value.firmwareVersion;
        this.log('radio.metadata', { firmware: v.value.firmwareVersion });
        break;
      case 'configCompleteId':
        if (v.value === this.configNonce && this._state === 'configuring') {
          this.clearHandshakeTimer();
          this.setState('ready');
          this.log('handshake.complete', { nodes: this.nodes.size, channels: this.channels.size });
          this.emit('ready', { myNodeNum: this._myNodeNum });
          this.pump();
        }
        break;
      case 'queueStatus':
        this.handleQueueStatus(v.value);
        break;
      case 'packet':
        this.handlePacket(v.value);
        break;
      case 'rebooted':
        this.log('radio.rebooted');
        this.emit('rebooted', undefined);
        if (this.linkUp) this.startHandshake();
        break;
      default:
        // Log records, file info, newer firmware variants, etc.: ignore.
        break;
    }
  }

  private updateNode(num: number, apply: (n: NodeRecord) => void): NodeRecord {
    const n = this.nodes.get(num) ?? { num };
    apply(n);
    this.nodes.set(num, n);
    this.emit('nodeinfo', { node: n });
    return n;
  }

  private handlePacket(p: Mesh.MeshPacket): void {
    if (p.payloadVariant.case !== 'decoded') return; // Not for a channel we have.
    if (p.id !== 0 && !this.packetDedup.checkAndAdd(packetKey(p.from, p.id))) {
      this.log('rx.duplicate', { from: p.from, id: p.id });
      return;
    }
    const data = p.payloadVariant.value;
    const meta: RxMeta = {
      packetId: p.id,
      from: p.from,
      to: p.to,
      channel: p.channel,
      rxTime: p.rxTime ?? 0,
      rxSnr: p.rxSnr,
    };
    if (p.hopStart && p.hopStart >= p.hopLimit) meta.hopsAway = p.hopStart - p.hopLimit;
    this.log('rx.packet', {
      from: p.from,
      id: p.id,
      portnum: data.portnum,
      size: data.payload.length,
    });

    if (p.from !== this._myNodeNum && p.from !== 0) {
      const n = this.nodes.get(p.from);
      if (n || data.portnum !== Portnums.PortNum.ROUTING_APP) {
        const rec = n ?? { num: p.from };
        if (meta.rxTime) rec.lastHeard = meta.rxTime;
        if (p.rxSnr) rec.snr = p.rxSnr;
        if (meta.hopsAway !== undefined) rec.hopsAway = meta.hopsAway;
        this.nodes.set(p.from, rec);
      }
    }

    if (p.from !== this._myNodeNum && p.from !== 0) {
      this.emit('heard', { ...meta, portnum: data.portnum });
    }

    switch (data.portnum as number) {
      case Portnums.PortNum.ROUTING_APP:
        this.handleRouting(p, data);
        break;
      case Portnums.PortNum.TEXT_MESSAGE_APP:
        this.emit('text', {
          ...meta,
          text: decodeUtf8(data.payload),
          isDirect: p.to !== BROADCAST_ADDR && p.to === this._myNodeNum,
        });
        break;
      case Portnums.PortNum.POSITION_APP: {
        const position = safeDecode(Mesh.PositionSchema, data.payload);
        if (!position) return;
        this.updateNode(p.from, (n) => (n.position = position));
        const ev: PositionEvent = { ...meta, position };
        if (position.latitudeI !== undefined && position.longitudeI !== undefined) {
          ev.lat = position.latitudeI / 1e7;
          ev.lon = position.longitudeI / 1e7;
        }
        this.emit('position', ev);
        break;
      }
      case Portnums.PortNum.NODEINFO_APP: {
        const user = safeDecode(Mesh.UserSchema, data.payload);
        if (user) this.updateNode(p.from, (n) => (n.user = user));
        break;
      }
      case HUNTCLUB_PORT: {
        const message = tryDecodeAppMessage(data.payload);
        if (!message) {
          this.log('rx.appMessageInvalid', { from: p.from, id: p.id, size: data.payload.length });
          return;
        }
        const first = this.appDedup.checkAndAdd(appMessageKey(message));
        this.emit(first ? 'appMessage' : 'appMessageRepeat', { ...meta, message });
        break;
      }
      default:
        break;
    }
  }

  private handleRouting(p: Mesh.MeshPacket, data: Mesh.Data): void {
    if (!data.requestId) return;
    const routing = safeDecode(Mesh.RoutingSchema, data.payload);
    if (!routing || routing.variant.case !== 'errorReason') return;
    const code = routing.variant.value;
    const item =
      this.awaitingAck.get(data.requestId) ?? this.awaitingQueueStatus.get(data.requestId);
    if (code === Mesh.Routing_Error.NONE) {
      const ack: AckEvent = {
        packetId: data.requestId,
        by: p.from,
        implicit: p.from === this._myNodeNum,
      };
      this.log('rx.ack', { id: data.requestId, implicit: ack.implicit });
      if (item) this.finish(item, { status: 'acked', by: ack.by, implicit: ack.implicit });
      this.emit('ack', ack);
    } else {
      const reason = Mesh.Routing_Error[code] ?? `ERROR_${code}`;
      this.log('rx.nak', { id: data.requestId, code });
      if (item) this.finish(item, { status: 'failed', code, reason });
      this.emit('nak', { packetId: data.requestId, code, reason });
    }
  }

  // ---- Send queue ----

  private handleQueueStatus(qs: Mesh.QueueStatus): void {
    this.radioFree = qs.free;
    this.emit('queueStatus', { free: qs.free, maxlen: qs.maxlen });
    const item = this.awaitingQueueStatus.get(qs.meshPacketId);
    if (item) {
      this.awaitingQueueStatus.delete(item.id);
      if (item.timer !== undefined) this.timers.clearTimeout(item.timer);
      item.timer = undefined;
      if (qs.res !== 0) {
        const reason = `QUEUE_${qs.res}`;
        this.finish(item, { status: 'failed', code: qs.res, reason });
        this.emit('nak', { packetId: item.id, code: qs.res, reason });
      } else {
        this.onAccepted(item);
      }
    }
    // Fresh queue info: drop any pending probe/pacing timer and re-evaluate now.
    if (this.pumpTimer !== undefined) {
      this.timers.clearTimeout(this.pumpTimer);
      this.pumpTimer = undefined;
    }
    this.pump();
  }

  private onAccepted(item: Outgoing): void {
    if (!item.wantAck) {
      this.finish(item, { status: 'sent' });
      return;
    }
    this.awaitingAck.set(item.id, item);
    item.timer = this.timers.setTimeout(() => {
      item.timer = undefined;
      this.log('tx.ackTimeout', { id: item.id });
      this.finish(item, { status: 'timeout' });
    }, this.ackTimeoutMs);
  }

  private finish(item: Outgoing, result: DeliveryResult): void {
    if (item.timer !== undefined) this.timers.clearTimeout(item.timer);
    item.timer = undefined;
    this.awaitingAck.delete(item.id);
    this.awaitingQueueStatus.delete(item.id);
    item.resolve(result);
  }

  private cancelAll(): void {
    for (const item of [
      ...this.queue,
      ...this.awaitingQueueStatus.values(),
      ...this.awaitingAck.values(),
    ]) {
      this.finish(item, { status: 'cancelled' });
    }
    this.queue = [];
    if (this.pumpTimer !== undefined) this.timers.clearTimeout(this.pumpTimer);
    this.pumpTimer = undefined;
  }

  private pump(): void {
    if (this._state !== 'ready' || !this.linkUp || this.writing || this.pumpTimer !== undefined)
      return;
    if (this.queue.length === 0) return;
    if (this.radioFree - this.awaitingQueueStatus.size <= 0) {
      // Radio TX queue is full: wait for a QueueStatus with free slots. If none
      // comes (the radio only reports on change), probe with one packet later.
      if (this.awaitingQueueStatus.size === 0) {
        this.pumpTimer = this.timers.setTimeout(() => {
          this.pumpTimer = undefined;
          this.radioFree = Math.max(this.radioFree, 1);
          this.pump();
        }, this.queueFullProbeMs);
      }
      return;
    }
    const wait = this.lastWriteAt + this.pacingMs - this.now();
    if (wait > 0) {
      this.pumpTimer = this.timers.setTimeout(() => {
        this.pumpTimer = undefined;
        this.pump();
      }, wait);
      return;
    }
    const item = this.queue.shift()!;
    this.writing = true;
    this.lastWriteAt = this.now();
    this.awaitingQueueStatus.set(item.id, item);
    this.log('tx.write', { id: item.id, portnum: item.portnum });
    this.transport.write(item.bytes).then(
      () => {
        this.writing = false;
        if (this.awaitingQueueStatus.has(item.id) && item.timer === undefined) {
          item.timer = this.timers.setTimeout(() => {
            item.timer = undefined;
            if (!this.awaitingQueueStatus.delete(item.id)) return;
            // Older firmware may not send QueueStatus: assume accepted.
            this.onAccepted(item);
            this.pump();
          }, this.queueStatusTimeoutMs);
        }
        this.pump();
      },
      () => {
        // Link dropped mid-write: put it back at the front for after reconnect.
        this.writing = false;
        this.awaitingQueueStatus.delete(item.id);
        this.queue.unshift(item);
        this.log('tx.writeFailed', { id: item.id });
      },
    );
  }
}

function safeDecode<T extends Parameters<typeof fromBinary>[0]>(schema: T, bytes: Uint8Array) {
  try {
    return fromBinary(schema, bytes) as ReturnType<typeof fromBinary<T>>;
  } catch {
    return undefined;
  }
}
