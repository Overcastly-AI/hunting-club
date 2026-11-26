/**
 * Test doubles for the radio link. No real radio is available to agents, so
 * MeshClient is tested against:
 *
 * - FakeRadio: a scripted Meshtastic radio that implements Transport. It
 *   answers want_config_id with a config dump, answers each phone send with
 *   QueueStatus and a Routing ack/nak, applies local AdminMessages, and can
 *   inject arbitrary FromRadio frames or received packets.
 * - FakeAir: an in-memory "air" shared by several FakeRadios, so two clients
 *   can text each other. It only delivers to radios with a matching channel
 *   (name + key) and can inject duplicate rebroadcasts, the way relays do.
 *
 * Everything is delivered asynchronously on the microtask queue (no timers),
 * so tests can drive time with Jest fake timers.
 */
import { create, toBinary, type MessageInitShape } from '@bufbuild/protobuf';
import { Admin, Channel, Config, Mesh, Portnums } from '../protobufs';
import {
  BROADCAST_ADDR,
  DEFAULT_HOP_LIMIT,
  RADIO_TX_QUEUE_SIZE,
  decodeAdmin,
  decodeToRadio,
  nodeId,
  encodeFromRadio,
  encodeRouting,
} from '../codec/radio';
import {
  DEFAULT_CHANNEL_NAME,
  HUNT_POSITION_PRECISION,
  MAX_CHANNELS,
  channelHash,
  defaultLoRaConfig,
  expandPsk,
  type ChannelSettings,
} from '../codec/channelUrl';
import type { LinkStatus, Transport, Unsubscribe } from '../transport';
import { encodeUtf8 } from '../runtime';

type FromRadioInit = MessageInitShape<typeof Mesh.FromRadioSchema>;
type MeshPacketInit = MessageInitShape<typeof Mesh.MeshPacketSchema>;

/** Header fields a test may set on an injected packet. */
export interface InjectedPacketFields {
  id?: number;
  to?: number;
  channel?: number;
  hopStart?: number;
  hopLimit?: number;
  rxTime?: number;
}

/** How the fake radio answers a phone-originated packet that asked for an ack. */
export type AckMode =
  /** Behave like firmware: ack if someone on the air (or, with no air, anyone) could hear it. */
  | 'auto'
  /** Never answer (to test ack timeouts). */
  | 'none'
  /** Always answer with MAX_RETRANSMIT. */
  | 'nak';

export interface FakeRadioOptions {
  nodeNum: number;
  longName?: string;
  shortName?: string;
  firmwareVersion?: string;
  /** Channels, primary first. Defaults to one channel named "Test" with a fixed 32-byte key. */
  channels?: ChannelSettings[];
  lora?: Config.Config_LoRaConfig;
  ackMode?: AckMode;
  /** Send QueueStatus for each phone send (firmware 2.x does). Default true. */
  sendQueueStatus?: boolean;
  /** QueueStatus.res to report for phone sends (non-zero = rejected). Default 0. */
  queueStatusRes?: number;
  /** Radio TX queue size. Default RADIO_TX_QUEUE_SIZE. */
  queueSize?: number;
  /** When false, packets sent by the phone are accepted but the TX queue never drains (to test back-pressure). */
  drainTxQueue?: boolean;
}

interface AirPacket {
  from: number;
  to: number;
  id: number;
  hopStart: number;
  wantAck: boolean;
  channel: { name: string; psk: Uint8Array };
  data: Mesh.Data;
}

/** QueueStatus.res the fake reports when its TX queue is full (any non-zero value means rejected). */
export const QUEUE_FULL_RES = 1;

export const TEST_PSK = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff);

export class FakeRadio implements Transport {
  readonly nodeNum: number;
  readonly user: Mesh.User;
  firmwareVersion: string;
  readonly channels: (Channel.Channel | undefined)[] = [];
  readonly config: Record<string, Config.Config['payloadVariant']['value']> = {};
  ackMode: AckMode;
  sendQueueStatus: boolean;
  queueStatusRes: number;
  readonly queueSize: number;
  drainTxQueue: boolean;

  /** Every ToRadio the phone wrote, decoded, in order. */
  readonly writes: Mesh.ToRadio[] = [];
  /** AdminMessages applied to this radio, in order. */
  readonly adminLog: Admin.AdminMessage[] = [];
  /** Nodes this radio has heard of (included in the config dump). */
  readonly knownNodes = new Map<number, Mesh.User>();
  /** Number of want_config_id requests answered. */
  handshakes = 0;
  editing = false;
  air: FakeAir | undefined;

