import type { LinkStatus } from '@huntclub/mesh';

import { fakeBle, resetFakeBle } from '../../test-utils/fakeBleManager';
import { resetBleStartedForTests } from '../bleManager';
import { BleTransport, type BleTransportOptions } from '../BleTransport';
import { MESHTASTIC_BLE } from '../meshPending';

jest.mock(
  'react-native-ble-manager',
  () => jest.requireActual('../../test-utils/fakeBleManager').fakeBleManagerModule,
);

const ID = 'AA:BB:CC:DD:EE:FF';

function setup(opts: Partial<BleTransportOptions> = {}) {
  const transport = new BleTransport({ peripheralId: ID, platform: 'android', ...opts });
  const received: number[][] = [];
  const statuses: LinkStatus[] = [];
  const reconnects: number[] = [];
  const repairs: string[] = [];
  transport.onFromRadio((b) => received.push(Array.from(b)));
  transport.onStatus((s) => statuses.push(s));
  transport.onReconnecting((e) => reconnects.push(e.delayMs));
  transport.onRepairNeeded((e) => repairs.push(e.reason));
  return { transport, received, statuses, reconnects, repairs };
}

/** Let pending promise chains (the drain loop) run. */
const flush = () => jest.advanceTimersByTimeAsync(0);

beforeEach(() => {
  jest.useFakeTimers();
  resetFakeBle();
  resetBleStartedForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('BleTransport link setup', () => {
  it('connects, requests MTU 512 on Android, subscribes to fromNum and drains', async () => {
    fakeBle.fromRadio = [[1], [2, 2]];
    const { transport, received, statuses } = setup();

    await transport.connect();
    await flush();

    expect(fakeBle.calls).toEqual([
      'start',
      `connect ${ID}`,
      `requestMTU ${MESHTASTIC_BLE.preferredMtu}`,
      `retrieveServices ${MESHTASTIC_BLE.serviceUuid}`,
      `startNotification ${MESHTASTIC_BLE.fromNumUuid}`,
    ]);
    expect(transport.negotiatedMtu).toBe(512);
    expect(statuses).toEqual(['connecting', 'connected']);
    expect(received).toEqual([[1], [2, 2]]);
  });

  it('does not request an MTU on iOS (iOS negotiates by itself)', async () => {
    const { transport } = setup({ platform: 'ios' });
    await transport.connect();
    expect(fakeBle.calls.some((c) => c.startsWith('requestMTU'))).toBe(false);
  });

  it('starts react-native-ble-manager only once', async () => {
    const { transport } = setup();
    await transport.connect();
    await transport.disconnect();
    await transport.connect();
    expect(fakeBle.calls.filter((c) => c === 'start')).toHaveLength(1);
  });
});

describe('BleTransport fromRadio drain loop', () => {
  it('drains until an empty read on every fromNum notify', async () => {
    const { transport, received } = setup();
    await transport.connect();
    await flush();
    const readsBefore = fakeBle.readCount;

    fakeBle.fromRadio = [[7], [8], [9]];
    fakeBle.notifyFromNum(ID);
    await flush();

    expect(received).toEqual([[7], [8], [9]]);
    // Three packets plus the empty read that ends the drain.
    expect(fakeBle.readCount - readsBefore).toBe(4);
  });

  it('drains again when a notify arrives while draining', async () => {
    const { transport, received } = setup();
    await transport.connect();
    await flush();

    fakeBle.fromRadio = [[1]];
    fakeBle.notifyFromNum(ID);
    // Arrives mid-drain: must not start a second, overlapping read loop.
    fakeBle.fromRadio.push([2]);
    fakeBle.notifyFromNum(ID);
    await flush();
    fakeBle.fromRadio.push([3]);
    fakeBle.notifyFromNum(ID);
    await flush();

    expect(received).toEqual([[1], [2], [3]]);
  });

  it('ignores notifies from other radios and other characteristics', async () => {
    const { transport } = setup();
    await transport.connect();
    await flush();
    const reads = fakeBle.readCount;

    fakeBle.notifyFromNum('11:22:33:44:55:66');
    fakeBle.notifyFromNum(ID, MESHTASTIC_BLE.logRadioUuid);
    await flush();

    expect(fakeBle.readCount).toBe(reads);
  });
});

describe('BleTransport writes', () => {
  it('writes one ToRadio per write, with response, without splitting', async () => {
    const { transport } = setup();
    await transport.connect();
    const bytes = Uint8Array.from({ length: 300 }, (_, i) => i & 0xff);

    await transport.write(bytes);

    expect(fakeBle.writes).toEqual([
      {
        peripheralId: ID,
        characteristic: MESHTASTIC_BLE.toRadioUuid,
        data: Array.from(bytes),
        maxByteSize: MESHTASTIC_BLE.maxToFromRadioSize,
      },
    ]);
  });

  it('drains after a write', async () => {
    const { transport, received } = setup();
    await transport.connect();
    await flush();
    fakeBle.fromRadio = [[42]];

    await transport.write(Uint8Array.of(1));
    await flush();

    expect(received).toEqual([[42]]);
  });

  it('refuses to write while disconnected', async () => {
    const { transport } = setup();
    await expect(transport.write(Uint8Array.of(1))).rejects.toThrow(/not connected/);
  });
});

describe('BleTransport reconnect', () => {
  it('reconnects with exponential backoff after the link drops', async () => {
    const { transport, statuses, reconnects } = setup({
      initialBackoffMs: 1000,
      maxBackoffMs: 4000,
    });
    await transport.connect();
    fakeBle.connectErrors = ['Device disconnected', 'Device disconnected', 'Device disconnected'];

    fakeBle.dropLink(ID);
    expect(statuses.at(-1)).toBe('disconnected');

    await jest.advanceTimersByTimeAsync(1000); // attempt 1 fails
    await jest.advanceTimersByTimeAsync(2000); // attempt 2 fails
    await jest.advanceTimersByTimeAsync(4000); // attempt 3 fails
    await jest.advanceTimersByTimeAsync(4000); // attempt 4 succeeds (capped delay)

    expect(reconnects).toEqual([1000, 2000, 4000, 4000]);
    expect(statuses.at(-1)).toBe('connected');
    expect(fakeBle.calls.filter((c) => c.startsWith('connect'))).toHaveLength(5);
  });

  it('starts the backoff over after a successful reconnect', async () => {
    const { transport, reconnects } = setup({ initialBackoffMs: 1000 });
    await transport.connect();

    fakeBle.dropLink(ID);
    await jest.advanceTimersByTimeAsync(1000);
    fakeBle.dropLink(ID);
    await jest.advanceTimersByTimeAsync(1000);

    expect(reconnects).toEqual([1000, 1000]);
  });

  it('stops reconnecting after disconnect()', async () => {
    const { transport, statuses } = setup({ initialBackoffMs: 1000 });
    await transport.connect();
    fakeBle.dropLink(ID);

    await transport.disconnect();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(fakeBle.calls.filter((c) => c.startsWith('connect'))).toHaveLength(1);
    expect(statuses.at(-1)).toBe('disconnected');
  });

  it('does not retry a failed first connect when pairing a new radio', async () => {
    fakeBle.connectErrors = ['Connection error'];
    const { transport, reconnects } = setup();

    await expect(transport.connect()).rejects.toBe('Connection error');
    await jest.advanceTimersByTimeAsync(60_000);

    expect(reconnects).toEqual([]);
    expect(transport.linkStatus).toBe('disconnected');
  });

  it('keeps retrying a remembered radio that is off or out of range', async () => {
    fakeBle.connectErrors = ['Connection error'];
    const { transport, reconnects } = setup({ retryFirstConnect: true, initialBackoffMs: 500 });

    await expect(transport.connect()).rejects.toBe('Connection error');
    await jest.advanceTimersByTimeAsync(500);

    expect(reconnects).toEqual([500]);
    expect(transport.linkStatus).toBe('connected');
  });

  it('retries at once when Bluetooth is switched back on', async () => {
    const { transport } = setup({ initialBackoffMs: 30_000 });
    await transport.connect();
    fakeBle.connectErrors = ['Bluetooth off'];
    fakeBle.dropLink(ID);
    await jest.advanceTimersByTimeAsync(30_000); // fails, next retry in 60 s

    fakeBle.setBluetoothState('on');
    await flush();

    expect(transport.linkStatus).toBe('connected');
  });
});

describe('BleTransport pairing problems', () => {
  it('refreshes the GATT cache after status 133 and suggests re-pairing after repeated 133s', async () => {
    const { transport, repairs } = setup({ initialBackoffMs: 1000, gatt133Threshold: 3 });
    await transport.connect();
    fakeBle.connectErrors = ['Device disconnected', 'Device disconnected'];

    fakeBle.dropLink(ID, { status: 133 }); // 133 #1
    await jest.advanceTimersByTimeAsync(1000);
    expect(fakeBle.calls).toContain(`refreshCache ${ID}`);
    expect(repairs).toEqual([]);

    // The retries fail with 133 too.
    fakeBle.disconnectEvent.emit({ peripheral: ID, status: 133 }); // #2
    fakeBle.disconnectEvent.emit({ peripheral: ID, status: 133 }); // #3
    expect(repairs).toEqual(['gatt133']);
  });

  it('does not refresh the GATT cache on iOS', async () => {
    const { transport } = setup({ platform: 'ios', initialBackoffMs: 1000 });
    await transport.connect();
    fakeBle.dropLink(ID, { status: 133 });
    await jest.advanceTimersByTimeAsync(1000);
    expect(fakeBle.calls.some((c) => c.startsWith('refreshCache'))).toBe(false);
  });

  it('asks for re-pairing when a read fails for lack of authentication', async () => {
    const { transport, repairs } = setup();
    await transport.connect();
    await flush();
    fakeBle.readError = 'Error reading 2c55e69e-4993-11ed-b878-0242ac120002 status=5';

    fakeBle.notifyFromNum(ID);
    await flush();

    expect(repairs).toEqual(['auth']);
  });

  it('asks for re-pairing when iOS reports the radio removed its pairing', async () => {
    const { transport, repairs } = setup({ platform: 'ios' });
    await transport.connect();
    fakeBle.dropLink(ID, { domain: 'CBErrorDomain', code: 14 });
    expect(repairs).toEqual(['auth']);
  });
});
