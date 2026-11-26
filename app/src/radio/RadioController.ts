import {
  MeshClient,
  Protobufs,
  type ClientState,
  type DeliveryResult,
  type LinkStatus,
  type MeshClientOptions,
  type Transport,
  type Unsubscribe,
  Emitter,
  nodeId,
} from '@huntclub/mesh';

import type { PairedRadio } from '../db/pairedRadio';
import { nodeDisplayName } from '../map/meshMapData';
import type { FoundRadio } from './scan';

/** Where the app remembers its paired radio (SQLite in the app, in-memory in tests). */
export type PairedRadioStore = {
  load(): Promise<PairedRadio | null>;
  save(radio: PairedRadio): Promise<void>;
  clear(): Promise<void>;
};

/** Link events the BLE transport adds beyond the mesh Transport interface. */
export type LinkEvents = {
  onReconnecting?(cb: () => void): Unsubscribe;
  onRepairNeeded?(cb: () => void): Unsubscribe;
};

export type CreateTransport = (
  radio: PairedRadio,
  opts: { retryFirstConnect: boolean },
) => Transport & LinkEvents;

/** Keeps the app alive while linked (Android foreground service); no-ops elsewhere. */
export type BackgroundLink = { start(): void; stop(): void };

/**
 * - `none`: no radio paired.
 * - `connecting`: Bluetooth link being set up.
 * - `loading`: linked; reading the radio's settings (config handshake).
 * - `ready`: can send and receive.
 * - `reconnecting`: link dropped; retrying with backoff.
 * - `disconnected`: not linked and not retrying.
 */
export type RadioLinkState =
  'none' | 'connecting' | 'loading' | 'ready' | 'reconnecting' | 'disconnected';

export type RadioInfo = {
  nodeNum: number;
  /** Meshtastic node id, e.g. "!1a2b3c4d". */
  nodeId: string;
  longName?: string;
  shortName?: string;
  /** 0–100, or 101 when plugged in (Meshtastic convention). */
  batteryLevel?: number;
  firmwareVersion?: string;
};

export type ChannelInfo = { index: number; name: string; primary: boolean };

export type TextStatus = 'sending' | 'sent' | 'heard' | 'delivered' | 'failed' | 'noReply';

export type RadioText = {
  key: string;
  text: string;
  from: number;
  /** Sender's radio name as the map shows it (long name, short name or short id). */
  fromName: string;
  mine: boolean;
  /** Milliseconds since the epoch. */
  at: number;
  /** Only for texts we sent. */
  status?: TextStatus;
};

export type RadioSnapshot = {
  link: RadioLinkState;
  /** Phone and radio disagree about pairing: show "Forget and re-pair". */
  repairNeeded: boolean;
  pairedRadio: PairedRadio | null;
  radio: RadioInfo | null;
  channels: ChannelInfo[];
  texts: RadioText[];
};

export type RadioControllerDeps = {
  store: PairedRadioStore;
  createTransport: CreateTransport;
  background: BackgroundLink;
  /** Extra MeshClient options (random source, timers, logger). */
  clientOptions?: Omit<MeshClientOptions, 'transport'>;
  now?: () => number;
};

/** Maps a mesh delivery result to the word shown under a sent text. */
export function textStatusFor(result: DeliveryResult): TextStatus {
  switch (result.status) {
    case 'acked':
      // A broadcast's implicit ack only proves one neighbour relayed it.
      return result.implicit ? 'heard' : 'delivered';
    case 'sent':
      return 'sent';
    case 'timeout':
      return 'noReply';
    case 'failed':
    case 'cancelled':
      return 'failed';
  }
}

export function linkStateFor(
  client: ClientState,
  transport: LinkStatus,
  retrying: boolean,
): RadioLinkState {
  if (client === 'ready') return 'ready';
  if (transport === 'connected') return 'loading';
  if (transport === 'connecting') return retrying ? 'reconnecting' : 'connecting';
  return retrying ? 'reconnecting' : 'disconnected';
}

export const PRIMARY_CHANNEL = 0;

const INITIAL: RadioSnapshot = {
  link: 'none',
  repairNeeded: false,
  pairedRadio: null,
  radio: null,
  channels: [],
  texts: [],
};

type Session = {
  client: MeshClient;
  transport: Transport & LinkEvents;
  transportStatus: LinkStatus;
  retrying: boolean;
  subscriptions: Unsubscribe[];
};

/**
 * Owns the radio link: one transport + MeshClient at a time, the remembered
 * radio, and the state screens render. Pure TypeScript so it can be tested
 * with the mesh FakeRadio; RadioProvider exposes it to React.
 */
export class RadioController extends Emitter<{ change: RadioSnapshot }> {
  private snapshot: RadioSnapshot = INITIAL;
  private session: Session | null = null;
  private readonly deps: RadioControllerDeps;
  private readonly now: () => number;
  private disposed = false;

  constructor(deps: RadioControllerDeps) {
    super();
    this.deps = deps;
    this.now = deps.now ?? Date.now;
  }

  readonly getSnapshot = (): RadioSnapshot => this.snapshot;

  readonly subscribe = (cb: () => void): Unsubscribe => this.on('change', cb);

  /** Reconnects to the remembered radio, if any. Call once on launch. */
  async init(): Promise<void> {
    const remembered = await this.deps.store.load();
    if (this.disposed || !remembered) return;
    this.set({ pairedRadio: remembered });
    await this.start(remembered, { retryFirstConnect: true, remember: false }).catch(
      () => undefined,
    );
  }

