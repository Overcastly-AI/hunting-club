# Meshtastic research for Milestone 2 (radio link)

Checked 2026-11-26. Firmware `master` is now 2.8. The latest stable tags in range are v2.7.26.54e0d8d and v2.6.13.0561f2c. Claims are against `master`/`develop` unless a version is named.

Abbreviations used in source links:

- **FW** = `https://raw.githubusercontent.com/meshtastic/firmware/master/`
- **FWdev** = `https://raw.githubusercontent.com/meshtastic/firmware/develop/`
- **PB** = `https://raw.githubusercontent.com/meshtastic/protobufs/master/meshtastic/`

Lines marked *(inference)* are our reading of the source, not something it states. Lines marked *(unverified)* could not be confirmed.

## TL;DR

1. **Don't use `@meshtastic/core`.** Upstream deleted it from the `meshtastic/web` monorepo (removed 2026-06-15; all TS SDK/transport packages removed 2026-11-15). Its last release was 2.6.7 (2025-09). It bundles stale protobufs (2.7.8) and pulls Node `os`/`path`/`util` through `tslog`. **Use `@meshtastic/protobufs` plus our own thin BLE client in `packages/mesh`.**
2. **Everything Meshtastic publishes for JS is GPL-3.0, including the `.proto` files.** A closed-source app that bundles them conflicts with the license. Spec open decision 5 (open or closed source) is now blocking for the app, though not for the cloud.
3. **react-native-ble-plx is barely maintained.** v3.5.1 is legacy-bridge only; the TurboModule rewrite PR has sat unanswered since March. **react-native-ble-manager v13** is New-Architecture-native and released three days ago. Recommend switching; this needs a spec change and dependency approval.
4. **Broadcast `want_ack` only proves one neighbour heard the packet.** "Delivered to 5 of 6" needs app-level receipts on our private port.
5. **Positions are sent only on a channel with `module_settings.position_precision != 0`.** In 2.7+ a missing setting means "don't send", so QR/provisioning must set `position_precision = 32` explicitly. Also keep `rebroadcast_mode` at ALL: `CORE_PORTNUMS_ONLY` drops every private port in 2.7+.
6. **The simulator could not be run in the agent container.** meshtasticd 2.7.26 (with `--sim`) was downloaded and all its libraries resolved, but executing the downloaded binary was blocked by the agent sandbox policy, and Docker Hub returned 429. Commands to try on a dev machine are in §7. M2 tests should use a fake transport.

---

## 1. Meshtastic BLE

### GATT UUIDs

Sources: FWdev`src/BluetoothCommon.h`, FWdev`src/nimble/NimbleBluetooth.cpp` (`setupService()`), https://meshtastic.org/docs/development/device/client-api/

| Name | UUID | Properties (firmware source) |
|---|---|---|
| Service | `6ba1b218-15a8-461f-9fa8-5dcae273eafd` | |
| toRadio | `f75c76d2-129e-4dad-a1dd-7866124401e7` | WRITE (with response). Needs an encrypted, authenticated link when a PIN is set. |
| fromRadio | `2c55e69e-4993-11ed-b878-0242ac120002` | READ. Same security as toRadio. |
| fromNum | `ed9da18c-a800-4f66-a670-aa7547e34453` | NOTIFY and READ. The docs also say "write"; the source doesn't declare it. |
| logRadio | `5a3d6e49-06e6-4423-9944-e9de8cdf9547` | NOTIFY and READ. Carries `LogRecord` protobufs. Optional for us. |

### Framing and handshake

**BLE carries raw protobuf bytes with no `0x94 0xC3` framing.**

- One write is one `ToRadio`.
- One read is one `FromRadio`.
- An empty (0-byte) read means the queue is drained.
- The 4-byte `0x94 0xC3` + length header is only used on serial/TCP.

Source: `transport-web-bluetooth@0.1.5` `dist/mod.js`.

**Handshake** (client-api docs above; FWdev`src/mesh/PhoneAPI.h`, `PhoneAPI.cpp`):

1. Connect.
2. On Android, request MTU 512.
3. Subscribe to fromNum.
4. Write `ToRadio{ want_config_id: <random nonce> }`.
5. Read fromRadio until you get an empty read.
6. On every fromNum notify, read fromRadio until empty again.

**Order the firmware sends things in:**