  private connected = false;
  private configured = false;
  private txInFlight = 0;
  private readonly statusListeners = new Set<(s: LinkStatus) => void>();
  private readonly fromRadioListeners = new Set<(b: Uint8Array) => void>();
  /** Packets received while the phone was away; replayed after the next config dump. */
  private readonly pendingForPhone: Uint8Array[] = [];
  private outbox: Uint8Array[] = [];
  private flushScheduled = false;
  private nextPacketId = 0x1000;
  private readonly answeredRequests = new Set<string>();

  constructor(opts: FakeRadioOptions) {
    this.nodeNum = opts.nodeNum >>> 0;
    this.user = create(Mesh.UserSchema, {
      id: nodeId(this.nodeNum),
      longName: opts.longName ?? `Node ${this.nodeNum.toString(16)}`,
      shortName: opts.shortName ?? this.nodeNum.toString(16).slice(-4),
    });
    this.firmwareVersion = opts.firmwareVersion ?? '2.7.26.54e0d8d';
    this.ackMode = opts.ackMode ?? 'auto';
    this.sendQueueStatus = opts.sendQueueStatus ?? true;
    this.queueStatusRes = opts.queueStatusRes ?? 0;
    this.queueSize = opts.queueSize ?? RADIO_TX_QUEUE_SIZE;
    this.drainTxQueue = opts.drainTxQueue ?? true;

    const chans = opts.channels ?? [
      create(Channel.ChannelSettingsSchema, {
        name: 'Test',
        psk: TEST_PSK,
        moduleSettings: { positionPrecision: HUNT_POSITION_PRECISION },
      }),
    ];
    for (let i = 0; i < MAX_CHANNELS; i++) {
      const s = chans[i];
      this.channels[i] = create(Channel.ChannelSchema, {
        index: i,
        role: s
          ? i === 0
            ? Channel.Channel_Role.PRIMARY
            : Channel.Channel_Role.SECONDARY
          : Channel.Channel_Role.DISABLED,
        ...(s ? { settings: s } : {}),
      });
    }
    this.config.lora = opts.lora ?? defaultLoRaConfig();
    this.config.device = create(Config.Config_DeviceConfigSchema, {
      role: Config.Config_DeviceConfig_Role.CLIENT,
      nodeInfoBroadcastSecs: 10800,
    });
    this.config.position = create(Config.Config_PositionConfigSchema, {
      positionBroadcastSecs: 900,
      gpsMode: Config.Config_PositionConfig_GpsMode.ENABLED,
      rxGpio: 34,
      txGpio: 12,
    });
  }

  // ---- Transport ----

