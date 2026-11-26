# Hunt Club Mesh: Build Spec

2026-11-26 · Jake

> Originally exported from the [Build Spec doc](https://claude.ai/artifact/B6A6qTjctza5HrnVLiU2Be) on 2026-11-26, then revised in the repo. This file is now the source of truth. Mockups: [design canvas](https://claude.ai/artifact/2jjFAGqLWADJBm8UAALbpW).

## Overview

Build a phone app that pairs over Bluetooth with low-cost Meshtastic LoRa radios. It gives hunters a live map, texting and check-in with no cell service. Individual hunters and small parties use it free. Hunting clubs pay a subscription for shared club setup and admin tools, replacing paper sign-in sheets and old printed maps.

**Visual reference:** [design canvas](https://claude.ai/artifact/2jjFAGqLWADJBm8UAALbpW). **Design D (Live Map)** is the approved direction. Designs A–C show screen content only, not the visual style.

**Who uses it**

- **Hunters**, often 50–75 years old, often in gloves, in cold weather, at dawn and dusk. Most use only the free version.
- **Club admins**, who buy the club subscription and set up the property, stands and members.
- **The clubhouse board**, a wall tablet that replaces the paper sign-in sheet (club only).

**Product rules**

1. Works with zero cell service. Cloud features are extras, never required in the field.
2. **Everything that travels over the Meshtastic mesh is free, forever.** Paid features are the cloud and club-admin layer only.
3. **Free users cost us close to nothing.** Free users have no account and never call our backend. Their maps come straight from public USGS servers.
4. **Safety is never behind a paywall.** If a club's subscription lapses, Ask for a Hand, overdue alerts and the mesh keep working; only the club's shared setup and admin tools freeze.
5. If you can scan a QR code, you can use it. No channels, keys or radio settings in the normal UI.
6. Large text, large buttons and a word label on every control.
7. Location is shared only while you're checked in (at a stand, at a spot or on the move).
11. Stands are optional. Many hunters walk the woods; every feature must work for a hunter who never sits in a stand.
8. "Ask for a Hand" pings your party or club. Nothing in the app may look like it calls 911.
9. No legal shooting hours. Show sunrise and sunset only, since rules vary by state.
10. Compatible with stock Meshtastic radios and firmware.

## Free vs Club

| Feature | Free (any hunter, no account) | Club (paid) |
|---|---|---|
| Pair a radio, mesh status | Yes | Yes |
| Live map with free USGS topo and aerial (downloaded on device) | Yes | Yes |
| Wind, sunrise and sunset, scent cone | Yes | Yes |
| Hunting party by QR code: map, chat, quick replies, direct messages | Yes, **max 3 people** | Yes; whole-club chat plus parties |
| Check in (see Ways to hunt) | At a spot or On the move; your party sees it | Also at a club stand or club area; open/occupied stands |
| Ask for a Hand | To your party | To the whole club |
| Overdue alert (sunset + grace time) | To your party | To the whole club and the board |
| Club property line, shared stands and areas | No | Yes |
| Roster, roles, invites, guest passes, reset club key | No | Yes |
| Clubhouse board | No | Yes |
| High-res offline map pack for the property | No | Yes |
| Log a harvest (private by default, optional share) | Yes; share with your party | Yes; share with the club |
| Harvest reports and season summaries | No | Yes |
| Club areas (named zones such as "North 40" or "Creek Bottom") | No | Yes |
| Safety warnings near occupied stands and hunters on the move | No | Later |

**MVP:** the full free version, plus club setup, stands and areas, check-in, the clubhouse board and Stripe checkout. Harvest reports and safety warnings come after the field test.

**Party limit:** the 3-person cap is enforced by the app (party QR codes stop being shown and the app refuses to join a full party). It is a soft limit: someone with a stock Meshtastic client and the key could still listen on the channel. That's acceptable.

**Out of scope for v1:** legal shooting hours, 911 or SOS calling over the mesh, trail-camera integration, marketplaces or social feeds, and custom radio firmware (stock Meshtastic firmware only).

## Ways to hunt

Check-in describes where you are hunting, not just which stand you're in. Every mode gets the same map, chat, Ask for a Hand and overdue alert.

| Mode | For | What others see | Positions |
|---|---|---|---|
| **At a stand** (club) | Tree stands, ladders, ground blinds on the club's stand list | Stand name; stand shows as occupied | Every 5 min, plus smart position on movement |
| **At a spot** | Sitting anywhere: a log, a field edge, a portable stand | "My spot" or a name you give it, pinned where you are | Every 5 min, plus smart position on movement |
| **On the move** | Still-hunting, stalking, walking the woods, drives | "On the move" on your live position; club area name if you're inside one | Every 2 min while moving, smart position |
| **In an area** (club) | Hunting a named club zone without a fixed spot | Area name; area shows how many hunters are in it | As On the move |

- A hunter can switch modes without checking out (for example, from a stand to On the move to track a deer).
- Club areas are optional polygons the admin draws; stands can sit inside areas.

## System architecture

Everything that matters in the field travels over the LoRa mesh, with no server involved. The cloud only handles clubs: setup, membership, billing and map packs. It runs only when a club phone or the board has internet. **No always-on compute:** every cloud piece is pay-per-use or a free tier.

```text
 Hunter phone ──BLE── Personal radio ═LoRa═╗
 Hunter phone ──BLE── Personal radio ═LoRa═╬═ Solar repeater (ROUTER, optional)
 Clubhouse board ─USB/BLE─ Board radio ═LoRa═╝
        ┆ club users only, only when online
        ├┄ Supabase (free plan): Postgres, auth, row-level security
        └┄ AWS
            ├─ S3 + CloudFront: web admin + checkout page, club map packs, DB backups
            ├─ Lambda (function URLs, no API Gateway): Stripe webhook, club
            │    provisioning, signed entitlements, map-pack builds, backups
            └─ EventBridge Scheduler: daily jobs (subscription expiry, keep-alive, backup)

 Free users ┄┄ USGS public tile servers (map downloads; no traffic to us)
```

**Components**

- **Hunter phone app** (iOS and Android). Talks to its paired radio over Bluetooth LE, stores everything locally first, and renders offline maps.
- **Personal radio.** Any Meshtastic-compatible LoRa device **with GPS**. Positions come from the radio's GPS, so the phone doesn't need to stay awake in a pocket. Recommended test hardware: a RAK WisBlock or Heltec board with GPS.
- **Solar repeater.** A Meshtastic node set to the ROUTER role, placed on high ground to cover the property.
- **Clubhouse board.** A wall tablet connected to its own radio. *Open decision:* Board mode in the app, or a separate web page using Web Serial (see Open decisions).
- **Supabase (free plan).** Club accounts, clubs, members, stands, subscriptions, club radio keys. Never required in the field.
- **AWS.** Static web admin page, Stripe webhook and other Lambda functions, map-pack hosting, scheduled jobs. Defined as code with AWS CDK (TypeScript). An AWS budget alarm at $5/month.

**Cost targets** (verify current free-tier limits before relying on them)

| Item | Expected cost at launch |
|---|---|
| Free users | ~$0 (no backend calls; maps from USGS) |
| Supabase | $0 (free plan) |
| Lambda, CloudFront, EventBridge | $0 within always-free tiers |
| S3 | Cents per month |
| Route 53 hosted zone + domain | ~$0.50/month + domain |
| Stripe | Per-sale fees only |
| Apple Developer / Google Play | $99/year / ~$25 one-time |

**Supabase free-plan caveats**

- Projects pause after about a week with no activity (the off-season). A daily EventBridge → Lambda ping keeps it active; confirm this is within Supabase's terms.
- No automatic backups on the free plan: a weekly Lambda runs `pg_dump` to S3.
- Watch the database size and bandwidth limits; map packs never go through Supabase.

**Suggested stack** (confirm current package names and versions before installing)

| Layer | Choice | Why |
|---|---|---|
| App | React Native with Expo (dev build), TypeScript | One codebase for iOS and Android |
| Bluetooth | react-native-ble-plx | Mature BLE library for the Meshtastic BLE service |
| Mesh protocol | Official Meshtastic TypeScript packages (protobufs, core) with a custom BLE transport | Wire compatibility with stock radios; no hand-written protocol code |
| Maps | MapLibre React Native with offline packs | Free, open source, works fully offline |
| Basemap data | USGS topo and imagery services (free); per-club PMTiles/MBTiles pack (Club) | Public domain in the US |
| Local data | SQLite (expo-sqlite) | Offline-first storage and queueing |
| Database + auth | Supabase free plan (Postgres, auth, RLS) | Clubs, members, entitlements |
| Cloud functions + hosting | AWS Lambda, S3, CloudFront, EventBridge via CDK | Pay-per-use, nothing always running |
| Payments | Stripe Checkout + webhooks on the web admin page | No app store cut; per-sale fees only |
| Sun and wind | Sunrise and sunset computed on device; wind from forecast when online, cached | Works offline after the morning sync |

## Clubs and subscriptions

**A club is rows in a shared database, never new infrastructure.** Every club-owned table carries `club_id`, and Postgres row-level security restricts members to their own club's rows. No database, schema or Supabase project per club.

**Setting up a club**

1. The admin opens the web admin page (S3 + CloudFront), signs in with Supabase auth and pays through **Stripe Checkout**.
2. Stripe calls a **webhook Lambda**. It verifies the Stripe signature and creates or updates the `clubs` and `subscriptions` rows (status and paid-through date). Webhooks are idempotent on the Stripe event ID.
3. The admin signs in to the app with the same account. The app creates the club's radio channel key, stores it in Supabase, and generates the Club QR code. The admin draws the property line and adds stands.
4. Members scan the Club QR code. That joins the mesh immediately, even offline. When online, the invite token in the QR code adds them to `club_members` and enforces the plan's member limit. Members sign in once to join a club.
5. **Club features work offline.** A Lambda signs an entitlement token (club ID, plan, expires at paid-through date + grace period). Phones and the board cache it and check the signature locally.

**When a subscription lapses:** status goes to `past_due`, then `canceled`. Club features freeze when the cached entitlement expires: no stand edits, no new invites, no board, no new map packs. The mesh, chat, Ask for a Hand and overdue alerts keep working. Club data is kept for [N] days so a club can renew without losing setup.

**Club radio keys** are stored in Supabase, readable only by that club's admins (RLS). They let admins reset the key and add other admins. This is deliberately low-security: the key only protects radio traffic, and an attacker would also need to be within radio range of the property.

**Cloud tables**

| Table | Key fields | Notes |
|---|---|---|
| clubs | id, name, acreage, boundary (GeoJSON), region, overdue grace minutes, created by | |
| club_secrets | club id, channel key, key version | Admins only |
| club_members | club id, user id, display name, initials, role (admin, member, guest), node ID, expires at | Guests expire |
| subscriptions | club id, Stripe customer ID, Stripe subscription ID, plan, status, paid through | Written only by the webhook Lambda |
| invites | id, club id, token, created by, expires at, uses | Enforces member limit |
| stands | id, club id, area id, name, type, lat, lon, notes, active, updated at | |
| areas | id, club id, name, boundary (GeoJSON), notes, active, updated at | Optional named zones |
| harvests | id, club id, member id, species, sex, lat, lon, stand or area id, notes, harvested at | Only harvests a member chose to share with the club; feeds reports |
| map_packs | id, club id, bounds, zoom range, source, S3 key, size, built at | |
| stripe_events | event ID, processed at | Webhook idempotency |

## Mesh protocol

Use stock Meshtastic channels, positions and text messages. Put the hunting-specific data in compact app messages on the private app port, which stock clients ignore. Bandwidth is tiny, so every message type has a size and rate budget.

**Channels and onboarding**

- **Free party:** the phone that starts the party generates a primary channel with a random 256-bit key, picks the region from GPS (US: 915 MHz) and a default modem preset (LongFast). The Party QR code shares it. Max 3 people.
- **Club:** the admin's phone generates the club's primary channel the same way, and the key is stored in Supabase. A hunting party inside a club is a secondary channel (Meshtastic supports up to 8 per radio).
- QR codes wrap a standard Meshtastic channel-set URL in the app's own deep link (`huntclub://join?...`), plus the party ID or the club ID and invite token. Scanning one configures the paired radio and joins in one step.
- **Reset club key:** the admin generates a new key and QR code. Old radios lose access.
- Hunters never see channels, keys, presets or regions. An Advanced screen exposes them for power users.

**Message types**

| Type | Meshtastic port | Sent when | Budget |
|---|---|---|---|
| Position | Position (stock, from radio GPS) | While checked in: every 5 min sitting, every 2 min on the move; smart position on movement | Stock size |
| Text | Text message (stock) | User sends | 200 characters max, enforced in UI |
| CheckIn | Private app port | Check in or change mode (stand, area, spot, on the move) | Under 40 bytes, request ack |
| CheckOut | Private app port | Check out | Under 40 bytes, request ack |
| HelpRequest | Private app port | Ask for a Hand | Under 60 bytes, request ack, retry until acked |
| HarvestShare | Private app port | Hunter chooses to share | Under 80 bytes |
| StandListVersion | Private app port | Admin edits stands or areas (club) | Version number only; full list syncs via cloud |
| OverdueAlert | Private app port | Board or phone detects overdue | Under 40 bytes |

**Rules**

- Encode app messages as small protobufs with: message ID, sender node ID, timestamp, mode, stand or area ID or pin location, and payload. De-duplicate on message ID.
- Show delivery state in the UI (for example, "Delivered to 5 of 6") using Meshtastic acks.
- Mark positions as stale in the UI: solid ring under 2 min, dashed between 2 and 10 min, faded after that.
- Keep the hop limit at the Meshtastic default (3) and avoid chatty updates. Airtime is shared by everyone in range.
- Prefer GPS or radio time over the phone clock for timestamps.

## Local data model (on the phone)

The phone's SQLite database is the source of truth in the field. For club users, the cloud tables above sync when online. IDs are UUIDs, and synced records carry `updated_at` for last-write-wins sync.

| Entity | Key fields | Notes |
|---|---|---|
| Group | id, kind (party or club), name, channel key, region, overdue grace minutes, entitlement token | Key never logged |
| Member | id, group id, display name, initials, role, node ID | From the party QR or club sync |
| Radio | node ID, member id, hardware model, battery, last heard, last SNR | Filled from Meshtastic node info |
| Stand | id, club id, area id, name, type (tree stand, ladder, ground blind), lat, lon, notes, active | Club only; names, not coordinates, in the UI |
| Area | id, club id, name, boundary, notes, active | Club only |
| CheckIn | id, member id, mode (stand, area, spot, moving), stand id, area id, pin lat/lon, pin name, checked in at, checked out at, overdue alert sent at | One open check-in per member; mode can change |
| Position | node ID, lat, lon, accuracy, received at | Last known only |
| Message | id, channel (club, party, direct), sender, body, sent at, delivered count | 200-character limit |
| HelpRequest | id, member id, lat, lon, created at, acknowledged by, resolved at | |
| Harvest | id, member id, species, sex, lat, lon, stand or area id, notes, photo (local), shared with (none, party, club), harvested at | Private unless shared |
| MapPack | id, bounds, zoom range, source, size, downloaded at | Free: USGS region; Club: the property pack |

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

The app has four tabs (Map, Chat, Check In, Party/Club) plus onboarding and the clubhouse board. Only the Map screen has an approved mockup. Build the other screens in the same style, using the content from Designs A–C on the canvas. Free users see the same screens with party content instead of club content.

**1. Map (approved: Design D)**

- Full-screen offline basemap; for clubs, the club boundary, acreage label and club areas. Water and road labels and a 500 ft scale bar.
- Top bar: party or club button beside one conditions panel showing Sunrise · Sunset, wind direction and speed with a "blowing toward" arrow, and temperature.
- Mesh status line: "Mesh: 3 radios · heard 12s ago". Tapping it opens radio details.
- Right-side controls: map layers, north-up, center on me.
- Hunter markers: initials in a circle with a freshness ring, plus the stand, spot or area name (or "On the move") and "2 min ago". Club open stands: icon by stand type plus "Open".
- Your marker: an orange dot with a pulse and a scent cone pointing downwind, labeled "Your scent".
- Bottom sheet when checked in: "Checked in at" plus the stand, spot or area name (or "On the move") and time since check-in; **Ask for a Hand** (gold outline, "Pings your party" / "Pings club members"); **Check Out** (orange); a "Change mode" control; a "Log a harvest · Private" row.
- Bottom sheet when not checked in: one large "Check In" button (club: nearest open stand suggested).
- No search bar on the map.

**2. Chat**

- Segmented control: Party and Direct (free); Whole Club, Hunting Party and Direct (club).
- Message bubbles with sender, stand/spot/area or "On the move", and time; system cards for check-ins, help requests and shared harvests.
- Quick replies: Coming to you, Seeing deer, All quiet, On my way out.
- Text field with a live 200-character limit and delivery status ("Delivered to 5 of 6").

**3. Check In**

- First choice, as large buttons: **Right here** (spot, with an optional name), **On the move**, and for clubs **At a stand** and **In an area**.
- Club stands: the nearest open stand by GPS highlighted at the top; full stand list where open stands are tappable and occupied ones show who is there.
- Club areas: list with how many hunters are in each; the area you're standing in is suggested.
- Note explaining the overdue alert: sunset plus the grace time.
- A large "Slide to check in" control to prevent pocket taps. Same pattern for Check Out.

**4. Party / Club**

- Free: party members (max 3) with radio status and battery; Party QR code; "Start a club" card linking to the web admin page.
- Club: search for stands, areas, members and pins (search lives here, not on the map); member list with radio status and battery; Club QR code to invite members (admins only).
- Settings: location sharing, text size, red-light night mode, Advanced radio settings.

**5. Onboarding**

1. Welcome, then pair a radio over Bluetooth (one tap, with a pairing-PIN helper).
2. Start a party, scan a Party QR code, or scan a Club QR code (club: sign in once).
3. Enter your name and initials.
4. Allow location, Bluetooth and notifications, with a plain-language reason for each.
5. Download the map for your area.
6. Land on the map.

**6. Clubhouse board (Club)**

- A landscape tablet showing the map and a large list of everyone out: stand, spot, area or On the move, and since when. Open stands listed separately.
- Overdue members highlighted, with a full-screen alert after sunset plus grace time.
- Runs unattended, keeps the screen awake and auto-recovers the radio connection.

**7. Web admin page (Club)**

- Sign in, buy or renew the club subscription (Stripe Checkout), manage billing (Stripe customer portal).
- Roster and roles, invite links, guest passes, stands and areas, harvest reports and season summaries, request a high-res map pack for the property.

## Safety, privacy and accessibility

The app helps hunters look out for each other; it is not an emergency service. All copy, store listings and marketing must say so, and nothing in the UI may imply a 911 call.

**Safety**

- Ask for a Hand sends a HelpRequest to your party or club with your current location (not just your stand or spot), and retries until at least one person acknowledges it.
- The overdue alert fires at sunset plus the grace time (club: admin-set; default 30 minutes). Never use legal shooting hours.
- If the mesh is down, say so plainly ("No radios heard for 15 min"); never show stale positions as live.
- Include a plain note in settings: for emergencies, call 911 from your phone if you have service.
- Safety features never depend on payment status or internet.

**Privacy**

- Your location is shared only while you're checked in, unless you change it in settings.
- Keep only last-known positions; no location history.
- Harvests are private by default; sharing (party or club) is a per-harvest choice.
- Free users have no account; nothing about them is stored on our servers.
- Mesh messages are encrypted with the party or club key. Never log keys or message bodies.

**Accessibility**

- Minimum 13 px text on the map and 16 px for body text; support the system text size up to 200%.
- 48 px minimum tap targets; slide-to-confirm for check-in and check-out.
- Every icon has a word label; screen-reader labels on all markers ("Creek Stand, Dale, updated 2 minutes ago").
- Text contrast of at least 4.5:1, including map labels with their halo.
- Red-light night mode for pre-dawn use.

## Pricing, stores and licensing

The app is free to download and free to use for individual hunters and parties of up to 3. Clubs buy a subscription on the web admin page. Radio kits are sold separately.

| Item | Price | Cost to us |
|---|---|---|
| Free app | $0 | ~$0 (no backend) |
| Club subscription | [YOUR PRICE]; model open (see Open decisions) | Stripe fees; no app store cut when sold on the web |
| Radio kit and solar repeater | [YOUR PRICE] | No app store cut on physical goods |
| Apple Developer Program | — | $99 per year |
| Google Play developer account | — | About $25 one-time (verify) |

- Apple's standard in-app cut is 30%, or 15% in the Small Business Program for developers under $1M a year ([Apple](https://developer.apple.com/app-store/small-business-program/), [Paddle summary](https://www.paddle.com/blog/app-store-fees)).
- Sell the club subscription on the web admin page. Check Apple's and Google's current rules on linking to outside payment before launch.
- **Licensing:** Meshtastic firmware is GPL-3.0. Before a closed-source release, confirm the licenses of the protobuf definitions and any Meshtastic client libraries the app uses.

## Open decisions

1. **Club pricing model:** flat price per club, or tiers by member count? Per season or per year?
2. **Club member limits** per plan, and whether hunting parties inside a club are capped.
3. **Clubhouse board:** Board mode in the app, or a separate web page using Web Serial.
4. **Lapsed clubs:** how many days to keep club data after cancellation ([N]).
5. **Open or closed source** (decides the GPL question above).

## Build plan

Build in this order. Each milestone ends with something you can test on real radios. You'll need two or three Meshtastic radios with GPS before Milestone 2.

1. **Project setup:** Expo dev build, TypeScript, theme tokens from the design system, tab navigation, SQLite.
2. **Radio link:** scan, pair and connect over BLE; read node info; send and receive text on the primary channel. Test: two phones text with no cell service.
3. **Free party:** start a party, Party QR code, scan to join (max 3), Advanced settings screen.
4. **Live map:** MapLibre with on-device USGS map download; positions on the map with freshness rings; mesh status line.
5. **Check-in (free):** At a spot and On the move modes, mode switching, slide to check in and out, CheckIn and CheckOut app messages with acks, bottom sheet states.
6. **Safety:** Ask for a Hand with retries and acks, overdue alert from sunset plus grace time, mesh-down warnings.
7. **Chat and harvests:** party and direct channels, quick replies, delivery status; log a harvest, share with the party. *The free version is complete here.*
8. **Cloud foundation:** Supabase schema and RLS, AWS CDK stack (S3, CloudFront, Lambda, EventBridge), budget alarm, keep-alive and backup jobs.
9. **Club subscriptions:** web admin page, Stripe Checkout and webhook, club provisioning, signed entitlements, invites and member limits.
10. **Club in the app:** club sign-in, club key storage and reset, stand and area sync, At a stand and In an area check-in, whole-club chat and alerts, harvest sharing to the club.
11. **Clubhouse board.**
12. **Club map packs:** build per-club PMTiles/MBTiles, host on S3 + CloudFront, download in the app.
13. **Harvest reports:** season summaries on the web admin page.
14. **Field test:** one real club for one weekend; log range, battery and confusion points.

Agent instructions live in `CLAUDE.md` at the repo root.
