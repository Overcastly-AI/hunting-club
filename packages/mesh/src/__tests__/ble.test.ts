import { MESHTASTIC_BLE } from '../ble';
import * as mesh from '../index';

describe('MESHTASTIC_BLE', () => {
  it('has the Meshtastic GATT UUIDs and sizes', () => {
    expect(MESHTASTIC_BLE).toEqual({
      serviceUuid: '6ba1b218-15a8-461f-9fa8-5dcae273eafd',
      toRadioUuid: 'f75c76d2-129e-4dad-a1dd-7866124401e7',
      fromRadioUuid: '2c55e69e-4993-11ed-b878-0242ac120002',
      fromNumUuid: 'ed9da18c-a800-4f66-a670-aa7547e34453',
      logRadioUuid: '5a3d6e49-06e6-4423-9944-e9de8cdf9547',
      maxToFromRadioSize: 512,
      preferredMtu: 512,
      defaultFixedPin: '123456',
    });
  });

  it('is exported from the package index with the other shared helpers', () => {
    expect(mesh.MESHTASTIC_BLE).toBe(MESHTASTIC_BLE);
    expect(typeof mesh.Emitter).toBe('function');
    expect(typeof mesh.defaultTimers.setTimeout).toBe('function');
    expect(mesh.MAX_TEXT_CHARS).toBe(200);
    expect(mesh.nodeId(0x1a2b3c4d)).toBe('!1a2b3c4d');
    expect(mesh.nodeId(1)).toBe('!00000001');
  });
});
