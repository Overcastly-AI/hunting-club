# Hunt Club Mesh: Build Spec for Claude Code

2026-11-25 · Jake

> Exported from the [Build Spec doc](https://claude.ai/artifact/B6A6qTjctza5HrnVLiU2Be) on 2026-11-26. Mockups: [design canvas](https://claude.ai/artifact/2jjFAGqLWADJBm8UAALbpW).

## Overview

Build a phone app that pairs over Bluetooth with low-cost Meshtastic LoRa radios. It gives a hunting club a live map, texting and digital stand check-in with no cell service, replacing paper sign-in sheets and old printed maps.

**How to use this doc with Claude Code:** treat it as the source of truth. Save it as `docs/SPEC.md` in the repo, copy the starter `CLAUDE.md` from the last section, and start with Milestone 1. Visual reference: [design canvas](https://claude.ai/artifact/2jjFAGqLWADJBm8UAALbpW). **Design D (Live Map)** is the approved direction. Designs A–C show screen content only, not the visual style.

**Who uses it**

- **Club members**, mostly 50–75 years old, often in gloves, in cold weather, at dawn and dusk.
- **Club admins**, who set up the club, stands and members once.
- **The clubhouse board**, a wall tablet that replaces the paper sign-in sheet.

**Product rules**

1. Works with zero cell service. Cloud features are extras, never required in the field.
2. If you can scan a QR code, you can use it. No channels, keys or radio settings in the normal UI.
3. Large text, large buttons and a word label on every control.
4. Private by default: harvests stay private unless shared, and location is shared only while checked in.
5. "Ask for a Hand" pings club members. Nothing in the app may look like it calls 911.
6. No legal shooting hours. Show sunrise and sunset only, since rules vary by state.
7. Compatible with stock Meshtastic radios and firmware.

## Feature scope

The MVP ships the free tier plus the clubhouse board. Other Club Pro features come after the field test. Every member uses the free app, and the club pays once per season to unlock Pro for everyone.

| Feature | Tier | MVP |
|---|---|---|
| Live map of club members (offline basemap) | Free | Yes |
| Club chat, hunting-party chat, direct messages, quick replies | Free | Yes |
| Stand check-in and check-out with GPS nearest-stand suggestion | Free | Yes |
| Overdue alert: not checked out by sunset + admin-set grace time | Free | Yes |
| Ask for a Hand (pings club members with your location) | Free | Yes |
| Join a club by scanning a QR code | Free | Yes |
| Mesh status: radios heard, last-heard time, position freshness | Free | Yes |
| Wind and scent cone from your stand | Free | Yes |
| Log a harvest (private by default, optional share) | Free | Yes |
| Basic topo basemap, up to [10] members | Free | Yes |
| Clubhouse display board (replaces paper sign-in sheet) | Club Pro | Yes |
| High-res offline aerial and topo map packs | Club Pro | Later |
| Shooting-lane and safety-zone warnings near occupied stands | Club Pro | Later |
| Harvest log reports and season summaries | Club Pro | Later |
| Unlimited members, hunting parties, guest passes | Club Pro | Later |
| Admin tools: roles, stand rules, reset club key | Club Pro | Admin basics in MVP |

**Out of scope for v1:** legal shooting hours, 911 or SOS calling over the mesh, trail-camera integration, marketplaces or social feeds, and custom radio firmware (stock Meshtastic firmware only).

## System architecture

Everything that matters in the field travels over the LoRa mesh. The cloud only stores club setup, accounts and billing, and syncs when a phone or the board has internet.

```text
 Hunter phone ──BLE── Personal radio ═LoRa═╗
 Hunter phone ──BLE── Personal radio ═LoRa═╬═ Solar repeater (ROUTER)
 Clubhouse board ─USB/BLE─ Board radio ═LoRa═╝
        ┆ (only when internet is available)
 Phones / Board ┄┄┄┄┄┄┄┄ Cloud backend (Supabase: accounts, club config, Pro)
```

The highlighted links carry all field traffic over LoRa; dashed links to the cloud only run when a phone or the board has internet.

**Components**

- **Hunter phone app** (iOS and Android). Talks to its paired radio over Bluetooth LE, stores everything locally first, and renders offline maps.
- **Personal radio.** Any Meshtastic-compatible LoRa device. Recommended test hardware: a RAK WisBlock or Heltec board with GPS.
- **Solar repeater.** A Meshtastic node set to the ROUTER role, placed on high ground to cover the property.
- **Clubhouse board.** A wall tablet running the same app in "Board mode," connected to its own radio by USB serial or Bluetooth.
- **Cloud backend.** Accounts, club config, stand lists, Pro entitlements and optional backup. Never required in the field.

**Suggested stack** (Claude Code should confirm current package names and versions before installing)

| Layer | Choice | Why |
|---|---|---|
| App | React Native with Expo (dev build) | One codebase for iOS, Android and the tablet board |
| Bluetooth | react-native-ble-plx | Mature BLE library for the Meshtastic BLE service |
| Mesh protocol | Official Meshtastic protobuf definitions | Wire compatibility with stock radios |
| Maps | MapLibre React Native with offline packs | Free, open source, works fully offline |
| Basemap data | USGS topo and USDA NAIP aerial imagery | Public domain in the US |
| Local data | SQLite (expo-sqlite) | Offline-first storage and queueing |
| Backend | Supabase (Postgres, auth, storage) | Club config, members, entitlements |
| Payments | Stripe on a web admin page; RevenueCat if in-app purchase is added | Keeps Club Pro sales off the app store cut where allowed |
| Sun and wind | Sunrise and sunset computed on device; wind from forecast when online, cached | Works offline after the morning sync |

## Mesh protocol

Use stock Meshtastic channels, positions and text messages. Put the hunting-specific data in compact app messages on the private app port, which stock clients ignore. Bandwidth is tiny, so every message type has a size and rate budget.

**Channels and onboarding**

- When the admin creates a club, the app generates a primary channel with a random 256-bit key and picks the region from GPS (US: 915 MHz) and a default modem preset (LongFast).
- A hunting party is a secondary channel (Meshtastic supports up to 8 per radio).
- The **Club QR code** wraps a standard Meshtastic channel-set URL plus the club ID in the app's own deep link (`huntclub://join?...`). Scanning it configures the paired radio and joins the club in one step.
- **Reset club key:** the admin generates a new key and QR code. Old radios lose access.
- Members never see channels, keys, presets or regions. An Advanced screen exposes them for power users.

**Message types**

| Type | Meshtastic port | Sent when | Budget |
|---|---|---|---|
| Position | Position (stock) | Every 2–5 min while checked in; smart position on movement | Stock size |
| Text | Text message (stock) | User sends | 200 characters max, enforced in UI |
| CheckIn | Private app port | Check in at a stand | Under 40 bytes, request ack |
| CheckOut | Private app port | Check out | Under 40 bytes, request ack |
| HelpRequest | Private app port | Ask for a Hand | Under 60 bytes, request ack, retry until acked |
| HarvestShare | Private app port | Hunter chooses to share | Under 80 bytes |
| StandListVersion | Private app port | Admin edits stands | Version number only; full list syncs via QR or cloud |
| OverdueAlert | Private app port | Board or phone detects overdue | Under 40 bytes |

**Rules**

- Encode app messages as small protobufs with: message ID, sender node ID, timestamp, stand ID and payload. De-duplicate on message ID.
- Show delivery state in the UI (for example, "Delivered to 5 of 6") using Meshtastic acks.
- Mark positions as stale in the UI: solid ring under 2 min, dashed between 2 and 10 min, faded after that.
- Keep the hop limit at the Meshtastic default (3) and avoid chatty updates. Airtime is shared by the whole club.

## Data model

The phone's local SQLite database is the source of truth in the field. The cloud mirrors club setup and accepts sync when online. IDs are UUIDs, and every record carries `updated_at` for last-write-wins sync.

| Entity | Key fields | Notes |
|---|---|---|
| Club | id, name, acreage, boundary (GeoJSON), channel key, region, overdue grace minutes, plan (free or pro), season end | Key is stored encrypted on device; never logged |
| Member | id, club id, display name, initials, role (admin, member, guest), node ID, location sharing setting | Guests expire at a set date |
| Radio | node ID, member id, hardware model, battery, last heard, last SNR | Filled from Meshtastic node info |
| Stand | id, club id, name, type (tree stand, ladder, ground blind), lat, lon, notes, active | Names, not coordinates, in the UI |
| CheckIn | id, member id, stand id, checked in at, checked out at, overdue alert sent at | One open check-in per member |
| Position | node ID, lat, lon, accuracy, received at | Keep last known only; history is opt-in Pro |
| Message | id, channel (club, party, direct), sender, body, sent at, delivered count | 200-character limit |
| HelpRequest | id, member id, lat, lon, created at, acknowledged by, resolved at | Pings club members only |
| Harvest | id, member id, stand id, species, sex, notes, photo (local), shared | Private unless shared is true |
| MapPack | id, club id, bounds, zoom range, source, size, downloaded at | Pro unlocks the high-res aerial pack |

## Design system (from Design D)

The look is a full-screen aerial map with dark floating controls and a bottom sheet. Orange is reserved for three things: you, the main action and the selected tab. Build these as theme tokens; do not hard-code colors in components.

**Color tokens**

| Token | Value | Use |
|---|---|---|
| surface | #121416 | Floating panels, bottom sheet, tab bar |
| surface-raised | #23272B | Secondary buttons |
| border | #2A2E33 | Dividers and outlines |
| text | #FFFFFF | Primary text |
| text-secondary | #B8BDC2 | Labels, inactive tabs |
| accent | #FF7A1F | You marker, primary button (Check Out), active tab only |
| help | #F5C04E | Ask for a Hand outline and icon; stale position ring |
| fresh | #4ADE80 | Fresh position ring, mesh connected |
| alert | #FF5A4E | Unread badges, compass north |
| wind | #8EC5FF | Wind arrow |
| water-label | #C9DCDD | Creek and pond names |
| map-halo | #0B0D0E | 3 px outline behind all map text |
| boundary | #FFFFFF at 85% + 1 px accent inner line | Club property line |

**Type:** Archivo variable font (width 75–100, weight 500–800). Map labels at least 13 px; marker names 15 px / 800; sheet title 25 px / 800 at 82% width; body 16–17 px; tab labels 14 px. Use mixed case; no letter-spaced all-caps labels.

**Shape and size:** controls 52 × 52 px with 14 px corners; primary buttons 62–66 px tall with 12 px corners; bottom sheet 20 px top corners; hunters are circles, stands are rounded squares with a type icon. Minimum tap target is 48 px everywhere.

**Avoid:** pill-shaped chips, Inter or system fonts, gradient backgrounds, emoji, and orange on anything that isn't you, the main action or the active tab.

## Screens

The app has four tabs (Map, Chat, Check In, Club) plus onboarding and Board mode. Only the Map screen has an approved mockup. Build the other screens in the same style, using the content from Designs A–C on the canvas.

**1. Map (approved: Design D)**

- Full-screen offline aerial basemap with the club boundary, acreage label, water and road labels, and a 500 ft scale bar.
- Top bar: club button (club logo or initials) beside one conditions panel showing Sunrise · Sunset, wind direction and speed with a "blowing toward" arrow, and temperature.
- Mesh status line: "Mesh: 3 radios · heard 12s ago". Tapping it opens radio details.
- Right-side controls: map layers, north-up, center on me.
- Hunter markers: initials in a circle with a freshness ring, plus the stand name and "2 min ago". Open stands: icon by stand type plus "Open".
- Your marker: an orange dot with a pulse and a scent cone pointing downwind, labeled "Your scent".
- Bottom sheet when checked in: "Checked in at" plus the stand name and time since check-in; **Ask for a Hand** (gold outline, "Pings club members"); **Check Out** (orange); a "Log a harvest · Private" row.
- Bottom sheet when not checked in: one large "Check In" button with the nearest open stand suggested.
- No search bar on the map.

**2. Chat**

- Segmented control: Whole Club, Hunting Party, Direct.
- Message bubbles with sender, stand and time; system cards for check-ins, help requests and shared harvests.
- Quick replies: Coming to you, Seeing deer, All quiet, On my way out.
- Text field with a live 200-character limit and delivery status ("Delivered to 5 of 6").

**3. Check In**

- The nearest open stand by GPS, highlighted at the top.
- Full stand list: open stands are tappable; occupied ones show who is there.
- Note explaining the overdue alert: sunset plus the club's grace time.
- A large "Slide to check in" control to prevent pocket taps. Same pattern for Check Out.

**4. Club**

- Search for stands, members and pins (search lives here, not on the map).
- Member list with radio status and battery.
- Club QR code to invite members (admins only).
- Settings: location sharing, text size, red-light night mode, Advanced radio settings.
- Club Pro upgrade card for admins.

**5. Onboarding**

1. Welcome, then pair a radio over Bluetooth (one tap, with a pairing-PIN helper).
2. Scan the Club QR code.
3. Enter your name and initials.
4. Allow location, Bluetooth and notifications, with a plain-language reason for each.
5. Land on the map.

**6. Clubhouse board (Board mode, Pro)**

- A landscape tablet showing the map and a large list of every stand: who is in it and since when.
- Overdue members highlighted, with a full-screen alert after sunset plus grace time.
- Runs unattended, keeps the screen awake and auto-recovers the radio connection.

## Safety, privacy and accessibility

The app helps club members look out for each other; it is not an emergency service. All copy, store listings and marketing must say so, and nothing in the UI may imply a 911 call.

**Safety**

- Ask for a Hand sends a HelpRequest to club members with your location, and retries until at least one member acknowledges it.
- The overdue alert fires at sunset plus the club's grace time (admin-set; default 30 minutes). Never use legal shooting hours.
- If the mesh is down, say so plainly ("No radios heard for 15 min"); never show stale positions as live.
- Include a plain note in settings: for emergencies, call 911 from your phone if you have service.

**Privacy**

- Your location is shared only while you're checked in, unless you change it in settings.
- Harvests are private by default; sharing is a per-harvest choice.
- Keep only last-known positions; location history is opt-in.
- Club messages are encrypted with the club key on the mesh. Never log keys or message bodies.

**Accessibility**

- Minimum 13 px text on the map and 16 px for body text; support the system text size up to 200%.
- 48 px minimum tap targets; slide-to-confirm for check-in and check-out.
- Every icon has a word label; screen-reader labels on all markers ("Creek Stand, Dale, updated 2 minutes ago").
- Text contrast of at least 4.5:1, including map labels with their halo.
- Red-light night mode for pre-dawn use.

## Pricing, stores and licensing

The app is free to download. The club buys Club Pro once per season for every member, and radio kits are sold separately. Prices are still open.

| Item | Price | Cost to us |
|---|---|---|
| Free app | $0 | — |
| Club Pro | [YOUR PRICE] per club, per season | Apple and Google take a cut if sold in-app (below) |
| Radio kit and solar repeater | [YOUR PRICE] | No app store cut on physical goods |
| Apple Developer Program | — | $99 per year |
| Google Play developer account | — | About $25 one-time (verify) |

- Apple's standard in-app cut is 30%, or 15% in the Small Business Program for developers under $1M a year ([Apple](https://developer.apple.com/app-store/small-business-program/), [Paddle summary](https://www.paddle.com/blog/app-store-fees)).
- Plan to sell Club Pro on a web admin page. Check Apple's and Google's current rules on linking to outside payment before launch.
- **Licensing:** Meshtastic firmware is GPL-3.0. Before a closed-source release, confirm the licenses of the protobuf definitions and any Meshtastic client libraries the app uses.

## Build plan for Claude Code

Build in this order. Each milestone ends with something you can test on real radios. You'll need two or three Meshtastic radios with GPS before Milestone 1.

1. **Project setup:** Expo dev build, TypeScript, theme tokens from the design system, tab navigation, SQLite.
2. **Radio link:** scan, pair and connect over BLE; read node info; send and receive text on the primary channel. Test: two phones text with no cell service.
3. **Club onboarding:** create a club, generate a key and Club QR code, scan to join, Advanced settings screen.
4. **Live map:** MapLibre with an offline basemap pack for one test property; positions on the map with freshness rings; mesh status line.
5. **Stands and check-in:** stand list, nearest-stand suggestion, slide to check in and out, CheckIn and CheckOut app messages with acks, bottom sheet states.
6. **Safety:** Ask for a Hand with retries and acks, overdue alert from sunset plus grace time, mesh-down warnings.
7. **Chat:** club, party and direct channels, quick replies, delivery status.
8. **Clubhouse board:** Board mode on a tablet connected to its own radio.
9. **Cloud and Pro:** Supabase accounts and club sync, Stripe web checkout, Pro entitlements, high-res map packs.
10. **Field test:** one real club for one weekend; log range, battery and confusion points.

**Starter CLAUDE.md**

```markdown
# Hunt Club Mesh

Off-grid hunting club app: phones pair over BLE to Meshtastic LoRa radios.
Source of truth: docs/SPEC.md. Read it before starting any milestone.

## Rules
- Offline-first: every field feature must work with no internet.
- Stay wire-compatible with stock Meshtastic firmware. No custom firmware.
- Members never see channels, keys, presets or regions outside Advanced settings.
- Use theme tokens only; no hard-coded colors. Font: Archivo.
- Min tap target 48px, min map text 13px, body 16px+.
- Never show legal shooting hours. Sunrise and sunset only.
- Ask for a Hand pings club members. Never style or word anything like a 911 call.
- Harvests are private by default. Location is shared only while checked in.
- Never log channel keys or message bodies.

## Workflow
- Work one milestone at a time; list what you will build and the test, then build.
- Write unit tests for protobuf encode/decode and message de-duplication.
- Ask before adding a dependency not listed in docs/SPEC.md.
```

**First prompt to paste into Claude Code**

```text
Read docs/SPEC.md and CLAUDE.md. Start Milestone 1 (project setup), then Milestone 2 (radio link).
Before coding, confirm the current Meshtastic BLE service UUIDs, protobuf package and
react-native-ble-plx setup for Expo dev builds, and list any decisions you need from me.
```
