# @huntclub/club-data

The club cloud data layer behind the Lambda API (docs/SPEC.md, "Clubs and subscriptions" and
"Cloud data"): one on-demand DynamoDB table shared by every club, the repository that reads and
writes it, and the authorization rules. Free users never reach any of this.

Replaces the Postgres schema and RLS policies from PR #5 (`supabase/`, removed). Every rule those
enforced is enforced here and tested on DynamoDB Local (mapping below).

| File                   | What                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/keys.ts`          | Table definition as data: `TABLE_KEYS`, `GSIS`, `TTL_ATTRIBUTE`, `BILLING_MODE`. The CDK stack imports it (`@huntclub/club-data/keys`); tests create the same table from it. |
| `src/items.ts`         | How each entity is keyed (the layout below).                                                                                                                                 |
| `src/authz.ts`         | Who may do what: one policy table, used by every operation.                                                                                                                  |
| `src/repository/`      | Operations per entity. Every write has a condition expression; multi-item rules use one `TransactWriteItems`.                                                                |
| `src/plans.ts`         | **Placeholder** plans (member limit 50) until the owner decides limits (SPEC open decision).                                                                                 |
| `src/testing/world.ts` | Test fixtures (two seeded clubs, users by name, a controllable clock).                                                                                                       |

Entity shapes, enums and validation rules come from `@huntclub/shared` (zod schemas), the single
source for the app, web admin and Lambdas.

## Use

```ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createClubData, DOCUMENT_CLIENT_OPTIONS, SERVICE, userActor } from '@huntclub/club-data';

const data = createClubData({
  client: DynamoDBDocumentClient.from(new DynamoDBClient({}), DOCUMENT_CLIENT_OPTIONS),
  tableName: process.env.CLUB_TABLE!,
});
await data.listStands(userActor(cognitoSub), clubId); // throws ClubDataError('forbidden') for non-members
await data.applyStripeEvent(SERVICE, event); // 'applied' | 'duplicate'
```

Every operation takes the caller first: `userActor(sub)` from the verified Cognito token, `SERVICE`
inside trusted Lambdas (webhook, provisioning, map packs), or `ANONYMOUS`. Failures throw
`ClubDataError` with a `code` from `CLUB_API_ERRORS` (`@huntclub/shared`).

## Access rules

- Members, and guests whose pass hasn't expired, read their own club: club, roster, stands, areas, map packs.
- Admins update the club and manage stands, areas, invites and the roster; only admins read or write the club secret (radio key).
- Members edit only their own name, initials and radio, and may leave. A club always keeps one admin (`last_admin`).
- Harvests: the hunter's own always; the rest of the club only while `shared`; admins may remove shared ones.
- Subscriptions: admins read their club's. Only the service writes subscriptions, Stripe events and plans, writes map packs, and creates or deletes clubs. Anyone (even signed out) lists active plans.
- Joining is `redeemInvite(token, profile)`: one transaction checks invite expiry and uses, the subscription status and plan, the seat limit (guests don't count), and duplicate membership.
- Stands and areas get a `meshId` (uint32, per club and kind, from 1, never reused, never changed) from an atomic counter. Clients can't set it.

## Item layout

`PK`/`SK` are the table keys; `GSI1PK`/`GSI1SK` the one (overloaded) global secondary index;
`ttl` (epoch seconds) is the TTL attribute. `<club>` is the club id.

| Entity                                   | PK                  | SK                             | GSI1PK                | GSI1SK        | TTL               |
| ---------------------------------------- | ------------------- | ------------------------------ | --------------------- | ------------- | ----------------- |
| Club (+ seat counters `seats`, `admins`) | `CLUB#<club>`       | `CLUB`                         |                       |               |                   |
| Club secret                              | `CLUB#<club>`       | `SECRET`                       |                       |               |                   |
| Subscription                             | `CLUB#<club>`       | `SUBSCRIPTION`                 |                       |               |                   |
| Member                                   | `CLUB#<club>`       | `MEMBER#<user>`                | `USER#<user>`         | `CLUB#<club>` | guest pass expiry |
| Area                                     | `CLUB#<club>`       | `AREA#<id>`                    |                       |               |                   |
| Stand                                    | `CLUB#<club>`       | `STAND#<id>`                   |                       |               |                   |
| Mesh id counter                          | `CLUB#<club>`       | `MESHID#AREA` / `MESHID#STAND` |                       |               |                   |
| Harvest (shared)                         | `CLUB#<club>`       | `HARVEST#<id>`                 |                       |               |                   |
| Map pack                                 | `CLUB#<club>`       | `MAPPACK#<id>`                 |                       |               |                   |
| Invite                                   | `INVITE#<token>`    | `INVITE`                       | `CLUB#<club>#INVITES` | `INVITE#<id>` | invite expiry     |
| Plan                                     | `PLAN#<plan>`       | `PLAN`                         | `PLANS`               | `PLAN#<plan>` |                   |
| Stripe event                             | `STRIPEEVENT#<evt>` | `STRIPEEVENT`                  |                       |               |                   |
| Stripe subscription guard                | `STRIPESUB#<sub>`   | `STRIPESUB`                    |                       |               |                   |

