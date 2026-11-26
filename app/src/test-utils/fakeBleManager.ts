/**
 * In-memory stand-in for react-native-ble-manager, scripted by tests.
 *
 *   jest.mock('react-native-ble-manager', () =>
 *     jest.requireActual('../../test-utils/fakeBleManager').fakeBleManagerModule,
 *   );
 *
 * It models one Meshtastic radio: fromRadio is a queue of packets that reads
 * drain (an empty read means the queue is empty), writes are recorded, and
 * tests can fail the next connects, notify fromNum or drop the link.
 */
import { MESHTASTIC_BLE } from '@huntclub/mesh';
import type {
  BleDisconnectPeripheralEvent,
  BleManagerDidUpdateStateEvent,
  BleManagerDidUpdateValueForCharacteristicEvent,
  Peripheral,
  ScanOptions,
} from 'react-native-ble-manager';

// The real enums, without loading the native module.
const types = jest.requireActual<typeof import('react-native-ble-manager')>(
  'react-native-ble-manager/dist/cjs/types',
);

type Listener<T> = (event: T) => void;

class ListenerSet<T> {
  private readonly listeners = new Set<Listener<T>>();
  add(cb: Listener<T>) {
    this.listeners.add(cb);
    return { remove: () => this.listeners.delete(cb) };
  }
  emit(event: T) {
    for (const cb of [...this.listeners]) cb(event);
  }
  get size() {
    return this.listeners.size;
  }
}

export type WriteRecord = {
  peripheralId: string;
  characteristic: string;
  data: number[];
  maxByteSize?: number;
};

export class FakeBleManager {
  /** Packets the radio has queued for the phone. */
  fromRadio: number[][] = [];
  writes: WriteRecord[] = [];
  /** Errors to throw from the next connect() calls, in order. */
  connectErrors: string[] = [];
  /** Error to throw from the next read(), once. */
  readError: string | undefined;
  /** Leave connect() pending (radio out of range on iOS). */
  holdConnect = false;
  mtuGranted = 512;
  state: string = types.BleState.On;
  scanResults: Peripheral[] = [];
  connected = new Set<string>();
  calls: string[] = [];
  readCount = 0;

  readonly discover = new ListenerSet<Peripheral>();
  readonly stopScanEvent = new ListenerSet<{ status?: number }>();
  readonly valueUpdate = new ListenerSet<BleManagerDidUpdateValueForCharacteristicEvent>();
  readonly disconnectEvent = new ListenerSet<BleDisconnectPeripheralEvent>();
  readonly stateUpdate = new ListenerSet<BleManagerDidUpdateStateEvent>();

  private log(call: string) {
    this.calls.push(call);
  }

  // ---- Test controls ----

  /** The radio signals new data on fromNum (upper case, as iOS reports UUIDs). */
  notifyFromNum(peripheralId: string, characteristic = MESHTASTIC_BLE.fromNumUuid.toUpperCase()) {
    this.valueUpdate.emit({
      peripheral: peripheralId,
      characteristic,
      service: '',
      value: [1, 0, 0, 0],
    });
  }

  /** The link drops (radio walked out of range, GATT error, …). */
  dropLink(peripheralId: string, extra: Partial<BleDisconnectPeripheralEvent> = {}) {
    this.connected.delete(peripheralId);
    this.disconnectEvent.emit({ peripheral: peripheralId, ...extra });
  }

  setBluetoothState(state: string) {
    this.state = state;
    this.stateUpdate.emit({ state } as BleManagerDidUpdateStateEvent);
  }

  // ---- react-native-ble-manager API ----

  async start(_options?: object) {
    this.log('start');
  }
  async checkState() {
    return this.state;
  }
  connect(peripheralId: string) {
    this.log(`connect ${peripheralId}`);
    const error = this.connectErrors.shift();
    if (error) return Promise.reject(error);
    if (this.holdConnect) return new Promise<void>(() => undefined);
    this.connected.add(peripheralId);
    return Promise.resolve();
  }
  async disconnect(peripheralId: string) {
    this.log(`disconnect ${peripheralId}`);
    this.connected.delete(peripheralId);
  }
  async refreshCache(peripheralId: string) {
    this.log(`refreshCache ${peripheralId}`);
    return true;
  }
  async requestMTU(_peripheralId: string, mtu: number) {
    this.log(`requestMTU ${mtu}`);
    return Math.min(mtu, this.mtuGranted);
  }
  async retrieveServices(peripheralId: string, services: string[] = []) {
    this.log(`retrieveServices ${services.join(',')}`);
    return { id: peripheralId, rssi: 0, advertising: {} };
  }
  async startNotification(_p: string, _s: string, characteristic: string) {
    this.log(`startNotification ${characteristic}`);
  }
  async stopNotification(_p: string, _s: string, characteristic: string) {
    this.log(`stopNotification ${characteristic}`);
  }
  async read(peripheralId: string, _s: string, _c: string) {
    this.readCount += 1;
    if (this.readError) {
      const error = this.readError;
      this.readError = undefined;
      throw error;
    }
    if (!this.connected.has(peripheralId)) throw 'Device disconnected';
    return this.fromRadio.shift() ?? [];
  }
  async write(
    peripheralId: string,
    _s: string,
    characteristic: string,
    data: number[],
    maxByteSize?: number,
  ) {
    if (!this.connected.has(peripheralId)) throw 'Device disconnected';
    this.writes.push({ peripheralId, characteristic, data, maxByteSize });
  }
  async scan(options: ScanOptions = {}) {
    this.log(`scan ${(options.serviceUUIDs ?? []).join(',')}`);
    for (const p of this.scanResults) this.discover.emit(p);
  }
  async stopScan() {
    this.log('stopScan');
    this.stopScanEvent.emit({});
  }

  onDiscoverPeripheral(cb: Listener<Peripheral>) {
    return this.discover.add(cb);
  }
  onStopScan(cb: Listener<{ status?: number }>) {
    return this.stopScanEvent.add(cb);
  }
  onDidUpdateValueForCharacteristic(cb: Listener<BleManagerDidUpdateValueForCharacteristicEvent>) {
    return this.valueUpdate.add(cb);
  }
  onDisconnectPeripheral(cb: Listener<BleDisconnectPeripheralEvent>) {
    return this.disconnectEvent.add(cb);
  }
  onDidUpdateState(cb: Listener<BleManagerDidUpdateStateEvent>) {
    return this.stateUpdate.add(cb);
  }
}

/** The one fake instance the mocked module exposes; reset it in beforeEach. */
export const fakeBle = new FakeBleManager();

export function resetFakeBle(): void {
  Object.assign(fakeBle, new FakeBleManager());
}

export const fakeBleManagerModule = { __esModule: true, ...types, default: fakeBle };
