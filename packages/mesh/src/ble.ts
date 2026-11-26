/**
 * Meshtastic BLE GATT constants (docs/research/meshtastic.md §1). Used by
 * the app's BLE transport; this package itself has no BLE code.
 */
/** Firmware MAX_TO_FROM_RADIO_SIZE: the largest ToRadio/FromRadio, one GATT read/write. */
const MAX_TO_FROM_RADIO_SIZE = 512;

export const MESHTASTIC_BLE = {
  serviceUuid: '6ba1b218-15a8-461f-9fa8-5dcae273eafd',
  /** Write with response: one write = one ToRadio. */
  toRadioUuid: 'f75c76d2-129e-4dad-a1dd-7866124401e7',
  /** Read: one read = one FromRadio; an empty read means drained. */
  fromRadioUuid: '2c55e69e-4993-11ed-b878-0242ac120002',
  /** Notify: a packet is waiting; drain fromRadio. */
  fromNumUuid: 'ed9da18c-a800-4f66-a670-aa7547e34453',
  /** Notify: LogRecord protobufs (optional). */
  logRadioUuid: '5a3d6e49-06e6-4423-9944-e9de8cdf9547',
  maxToFromRadioSize: MAX_TO_FROM_RADIO_SIZE,
  /** Request on Android right after connecting. */
  preferredMtu: MAX_TO_FROM_RADIO_SIZE,
  /** Default PIN on radios without a screen (FIXED_PIN mode). */
  defaultFixedPin: '123456',
} as const;
