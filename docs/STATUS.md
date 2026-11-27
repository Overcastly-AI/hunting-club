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
| Cognito app client | `5dn1jcrnef1v6cfv6da0i7qtne` (public, ALLOW_USER_AUTH + refresh) |
| Cognito web client | `6mpfpr6nrdqddim7trfqckegu5` (`hunt-club-mesh-dev-web`, no hosted UI) |

**Reading Grok Bot replies:** always open the full thread with `get_thread`. Search previews show stale message counts and miss replies.

## AWS requests (Grok Bot)

| # | Sent | Request | Status | Result |
|---|---|---|---|---|
| 11 | 2026-11-26 19:10 | Cognito AuthSessionValidity 3 → 10 min on both clients (codes arrive in 8–11 s; hunters on weak signal) | **Done** 19:41 UTC: AuthSessionValidity 3 → 10 min on both clients = EMAIL_OTP code lifetime (API flow). Template updated | Copy update in club-data PR A |
| 10 | 2026-11-26 18:10 | Owner rule: long-lived sign-in for hunters out of service. App client refresh token 365 d, web client 30 d (access 60 min unchanged, revocation on) | **Done** 18:36 UTC: app client refresh 365 d, web 30 d, access/ID 1 h, revocation on; Grok Bot's HuntClubMeshDataDev template updated. Existing tokens keep 30 d until next sign-in | |
| 9 | 2026-11-26 17:08 | Seed dev "UAT Test Club" (seed:dev) for jonesjaycob+uitest@gmail.com once that user exists | BLOCKED 18:09 UTC: +uitest CONFIRMED but seed failed `Invalid UUID` (z.uuid rejects Cognito subs without RFC variant bits) — fix PR #59 merged; **Done 19:04 UTC**: UAT Test Club 04f40d22-a9c5-4c23-864b-13c69df41aef (admin +uitest), area North Timber, stands Creek Bottom / South Field Blind / Ridge Ladder, entitlement to 2027-02-24. Earlier: WAITING: +uitest not yet signed up (UAT signed up +huntclubuat at 17:39 UTC; returning sign-in blocked by 8-digit code bug) | |
| 8 | 2026-11-26 16:37 | UAT blocker: Cognito sign-in emails don't arrive. Diagnose; SES domain identity huntclub-dev.jaycobjones.com (DKIM, MAIL FROM, DMARC p=none), pool EmailConfiguration → SES DEVELOPER, verify test recipients (sandbox), AutoVerifiedAttributes email | **NEEDS OWNER APPROVAL** 16:40 UTC (SES not yet an approved service). Diagnosis: pool has 0 users; client never called SignUp because PreventUserExistenceErrors hides unknown users (fix PR #51); pool on COGNITO_DEFAULT, which can't deliver EMAIL_OTP; Essentials plan (free ≤10k MAU) | **Owner approved 16:49 UTC** (SES now an approved service for dev; stay in sandbox). Client fix #51 merged. **Done 17:00 UTC (partly):** SES domain identity huntclub-dev.jaycobjones.com DKIM SUCCESS, MAIL FROM mail.huntclub-dev…, DMARC p=none; pool EmailConfiguration → DEVELOPER from no-reply@huntclub-dev.jaycobjones.com; test email delivered. Both SES test recipients verified 17:04 UTC. |
| 7 | 2026-11-26 16:12 | Fix OIDC trust: Deploy dev run 45855450992 (owner, 16:05) failed at AWS credentials with `Not authorized to perform sts:AssumeRoleWithWebIdentity` (env + variable OK; role ARN correct). Find the token's sub/aud in CloudTrail, match the trust policy (still this repo + dev env only) | **Done** 16:09 UTC: GitHub uses a customised OIDC sub with IDs; trust sub now `repo:Overcastly-AI@282247350/hunting-club@1472690296:environment:dev`, aud sts.amazonaws.com | **Deploy dev works:** run 45855450992 attempt 2 succeeded 16:12 UTC (OIDC ok). Future deploys: Actions → Deploy dev |
| 6 | 2026-11-26 15:37 | Redeploy dev from CloudShell at main c5685ed (#46 club API init fix, #41 map pack builder, #44, #45) | **Done** 15:54 UTC (code = main 09d833c): both stacks UPDATE_COMPLETE; MapPackBuilder Lambda added (no reserved/provisioned concurrency, 900 s, logs 14 d); GET ClubApiUrl 404 (was 502) — club API healthy. Note: repo default branch is `claude/amazing-newton-q7bbpo`, should be `main` (owner to change). | Expect GET ClubApiUrl no longer 502 |
| 5 | 2026-11-26 14:47 | GitHub: `dev` environment (main only), repo var `AWS_DEPLOY_ROLE_ARN`, run Actions → Deploy dev (skip the run if the CloudShell deploy already went). Owner requested | **Blocked** 15:06 UTC: Grok Bot's GitHub tools can't create environments or variables; step 3 skipped (CloudShell deploy done). Owner created `dev` env + `AWS_DEPLOY_ROLE_ARN` (15:45 UTC, unverified). Workflow not yet run: coordinator's GitHub token gets 403 on workflow dispatch; owner couldn't start it either. | Expect run URL + ClubApiUrl, StripeWebhookUrl |
| 4 | 2026-11-26 14:45 | GitHub OIDC provider + role `hunt-club-mesh-github-deploy-dev` (trust repo:Overcastly-AI/hunting-club:environment:dev; may only assume the 4 cdk-hnb659fds roles). **Owner approved ("Yes GitHub")** | **Done** 14:45 UTC: role `arn:aws:iam::054825383623:role/hunt-club-mesh-github-deploy-dev`, OIDC provider `arn:aws:iam::054825383623:oidc-provider/token.actions.githubusercontent.com`, inline policy AssumeCdkBootstrapRoles, 1 h session. Grok Bot also trying the Request #3 deploy from CloudShell at the owner's request (result pending in #3 thread). | Then owner: GitHub `dev` environment + repo var `AWS_DEPLOY_ROLE_ARN`, run Actions → Deploy dev |
| 3 | 2026-11-26 | First CDK deploy: bootstrap + HuntClub-dev-Web + HuntClub-dev-Api (no Stripe yet) | **Done** 14:59 UTC from CloudShell (commit a404fd8). Site https://huntclub-dev.jaycobjones.com 200. ClubApiUrl `https://cmiavlwk3hqfou64bhxdbinhvm0rkxuj.lambda-url.us-east-1.on.aws/` (was 502: ESM bundle `Dynamic require of fs`; fix PR #46), StripeWebhookUrl `https://ehbje6gqn4puhaukhpcke7drja0rajrt.lambda-url.us-east-1.on.aws/`, CloudFront E3BU22QW9C8JW8 (d1be7otts0728y.cloudfront.net). Logs 14 d, tags ok, no provisioned concurrency. | Redeploy after #46 merges |
| 2 | 2026-11-26 | Enable TTL `expiresAt` on the table; add web app client to the user pool | **Done** 06:37 UTC | TTL enabled; web client `6mpfpr6nrdqddim7trfqckegu5` |
| 1 | 2026-11-26 | Dev subdomain: Route 53 hosted zone, delegation, ACM wildcard cert | **Done** 06:07 UTC (verified NS via public DNS) | See "AWS environment" below |

## How the project runs

- **Usage limit (2026-11-26):** 7 workers + coordinator hit the plan's 5-hour usage limit at ~06:55 UTC; everything stopped until the 09:30 reset. Run at most 3 workers at a time, prioritise merges, and keep worker messages short. Hit again at 11:41 UTC with 3 workers (reset 14:30). **Now at most 2 workers** (club-data on #41, onboarding on M12 app side); web worker paused with M13 + map-packs admin pushed to agent/m2-research.

- The owner delegated full control to the coordinator (2026-11-26). Hard limits that still need the owner: spending money beyond free tiers and the dev DNS zone, deleting the owner's data, emails to anyone but the owner.
- Coordinator session: `session_01QS5dr3XTYjo26Gf4MeA3GC`. Wakes hourly at :34 via scheduled task `trig_01SRzKhjqQDZWWfR6krcCifn`: checks Grok Bot email, workers and PRs; reviews and merges; starts the next tasks.
- Worker sessions can only push to the branch they were created with. Reuse a session for a new task only on that same branch (reset to main after its PR merges); otherwise start a new session.
- **Never leave a worker idle (owner rule):** the moment a worker finishes or stops, give it the next task (reuse the idle session) or start a new one. Timed wake-ups are only a backup; worker messages are the main signal.
- Workers: separate cloud sessions, up to ~5 at a time on non-overlapping files, one task each, branch `agent/<task>`, PR into `main`. Playbook: `docs/AGENTS.md`.
- **Email is checked every 30 minutes** (owner rule): hourly check-in at :34 (`trig_01SRzKhjqQDZWWfR6krcCifn`) plus an email check at :04 (`trig_01RboB5HqcNxpdXgKpAZU6YK`), both opening every thread in full.
- Daily status email to the owner around 13:00 UTC, subject starting "Hunt Club Mesh status" (never "Grok Bot", which is reserved for AWS requests). Last sent: 2026-11-26 14:40 UTC (late: usage limit).
- Commits authored as `Overcastly-AI <282247350+Overcastly-AI@users.noreply.github.com>`.

## Workers

| Task | Session | Branch / PR | Status |
|---|---|---|---|
| Merged | — | #1–#15, #17–#30, #32 | **Free version feature-complete in code** (onboarding done); club backend + app club layer done |
| Chat history persistence + app bundle size | session_01QS5dr7YPxgw1iqGybujET3 | agent/m2-ble-transport | Active |
| Club on radio #33; then parties inside a club (secondary channel) | session_01QS5dr3GmkJjvaYfcNrAN3b | agent/club-data | Active |
| Weather worker | session_01QS5dr7o9U9xBRJaR86iMuW | agent/weather | Paused (#10, #27 merged) |
| Map worker | session_01QS5dr3kB1sf3Bt86wVb3qW | agent/m4-offline-map | Paused (usage cap) |
| CI/font/board worker | session_01QS5dr4qFtLFfyf7oVjMNAj | agent/m1-scaffold | Paused |
| Web admin page + packages/design #31 (switching to shared client) | session_01QS5dr5ia6B5X5renWEXyAe | agent/m2-research | Active |
| Mesh-sim CI #16 | session_01QS5dr5jAZ6wC472f8hsUHW | PR #16 | Paused; first real meshtasticd run failed (non-blocking) |

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-11-26 | Own thin Meshtastic client on `@meshtastic/protobufs`; no `@meshtastic/core` | Core removed upstream; needs heavy polyfills |
| 2026-11-26 | `react-native-ble-manager` 13.x instead of ble-plx | ble-plx legacy-bridge only, rewrite stalled |
| 2026-11-26 | Private port 314 + app-level receipts | Broadcast acks only prove one neighbour heard |
| 2026-11-26 | App IDs `com.overcastly.huntclub` (iOS and Android) | Owner's GitHub org; hard to change after store upload |
| 2026-11-26 | DRY with no shortcuts (owner rule) | One source of truth; shared code in `packages/` |
| 2026-11-26 | Android foreground service as a small in-repo Expo module | No library provides it; avoids a dependency |
| 2026-11-26 | Map packs (#41): deps `@aws-sdk/client-lambda`, `@aws-sdk/client-s3` (runtime-provided) and `pmtiles` (devDep, tests) approved | Builder Lambda needs them; no runtime cost |
| 2026-11-26 | `@resvg/resvg-js` (exact pin) as devDependency of `@huntclub/design` only, to render app icons/splash from the token logo mark | No SVG rasterizer in repo; build-time only, never in app/web bundles |
| 2026-11-26 | App stays signed in for 365 days (refresh token); web admin 30 days. Offline never signs anyone out: only an expired/revoked refresh token or explicit sign-out does. Field and club features (cached clubs, keys, stands, mesh) never need a token | Owner: hunters are out of service for long stretches |
| 2026-11-26 | Club pricing (owner, via UI Director email): $10/month or $100/year per club, yearly default "(2 months free)", 14-day free trial on both. Member limit, card-up-front, refunds, data-retention days still TBD. Stripe setup still on hold (owner) | Owner decision |
| 2026-11-26 | Public marketing site: separate `site/` package, react-dom/server prerender (no new deps), admin moves to `/app/`, real 404s, registry = single source for nav/sitemap/meta/CloudFront allowlist. No analytics vendor without owner approval (zero-cost CloudFront logs default). Invite preview endpoint deferred | Brief from UI Director 2026-11-26 |
| 2026-11-26 | Map packs public on CloudFront at unguessable UUID URLs | Public-domain USGS tiles; signed URLs not worth the cost yet |
| 2026-11-26 | Map pack builds: status building/ready/failed, one in flight per club, builder concurrency 1, tile cap derived from rate × timeout | Stay gentle with USGS and inside the 900 s Lambda limit |

## Backlog (coordinator)

- Done: radio name (#32, #37), zod locale shim (#34, −243 KB), a11y pass (#39), deploy-dev workflow (#40, waits on owner deploy-path decision).
- Done: #42 sim CI fixed (firmware 2 s text limit; app now spaces texts), #16 closed. Screenshots skipped (needs react-native-web; not approved).
- Done: #41 map packs backend (global + per-club TTL locks instead of reserved concurrency, which new accounts can't spare), #43 harvest reports (M13).
- Active (2-worker cap): onboarding worker = M12 app side; web worker = map-packs admin PR. Paused: club-data, mesh, map, CI/board, weather.
- Done: #44 web map-packs admin, #45 app club map packs (M12 complete in code; device check of pmtiles://file:// in field-test plan), #46 Lambda ESM require fix + dev clubApiUrl.
- 17:23 UTC: first automatic Deploy dev (run 45866729496, #56) succeeded with smoke. Merged since 16:30: #47 DRY, #48 smoke + webhook 400, #49 TestFlight, #50 dev seed, #51 SignUp-first, #52 site 404/SPA, #53 web UI review fixes, #54 app icons, #55 legal drafts, #56 auto-deploy, #57 app legal screens.
- 18:35 UTC: web worker = marketing site Phase 1 (site/, /app move, pages, /join, OG); club-data worker = CLUB_PRICING + monthly/yearly + 14-day trial in Billing. #58 UAT retest fixes merged; #59 user-id fix open.
- All workers paused 15:15 UTC (remaining work waits on owner: GitHub dev env/variable, Stripe, Apple Team ID/Android fingerprints, field test).
- Was in progress: M12 app side (onboarding worker); map packs #41 backend → app (club-data); #41 review then web Map packs admin (web).

- After #4 and #5: HarvestSex single source = SQL enum → @huntclub/shared → mesh derives wire codes (assigned to the schema worker).
- After #6: move sunrise/sunset and freshness thresholds from app/src/map into packages/core if core needs them (DRY).

- After mesh client merges: app DB migrations (TS strings) should interpolate check-in modes, `MAX_TEXT_CHARS` and other constants from `@huntclub/mesh` instead of literals (DRY).
- Tab icon set (dependency choice).
- `messages` table needs recipient/group column before chat (M7).

## UAT and UI review (Grok Bot)

Owner rule (2026-11-26): Grok Bot runs UAT and reviews UI decisions by email. Every finding is logged here and answered in its thread.

| Date | Thread / subject | Finding | Decision | PR |
|---|---|---|---|---|
| 2026-11-27 | Owner | Rejected SaaS-kit look, then First Light / Tag Board; asked for onX-style research | frontend-design skill added (#84); map-first direction approved (docs/DESIGN.md) | #84 |
| 2026-11-27 | Redesign | Map-first built: logic #85, tokens #86, app #87, admin #88, site #89; all deployed to dev (run 31, smoke green); Grok asked to review | Done | #85–#89 |
| 2026-11-27 | Open (owner) | Dawn scene unused after redesign: delete or reuse? How to see the app on a phone (TestFlight $99 or Android)? | Waiting on owner | — |
| 2026-11-26 | UAT retest 23:03 (deploy 0971fd7) | 0 Blocker/Major; all fix-note items, public pages, headers, dawn, admin pass | Closed | #64–#77 |
| 2026-11-26 | UAT 23:03 | MINOR invite page doesn't name club; POLISH /join no/invalid invite | Accepted: club name in invite fragment (shared encodeJoinUrl, textContent), invalid-invite state | #80 |
| 2026-11-26 | UAT 23:03 | MINOR dawn SVG console errors (ridge Q) | Accepted: ridge() fix + path-parse test (no art change) | #80 |
| 2026-11-26 | UAT 23:03 | MINOR pause button touches hero CTA at 400px; POLISH /pricing desktop gap | Accepted | #80 |
| 2026-11-26 | UAT 23:03 | POLISH admin nav at 400px; sign-out shows expired + keeps hash | Redesign P2 (shell, account menu) | — |
| 2026-11-26 | UAT 23:03 | Q: theme toggle; web stand/area/harvest editing; invite revoke | Toggle in P2; editing = owner question; revoke in P3b | — |
| 2026-11-26 | Redesign progress | P1a tokens #77, P5a app theme #78, P5b app components #79 merged; P1b kit, P5c in progress | — | #77–#79 |
| 2026-11-26 | UI redesign 22:03 (owner: "UI is trash") | Full admin + app redesign: tokens (dark + light), primitives/_kit, shell (sidebar/rail/tabs), page rebuilds, polish, Expo restyle. Brief: docs/UI_REDESIGN.md (P1a) | Accepted, phased P1a→P5. Pushback: 48px min (no 40px sm), sign-in keeps dawn scene, no Crosshair icon, map colours unchanged. First deploy (P1+P2) by 2026-11-28 | P1a in progress |
| 2026-11-26 | UI 21:59 (nav cue, billing dates, focus ring, tables, code copy) | Admin polish | Superseded by redesign (P2/P3) | — |
| 2026-11-26 | Site 22:00 (CSP smoke, trial CTA, 404 shell, contrast, /download beta, pricing cards, phone header, claims) | Public site | Accepted; worker auditing and fixing | ui-review-notes-2200 |
| 2026-11-26 | Owner | Dawn scene background on home and sign-in | Shipped; deer + ridge path fixes deferred | #74 |
| 2026-11-26 | UI review 19:41 (signed-in, seeded club) | Roster copy, Signed in as, focus ring, nav <640px, Stands headings, Harvests export hint | Accepted | club-data PR A |
| 2026-11-26 | UI review 19:41 | Billing plan/price/dates/grace + Manage subscription (portal); My club summary; map-pack estimate without property line; wider tables; email until display name | Accepted | club-data PR B |
| 2026-11-26 | UI review 19:41 | Unknown hash routes; aria-current | Already fixed | #66 |
| 2026-11-26 | UI review 19:41 | Stands-per-area view; display-name prompt | Deferred (backlog) | — |
| 2026-11-26 | UI review 18:38 (run 2) | Reload logout; no-club errors | Already fixed | #58 |
| 2026-11-26 | UI review 18:38 | Billing no-club plans; Create club validation; unknown hash → 404; Back to the app; aria-current; Harvests copy; sending hint | Accepted | club-data PR (queued) |
| 2026-11-26 | UI review 18:38 | Real 404 status | In PR | #63 |
| 2026-11-26 | UI review 18:38 | Code expiry 3 min too short | Accepted: Request #11 (10 min) | — |
| 2026-11-26 | UI review 18:38 | Draft label must not ship to prod | Launch checklist (owner approval) | — |
| 2026-11-26 | UAT 18:56 | All #58 fixes pass; create club, empty states, phone width, sign out OK | Closed | #58, #59 |
| 2026-11-26 | UAT 18:56 | MAJOR: Make an invite fails (GET /clubs/{id}/secret 404 on web-created club) | Accepted | club-data PR (next) |
| 2026-11-26 | UAT 18:56 | MAJOR: Checkout 503 | Expected: Stripe on hold (owner) | — |
| 2026-11-26 | UAT 18:56 | MINOR stale Billing placeholder; POLISH subscription 404 → 200 null | Accepted | club-data PR (next) |
| 2026-11-26 | UAT 18:56 | NOTE: no web editing for stands/areas/property line/harvests | Owner question (web vs app-only) | — |
| 2026-11-26 | UAT retest 17:42 | Earlier fixes pass: SES codes arrive, 404/SPA, legal drafts, branding, validation, first sign-up works, /me/clubs 200 | Closed | #51–#55 |
| 2026-11-26 | UAT retest 17:42 | BLOCKER: returning-user EMAIL_OTP code is 8 digits, UI accepts 6 | Accepted: code length per challenge kind (shared helper) | web PR (next) |
| 2026-11-26 | UAT retest 17:42 | MAJOR: session lost on reload/deep link | Accepted: persist refresh token (localStorage), refresh on load, expired message, return to route | web PR (next) |
| 2026-11-26 | UAT retest 17:42 | MINOR/POLISH: no-club errors on tabs; route jump after failed code; title; double error; /favicon.ico 404 | Accepted | web PR (next) |
| 2026-11-26 | UAT feedback | BLOCKER: sign-in code email never arrives | Accepted: Grok Bot Request #8 (Cognito → SES, verify test inboxes) | — |
| 2026-11-26 | UAT feedback | MAJOR: deep links/unknown paths → raw 403 XML | Accepted: SPA fallback + styled 404 + robots.txt | web PR A |
| 2026-11-26 | UAT feedback | MINOR: no email validation message; first-load 403 | Accepted | web PR A/B |
| 2026-11-26 | UAT feedback | POLISH: no branding; no resend/expiry/spam hint | Accepted | web PR B |
| 2026-11-26 | UI feedback | MUST 1–5: 404 page; silent create-club/invite errors; false "Copied"; input border 1.2:1 | Accepted | web PR A/B |
| 2026-11-26 | UI feedback | SHOULD 6–16: sign-in card/branding/validation, tables at phone width, retry, empty states, route a11y, nav cue, WOFF2 font, offline data, billing gap | Accepted | web PR B |
| 2026-11-26 | UI feedback | Light/high-contrast theme | Deferred to after field test (touches shared tokens) | — |
| 2026-11-26 | UI feedback | Request: dev test account + club for +uitest | Accepted after Request #8; seed test club next | — |

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

- When Stripe is set up: create monthly ($10) and yearly ($100) prices with the 14-day trial handled by Checkout, enable the Customer Portal (Settings → Billing → Customer portal), and give Grok Bot the keys for SSM `/hunt-club-mesh/dev/stripe-*`.
- Supply a support email (SUPPORT_EMAIL), production domain, member limit, refund/retention terms, and approve Privacy/Terms drafts.

- **Approve the deploy path (blocking the first deploy):** let Grok Bot create a GitHub Actions OIDC deploy role `hunt-club-mesh-github-deploy-dev` (trust: repo Overcastly-AI/hunting-club, GitHub environment `dev` only; may only assume the four CDK bootstrap roles). Alternatives: run `cdk deploy` from your own machine or AWS CloudShell, or allow the CDK assets bucket in Grok Bot's VPC endpoint policy.

- **Stripe account (needed to take club payments, Milestone 9):** create a Stripe account in test mode. Then Grok Bot (via a numbered request) creates the test price, the SSM parameters `/hunt-club-mesh/dev/stripe-api-key` and `/hunt-club-mesh/dev/stripe-webhook-secret`, and a thin-event webhook destination pointing at the `StripeWebhookUrl` stack output.
- **Delete one PR comment by hand** (the tool keeps re-adding an AI footer): https://github.com/Overcastly-AI/hunting-club/pull/7#issuecomment-7188280309


- **Open or closed source (needed before the app ships):** Meshtastic protobufs are GPL-3.0 with no app exception. Closed-source app + bundled protobufs conflicts with the license; open-sourcing the app (GPL-3.0) resolves it and the cloud can stay proprietary.
- Optional: allow running `meshtasticd --sim` in the agent environment (blocked by sandbox policy) so agents can test against a simulated radio.

- Set the GitHub default branch to `main` (repo Settings → Branches).
- Open decisions listed in `docs/SPEC.md`.
- Real-radio testing when milestones 2+ land (agents can't reach hardware).