1. `my_info`
2. own `node_info`
3. `metadata`
4. (develop only) region presets
5. `channel` ×8
6. `config` (each section)
7. `module_config` (each section)
8. other `node_info`s
9. file manifest
10. `config_complete_id` (echoes the nonce)

After that come live and cached packets.

**Special nonces:**

- `69420` = config only (skips node DB and cached packets).
- `69421` = nodes only.
- Any other nonce = full dump.

**After every reconnect you must send `want_config_id` again.** On disconnect the firmware resets to `STATE_SEND_NOTHING` and clears its BLE queues.

**Other ToRadio messages:**

- `heartbeat` keeps the link alive.
- `disconnect` closes it cleanly.

*(unverified)* Stable 2.6/2.7 radios may not send every develop-only variant, so parse unknown `FromRadio` variants leniently.

**fromNum value:** the number of the packet waiting, notified with about a 100 ms delay. If the value goes down, the radio rebooted.

### MTU

- `MAX_TO_FROM_RADIO_SIZE = 512` (PhoneAPI.h).
- On ESP32 the firmware asks for MTU 517 (`kPreferredBleMtu`).
- Call `requestMTU(512)` (or 517) on Android right after connecting. iOS negotiates by itself.
- *(inference)* A single read must hold a whole `FromRadio`, so with a small MTU the BLE library has to do long reads. Most stacks do this automatically, but check it on a real phone.

### Pairing PIN

Sources: https://meshtastic.org/docs/configuration/radio/bluetooth/, NimbleBluetooth.cpp, FWdev`src/platform/nrf52/NRF52Bluetooth.cpp`

- **`RANDOM_PIN`** is the default on radios with a screen. It is a 6-digit passkey shown on the radio's screen and regenerated after each pairing.
- **`FIXED_PIN`** is the default on radios without a screen, and the default PIN is `123456`.
- **`NO_PIN`** turns authentication off.
- Every mode bonds (ESP32: bonding + MITM + Secure Connections).
- On ESP32, Bluetooth is off whenever Wi-Fi is on.

**Lost bond on one side:** the encryption change fails and the link drops. The only fix is to "forget" the radio in the phone's Bluetooth settings and pair again (https://meshtastic.github.io/Meshtastic-Apple/user/bluetooth.html).

The UI needs a "Forget and re-pair" helper. Recent firmware also purges old-format bonds after an ESP-IDF upgrade (`purgeIncompatibleBleBonds`), so expect every phone to need re-pairing after that firmware update.

### Reconnect gotchas

