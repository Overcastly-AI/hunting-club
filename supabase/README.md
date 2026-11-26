# Supabase schema

The club cloud layer (docs/SPEC.md, "Clubs and subscriptions"). Code only: nothing here
deploys, and no Supabase project or credentials are needed to work on it.

| Path                                | What                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `migrations/`                       | Schema, RLS policies and RPCs, in Supabase CLI layout (`<timestamp>_<name>.sql`). The only source of truth for the database.                        |
| `tests/database/`                   | pgTAP tests: every RLS rule with positive and negative cases, constraints, `redeem_invite`.                                                         |
| `scripts/db.sh`                     | `reset` builds a throwaway database from the migrations; `test` resets and runs the tests with `pg_prove`.                                          |
| `scripts/test-helpers.sql`          | Shared fixtures (`tests.seed_two_clubs()`, `tests.authenticate_as()`, …). Each test file includes it with `\ir`.                                    |
| `scripts/vanilla-postgres-shim.sql` | The few Supabase objects (API roles, `auth.uid()`, default grants) the migrations need, so they run on plain PostgreSQL. Never applied to Supabase. |

## Run the tests

Needs PostgreSQL 15+ with pgTAP and `pg_prove` (Ubuntu: `postgresql-16 postgresql-16-pgtap
libtap-parser-sourcehandler-pgtap-perl`) and a role that can create databases:

```sh
supabase/scripts/db.sh test
```

`HUNTCLUB_DB` names the database (default `huntclub_test`); it is dropped and recreated each
run. Connection settings come from the usual `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`.
CI runs the same script (`.github/workflows/database.yml`).

## TypeScript types

`packages/shared/src/database.types.ts` is generated from the migrations; never edit it.
After changing SQL:

```sh
npm run gen:db-types -w @huntclub/shared
```

CI fails if the committed file is out of date. App, web and Lambdas import types and enum
values from `@huntclub/shared` (`Tables<'stands'>`, `STAND_TYPES`, `REDEEM_INVITE_ERRORS`).

## Access rules

- Members (and guests whose pass hasn't expired) read their own club's rows.
- Admins write stands, areas, invites and the roster, and read and write `club_secrets`.
- Members edit only their own name, initials and radio, and may leave; a club always keeps one admin.
- Harvests: the hunter's own rows always; the rest of the club only while `shared`.
- The service role (webhook and provisioning Lambdas) is the only writer of `clubs` (create and delete),
  `subscriptions`, `map_packs`, `plans` and `stripe_events`.
- All membership checks go through `private.is_club_member()` / `private.is_club_admin()`.
- Joining uses `public.redeem_invite(token, display_name, initials)`, which checks expiry, use
  count, subscription status and the plan's member limit in one locked transaction.

`plans.member_limit` values are placeholders until the owner decides member limits (SPEC open decision 2).