  async connect(): Promise<void> {
    if (this.connected) return;
    this.emitStatus('connecting');
    this.connected = true;
    this.configured = false;
    this.emitStatus('connected');
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    this.configured = false;
    this.outbox = [];
    this.emitStatus('disconnected');
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!this.connected) throw new Error('FakeRadio: not connected');
    const msg = decodeToRadio(bytes);
    this.writes.push(msg);
    const v = msg.payloadVariant;
    switch (v.case) {
      case 'wantConfigId':
        this.sendConfigDump(v.value);
        break;
      case 'packet':
        this.handlePhonePacket(v.value);
        break;
      default:
        break; // heartbeat, disconnect: nothing to answer.
    }
  }

  onFromRadio(cb: (bytes: Uint8Array) => void): Unsubscribe {
    this.fromRadioListeners.add(cb);
    return () => this.fromRadioListeners.delete(cb);
  }

  onStatus(cb: (status: LinkStatus) => void): Unsubscribe {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  // ---- Test controls ----

  /** The BLE link drops (radio out of range, phone Bluetooth off...). */
  dropLink(): void {
    if (!this.connected) return;
    this.connected = false;
    this.configured = false;
    this.outbox = [];
    this.emitStatus('disconnected');
  }

  /** The transport reconnects by itself (like a BLE auto-reconnect). */
  restoreLink(): void {
    if (this.connected) return;
    this.emitStatus('connecting');
    this.connected = true;
    this.emitStatus('connected');
  }

  /** Sends any FromRadio frame to the phone. */
  injectFromRadio(init: FromRadioInit): void {
    this.deliverRaw(encodeFromRadio(init));
  }

  /** Sends raw bytes to the phone (e.g. garbage or a frame from newer firmware). */
  injectRaw(bytes: Uint8Array): void {
    this.deliverRaw(bytes);
  }

  /** Delivers a packet to the phone as if heard over the air. */
  injectPacket(packet: MeshPacketInit): void {
    this.deliverPacket(encodeFromRadio({ payloadVariant: { case: 'packet', value: packet } }));
  }

  /** Delivers a text message to the phone as if heard from `from`. */
  injectText(from: number, text: string, packet: InjectedPacketFields = {}): void {
    this.injectData(from, Portnums.PortNum.TEXT_MESSAGE_APP, encodeUtf8(text), packet);
  }

  /** Delivers a Routing ack (NONE) or nak for one of the phone's packets. */
  injectRouting(requestId: number, error: Mesh.Routing_Error, from = this.nodeNum): void {
    this.injectData(from, Portnums.PortNum.ROUTING_APP, encodeRouting(error), {
      id: this.nextPacketId++,
      to: this.nodeNum,
      requestId,
    });
  }

  /** Delivers a decoded packet on any port. `requestId` goes into Data. */
  injectData(
    from: number,
    portnum: Portnums.PortNum | number,
    payload: Uint8Array,
    packet: InjectedPacketFields & { requestId?: number } = {},
  ): void {
    const { requestId, ...rest } = packet;
    this.injectPacket({
      from,
      to: BROADCAST_ADDR,
      id: this.nextPacketId++,
      ...rest,
      payloadVariant: {
        case: 'decoded',
        value: { portnum: portnum as Portnums.PortNum, payload, requestId: requestId ?? 0 },
      },
    });
  }

  /** MeshPackets the phone has written so far. */
  sentPackets(): Mesh.MeshPacket[] {
    return this.writes
      .filter((w) => w.payloadVariant.case === 'packet')
      .map((w) => w.payloadVariant.value as Mesh.MeshPacket);
  }

  /** Nonces of every want_config_id the phone sent. */
  configNonces(): number[] {
    return this.writes
      .filter((w) => w.payloadVariant.case === 'wantConfigId')
      .map((w) => w.payloadVariant.value as number);
  }

  /** Lets queued phone sends leave the TX queue (when drainTxQueue is false). */
  drainQueue(): void {
    this.txInFlight = 0;
    this.deliverRaw(
      encodeFromRadio({
        payloadVariant: {
          case: 'queueStatus',
          value: { res: 0, free: this.queueSize, maxlen: this.queueSize, meshPacketId: 0 },
        },
      }),
    );
  }

  /** Index of our channel matching the given name + key, or -1. */
  channelIndexFor(name: string, psk: Uint8Array): number {
    const wantHash = channelHash({ name, psk });
    const wantKey = expandPsk(psk);
    for (const ch of this.channels) {
      if (!ch?.settings || ch.role === Channel.Channel_Role.DISABLED) continue;
      if (channelHash(ch.settings) !== wantHash) continue;
      if ((ch.settings.name || DEFAULT_CHANNEL_NAME) !== (name || DEFAULT_CHANNEL_NAME)) continue;
      if (bytesEqual(expandPsk(ch.settings.psk), wantKey)) return ch.index;
    }
    return -1;
  }

  /** Called by FakeAir when a packet reaches this radio. Returns true if it could decrypt it. */
  receiveFromAir(p: AirPacket, hopLimit: number): boolean {
    const idx = this.channelIndexFor(p.channel.name, p.channel.psk);
    if (idx < 0) return false;
    if (p.to !== BROADCAST_ADDR && p.to !== this.nodeNum) return true; // Heard, not for us.
    this.deliverPacket(
      encodeFromRadio({
        payloadVariant: {
          case: 'packet',
          value: {
            from: p.from,
            to: p.to,
            id: p.id,
            channel: idx,
            hopStart: p.hopStart,
            hopLimit,
            wantAck: p.wantAck,
            rxTime: 1_764_100_000,
            rxSnr: 6.5,
            payloadVariant: { case: 'decoded', value: p.data },
          },
        },
      }),
    );
    this.answerNodeInfoRequest(p, idx);
    return true;
  }

  /** Like firmware's NodeInfo module: a node-info request with want_response gets our node info back. */
  private answerNodeInfoRequest(p: AirPacket, channelIndex: number): void {
    if (p.data.portnum !== Portnums.PortNum.NODEINFO_APP || !p.data.wantResponse || !this.air)
      return;
    const key = `${p.from}:${p.id}`;
    if (this.answeredRequests.has(key)) return; // relay copies of the same request
    this.answeredRequests.add(key);
    const ch = this.channels[channelIndex]!.settings!;
    this.air.transmit(this, {
      from: this.nodeNum,
      to: p.from,
      id: this.nextPacketId++,
      hopStart: DEFAULT_HOP_LIMIT,
      wantAck: false,
      channel: { name: ch.name, psk: ch.psk },
      data: create(Mesh.DataSchema, {
        portnum: Portnums.PortNum.NODEINFO_APP,
        payload: toBinary(Mesh.UserSchema, this.user),
        requestId: p.id,
      }),
    });
  }

  // ---- Internals ----

  private emitStatus(s: LinkStatus): void {
    for (const cb of [...this.statusListeners]) cb(s);
  }

  private deliverRaw(bytes: Uint8Array): void {
    if (!this.connected) return;
    this.outbox.push(bytes);
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    void Promise.resolve().then(() => {
      this.flushScheduled = false;
      const frames = this.outbox;
      this.outbox = [];
      for (const f of frames) {
        if (!this.connected) return;
        for (const cb of [...this.fromRadioListeners]) cb(f);
      }
    });
  }

  /** Packets for the phone wait until it has finished the config handshake. */
  private deliverPacket(bytes: Uint8Array): void {
    if (this.connected && this.configured) this.deliverRaw(bytes);
    else this.pendingForPhone.push(bytes);
  }

  private sendConfigDump(nonce: number): void {
    this.handshakes++;
    this.configured = false;
    const send = (v: FromRadioInit['payloadVariant']) =>
      this.deliverRaw(encodeFromRadio({ payloadVariant: v }));
    send({
      case: 'myInfo',
      value: { myNodeNum: this.nodeNum, rebootCount: 1, minAppVersion: 30200 },
    });
    send({
      case: 'nodeInfo',
      value: { num: this.nodeNum, user: this.user, lastHeard: 1_764_100_000 },
    });
    send({
      case: 'metadata',
      value: { firmwareVersion: this.firmwareVersion, hasBluetooth: true, hasPKC: true },
    });
    for (const ch of this.channels) if (ch) send({ case: 'channel', value: ch });
    for (const [name, value] of Object.entries(this.config)) {
      send({
        case: 'config',
        value: { payloadVariant: { case: name, value } as Config.Config['payloadVariant'] },
      });
    }
    send({
      case: 'moduleConfig',
      value: { payloadVariant: { case: 'mqtt', value: { enabled: false } } },
    });
    for (const [num, user] of this.knownNodes) {
      send({ case: 'nodeInfo', value: { num, user, lastHeard: 1_764_099_000, snr: 5 } });
    }
    send({ case: 'configCompleteId', value: nonce });
    this.configured = true;
    const pending = this.pendingForPhone.splice(0);
    for (const b of pending) this.deliverRaw(b);
  }

  private handlePhonePacket(p: Mesh.MeshPacket): void {
    const id = p.id || this.nextPacketId++;
    const queueFull = this.txInFlight >= this.queueSize;
    const res = queueFull ? QUEUE_FULL_RES : this.queueStatusRes;
    if (res === 0) this.txInFlight++;
    if (this.sendQueueStatus) {
      this.deliverRaw(
        encodeFromRadio({
          payloadVariant: {
            case: 'queueStatus',
            value: {
              res,
              free: Math.max(0, this.queueSize - this.txInFlight),
              maxlen: this.queueSize,
              meshPacketId: id,
            },
          },
        }),
      );
    }
    if (res !== 0) return;
    if (this.drainTxQueue) this.txInFlight--;

    if (p.payloadVariant.case !== 'decoded') return;
    const data = p.payloadVariant.value;

    // Local admin: the phone configuring its own radio.
    if (data.portnum === Portnums.PortNum.ADMIN_APP && (p.to === this.nodeNum || p.to === 0)) {
      this.applyAdmin(decodeAdmin(data.payload));
      if (data.wantResponse || p.wantAck)
        this.sendRouting(id, Mesh.Routing_Error.NONE, this.nodeNum);
      return;
    }

    const ch = this.channels[p.channel]?.settings;
    if (!ch || this.channels[p.channel]?.role === Channel.Channel_Role.DISABLED) {
      if (p.wantAck) this.sendRouting(id, Mesh.Routing_Error.NO_CHANNEL, this.nodeNum);
      return;
    }

    let heardBy: number[] = [];
    if (this.air) {
      heardBy = this.air.transmit(this, {
        from: this.nodeNum,
        to: p.to,
        id,
        hopStart: p.hopLimit || DEFAULT_HOP_LIMIT,
        wantAck: p.wantAck,
        channel: { name: ch.name, psk: ch.psk },
        data,
      });
    }

    if (!p.wantAck || this.ackMode === 'none') return;
    if (this.ackMode === 'nak') {
      this.sendRouting(id, Mesh.Routing_Error.MAX_RETRANSMIT, this.nodeNum);
      return;
    }
    if (p.to === BROADCAST_ADDR) {
      // Implicit ack: we heard a neighbour rebroadcast it (or there is no air to check).
      if (!this.air || heardBy.length > 0)
        this.sendRouting(id, Mesh.Routing_Error.NONE, this.nodeNum);
      else this.sendRouting(id, Mesh.Routing_Error.MAX_RETRANSMIT, this.nodeNum);
    } else if (!this.air || heardBy.includes(p.to)) {
      this.sendRouting(id, Mesh.Routing_Error.NONE, p.to);
    } else {
      this.sendRouting(id, Mesh.Routing_Error.MAX_RETRANSMIT, this.nodeNum);
    }
  }

  private sendRouting(requestId: number, error: Mesh.Routing_Error, from: number): void {
    this.deliverRaw(
      encodeFromRadio({
        payloadVariant: {
          case: 'packet',
          value: {
            from,
            to: this.nodeNum,
            id: this.nextPacketId++,
            channel: 0,
            payloadVariant: {
              case: 'decoded',
              value: {
                portnum: Portnums.PortNum.ROUTING_APP,
                payload: encodeRouting(error),
                requestId,
              },
            },
          },
        },
      }),
    );
  }

  private applyAdmin(a: Admin.AdminMessage): void {
    this.adminLog.push(a);
    const v = a.payloadVariant;
    switch (v.case) {
      case 'beginEditSettings':
        this.editing = true;
        break;
      case 'commitEditSettings':
        this.editing = false;
        break;
      case 'setChannel':
        this.channels[v.value.index] = v.value;
        break;
      case 'setOwner':
        this.user.longName = v.value.longName;
        this.user.shortName = v.value.shortName;
        break;
      case 'setConfig':
        if (v.value.payloadVariant.case)
          this.config[v.value.payloadVariant.case] = v.value.payloadVariant.value;
        break;
      default:
        break;
    }
  }
}

