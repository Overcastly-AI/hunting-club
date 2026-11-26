# Project status

Coordinator log. Updated by the coordinating session; read this first when resuming.

## Working agreements

- AWS changes are requested by email to the owner with a subject starting with `Grok Bot`. Grok Bot configures AWS.
- **Secrets (owner decision 2026-11-26):** project secrets live in AWS SSM Parameter Store as SecureString, standard tier, free (`/hunt-club-mesh/<env>/<name>`). Not Secrets Manager: it costs $0.40 per secret per month. They may be sent by email between the coordinator and Grok Bot; the owner accepts that and will rotate them later. Never put secrets in the repo, PRs, commit messages, logs or worker briefs; Lambdas read them from Parameter Store at runtime. Every secret that travels by email is listed under "Rotate later" below.
- Commit messages never credit Claude or other AI tools (enforced by `.githooks/commit-msg`).
- Stop and ask the owner before: spending money, open decisions in `docs/SPEC.md`, emails to anyone other than the owner, deleting anything.

## AWS environment (dev)

| Item | Value |
|---|---|
| AWS account | 054825383623 |
| Region | us-east-1 (everything, incl. CloudFront certs) |
| Dev domain | `huntclub-dev.jaycobjones.com` (parent `jaycobjones.com`, zone Z034387627ELT5Y50SBHP) |
| Dev hosted zone | Z041480814OY68TGPM84F |
| ACM certificate (ISSUED) | arn:aws:acm:us-east-1:054825383623:certificate/ece3d63e-c299-4106-b448-88b7bb3dcb48 (covers apex + `*.huntclub-dev.jaycobjones.com`) |
| Budget | `hunt-club-mesh-monthly`, $5/month, alerts 50/80/100% |
| Tags | Project=hunt-club-mesh, Env=dev |
| Deploys | Grok Bot runs `cdk deploy` from the repo when a request says "deploy" (after synth + diff checks) |
| Data layer owner | CloudFormation stack `HuntClubMeshDataDev`, built by Grok Bot at the owner's direction (06:32 UTC), Retain policies. **The CDK references these, never defines them.** |
| DynamoDB table | `hunt-club-mesh-dev` (arn:aws:dynamodb:us-east-1:054825383623:table/hunt-club-mesh-dev), PK/SK (S), GSI1 = GSI1PK/GSI1SK (ALL), on-demand, PITR off, deletion protection on, TTL `expiresAt` (Request #2) |
| Cognito user pool | `us-east-1_0W2YbjVht` (Essentials, email username, first factors PASSWORD + EMAIL_OTP; the app uses EMAIL_OTP only), default email sender (~50/day; SES later per owner) |
| Cognito app client | `5dn1jcrnef1v6cfv6da0i7qtne` (public, ALLOW_USER_AUTH + refresh); web client via Request #2 |

**Reading Grok Bot replies:** always open the full thread with `get_thread`. Search previews show stale message counts and miss replies.

## AWS requests (Grok Bot)

| # | Sent | Request | Status | Result |
|---|---|---|---|---|
| 2 | 2026-11-26 | Enable TTL `expiresAt` on the table; add web app client to the user pool | Sent 06:36 UTC | |
| 1 | 2026-11-26 | Dev subdomain: Route 53 hosted zone, delegation, ACM wildcard cert | **Done** 06:07 UTC (verified NS via public DNS) | See "AWS environment" below |

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
| HarvestSex single source + Stripe/Auth research | session_01QS5dr5ia6B5X5renWEXyAe | PR #8 | Merged 06:16 UTC |
| infra/: CDK stacks (web+CloudFront, webhook Lambda stub, ops schedules) | session_01QS5dr5ia6B5X5renWEXyAe | agent/m2-research | Started 06:15 UTC |
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

| Secret | Parameter name | Sent | Rotated |
|---|---|---|---|

## Database

- **Decision (coordinator, 2026-11-26): DynamoDB (on-demand, single table) + Cognito (email OTP), all in AWS.** Replaces Supabase: no free-project limit, no pausing, $0 on the always-free tier, managed by Grok Bot via CDK. Permissions move from Postgres RLS into the Lambda API (tested against DynamoDB Local). Grok Bot informed 06:24 UTC.
- The Postgres schema in `supabase/` (PR #5) is superseded: its RLS test cases are ported to API permission tests, then `supabase/` and `database.yml` are removed. `@huntclub/shared` becomes hand-written schemas (single source for StandType, HarvestSex, etc.), no longer generated from SQL.

### Supabase (history)

- **Owner rule (2026-11-26): the coordinator makes database decisions and proceeds without asking.**
- Org "Grok Bot" (dtbdseniylkmipccqskx), free plan. Project `desk` (jvanxotplnwddodwxxcx) belongs to the owner's trading desk: it must stay. **Never modify, pause or delete desk's existing schemas, tables, functions, auth settings or API settings.**
- Plan (coordinator decision): run the hunt club database side by side inside the `desk` project in its own isolated schema `huntclub` (no changes to desk's `public`/`private` objects), until a dedicated free project is available; then move it with pg_dump of that schema. First step: read-only inventory of desk's schemas for name clashes (blocked 06:22 UTC by Supabase API "Bad Gateway"; retry).
- Creating `hunt-club-mesh-dev` (us-east-1) failed: the owner is at the 2-active-free-projects limit; the other project is in an org this connection can't see. Waiting for the owner to pause/delete that one. Until then the schema is tested against local Postgres in CI; not blocking before M8–M10.

## Owner to-dos (non-blocking)


- **Open or closed source (needed before the app ships):** Meshtastic protobufs are GPL-3.0 with no app exception. Closed-source app + bundled protobufs conflicts with the license; open-sourcing the app (GPL-3.0) resolves it and the cloud can stay proprietary.
- Optional: allow running `meshtasticd --sim` in the agent environment (blocked by sandbox policy) so agents can test against a simulated radio.

- Set the GitHub default branch to `main` (repo Settings → Branches).
- Open decisions listed in `docs/SPEC.md`.
- Real-radio testing when milestones 2+ land (agents can't reach hardware).
