import {
  defaultTimers,
  Emitter,
  MESHTASTIC_BLE,
  type TimerHandle,
  type LinkStatus,
  type Timers,
  type Transport,
  type Unsubscribe,
} from '@huntclub/mesh';
import { Platform } from 'react-native';
import BleManager, { BleState } from 'react-native-ble-manager';

import { classifyDisconnect, classifyError, type BleFailure } from './bleErrors';
import { ensureBleStarted, sameUuid } from './bleManager';

/** Extra link events the app shows to the user; not part of the mesh Transport interface. */
export type BleTransportEvents = {
  fromRadio: Uint8Array;
  status: LinkStatus;
  /** A reconnect is scheduled after a drop. `attempt` starts at 1. */
  reconnecting: { attempt: number; delayMs: number };
  /** The phone and radio disagree about pairing; the user must forget and re-pair. */
  repairNeeded: { reason: 'auth' | 'gatt133' };
};

export type BleTransportOptions = {
  /** Android MAC address or iOS peripheral UUID. */
  peripheralId: string;
  /**
   * Keep retrying (with backoff) if the very first connect fails. True for a
   * remembered radio that may simply be off or out of range; false when
   * pairing a new radio, so a wrong PIN is not retried in a loop.
   */
  retryFirstConnect?: boolean;
  platform?: 'ios' | 'android';
  timers?: Timers;
  /** First reconnect delay; doubles each attempt up to `maxBackoffMs`. */
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  /** GATT 133s in a row before refreshing the cache and suggesting re-pairing. */
  gatt133Threshold?: number;
};

const DEFAULT_INITIAL_BACKOFF_MS = 1_000;
const DEFAULT_MAX_BACKOFF_MS = 30_000;
const DEFAULT_GATT133_THRESHOLD = 3;

/**
 * Meshtastic BLE link over react-native-ble-manager. Carries raw ToRadio /
 * FromRadio bytes (no serial framing); the protocol lives in MeshClient.
 *
 * Link setup: connect, request MTU 512 (Android), discover the Meshtastic
 * service, subscribe to fromNum, then drain fromRadio until an empty read.
 * fromRadio is drained again on every fromNum notify and after every write.
 * After a drop it reconnects with exponential backoff until `disconnect()`.
 * See docs/research/meshtastic.md §1.
 */
export class BleTransport extends Emitter<BleTransportEvents> implements Transport {
  readonly peripheralId: string;
  private readonly platform: 'ios' | 'android';
  private readonly timers: Timers;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly gatt133Threshold: number;
  private readonly retryFirstConnect: boolean;

  /** The app wants a link (between connect() and disconnect()). */
  private wanted = false;
  /** Link has been up at least once since connect(). */
  private everConnected = false;
  private linkUp = false;
  private attempting = false;
  private status: LinkStatus = 'disconnected';
  private reconnectAttempt = 0;
  private reconnectTimer: TimerHandle | undefined;
  private gatt133Count = 0;
  private draining = false;
  private drainAgain = false;
  private nativeSubscriptions: { remove(): void }[] = [];

  constructor(opts: BleTransportOptions) {
    super();
    this.peripheralId = opts.peripheralId;
    this.platform = opts.platform ?? (Platform.OS === 'ios' ? 'ios' : 'android');
    this.timers = opts.timers ?? defaultTimers;
    this.initialBackoffMs = opts.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
    this.maxBackoffMs = opts.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
    this.gatt133Threshold = opts.gatt133Threshold ?? DEFAULT_GATT133_THRESHOLD;
    this.retryFirstConnect = opts.retryFirstConnect ?? false;
  }

  /** Android: the MTU the radio accepted on the last connect. */
  negotiatedMtu: number | undefined;

  get linkStatus(): LinkStatus {
    return this.status;
  }

  // ---- Transport ----

  onFromRadio(cb: (bytes: Uint8Array) => void): Unsubscribe {
    return this.on('fromRadio', cb);
  }

  onStatus(cb: (status: LinkStatus) => void): Unsubscribe {
    return this.on('status', cb);
  }

  // ---- Link events beyond the Transport interface ----

  onReconnecting(cb: (e: BleTransportEvents['reconnecting']) => void): Unsubscribe {
    return this.on('reconnecting', cb);
  }

  onRepairNeeded(cb: (e: BleTransportEvents['repairNeeded']) => void): Unsubscribe {
    return this.on('repairNeeded', cb);
  }

  /**
   * Resolves once the link is up. Rejects if the first attempt fails; with
   * `retryFirstConnect` the transport keeps retrying in the background anyway.
   * Once connected, drops are always retried until `disconnect()`.
   */
  async connect(): Promise<void> {
    if (this.wanted && (this.linkUp || this.attempting)) return;
    this.wanted = true;
    this.everConnected = false;
    this.reconnectAttempt = 0;
    this.subscribeNative();
    await this.attempt();
  }

  async write(toRadio: Uint8Array): Promise<void> {
    if (!this.linkUp) throw new Error('Radio is not connected');
    try {
      await BleManager.write(
        this.peripheralId,
        MESHTASTIC_BLE.serviceUuid,
        MESHTASTIC_BLE.toRadioUuid,
        Array.from(toRadio),
        // One write must be one ToRadio: never let the library split it.
        MESHTASTIC_BLE.maxToFromRadioSize,
      );
    } catch (error) {
      this.noteFailure(classifyError(error));
      throw error;
    }
    void this.drain();
  }