export interface FakeAirOptions {
  /** Extra copies of every packet each receiver gets, as if relays rebroadcast it. Default 0. */
  duplicates?: number;
}

/** In-memory shared radio channel for several FakeRadios. */
export class FakeAir {
  readonly radios = new Set<FakeRadio>();
  /** Every transmission, in order (for assertions and replays). */
  readonly log: AirPacket[] = [];
  duplicates: number;

  constructor(opts: FakeAirOptions = {}) {
    this.duplicates = opts.duplicates ?? 0;
  }

  /** Puts a radio on the air; radios learn each other's node info. */
  attach(...radios: FakeRadio[]): this {
    for (const r of radios) {
      r.air = this;
      for (const other of this.radios) {
        other.knownNodes.set(r.nodeNum, r.user);
        r.knownNodes.set(other.nodeNum, other.user);
      }
      this.radios.add(r);
    }
    return this;
  }

  /** Returns the node numbers of radios that could decrypt it. */
  transmit(sender: FakeRadio, p: AirPacket): number[] {
    this.log.push(p);
    return this.deliver(sender, p, 1 + this.duplicates);
  }

  /**
   * Re-delivers a logged transmission, as if a relay rebroadcast it again
   * (same from + packet id, one hop fewer). Default: the last one.
   */
  rebroadcast(index = this.log.length - 1, copies = 1): number[] {
    const p = this.log[index];
    if (!p) throw new Error('FakeAir: nothing to rebroadcast');
    const sender = [...this.radios].find((r) => r.nodeNum === p.from);
    return this.deliver(sender, p, copies, 1);
  }

  private deliver(
    sender: FakeRadio | undefined,
    p: AirPacket,
    copies: number,
    firstHop = 0,
  ): number[] {
    const heard: number[] = [];
    for (const r of this.radios) {
      if (r === sender) continue;
      let ok = false;
      for (let c = 0; c < copies; c++) {
        ok = r.receiveFromAir(p, Math.max(0, p.hopStart - firstHop - c)) || ok;
      }
      if (ok) heard.push(r.nodeNum);
    }
    return heard;
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export type { AirPacket };