TTL deletion is lazy (it can lag by days), so expiry is always checked in code; TTL only cleans up.

## Access patterns

| #   | Pattern                                         | Who                       | How                                                                                                                                                                                                                    |
| --- | ----------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Get a club                                      | member                    | GetItem `CLUB#<club>` / `CLUB`                                                                                                                                                                                         |
| 2   | My clubs                                        | signed-in user            | Query GSI1 `USER#<user>`, then GetItem each club; expired guest passes filtered out                                                                                                                                    |
| 3   | Caller's membership (every authorization check) | all                       | GetItem `CLUB#<club>` / `MEMBER#<user>` (consistent)                                                                                                                                                                   |
| 4   | Roster                                          | member                    | Query `CLUB#<club>`, `begins_with(SK, 'MEMBER#')`                                                                                                                                                                      |
| 5   | Add member / change role / remove               | admin (remove: also self) | TransactWriteItems: member item + seat counters on the club item (`admins > 1` when an admin goes)                                                                                                                     |
| 6   | Edit own profile                                | self or admin             | UpdateItem member, `attribute_exists`                                                                                                                                                                                  |
| 7   | Club secret read / reset                        | admin                     | GetItem / Update `SECRET` (`keyVersion + 1`) with a club ConditionCheck                                                                                                                                                |
| 8   | Stands / areas / harvests / map packs of a club | member                    | Query `CLUB#<club>`, `begins_with(SK, 'STAND#' …)`                                                                                                                                                                     |
| 9   | Create stand or area                            | admin                     | UpdateItem `ADD lastValue 1` on the counter (atomic mesh id), then TransactWriteItems: put + club check (+ area check for stands)                                                                                      |
| 10  | Delete area / stand                             | admin                     | DeleteItem, then clear `areaId` / `standId` on referencing stands and harvests                                                                                                                                         |
| 11  | Log / edit a harvest                            | the hunter                | TransactWriteItems: harvest + active-membership ConditionCheck (+ stand/area checks)                                                                                                                                   |
| 12  | Invites of a club                               | admin                     | Query GSI1 `CLUB#<club>#INVITES`                                                                                                                                                                                       |
| 13  | Revoke an invite                                | admin                     | Query GSI1 `CLUB#<club>#INVITES` / `INVITE#<id>`, DeleteItem `INVITE#<token>`                                                                                                                                          |
| 14  | Redeem an invite                                | signed-in user            | GetItem invite by token; TransactWriteItems: invite `uses + 1` (unexpired, uses left), subscription ConditionCheck (entitled status, same plan), member put (no active membership), club `seats + 1` (`seats < limit`) |
| 15  | Active plans                                    | anyone                    | Query GSI1 `PLANS`                                                                                                                                                                                                     |
| 16  | Subscription of a club                          | admin                     | GetItem `SUBSCRIPTION`                                                                                                                                                                                                 |
| 17  | Apply a Stripe event                            | service                   | TransactWriteItems: put `STRIPEEVENT#<evt>` (not exists → else `duplicate`), upsert subscription, `STRIPESUB#<sub>` guard (same club), club and plan ConditionChecks                                                   |
| 18  | Delete a club                                   | service                   | Query `CLUB#<club>` + GSI1 `CLUB#<club>#INVITES`, BatchWriteItem deletes                                                                                                                                               |

## Tests

```sh
npm test -w @huntclub/club-data                      # unit tests (policy matrix, table definition)

docker run --rm -p 8000:8000 amazon/dynamodb-local:3.3.2
npm run test:db -w @huntclub/club-data               # every rule against DynamoDB Local
```

`DYNAMODB_ENDPOINT` overrides `http://localhost:8000`. Each test file creates and drops its own
table. CI runs both (`.github/workflows/ci.yml`, job "Club data (DynamoDB Local)").

### Ported pgTAP tests

Every case in the former `supabase/tests/database/*.sql` has a Jest test with the same intent:

| pgTAP file                               | Cases | Jest file                         |
| ---------------------------------------- | ----- | --------------------------------- |
| `00_schema.test.sql`                     | 22    | `schema.db.test.ts`               |
| `10_clubs_and_secrets.test.sql`          | 16    | `clubs-and-secrets.db.test.ts`    |
| `20_club_members.test.sql`               | 17    | `members.db.test.ts`              |
| `30_billing_and_service_tables.test.sql` | 17    | `billing.db.test.ts`              |
| `40_invites_areas_stands.test.sql`       | 19    | `invites-areas-stands.db.test.ts` |
| `45_mesh_ids.test.sql`                   | 10    | `mesh-ids.db.test.ts`             |
| `50_harvests.test.sql`                   | 14    | `harvests.db.test.ts`             |
| `60_redeem_invite.test.sql`              | 21    | `redeem-invite.db.test.ts`        |

Postgres-only checks became their DynamoDB equivalents: "RLS on every table" → every operation
refuses anonymous callers; "index on club_id" → club-owned items share the club partition;
"helpers not in public" → internal lookups aren't exported; "security definer / search_path" on
`redeem_invite` → concurrent redemptions never exceed the member limit or max uses.