  /** Connects to a radio from a scan and remembers it once the link is up. Rejects if it can't connect. */
  pair = (found: FoundRadio): Promise<void> =>
    this.start(
      { peripheralId: found.id, name: found.name, pairedAt: this.now() },
      { retryFirstConnect: false, remember: true },
    );

  /** Retries the remembered radio. */
  reconnect = async (): Promise<void> => {
    const { pairedRadio } = this.snapshot;
    if (pairedRadio) await this.start(pairedRadio, { retryFirstConnect: true, remember: false });
  };

  /** Disconnects and forgets the remembered radio. */
  forget = async (): Promise<void> => {
    await this.stop();
    await this.deps.store.clear();
    this.set(INITIAL);
  };

  /** Sends a text on the primary channel. */
  sendText = (text: string): void => {
    const client = this.session?.client;
    if (!client) return;
    const handle = client.sendText(text, { channel: PRIMARY_CHANNEL });
    const key = `tx:${handle.id}`;
    this.addText({
      key,
      text,
      from: client.myNodeNum,
      fromName: nodeDisplayName(client.nodes.get(client.myNodeNum), client.myNodeNum),
      mine: true,
      at: this.now(),
      status: 'sending',
    });
    void handle.result.then((result) => this.updateText(key, { status: textStatusFor(result) }));
  };

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.stop();
  }

  // ---- Internals ----

  private set(patch: Partial<RadioSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.emit('change', this.snapshot);
  }

  private addText(text: RadioText): void {
    this.set({ texts: [...this.snapshot.texts, text] });
  }

  private updateText(key: string, patch: Partial<RadioText>): void {
    this.set({ texts: this.snapshot.texts.map((t) => (t.key === key ? { ...t, ...patch } : t)) });
  }

  private async stop(): Promise<void> {
    const session = this.session;
    if (!session) return;
    this.session = null;
    for (const off of session.subscriptions) off();
    this.deps.background.stop();
    await session.client.close().catch(() => undefined);
    this.set({ link: 'disconnected' });
  }

  private refreshLink(session: Session): void {
    if (this.session !== session) return;
    this.set({
      link: linkStateFor(session.client.state, session.transportStatus, session.retrying),
    });
  }

  private refreshRadio(client: MeshClient): void {
    const num = client.myNodeNum;
    if (!num) return;
    const node = client.nodes.get(num);
    this.set({
      radio: {
        nodeNum: num,
        nodeId: nodeId(num),
        longName: node?.user?.longName,
        shortName: node?.user?.shortName,
        batteryLevel: node?.deviceMetrics?.batteryLevel,
        firmwareVersion: client.firmwareVersion,
      },
    });
  }

  private refreshChannels(client: MeshClient): void {
    this.set({
      channels: [...client.channels.values()]
        .filter((c) => c.settings && c.role !== Protobufs.Channel.Channel_Role.DISABLED)
        .map((c) => ({
          index: c.index,
          name: c.settings?.name ?? '',
          primary: c.role === Protobufs.Channel.Channel_Role.PRIMARY,
        })),
    });
  }

  private async start(
    target: PairedRadio,
    opts: { retryFirstConnect: boolean; remember: boolean },
  ): Promise<void> {
    await this.stop();
    const transport = this.deps.createTransport(target, {
      retryFirstConnect: opts.retryFirstConnect,
    });
    const client = new MeshClient({ ...this.deps.clientOptions, transport });
    const session: Session = {
      client,
      transport,
      transportStatus: 'disconnected',
      retrying: false,
      subscriptions: [],
    };
    this.session = session;
    this.set({ repairNeeded: false, radio: null, channels: [] });

    session.subscriptions.push(
      transport.onStatus((status) => {
        session.transportStatus = status;
        if (status === 'connected') {
          session.retrying = false;
          this.deps.background.start();
          if (opts.remember) {
            const remembered = { ...target, pairedAt: this.now() };
            void this.deps.store.save(remembered);
            this.set({ pairedRadio: remembered });
          }
        }
        this.refreshLink(session);
      }),
      client.on('state', () => this.refreshLink(session)),
      client.on('ready', () => {
        this.refreshRadio(client);
        this.refreshChannels(client);
      }),
      client.on('nodeinfo', ({ node }) => {
        if (node.num === client.myNodeNum) this.refreshRadio(client);
      }),
      client.on('text', (e) => {
        this.addText({
          key: `rx:${e.from}:${e.packetId}`,
          text: e.text,
          from: e.from,
          fromName: nodeDisplayName(client.nodes.get(e.from), e.from),
          mine: false,
          at: e.rxTime ? e.rxTime * 1000 : this.now(),
        });
      }),
    );
    if (transport.onReconnecting) {
      session.subscriptions.push(
        transport.onReconnecting(() => {
          session.retrying = true;
          this.refreshLink(session);
        }),
      );
    }
    if (transport.onRepairNeeded) {
      session.subscriptions.push(transport.onRepairNeeded(() => this.set({ repairNeeded: true })));
    }

    this.set({ link: 'connecting' });
    try {
      await client.connect();
    } catch (error) {
      if (!opts.retryFirstConnect && this.session === session) await this.stop();
      throw error;
    }
  }
}
