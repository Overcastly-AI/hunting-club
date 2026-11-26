# @huntclub/api

The two Lambda handlers behind Function URLs (Milestone 9 backend). `infra/lambda/club-api` and
`infra/lambda/stripe-webhook` are thin entry points that read configuration from env vars, build
these handlers once per container, and let esbuild bundle them.

| File                   | What                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `src/clubApi.ts`       | Club API routes over `@huntclub/club-data` (permissions are club-data's authz).                  |
| `src/stripeWebhook.ts` | Stripe webhook: verify signature, thin event → re-fetch subscription → `applyStripeEvent`.       |
| `src/auth.ts`          | Cognito access-token verification (`aws-jwt-verify`): signature, issuer, client id, `token_use`. |
| `src/billing.ts`       | Narrow Stripe interface, event → subscription mapping, Checkout Session creation.                |
| `src/router.ts`        | Tiny router; every `:param` must be a UUID (nothing else reaches a table key).                   |
| `src/errors.ts`        | Error code → HTTP status (exhaustive over `CLUB_API_ERRORS`).                                    |

## Club API

Every route needs `Authorization: Bearer <Cognito access token>` except `GET /plans`. Bodies are
JSON, validated with the `@huntclub/shared` schemas. Errors are
`{ "error": { "code", "message" } }` with `code` from `CLUB_API_ERRORS`.

| Method and path                                              | Who                                   | Body / result                                                                                           |
| ------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /plans`                                                 | anyone                                | active plans                                                                                            |
| `GET /me/clubs`                                              | signed in                             | `[{ club, membership }]`                                                                                |
| `POST /clubs`                                                | signed in                             | `ClubCreateRequest` → club (caller is first admin; features stay locked until a subscription is active) |
| `GET`, `PATCH /clubs/:clubId`                                | member / admin                        | club / `ClubUpdate`                                                                                     |
| `GET`, `POST /clubs/:clubId/members`                         | member / admin                        | roster / `MemberAdd`                                                                                    |
| `PATCH /clubs/:clubId/members/:userId`                       | self or admin                         | `MemberProfileUpdate`                                                                                   |
| `PUT /clubs/:clubId/members/:userId/access`                  | admin                                 | `MemberAccessUpdate` (409 `last_admin`)                                                                 |
| `DELETE /clubs/:clubId/members/:userId`                      | self or admin                         | 204                                                                                                     |
| `GET`, `POST /clubs/:clubId/invites`, `DELETE …/:inviteId`   | admin                                 | invites / `InviteCreate` / 204                                                                          |
| `POST /invites/redeem`                                       | signed in                             | `RedeemInviteRequest` → membership                                                                      |
| `GET`, `POST /clubs/:clubId/stands`, `PATCH`, `DELETE …/:id` | member / admin                        | `meshId` is server-assigned                                                                             |
| same for `/areas` and `/harvests`                            | member / admin (harvests: the hunter) |                                                                                                         |
| `GET /clubs/:clubId/map-packs`                               | member                                |                                                                                                         |
| `GET`, `PUT /clubs/:clubId/secret`                           | admin                                 | `{ channelKey: base64 }` (`ClubSecretPutRequest`)                                                       |
| `GET /clubs/:clubId/subscription`                            | admin                                 | subscription                                                                                            |
| `POST /clubs/:clubId/checkout`                               | admin                                 | `{ planId }` → `{ url }` (503 `not_configured` until the plan has a Stripe price)                       |

## Stripe webhook

Thin events, verified with `stripe.parseEventNotification` over the raw body. Handled:
`v1.checkout.session.completed`, `v1.customer.subscription.*`, `v1.invoice.paid`,
`v1.invoice.payment_failed`. Each re-fetches the subscription and applies its current state
(club and plan from the metadata the Checkout Session put there). Bad signature: 400. Stripe or
database failure: 500 (Stripe retries). Permanent data problems: 200 with `outcome: rejected`
(logged). Ignored types: 200.

## Tests

```sh
npm test -w @huntclub/api                       # unit
docker run --rm -p 8000:8000 amazon/dynamodb-local:3.3.2
npm run test:db -w @huntclub/api                # handlers end to end on DynamoDB Local
```

No network: tokens come from a local test user pool (`src/testing/jwt.ts`, JWKS preloaded into
the verifier), webhook signatures from Stripe's own `generateTestHeaderString`, and Stripe API
calls from a fake `StripeApi`.
