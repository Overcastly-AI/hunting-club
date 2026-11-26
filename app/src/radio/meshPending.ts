/**
 * TEMPORARY: things the app needs from @huntclub/mesh that it does not export
 * yet. Requested from the mesh worker (Emitter, defaultTimers, TimerHandle,
 * nodeId, MESHTASTIC_BLE, MAX_TEXT_CHARS). When they land, import them from
 * '@huntclub/mesh' and delete this file.
 */
export { Emitter } from '../../../packages/mesh/src/emitter';
export { defaultTimers, type TimerHandle } from '../../../packages/mesh/src/runtime';

/** Meshtastic node id as shown by Meshtastic apps, e.g. "!1a2b3c4d". */
export const nodeId = (num: number): string => `!${(num >>> 0).toString(16).padStart(8, '0')}`;

/** Meshtastic BLE GATT service (docs/research/meshtastic.md §1). */
export const MESHTASTIC_BLE = {
  serviceUuid: '6ba1b218-15a8-461f-9fa8-5dcae273eafd',
  toRadioUuid: 'f75c76d2-129e-4dad-a1dd-7866124401e7',
  fromRadioUuid: '2c55e69e-4993-11ed-b878-0242ac120002',
  fromNumUuid: 'ed9da18c-a800-4f66-a670-aa7547e34453',
  logRadioUuid: '5a3d6e49-06e6-4423-9944-e9de8cdf9547',
  /** MAX_TO_FROM_RADIO_SIZE in firmware PhoneAPI.h: one ToRadio per write. */
  maxToFromRadioSize: 512,
  /** Android MTU request right after connecting. */
  preferredMtu: 512,
  /** FIXED_PIN default on radios without a screen. */
  defaultFixedPin: '123456',
} as const;

/** Spec: texts are 200 characters max, enforced in the UI. */
export const MAX_TEXT_CHARS = 200;
