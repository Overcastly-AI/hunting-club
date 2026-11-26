# Project status

Coordinator log. Updated by the coordinating session; read this first when resuming.

## Working agreements

- AWS changes are requested by email to the owner with a subject starting with `Grok Bot`. Grok Bot configures AWS. Never send credentials by email.
- Commit messages never credit Claude or other AI tools (enforced by `.githooks/commit-msg`).
- Stop and ask the owner before: spending money, open decisions in `docs/SPEC.md`, emails to anyone other than the owner, deleting anything.

## AWS requests (Grok Bot)

| # | Sent | Request | Status | Result |
|---|---|---|---|---|
| 1 | 2026-11-26 | Dev subdomain `huntclub-dev.<domain>`: Route 53 hosted zone, delegation from parent, ACM wildcard cert in us-east-1 | Waiting for reply (Grok Bot checks email every 30 min) | |

## How the project runs

- The owner delegated full control to the coordinator (2026-11-26). Hard limits that still need the owner: spending money beyond free tiers and the dev DNS zone, deleting the owner's data, emails to anyone but the owner.
- Coordinator session: `session_01QS5dr3XTYjo26Gf4MeA3GC`. Wakes hourly at :34 via scheduled task `trig_01SRzKhjqQDZWWfR6krcCifn`: checks Grok Bot email, workers and PRs; reviews and merges; starts the next tasks.
- **Never leave a worker idle (owner rule):** the moment a worker finishes or stops, give it the next task (reuse the idle session) or start a new one. Timed wake-ups are only a backup; worker messages are the main signal.
- Workers: separate cloud sessions, up to ~5 at a time on non-overlapping files, one task each, branch `agent/<task>`, PR into `main`. Playbook: `docs/AGENTS.md`.
- Daily status email to the owner around 13:00 UTC, subject starting "Hunt Club Mesh status" (never "Grok Bot", which is reserved for AWS requests).
- Commits authored as `Overcastly-AI <282247350+Overcastly-AI@users.noreply.github.com>`.

## Workers

| Task | Session | Branch / PR | Status |
|---|---|---|---|
| M1: app project setup | session_01QS5dr4qFtLFfyf7oVjMNAj | PR #2 | Merged 2026-11-26 05:50 UTC |
| M2 research: Meshtastic link + simulator | session_01QS5dr5ia6B5X5renWEXyAe | PR #1 | Merged 2026-11-26 05:42 UTC |
| M2 part 1: packages/mesh client + FakeTransport | session_01QS5dr5jAZ6wC472f8hsUHW | PR #4 | In review: DRY pass + exports for BLE worker |
| M2 part 2: BLE transport, permissions, Android foreground service, pairing screen | session_01QS5dr7YPxgw1iqGybujET3 | agent/m2-ble-transport | Started 2026-11-26 05:51 UTC (depends on mesh client) |
| M4: offline map (MapLibre + USGS), Design D overlays and markers | session_01QS5dr3kB1sf3Bt86wVb3qW | agent/m4-offline-map | Started 2026-11-26 05:51 UTC |
| CI Android native build + Archivo variable font + minSdk 26 | session_01QS5dr4qFtLFfyf7oVjMNAj (reused) | PR #3 | Approved; waiting on first Android CI build |
| M8: Supabase schema, RLS, invite RPC, tests, packages/shared types | session_01QS5dr5ia6B5X5renWEXyAe (reused) | agent/m8-supabase-schema | Started 2026-11-26 05:55 UTC |

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-11-26 | Own thin Meshtastic client on `@meshtastic/protobufs`; no `@meshtastic/core` | Core removed upstream; needs heavy polyfills |
| 2026-11-26 | `react-native-ble-manager` 13.x instead of ble-plx | ble-plx legacy-bridge only, rewrite stalled |
| 2026-11-26 | Private port 314 + app-level receipts | Broadcast acks only prove one neighbour heard |
| 2026-11-26 | App IDs `com.overcastly.huntclub` (iOS and Android) | Owner's GitHub org; hard to change after store upload |
| 2026-11-26 | DRY with no shortcuts (owner rule) | One source of truth; shared code in `packages/` |
| 2026-11-26 | Android foreground service as a small in-repo Expo module | No library provides it; avoids a dependency |

## Backlog (coordinator)

- After mesh client merges: app DB migrations (TS strings) should interpolate check-in modes, `MAX_TEXT_CHARS` and other constants from `@huntclub/mesh` instead of literals (DRY).
- Tab icon set (dependency choice).
- `messages` table needs recipient/group column before chat (M7).

## Owner to-dos (non-blocking)

- **Open or closed source (needed before the app ships):** Meshtastic protobufs are GPL-3.0 with no app exception. Closed-source app + bundled protobufs conflicts with the license; open-sourcing the app (GPL-3.0) resolves it and the cloud can stay proprietary.
- Optional: allow running `meshtasticd --sim` in the agent environment (blocked by sandbox policy) so agents can test against a simulated radio.

- Set the GitHub default branch to `main` (repo Settings → Branches).
- Open decisions listed in `docs/SPEC.md`.
- Real-radio testing when milestones 2+ land (agents can't reach hardware).
