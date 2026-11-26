/**
 * The link between a MeshClient and one Meshtastic radio.
 *
 * A transport carries raw, unframed protobuf bytes: one `write` is one
 * serialized `ToRadio`, one `onFromRadio` callback is one serialized
 * `FromRadio`. Over BLE that is exactly one GATT write / one fromRadio read.
 * Serial/TCP transports strip the 0x94 0xC3 framing before calling back.
 *
 * The app supplies a BLE transport; this package ships only FakeTransport
 * for tests. Keep BLE and React Native code out of this package.
 */
export type Unsubscribe = () => void;

/**
 * - `connecting`: link is being set up (or re-established after a drop).
 * - `connected`: bytes can flow. The client (re)runs the config handshake
 *   every time it sees this, because the radio forgets the phone on every
 *   disconnect.
 * - `disconnected`: link lost or closed.
 */
export type LinkStatus = 'connecting' | 'connected' | 'disconnected';

export interface Transport {
  connect(): Promise<void>;
  write(toRadio: Uint8Array): Promise<void>;
  onFromRadio(cb: (bytes: Uint8Array) => void): Unsubscribe;
  onStatus(cb: (status: LinkStatus) => void): Unsubscribe;
  disconnect(): Promise<void>;
}
