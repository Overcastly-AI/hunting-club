# @huntclub/mesh

Pure TypeScript Meshtastic client and Hunt Club app-port codec. No React Native or BLE code: the app supplies a `Transport`. Design: `docs/research/meshtastic.md` ("Recommendations for Milestone 2").

```sh
npm test          # Jest (ts-jest), runs in Node
npm run typecheck # tsc --noEmit, strict
```

## What's here

| Path                              | What                                                                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/transport.ts`                | `Transport` interface: raw, unframed `ToRadio`/`FromRadio` bytes plus link status                                                                                                                      |
| `src/MeshClient.ts`               | Handshake (`want_config_id`, re-run on every reconnect), node DB, channels, config, paced send queue respecting `QueueStatus`, ack/nak matching, de-duplication, typed events                          |
| `src/domain.ts`                   | Mesh domain enums: `CheckInMode` (defined here) and harvest-sex wire codes (`HARVEST_SEX_CODES`, keyed by the SQL enum from `@huntclub/shared`), with their database string keys, and `MAX_TEXT_CHARS` |
| `src/ble.ts`                      | `MESHTASTIC_BLE`: GATT service and characteristic UUIDs, preferred MTU, default PIN                                                                                                                    |
| `src/codec/radio.ts`              | `ToRadio`/`FromRadio` helpers; lenient `FromRadio` decoding                                                                                                                                            |
| `src/codec/appPort.ts`            | App messages on private port 314 (version byte, type byte, protobuf wire-format body, ≤ 200 bytes). The format is data (`FIELDS`, `APP_MESSAGE_SCHEMAS`) walked by one generic encoder and decoder     |
| `src/codec/channelUrl.ts`         | `meshtastic.org/e/#` ChannelSet URLs, the `huntclub://join` wrapper, party channel generator                                                                                                           |
| `src/provisioning.ts`             | AdminMessage sequence that applies a channel set to our radio                                                                                                                                          |
| `src/transports/FakeTransport.ts` | `FakeRadio` (scripted radio) and `FakeAir` (multi-radio loopback with duplicate rebroadcasts)                                                                                                          |

Test doubles and shared fixtures (`connectedClient`, `connectedMesh`, `collect`, `tick`, `NODES`, `seededRandom`, and `FakeRadio.injectText` / `injectRouting` / `injectData`) are exported from `@huntclub/mesh/testing`.

## Usage sketch

```ts
import { MeshClient, decodeJoinUrl, planFromChannelSet } from '@huntclub/mesh';

const client = new MeshClient({ transport: bleTransport, random: secureRandom });
client.on('text', (m) => store.addMessage(m));
client.on('appMessage', ({ message }) => handleAppMessage(message));
await client.connect();
await client.waitUntilReady();

const { result } = client.sendText('On stand 4');
const delivery = await result; // { status: 'acked', implicit: true, ... }

// Joining a party from a scanned QR code:
const { channelSet } = decodeJoinUrl(scannedText);
client.provision(planFromChannelSet(channelSet));
```

## Rules this package follows

- Never logs message bodies, notes or channel keys. The optional `log` callback gets ids, ports, sizes and states only.
- Parses unknown `FromRadio` variants and unknown app-message fields leniently.
- Provisioning always writes explicit settings (`rebroadcast_mode = ALL`, role CLIENT, `position_precision` 32 on the hunt channel and 0 elsewhere).
