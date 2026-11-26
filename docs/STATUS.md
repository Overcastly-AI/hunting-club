# Project status

Coordinator log. Updated by the coordinating session; read this first when resuming.

## Working agreements

- AWS changes are requested by email to the owner with a subject starting with `Grok Bot`. Grok Bot configures AWS.
- **Secrets (owner decision 2026-11-26):** project secrets live in AWS Secrets Manager (`hunt-club-mesh/<env>/<name>`). They may be sent by email between the coordinator and Grok Bot; the owner accepts that and will rotate them later. Never put secrets in the repo, PRs, commit messages, logs or worker briefs; Lambdas read them from Secrets Manager at runtime. Every secret that travels by email is listed under "Rotate later" below.
- Commit messages never credit Claude or other AI tools (enforced by `.githooks/commit-msg`).
- Stop and ask the owner before: spending money, open decisions in `docs/SPEC.md`, emails to anyone other than the owner, deleting anything.

## AWS requests (Grok Bot)

| # | Sent | Request | Status | Result |
|---|---|---|---|---|
| 1 | 2026-11-26 | Dev subdomain `huntclub-dev.<domain>`: Route 53 hosted zone, delegation from parent, ACM wildcard cert in us-east-1 | Waiting for reply (Grok Bot checks email every 30 min) | |

## How the project runs

- The owner delegated full control to the coordinator (2026-11-26). Hard limits that still need the owner: spending money beyond free tiers and the dev DNS zone, deleting the owner's data, emails to anyone but the owner.
- Coordinator session: `session_01QS5dr3XTYjo26Gf4MeA3GC`. Wakes hourly at :34 via scheduled task `trig_01SRzKhjqQDZWWfR6krcCifn`: checks Grok Bot email, workers and PRs; reviews and merges; starts the next tasks.
- Worker sessions can only push to the branch they were created with. Reuse a session for a new task only on that same branch (reset to main after its PR merges); otherwise start a new session.
- **Never leave a worker idle (owner rule):** the moment a worker finishes or stops, give it the next task (reuse the idle session) or start a new one. Timed wake-ups are only a backup; worker messages are the main signal.
- Workers: separate cloud sessions, up to ~5 at a time on non-overlapping files, one task each, branch `agent/<task>`, PR into `main`. Playbook: `docs/AGENTS.md`.
- Daily status email to the owner around 13:00 UTC, subject starting "Hunt Club Mesh status" (never "Grok Bot", which is reserved for AWS requests).
- Commits authored as `Overcastly-AI <282247350+Overcastly-AI@users.noreply.github.com>`.

## Workers

| Task | Session | Branch / PR | Status |
|---|---|---|---|
| M1: app project setup | session_01QS5dr4qFtLFfyf7oVjMNAj | PR #2 | Merged |
| M2 research | session_01QS5dr5ia6B5X5renWEXyAe | PR #1 | Merged |
| M2 part 1: packages/mesh | session_01QS5dr5jAZ6wC472f8hsUHW | PR #4 | Merged 06:08 UTC |
| CI Android build + Archivo variable font + minSdk 26 | session_01QS5dr4qFtLFfyf7oVjMNAj | PR #3 | Approved; waiting on first Android CI build |
| M8: Supabase schema, RLS, invite RPC, packages/shared | session_01QS5dr5ia6B5X5renWEXyAe | PR #5 | Approved, CI green; resolving lockfile conflict |
| M4: offline map | session_01QS5dr3kB1sf3Bt86wVb3qW | PR #6 | Approved; moving config to app.config.ts after #3 |
| M2 part 2: BLE transport, pairing, Android service | session_01QS5dr7YPxgw1iqGybujET3 | PR #7 (draft) | Switching to @huntclub/mesh imports; then app.config.ts after #3 |
| Weather: NWS wind/temperature, offline cache | session_01QS5dr7o9U9xBRJaR86iMuW | agent/weather | Started 06:10 UTC (builds on #6) |
| Research: Stripe + Supabase Auth + webhook Lambda | session_01QS5dr5ia6B5X5renWEXyAe | agent/m2-research | Started 06:08 UTC (after #5 conflict) |
| packages/core: check-in, overdue, help retries, receipts, party cap | session_01QS5dr5jAZ6wC472f8hsUHW | agent/m2-mesh-client (new PR) | Started 06:09 UTC |

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

- After #4 and #5: HarvestSex single source = SQL enum → @huntclub/shared → mesh derives wire codes (assigned to the schema worker).
- After #6: move sunrise/sunset and freshness thresholds from app/src/map into packages/core if core needs them (DRY).

- After mesh client merges: app DB migrations (TS strings) should interpolate check-in modes, `MAX_TEXT_CHARS` and other constants from `@huntclub/mesh` instead of literals (DRY).
- Tab icon set (dependency choice).
- `messages` table needs recipient/group column before chat (M7).

## Rotate later (secrets that travelled by email)

| Secret | Secrets Manager name | Sent | Rotated |
|---|---|---|---|

## Owner to-dos (non-blocking)

- **Open or closed source (needed before the app ships):** Meshtastic protobufs are GPL-3.0 with no app exception. Closed-source app + bundled protobufs conflicts with the license; open-sourcing the app (GPL-3.0) resolves it and the cloud can stay proprietary.
- Optional: allow running `meshtasticd --sim` in the agent environment (blocked by sandbox policy) so agents can test against a simulated radio.

- Set the GitHub default branch to `main` (repo Settings → Branches).
- Open decisions listed in `docs/SPEC.md`.
- Real-radio testing when milestones 2+ land (agents can't reach hardware).