  async disconnect(): Promise<void> {
    this.wanted = false;
    this.clearReconnectTimer();
    const wasUp = this.linkUp;
    this.linkUp = false;
    this.unsubscribeNative();
    if (wasUp) {
      await BleManager.stopNotification(
        this.peripheralId,
        MESHTASTIC_BLE.serviceUuid,
        MESHTASTIC_BLE.fromNumUuid,
      ).catch(() => undefined);
    }
    await BleManager.disconnect(this.peripheralId).catch(() => undefined);
    this.setStatus('disconnected');
  }

  // ---- Link setup ----

  private async attempt(): Promise<void> {
    this.attempting = true;
    this.setStatus('connecting');
    try {
      await ensureBleStarted();
      if (this.platform === 'android' && this.gatt133Count > 0) {
        // A stale GATT cache is the usual cause of status 133.
        await BleManager.refreshCache(this.peripheralId).catch(() => undefined);
      }
      // iOS: no timeout, so iOS completes it when the radio comes back in range.
      await BleManager.connect(this.peripheralId);
      if (!this.wanted) return;
      if (this.platform === 'android') {
        const mtu = await BleManager.requestMTU(
          this.peripheralId,
          MESHTASTIC_BLE.preferredMtu,
        ).catch(() => undefined);
        this.negotiatedMtu = mtu;
      }
      await BleManager.retrieveServices(this.peripheralId, [MESHTASTIC_BLE.serviceUuid]);
      await BleManager.startNotification(
        this.peripheralId,
        MESHTASTIC_BLE.serviceUuid,
        MESHTASTIC_BLE.fromNumUuid,
      );
      if (!this.wanted) return;
      this.linkUp = true;
      this.everConnected = true;
      this.reconnectAttempt = 0;
      this.gatt133Count = 0;
      this.setStatus('connected');
      void this.drain();
    } catch (error) {
      this.linkUp = false;
      this.noteFailure(classifyError(error));
      this.setStatus('disconnected');
      if (this.wanted && (this.everConnected || this.retryFirstConnect)) {
        this.scheduleReconnect();
      } else {
        this.wanted = false;
        this.unsubscribeNative();
      }
      throw error;
    } finally {
      this.attempting = false;
    }
  }

  private scheduleReconnect(): void {
    if (!this.wanted || this.reconnectTimer !== undefined) return;
    this.reconnectAttempt += 1;
    const delayMs = Math.min(
      this.maxBackoffMs,
      this.initialBackoffMs * 2 ** (this.reconnectAttempt - 1),
    );
    this.emit('reconnecting', { attempt: this.reconnectAttempt, delayMs });
    this.reconnectTimer = this.timers.setTimeout(() => {
      this.reconnectTimer = undefined;
      if (!this.wanted || this.linkUp || this.attempting) return;
      // Failures are already handled (and the next retry scheduled) inside attempt().
      this.attempt().catch(() => undefined);
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== undefined) {
      this.timers.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private noteFailure(failure: BleFailure): void {
    if (failure === 'gatt133') {
      this.gatt133Count += 1;
      if (this.gatt133Count === this.gatt133Threshold) {
        this.emit('repairNeeded', { reason: 'gatt133' });
      }
    } else if (failure === 'auth') {
      this.emit('repairNeeded', { reason: 'auth' });
    }
  }

  // ---- fromRadio drain loop ----

  /** Reads fromRadio until an empty read. Re-runs if a notify arrives mid-drain. */
  private async drain(): Promise<void> {
    if (this.draining) {
      this.drainAgain = true;
      return;
    }
    this.draining = true;
    try {
      do {
        this.drainAgain = false;
        while (this.linkUp) {
          const data = await BleManager.read(
            this.peripheralId,
            MESHTASTIC_BLE.serviceUuid,
            MESHTASTIC_BLE.fromRadioUuid,
          );
          if (data.length === 0) break;
          this.emit('fromRadio', Uint8Array.from(data));
        }
      } while (this.drainAgain && this.linkUp);
    } catch (error) {
      // A failed read usually means the link dropped; the disconnect event
      // drives the reconnect. Pairing problems surface here first.
      this.noteFailure(classifyError(error));
    } finally {
      this.draining = false;
    }
  }

  // ---- Native events ----

  private subscribeNative(): void {
    if (this.nativeSubscriptions.length > 0) return;
    this.nativeSubscriptions = [
      BleManager.onDidUpdateValueForCharacteristic((e) => {
        if (
          e.peripheral === this.peripheralId &&
          sameUuid(e.characteristic, MESHTASTIC_BLE.fromNumUuid)
        ) {
          void this.drain();
        }
      }),
      BleManager.onDisconnectPeripheral((e) => {
        if (e.peripheral !== this.peripheralId) return;
        this.noteFailure(classifyDisconnect(e));
        if (!this.linkUp) return; // A failed attempt handles its own retry.
        this.linkUp = false;
        this.setStatus('disconnected');
        this.scheduleReconnect();
      }),
      BleManager.onDidUpdateState((e) => {
        // Bluetooth switched back on: retry now instead of waiting out the backoff.
        if (e.state === BleState.On && this.wanted && !this.linkUp && !this.attempting) {
          this.clearReconnectTimer();
          this.attempt().catch(() => undefined);
        }
      }),
    ];
  }

  private unsubscribeNative(): void {
    for (const s of this.nativeSubscriptions) s.remove();
    this.nativeSubscriptions = [];
  }

  private setStatus(status: LinkStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.emit('status', status);
  }
}