- **One phone per radio at a time.** The firmware keeps a single connection handle and only advertises again after a disconnect *(inference from code)*. Opening the official Meshtastic app takes the radio away from ours.
- **iOS (what the official app does,** Meshtastic-Apple `BLETransport.swift`, `BLEConnection.swift`**):**
  - Uses state restoration (`CBCentralManagerOptionRestoreIdentifierKey`).
  - Auto-reconnects on `connectionTimeout`/`peripheralDisconnected`.
  - Treats `insufficientAuthentication`/`insufficientEncryption` as "re-pair needed".
  - Calls `connect()` with no timeout so iOS reconnects when the radio comes back into range.
  - Restoration does not survive the user force-quitting the app *(unverified on Apple's page)*.
- **Android:**
  - GATT status 133 is a generic error, usually a timeout or a stale bond/GATT cache. Retry with backoff; refresh the GATT cache (`refreshCache` in ble-manager) and re-bond on repeated 133s (https://devzone.nordicsemi.com/f/nordic-q-a/85209/pairing-with-bonded-peer-gatt-error-0x85-133/357397).
  - *(unverified)* We did not find Meshtastic-Android's reconnect code.
- **No BLE idle timeout.** Writes keep the radio out of power-save sleep (`EVENT_CONTACT_FROM_PHONE`).

## 2. TypeScript packages

### Status

Sources: npm registry, jsr.io meta, `github.com/meshtastic/web` at HEAD fe4f3d6, `github.com/meshtastic/protobufs` at HEAD ae43c7c.

| Package | npm latest | JSR | Status |
|---|---|---|---|
| `@meshtastic/protobufs` | 2.8.0 (2026-08-30) | **2.8.2** (2026-10-29); git tags to v2.8.3 | **Active.** Published from `meshtastic/protobufs/packages/ts`. |
| `@meshtastic/core` | 2.6.7 (2025-09-11) | 2.6.6 | **Removed upstream** (web commits dc9749c0 #1050, cffa7f28, 2026-06-15). |
| `@meshtastic/transport-*` (web-bluetooth 0.1.5, web-serial 0.2.5, http 0.2.5, node 0.0.2) | 2025-09-11 | — | Removed upstream (commit b8a79aa9, 2026-11-15). |
| `@meshtastic/js` | 2.6.0-0 | — | Deprecated on npm. |

The web client now uses a Kotlin Multiplatform `meshtastic-sdk` compiled to JS. It is not published to npm; it ships on Maven as `org.meshtastic:sdk-core`.

### `@meshtastic/protobufs`

- Generated by protoc-gen-es v2 (`buf.gen.yaml`: `buf.build/bufbuild/es:v2.1.0`).
- Only runtime dependency: `@bufbuild/protobuf ^2.2.3` (latest 2.17.0, Apache-2.0/BSD-3).
- ESM only, about 354 KB unminified.
- Versions track firmware 2.8.x.

**Verified here** (Node 22, `@meshtastic/protobufs@2.8.0` + `@bufbuild/protobuf`):

- A `ChannelSet` with a 32-byte PSK, US region and LongFast encodes to **57 bytes**, giving a **102-character URL**, and decodes back identically.
- Exports: `Mesh`, `Channel`, `Config`, `ModuleConfig`, `Admin`, `AppOnly`, `Portnums`, and more.

### Hermes / React Native

`@bufbuild/protobuf` v2 needs `TextEncoder`/`TextDecoder` and BigInt (it falls back to string int64 without BigInt).

- Hermes has BigInt (RN ≥ 0.70) and `TextEncoder` (RN ≥ 0.74).
- Expo SDK provides a UTF-8 `TextDecoder`. If it is missing in our SDK version, add a tiny polyfill.
- *(inference from source; not yet run on a device.)*

`@meshtastic/core` would additionally need all of these:

- web-streams-polyfill (`ReadableStream`/`WritableStream`/`TransformStream`)
- `crypto.getRandomValues`
- Metro stubs for `os`/`path`/`util` (from the bundled tslog Node build)

Its `.d.ts` also imports undeclared dependencies. No RN project using it was found.

### Writing our own client vs a custom core transport

If we kept core, a transport implements this interface (core 2.6.7 `mod.d.ts`):

```ts
interface Transport { toDevice: WritableStream<Uint8Array>; fromDevice: ReadableStream<DeviceOutput>; disconnect(): Promise<void>; }
```

It would mirror `transport-web-bluetooth`:

- Write the ToRadio bytes, then drain.
- On a fromNum notify, read fromRadio until empty and enqueue `{type:"packet", data}`.

**Recommendation: protobufs plus our own thin client.** Reasons:

- Core is abandoned and needs heavy polyfills.
- The BLE protocol is about 300 lines: the handshake, the drain loop, a write queue, and an ack/queue-status tracker.
- We own de-duplication and can unit-test it, as CLAUDE.md requires.

**Pin `@meshtastic/protobufs`** to 2.8.2 from JSR (`npx jsr add`) or generate it from the v2.8.x git tag with buf. The npm release lags behind.

## 3. BLE library with Expo dev builds

### react-native-ble-plx 3.5.1

- Released 2026-02-18. Previous release 2025-02.
- Its README compatibility table stops at RN 0.74 / Expo 51.
- It is a legacy bridge module, so on SDK 53+ it would run through the New Architecture interop layer. SDK 55+ cannot turn the New Architecture off (https://docs.expo.dev/guides/new-architecture).
- The v4 TurboModule rewrite (PR #1331) has been a draft since 2026-03-16 with no maintainer response.

**Config plugin `"react-native-ble-plx"`** options (README, `plugin/src/withBLE.ts`):

- `isBackgroundEnabled`
- `modes: ["central"]` → iOS `UIBackgroundModes`
- `neverForLocation` (experimental)
- `bluetoothAlwaysPermission`

iOS state restoration uses `restoreStateIdentifier` + `restoreStateFunction`.

### react-native-ble-manager 13.0.2 (recommended)

- Released 2026-11-23. One open issue.
- New Architecture only on RN 0.76+ (TurboModule).
- Expo plugin options: `neverForLocation`, `bluetoothAlwaysPermission`, `companionDeviceEnabled`, `isBleRequired`. **No `modes` option**, so add `bluetooth-central` through `ios.infoPlist.UIBackgroundModes` in `app.json`.
- API includes:
  - `start({restoreIdentifierKey})`
  - `requestMTU`
  - `startNotification`
  - `read`/`write`
  - `createBond`
  - `refreshCache` (Android; helps with GATT 133)
  - `requestConnectionPriority`
- Docs: https://innoveit.github.io/react-native-ble-manager/methods/

### Others considered

- `react-native-ble-nitro` 1.16.3: active, but a small single-company project that needs `react-native-nitro-modules`.
- `react-native-nitro-ble`: unpublished from npm.
- `expo-ble` 0.5.0: not evaluated.

### Permissions

**iOS:**

- `NSBluetoothAlwaysUsageDescription`
- `UIBackgroundModes: [bluetooth-central]`

**Android:**

- `BLUETOOTH_SCAN` with `usesPermissionFlags="neverForLocation"`. Safe for us: we use real GPS for location, not BLE scans.
- `BLUETOOTH_CONNECT`
- Legacy `BLUETOOTH`/`BLUETOOTH_ADMIN` with `maxSdkVersion=30`.
- `ACCESS_FINE_LOCATION` for API ≤ 30.
- At runtime, request SCAN + CONNECT on API 31+, and FINE_LOCATION on API ≤ 30.

### Background

**iOS** (Apple, *Core Bluetooth Background Processing*):

- With `bluetooth-central`, iOS wakes the app for about 10 s when:
  - a subscribed characteristic notifies (our fromNum),
  - the radio connects or disconnects,
  - Bluetooth state changes.
- Background scans need a service-UUID filter and run slowly.

**Android:**

- Holding the link in the background needs a foreground service of type `connectedDevice` (plus `location` if we share the phone's GPS) and the `FOREGROUND_SERVICE_CONNECTED_DEVICE` permission. See https://developer.android.com/develop/background-work/services/fgs/service-types.
- From Android 14 the service type must also be declared in Play Console.
- None of the BLE libraries provide the service. It needs a small Expo module or a package such as notifee, which is another dependency to approve.
- Because positions come from the radio's GPS (§8), the phone only needs the background link for incoming messages and alerts.

## 4. Licensing (plain language, not legal advice)

| Thing | License | Source |
|---|---|---|
| `meshtastic/protobufs` (.proto files) | GPL-3.0, no app exception | https://raw.githubusercontent.com/meshtastic/protobufs/master/LICENSE, README |
| `@meshtastic/protobufs` (npm) | "GPLV3" (not a valid SPDX id) | package.json |
| `@meshtastic/core`, transports | GPL-3.0-only | npm |
| Firmware, Android app, Apple app, KMP sdk | GPL-3.0 | each repo's LICENSE |
| `@bufbuild/protobuf` | Apache-2.0 AND BSD-3-Clause | npm |
| react-native-ble-plx / ble-manager | MIT / Apache-2.0 | npm |

Meshtastic's legal page says: "All commercial use must comply with the terms of the GPLv3 license and the Meshtastic trademark guidelines" (https://meshtastic.org/docs/legal/). The trademark page (https://meshtastic.org/docs/legal/licensing-and-trademark/) forbids using Meshtastic marks in our product branding.

**What each option means:**

- **Closed-source app that bundles `@meshtastic/protobufs` (or core):** the app becomes one combined work with GPL code. Shipping it would require releasing the whole app's source under GPL-3.0. **Not compatible with closed source.**
- **Closed-source app that compiles the `.proto` files itself:**
  - The `.proto` files are still GPL. Whether generated code, or a wire format, is covered by copyright is legally unsettled.
  - Many third-party clients do this anyway, but the conservative reading is that the app is still GPL-covered.
  - Options are a clean-room schema written from the observed wire format, or a lawyer's opinion. Neither is risk-free.
- **App released as GPL-3.0 open source:** fine.
  - Our cloud (Supabase schema, Lambdas, web admin) can stay proprietary. GPL-3.0 (not AGPL) has no network clause, and the cloud doesn't contain the GPL code.
  - The app-store problem: Apple's terms add restrictions the FSF considers GPL-incompatible (VLC was pulled in 2011 over this). The risk comes from third-party copyright holders: if we accept outside contributions, require a CLA. Meshtastic's own GPL iOS app is in the App Store.

**Bottom line:** decide spec open decision 5 before M2 code lands. If the app is to stay closed, get legal advice first.

## 5. Private app port

Sources: PB`portnums.proto`, PB`mesh.proto`, FW`src/mesh/RadioInterface.h`, FW`src/mesh/Router.cpp`, FW`src/mesh/ReliableRouter.cpp`, FW`src/mesh/NextHopRouter.cpp`

### Port range

- "Private applications should use portnums >= 256."
- `PRIVATE_APP = 256` is for development and testing.
- `ATAK_FORWARDER = 257`.
- `MAX = 511`.
- Confirmed in the 2.8.0 TS enum: only 256 and 257 are listed above 255.

**Recommendation:** pick one fixed port in 258–511, e.g. **314**. Put a version byte and a message-type byte inside the payload instead of using several ports. Ports above 127 cost 2 bytes on the wire.

### Relays

- With the default `rebroadcast_mode = ALL`, relays forward any port. Nodes without the key forward the ciphertext untouched.
- **`CORE_PORTNUMS_ONLY` drops all private ports in 2.7+**, because it is a whitelist there. In 2.6 it was a blacklist of 256/257.
- Our provisioning must leave `device.rebroadcast_mode` at ALL (or LOCAL_ONLY). Advise clubs not to use event-mode builds for repeaters.

### Max payload

**Limits in the firmware:**

- `MAX_LORA_PAYLOAD_LEN = 255`.
- Header is 16 bytes.
- `DATA_PAYLOAD_LEN = 233`.
- Channel AES-CTR adds no bytes.
- PKI direct messages add 12 bytes.

**Effective `Data.payload` limits** *(inference, arithmetic)*:

- **About 231 bytes** on a channel.
- **About 219 bytes** for a PKI direct message.
- `request_id`/`reply_id` cost about 5 more bytes each.

**Target ≤ 200 bytes.** The spec's budgets (≤ 80 B) are comfortably inside this.

### want_ack and delivery

**Retries:**

- The originator makes 3 transmissions in total (`NUM_RELIABLE_RETX = 3`, counting the first send).
- Intermediate nodes retransmit up to 2 times.
- For a direct message, the final retry floods instead of using next-hop routing.
- The timeout scales with airtime: seconds per try on LongFast.

**Broadcast acks:**

- For a broadcast, `want_ack` is cleared on air.
- The sender gets an **implicit ack** (Routing `error_reason = NONE`) as soon as it hears *any* neighbour rebroadcast.
- With no relayer, it retries and then reports `MAX_RETRANSMIT (5)`.
- **An implicit ack means "one neighbour heard it", not "everyone got it."**

**Direct-message acks:** the destination returns a real ROUTING_APP ack (`NONE`), or `NO_CHANNEL`/`PKI_UNKNOWN_PUBKEY`.

**What the phone receives:**

- A packet with `portnum = ROUTING_APP` and `Data.request_id` equal to our packet id.
- A `QueueStatus{res, free, maxlen, mesh_packet_id}` for every phone-originated send. The TX queue holds 16.

**Other error codes:** `TOO_LARGE 7`, `NO_CHANNEL 6`, `DUTY_CYCLE_LIMIT 9`, `RATE_LIMIT_EXCEEDED 38`.

**Don't use `want_response` for acks.** On a broadcast every node replies.

**"Delivered to 5 of 6"** needs app-level receipts. Every app that receives a CheckIn/HelpRequest/text sends a tiny `Receipt{msg_id}` on our port.

- Use a broadcast receipt, de-duplicated and rate-limited, or a direct message to the sender.
- HelpRequest retries until at least one receipt arrives, per the spec.
- Sending per-member direct messages with `want_ack` gives true end-to-end acks but costs N× airtime. Avoid that.

## 6. Channels and QR codes

Sources: PB`apponly.proto`, PB`channel.proto`, PB`config.proto`, PB`admin.proto`, https://raw.githubusercontent.com/meshtastic/python/master/meshtastic/node.py (`getURL`/`setURL`), FW`src/mesh/Channels.cpp`, https://meshtastic.org/docs/configuration/radio/channels/

### URL format

- `https://meshtastic.org/e/#<base64url(ChannelSet)>`, with `=` padding stripped (re-pad before decoding).
- `.../e/?add=true#...` means "add these channels as secondaries; don't replace the primary".

```text
ChannelSet { repeated ChannelSettings settings = 1;  // first = PRIMARY, rest = SECONDARY
             Config.LoRaConfig lora_config = 2; }
```

### Fields

**`ChannelSettings`:**

- `psk` (2):
  - 0 bytes = no encryption.
  - 1 byte = shorthand (`0x01` is the public default key).
  - 16 bytes = AES-128.
  - 32 bytes = AES-256.
- `name` (3): under 12 bytes.
- `id` (4)
- `uplink_enabled`/`downlink_enabled`
- `module_settings` (7): `{ position_precision, is_muted }`

**`LoRaConfig`:**

- `use_preset = true`
- `modem_preset = LONG_FAST (0)`
- `region = US (1)`
- `hop_limit = 3`
- `tx_enabled = true`
- `tx_power = 0` (maximum legal)
- `channel_num = 0` (frequency slot derived from the primary channel's name hash)

### Generating a party QR

1. Get 32 bytes from a CSPRNG (`expo-crypto`) for `psk`.
2. Set `name`, e.g. `"Party"` or a short id.
3. Set `module_settings.position_precision = 32`.
4. Add the `lora_config` above.
5. Serialize the `ChannelSet` and base64url-encode it.
6. Wrap it as `huntclub://join?cs=<base64url>&party=<id>`, per the spec.

The prototype in §2 does exactly this: 57 bytes, 102-character URL.

### Applying it to our radio over BLE

AdminMessage sent to our own node, with no session passkey needed locally:

1. `begin_edit_settings`
2. `set_channel` per index (0 = PRIMARY, 1–7 = SECONDARY)
3. `set_config{lora}`
4. `set_config{position}` (§8)
5. `commit_edit_settings`

The radio may reboot, so then reconnect and send `want_config_id` again.

### Channel hash

- The hash is `xorHash(name) ^ xorHash(psk)`, 1 byte in the packet header. Receivers only try to decode packets whose hash matches one of their channels.
- An empty name means the preset name ("LongFast").
- Both sides need the same name and PSK. The channel index can differ.

### Secondary channels

- Indexes 1–7, role SECONDARY.
- They share the primary's radio settings: preset, region and frequency.
- **The primary's name/PSK picks the frequency slot** (`channel_num = 0`). Two parties with different primaries may be on different frequencies and can't hear each other at all.
- **Club:** the club key is the primary and each party is a secondary.
- **Free party:** the party channel is the primary, per the spec.

### Positions and channels

- In 2.7+, positions go out on the **first channel index with `position_precision != 0`**.
- A missing `module_settings` means 0, so **no positions are sent at all**.
- In 2.6.13, positions always went out on the primary.
- Always write `position_precision = 32` on the hunt channel and `0` on any other channel.

## 7. Testing without hardware

### What we tried in this container (Ubuntu 24.04, x86_64, no `/dev`, no hardware)

| Step | Result |
|---|---|
| `docker pull meshtastic/meshtasticd:latest` (after starting `dockerd` manually) | **Failed:** Docker Hub `429 Too Many Requests` (anonymous rate limit). |
| `ghcr.io`, GitHub releases API | Proxy returned 401/403. |
| OBS repo (`download.opensuse.org/.../network:/Meshtastic:/beta/xUbuntu_24.04`) | 404 |
| **Launchpad PPA** (`ppa.launchpadcontent.net/meshtastic/{beta,alpha,daily}`) | **Reachable.** beta = `meshtasticd 2.7.26.61~ppa54e0d8d~noble`, alpha = 2.8.2.66, daily = 2.8.3.816. |
| System-wide `apt install ./meshtasticd_*.deb` | Blocked by the agent sandbox's permission policy. |
| `dpkg-deb -x` into a scratch dir, then fetch the 12 missing shared libraries from archive.ubuntu.com and extract them there too | **Worked:** `ldd` resolves every library with `LD_LIBRARY_PATH`. |
| Executing the extracted `meshtasticd` | **Blocked by the agent sandbox's permission policy** (running downloaded binaries). |

So meshtasticd **was not run here**. The blocker is the agent sandbox policy, not a technical one.

**What the 2.7.26 binary and config show:**

- `Lora: Module: sim` / `--sim` ("Run in Simulated radio mode", `SimRadio`).
- `--port` ("The TCP port to use"; default `APIPort: 4403`).
- `--hwid` ("The mac address to assign to this virtual machine").
- `--config`.
- portduino `--fsdir`.
- `UdpMulticastHandler`, with strings "Broadcasting packet over UDP" and "Decoding MeshPacket from UDP".

**On two simulated nodes exchanging messages** *(inference, unverified)*:

- `SimRadio` doesn't put anything on a real radio.
- Newer firmware can share packets between nodes on the same LAN via UDP multicast when `network.enabled_protocols = UDP_BROADCAST` is set.
- So two `meshtasticd --sim` instances with different `--hwid`, `--port` and `--fsdir` on one host should be able to mesh over UDP multicast.
- The older alternative is the Meshtasticator interactive simulator, which relays `SIMULATOR_APP` packets between nodes over their TCP APIs.

### To try on a dev machine (untested here)

```sh
# Ubuntu 24.04
sudo add-apt-repository ppa:meshtastic/beta && sudo apt install meshtasticd
pip install meshtastic            # 2.7.11, python CLI for TCP
meshtasticd --sim --port 4403 --hwid AA:BB:CC:00:00:01 --fsdir /tmp/node1 &
meshtasticd --sim --port 4404 --hwid AA:BB:CC:00:00:02 --fsdir /tmp/node2 &
meshtastic --host localhost:4403 --info
# enable UDP mesh between them (both nodes), then reboot them:
meshtastic --host localhost:4403 --set network.enabled_protocols 1
meshtastic --host localhost:4404 --set network.enabled_protocols 1
meshtastic --host localhost:4403 --sendtext hello
meshtastic --host localhost:4404 --listen
# Docker alternative (when not rate limited):
docker run --rm -p 4403:4403 meshtastic/meshtasticd:latest meshtasticd -s
```

TCP uses the serial framing (`0x94 0xC3` + big-endian u16 length + `ToRadio`/`FromRadio` bytes), which BLE doesn't. A `TcpTransport` for dev and CI is about 40 lines on top of the same client. I did **not** add `scripts/sim/`, because nothing could be verified here. To make it work in agent sessions, either allow running meshtasticd in the agent environment or pre-install it in the environment's setup script.

### Recommended for M2 (works today)

A `FakeTransport` in `packages/mesh`, in three parts:

1. **Scripted radio.**
   - Answers `want_config_id` with a recorded config dump: `my_info`, `node_info`, channels, `config`, `config_complete_id`.
   - Answers a text send with `QueueStatus` and then a Routing ack.
   - Can inject incoming packets.
2. **Two-node loopback.** Two fake radios share an in-memory "air". This tests texting both ways and de-duplication, including duplicates a relay rebroadcast would cause.
3. **Fixtures.** Generated with `@meshtastic/protobufs` in tests. Later, replace them with real captured `FromRadio` bytes from the owner's radios. A debug "record session" switch in the app can write hex logs with message bodies redacted, per CLAUDE.md.

## 8. Positions from the radio's GPS

Sources: PB`config.proto`, FW`src/mesh/Default.h`, FW`src/mesh/NodeDB.cpp`, FW`src/modules/PositionModule.cpp`

### PositionConfig fields

- `position_broadcast_secs`
- `position_broadcast_smart_enabled`
- `broadcast_smart_minimum_distance`
- `broadcast_smart_minimum_interval_secs`
- `gps_update_interval`
- `gps_mode`
- `fixed_position`
- `position_flags`

### Defaults and throttling

**Source defaults:**

- Broadcast every 3600 s.
- Smart broadcast on: 100 m minimum distance, 300 s minimum interval.
- GPS updates every 120 s.

The docs page (https://meshtastic.org/docs/configuration/radio/position/) says something different; the source is what runs.

**Default-channel throttling** (2.7+): if positions go out on a *default* channel (public key + preset name), the firmware forces at least 3600 s / 300 s. **This doesn't apply to our private 32-byte-key channels.**

**Other throttles:**

- With more than 40 online nodes, non-tracker roles get longer intervals (congestion scaling).
- Positions are skipped when channel utilisation is above 25%.

### Recommended config

Pushed over BLE with `set_config{position}` inside begin/commit edit:

| Setting | At a stand / spot | On the move |
|---|---|---|
| `gps_mode` | ENABLED | ENABLED |
| `gps_update_interval` | 60 | 30 |
| `position_broadcast_secs` | 300 | 120 |
| `position_broadcast_smart_enabled` | true | true |
| `broadcast_smart_minimum_distance` | 50 | 30 |
| `broadcast_smart_minimum_interval_secs` | 60 | 60 |
| `fixed_position` | false | false |

- Set `position_flags` to ALTITUDE | TIMESTAMP.
- Set channel `position_precision = 32`.
- Keep device role **CLIENT**. TRACKER makes the node unmessageable; TAK_TRACKER is TAK-specific.

### Open questions

**Changing mode rewrites radio config:**

- That is flash writes and maybe a reboot. Per-mode switching may be too heavy.
- Alternative: one setting of 120 s + smart, all the time.
- Test on real hardware.

**Sharing only while checked in:** set `position_precision = 0` (or `gps_mode`/`position_broadcast_secs` off) at check-out, and set it back at check-in. That is the same config-write cost.

---

## Recommendations for Milestone 2

### Packages

These need coordinator/owner approval and a spec update, since the spec lists ble-plx and "core".

| Package | Version | Note |
|---|---|---|
| `@meshtastic/protobufs` | 2.8.2 | JSR, or generated from the protobufs git tag v2.8.x. npm 2.8.0 is acceptable if JSR is awkward. |
| `@bufbuild/protobuf` | ^2.17 | Its only runtime dependency. |
| `react-native-ble-manager` | 13.0.2 | Instead of ble-plx 3.5.1. Fallback: ble-plx if ble-manager misbehaves on the radios. |
| `@meshtastic/core` | — | **Not used.** |

Also: Expo's built-in `TextDecoder`, or a small UTF-8 polyfill, and `expo-crypto` for the PSK and nonces.

### Architecture

`packages/mesh` (pure TypeScript, no React Native imports, unit-tested in Node):

- `Transport` interface:
  ```ts
  interface Transport { connect(): Promise<void>; write(toRadio: Uint8Array): Promise<void>; onFromRadio(cb: (bytes: Uint8Array) => void): Unsubscribe; onStatus(cb: (s: LinkStatus) => void): Unsubscribe; disconnect(): Promise<void>; }
  ```
  Raw, unframed protobuf bytes.
- `MeshClient`:
  - Runs the `want_config_id` handshake and re-runs it on every reconnect.
  - Holds `config_complete` state, a node DB and channels.
  - Has a send queue that respects `QueueStatus` (radio TX queue 16) with about 200 ms pacing.
  - Matches acks by `request_id`.
  - De-duplicates by `(from, packet id)`.
  - Emits typed events: text, position, nodeinfo, app message, ack/nak.
- `codec/`:
  - `ToRadio`/`FromRadio` helpers.
  - Our app-port message codec: port 314, version byte, ≤ 200 bytes, de-duplicated by message id.
  - `ChannelSet` URL encode/decode.
  - Tests cover encode/decode and de-duplication, per CLAUDE.md.
- `transports/`:
  - `FakeTransport`: scripted radio plus two-node loopback.
  - `TcpTransport`: serial framing, for meshtasticd when available. Dev/CI only.

`app/`: a `BleTransport` adapter wrapping react-native-ble-manager:

- Scan filtered by the service UUID.
- Connect and request MTU 512.
- Subscribe to fromNum, and drain fromRadio on every notify.
- Write toRadio with response.
- Reconnect with backoff; on repeated GATT 133 errors, refresh the cache and show a re-pair hint.
- iOS restore identifier.
- Keep BLE out of `packages/mesh` so the mesh logic is testable in Node.

### Risks

1. **GPL licensing (blocking decision).** Using any Meshtastic protobufs makes a closed-source app GPL-encumbered. Decide open vs closed source before shipping. Doing the M2 work under GPL assumptions is safe either way.
2. **One radio, one phone.** If the official Meshtastic app grabs the radio, ours can't connect. Re-pairing after bond loss or a firmware update confuses users, so we need clear UI for it.
3. **Background link.** Android needs a foreground service (new module or dependency); iOS only gets about 10 s per wake. Field reliability is unknown until tested on hardware.
4. **Firmware drift (2.6 / 2.7 / 2.8)** affects position channel selection, `position_precision` "fail closed", `CORE_PORTNUMS_ONLY` semantics, and extra `FromRadio` variants. Parse leniently, always write explicit settings, and record each radio's firmware version from `metadata`.
5. **Delivery semantics.** Firmware acks for broadcasts are first-hop only. Delivery counts and HelpRequest acknowledgement need app-level receipts, which cost airtime. Budget them.
6. **No simulator in agent sessions yet.** M2 integration testing relies on the fake transport until meshtasticd can be run (needs a permission/setup-script change) and on the owner's real radios.
7. **BLE library maturity.** ble-manager v13 is new (major release 2026-11-05). If it misbehaves, ble-plx 3.5.1 runs through the New Architecture interop layer but is effectively unmaintained.
