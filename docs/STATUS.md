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
- Workers: separate cloud sessions, at most 2–3 at a time, one task each, branch `agent/<task>`, PR into `main`. Playbook: `docs/AGENTS.md`.
- Daily status email to the owner around 13:00 UTC, subject starting "Hunt Club Mesh status" (never "Grok Bot", which is reserved for AWS requests).
- Commits authored as `Overcastly-AI <282247350+Overcastly-AI@users.noreply.github.com>`.

## Workers

| Task | Session | Branch / PR | Status |
|---|---|---|---|
| M1: app project setup | session_01QS5dr4qFtLFfyf7oVjMNAj | agent/m1-scaffold | Started 2026-11-26 05:34 UTC |
| M2 research: Meshtastic link + simulator | session_01QS5dr5ia6B5X5renWEXyAe | PR #1 | Merged 2026-11-26 05:42 UTC |
| M2 part 1: packages/mesh client + FakeTransport | session_01QS5dr5jAZ6wC472f8hsUHW | agent/m2-mesh-client | Started 2026-11-26 05:42 UTC |

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-11-26 | Own thin Meshtastic client on `@meshtastic/protobufs`; no `@meshtastic/core` | Core removed upstream; needs heavy polyfills |
| 2026-11-26 | `react-native-ble-manager` 13.x instead of ble-plx | ble-plx legacy-bridge only, rewrite stalled |
| 2026-11-26 | Private port 314 + app-level receipts | Broadcast acks only prove one neighbour heard |
| 2026-11-26 | Android foreground service as a small in-repo Expo module | No library provides it; avoids a dependency |

## Owner to-dos (non-blocking)

- **Open or closed source (needed before the app ships):** Meshtastic protobufs are GPL-3.0 with no app exception. Closed-source app + bundled protobufs conflicts with the license; open-sourcing the app (GPL-3.0) resolves it and the cloud can stay proprietary.
- Optional: allow running `meshtasticd --sim` in the agent environment (blocked by sandbox policy) so agents can test against a simulated radio.

- Set the GitHub default branch to `main` (repo Settings → Branches).
- Open decisions listed in `docs/SPEC.md`.
- Real-radio testing when milestones 2+ land (agents can't reach hardware).
