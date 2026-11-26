# Stripe billing and Supabase Auth research

Checked 2026-11-26. Scope: the club subscription on the web admin page, sign-in for club admins and members (web page and Expo app), and the Stripe webhook Lambda. Free users never sign in and never call our backend, so none of this applies to them.

Lines marked *(unverified)* could not be confirmed on a primary source. Nothing here is legal or tax advice.

## TL;DR

1. **Hosted Stripe Checkout, subscription mode, yearly Price.**
   - For a "season", set a fixed renewal date with `billing_cycle_anchor_config {month, day_of_month}`.
   - Whether a club joining mid-season pays a prorated first invoice or a full year is an **owner decision**.
   - Pin API version `2026-11-18.endive` in code.
2. **One webhook Lambda behind a Function URL** (auth `NONE`):
   - Verify the signature over the raw body.
   - Ignore the event payload and **re-fetch the Subscription**, because ordering isn't guaranteed.
   - Write through one atomic Postgres RPC that records `stripe_events` and upserts `subscriptions` together.
   - Return 500 on database failure so Stripe retries for up to 3 days.
3. **"Paid through" moved:** since API `2025-03-31.basil` it is `items.data[].current_period_end`, not on the Subscription.
4. **Sign-in: email plus a 6-digit code** (Supabase email OTP), the same on the web page and in the app.
   - Nothing to remember.
   - No switching to an email app to tap a link, which matters for 50–75-year-olds.
   - Apple and Google sign-in are optional extras. Adding Google means adding Apple too (App Store guideline 4.8).
5. **Before launch we need custom SMTP.** Supabase's built-in email only reaches project team members, at 2 per hour.
6. **Club QR invites should be `https://` universal/app links**, not `huntclub://`. A camera scan of a custom scheme does nothing when the app isn't installed.
7. **Lambdas verify Supabase access tokens** with the project's JWKS (asymmetric ES256 keys), not a shared secret.
8. **Key renaming:** Supabase is replacing `anon`/`service_role` keys with `sb_publishable_…`/`sb_secret_…`; the legacy keys are deprecated "early 2027". Use the new names from the start.
9. **New dependencies need approval** (none is in SPEC.md):
   - `stripe` (stripe-node 23.x)
   - `@supabase/supabase-js`
   - `jose`
   - for the app's session storage: `expo-sqlite` (already in the app) or `expo-secure-store`

---

## 1. Stripe: versions and SDK

**API versioning:**

- **Latest version:** `2026-11-18.endive`. Earlier ones: `2026-10-28.endive`, `2026-09-30.endive`, `2026-08-26.dahlia`.
- **How releases work:**
  - Since `2024-09-30.acacia`, monthly versions within a named release have no breaking changes.
  - A new named release with breaking changes ships about twice a year.
  - Sources: https://docs.stripe.com/changelog, https://docs.stripe.com/upgrades, https://docs.stripe.com/sdks/versioning
- **Pin the version in code:** `new Stripe(key, { apiVersion: '2026-11-18.endive' })`, or send the `Stripe-Version` header. Don't rely on the account default.
- **Snapshot webhook destinations** fix their payload version when created. Upgrading means creating a new destination. Thin events have no version (§3).

**SDK:**

- **stripe-node 23.2.0** (npm, published 2026-11-19): `engines: node >=20`, no runtime dependencies.
- **Node support:** Stripe supports Node 22 until 2028-09 and Node 24 until 2029-09.
- **Lambda runtime:** use `nodejs24.x` (deprecated 2028-04-30). Source: https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html
- **A hand-written `fetch` client is feasible** (about 4 endpoints plus HMAC; Stripe documents manual verification at https://docs.stripe.com/webhooks).
- **Recommendation: use the SDK** for typed objects and thin-event parsing. It is small and has no dependencies. It needs dependency approval.

## 2. Stripe Checkout for a club subscription

Sources:

- https://docs.stripe.com/payments/checkout/build-subscriptions.md?payment-ui=stripe-hosted&platform=web&ui=stripe-hosted
- https://docs.stripe.com/payments/checkout/billing-cycle.md?ui=full-page
- https://docs.stripe.com/payments/checkout/free-trials.md?ui=full-page

### Product and price

- One Product, "Club subscription", with a recurring yearly Price per plan.
- Plan ids match our `plans.id` (for example `club_standard`). Store the Stripe Price id in `plans`, which needs a migration later.

### Season billing

- **Fixed renewal date:** `subscription_data.billing_cycle_anchor_config = { month: 8, day_of_month: 1 }` renews every Aug 1. It works for monthly and yearly Prices.
- **Proration options for the first invoice:**
  - `create_prorations` (default): a prorated first invoice up to the anchor.
  - `none`: the first period is free and the full price is charged on the anchor date. The session's `payment_status` is `no_payment_required`.
- **Limits:** an anchor can't be combined with a trial, and with `none` you can't add one-time prices.
- **Owner decision:** which of these fits "per season". The other option is a plain yearly anniversary subscription with no anchor.

### Without auto-renew

`mode=payment` with a one-time Price, where we set `paid_through` ourselves. There's no Stripe Billing fee, but we have to send reminders and renewals ourselves.

### Hosted Checkout, not embedded

Hosted works from a static S3/CloudFront page with a plain redirect to the session `url`. It needs no Stripe.js content-security-policy work.

### Passing club context

The club is created first, so payment is never orphaned.

1. Create the club in a pending state (provisioning Lambda, service role).
2. Create a Stripe Customer with `metadata.club_id` and store `subscriptions.stripe_customer_id`.
3. Create the Checkout Session with `customer`, `client_reference_id = club_id` and `subscription_data.metadata.club_id`.
4. Every `customer.subscription.*` event then carries `club_id` in the fetched subscription's metadata.

*(unverified: parameter names taken from the API reference, which wasn't opened page by page.)*

### Trials (optional)

- `subscription_data.trial_period_days`, up to 730 days.
- `payment_method_collection=if_required` allows a trial with no card. Then set `trial_settings.end_behavior.missing_payment_method = cancel | pause`.
- `customer.subscription.trial_will_end` fires 3 days before the trial ends.

### Tax

`automatic_tax[enabled]=true` uses Stripe Tax. It collects only where we're registered; it costs extra (§7).

## 3. Webhook events, "paid through" and ordering

Sources: https://docs.stripe.com/billing/subscriptions/webhooks, https://docs.stripe.com/webhooks, https://docs.stripe.com/events/how-events-work, https://docs.stripe.com/api/v2/core/events/event-types

### Events to handle

| Event | What we do |
|---|---|
| `checkout.session.completed` | Link the Stripe subscription to the club, then sync it (below) |
| `customer.subscription.created`, `.updated`, `.deleted` | Sync the subscription |
| `invoice.paid` | Sync. Stripe advises confirming `status=active` on the fetched subscription before extending access |
| `invoice.payment_failed` | Sync (the status becomes `past_due`). Optional: email the club admin |
| `customer.subscription.trial_will_end` | Only if we offer trials. Remind the admin |

- **Naming:** use `invoice.paid`; `invoice.payment_succeeded` still exists but isn't needed.
- **Don't subscribe to `invoice.created`** unless we handle it: unanswered `invoice.created` events can delay invoice finalisation by up to 72 h.
- **Expiry:** an `incomplete` subscription expires to `incomplete_expired` after 23 h.

### Paid through

- Since `2025-03-31.basil`, `current_period_start`/`current_period_end` live on each subscription item (`items.data[].current_period_end`), not on the Subscription. Source: https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end
- Set `subscriptions.paid_through` to that value. While `trialing`, use `trial_end`.

### Ordering and duplicates

- Stripe: "Don't use `created` to determine event order". Delivery order isn't guaranteed and duplicates happen.
- **Pattern: on every event, re-fetch the Subscription from the API and upsert the whole row.** Then order doesn't matter, and replaying an event is harmless.
- **Idempotency:** each `event.id` is recorded once in `stripe_events` (table exists, insert-once tested in `supabase/tests`).

### Retries

- **Live mode:** retries with exponential backoff for up to 3 days.
- **Sandboxes:** 3 retries over a few hours.
- **Manual resend:** from the Dashboard for 15 days, from the CLI for 30.
- Respond with 2xx quickly. A non-2xx (for example a database outage) makes Stripe retry.

### Thin events vs snapshot payloads

- Endpoints are now "event destinations" (up to 16), with a **thin** (recommended) or **snapshot** payload.
- Thin events have no version and carry only the related object's id. The thin catalogue covers everything above: `v1.checkout.session.completed`, `v1.customer.subscription.*`, `v1.invoice.paid` and `v1.invoice.payment_failed`.
- **Recommendation: thin events.** We re-fetch anyway, and API upgrades won't need a destination migration.
- The Node helper names for parsing thin events weren't verified *(unverified)*; Stripe's examples are labelled for current SDKs.

### Alternative: Amazon EventBridge

Stripe can deliver straight to Amazon EventBridge, which avoids a public URL. You can't manually resend events to it, and it's more setup. Webhook plus Function URL is simpler.

## 4. The webhook Lambda

Sources: https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html, https://docs.stripe.com/webhooks, https://github.com/stripe/stripe-node, https://supabase.com/docs/guides/api/api-keys

### Raw body

Function URLs use the API Gateway v2.0 payload. Rebuild the exact bytes and **never parse JSON before verifying**:

```ts
const raw = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64') : Buffer.from(event.body ?? '', 'utf8');
```

### Signature

- Call `stripe.webhooks.constructEvent(raw, event.headers['stripe-signature'], whsec)`.
- Header names arrive lower-cased in v2.0 *(unverified)*.
- The default tolerance is 300 s; never set it to 0.
- Without the SDK: HMAC-SHA256 over `${t}.${raw}`, constant-time compare against any `v1=` entry, ignore `v0` and unknown entries.

### Function URL settings

- **Auth type `NONE`:** Stripe can't sign AWS SigV4.
- **Reserved concurrency** (for example 5) caps cost under a flood. Unsigned requests are rejected before any database call.
- Stripe's IP allowlist (https://docs.stripe.com/ips) can optionally be checked against `requestContext.http.sourceIp`.

### Secrets

- Per the owner decision of 2026-11-26 (`docs/STATUS.md`), they live in **AWS Secrets Manager**:
  - `hunt-club-mesh/<env>/stripe-webhook-secret`
  - `hunt-club-mesh/<env>/stripe-api-key` (use a Stripe **restricted key** limited to Customers, Checkout, Billing Portal and Subscriptions read)
  - `hunt-club-mesh/<env>/supabase-secret-key`
- Read them once per cold start and cache them in module scope.
- Cost: $0.40 per secret per month plus $0.05 per 10,000 calls (https://aws.amazon.com/secrets-manager/pricing/). That is about $1.20/month for three secrets. SSM Parameter Store SecureString would be free (https://aws.amazon.com/systems-manager/pricing/) if the owner wants to revisit.
- Never put them in Lambda environment variables, CDK code or logs.

### Writing to Supabase

- **Key:** the Supabase **secret key** (`sb_secret_…`, the successor to `service_role`) bypasses RLS. It is used only in Lambdas.
- **One atomic RPC:** add a `security definer` function in a new migration, `private`-style and executable only by the service role:

  ```sql
  apply_stripe_event(event_id text, club_id uuid, customer_id text, subscription_id text,
                     plan_id text, status subscription_status, paid_through timestamptz)
  -- insert into stripe_events … on conflict do nothing; if no row inserted → return 'duplicate'
  -- else upsert subscriptions on conflict (stripe_subscription_id) → return 'applied'
  ```

  Call it with `POST /rest/v1/rpc/apply_stripe_event`, via supabase-js `.rpc()` or plain `fetch`. One function call is one transaction, so the event record and the subscription row commit together or not at all.
- **Entitlement:** reuse `private.is_entitled_status()` (already in the schema) rather than re-listing statuses in TypeScript.
- **Logging:** log event id and type only, never payloads (CLAUDE.md).

### Customer portal

(https://docs.stripe.com/customer-management/configure-portal)

- **Configure in the Dashboard:** cancel at period end (on), update payment method (on), invoice history (on), switch plan (off until there are several plans).
- **A second small Lambda** (`POST /portal`, Function URL):
  1. Verify the caller's Supabase access token (§9).
  2. Check that `club_members` holds `role = 'admin'` for the requested club.
  3. Call `billing_portal.sessions.create({ customer, return_url })`.
  4. Return the URL.
- The same Lambda pattern creates Checkout Sessions, so the web page never holds Stripe keys.

## 5. Testing Stripe

- **Sandboxes:** Stripe now says "For new integrations, use general sandboxes instead of your test mode sandbox". Use one sandbox for local development and one for CI. Source: https://docs.stripe.com/sandboxes
- **Test clocks** (shown as "simulations" in the Dashboard): advance up to 2 billing intervals at a time, so a yearly renewal and a failed renewal can be tested in minutes. Source: https://docs.stripe.com/billing/testing/test-clocks
- **Stripe CLI:**
  - Thin events: `stripe listen --forward-thin-to localhost:4242/webhook --thin-events "*"` (CLI ≥ 1.51.0).
  - Snapshot events: `stripe listen --forward-to …`.
  - `stripe trigger` sends synthetic events.
- **Test cards:**
  - `4242 4242 4242 4242`: succeeds.
  - `4000 0025 0000 3155`: requires authentication.
  - `4000 0000 0000 9995`: declined.
  - `4000 0000 0000 0341`: attaches, then fails at renewal.
- **Agents have no Stripe account.** The webhook handler must be testable offline with recorded fixture events, a fake Stripe client and the pgTAP harness for `apply_stripe_event`.

## 6. Fees and app-store rules

**Stripe pricing** (https://stripe.com/pricing; the page shows no effective date):

- **Cards:** 2.9% + 30¢ for US cards, plus 1.5% for international cards and 1% for currency conversion.
- **Stripe Billing:** 0.7% of billing volume (pay-as-you-go).
- **Stripe Tax:** 0.5% per transaction (no-code setup), only where registered.
- **Example:** a $300/year club pays $8.70 + $0.30 = $9.00 card fee plus $2.10 Billing, or **≈ $11.10** (3.7%). The `mode=payment` alternative skips the Billing fee.

**Apple** (https://developer.apple.com/app-store/review/guidelines/, 3.1.1(a), 3.1.3):

- **US storefront:** apps may link to external purchasing without an entitlement. Elsewhere it is still restricted.
- **Commission status:** a December 2025 court ruling reportedly lets Apple charge a "reasonable" commission on linked purchases (https://www.macrumors.com/2025/12/11/APPLE-APP-STORE-FEES-EXTERNAL-PAYMENT-LINKS/, secondary source). Current status *(unverified)*.
- **Safest design:** keep **no purchase button or link in the app**. Admins buy on the web page; the app only unlocks what the club already paid for (allowed by 3.1.3(b), multiplatform services).
- Google Play's US rules were not checked.

## 7. Supabase Auth: which method

Source for the OTP and magic-link points: https://supabase.com/docs/guides/auth/auth-email-passwordless

| Method | Fit for hunters 50–75 | Notes |
|---|---|---|
| **Email + 6-digit code (OTP)** | **Best.** Type a code on the same phone; no app switching; works for web admins too | See below |
| Magic link | Poor. Opens in the mail app or browser, often on another device; PKCE requires the same device and browser and expires in 5 min | Needs deep-link plumbing |
| Password | Poor. Forgotten passwords mean reset emails and support | Free plan lacks leaked-password protection (https://supabase.com/pricing) |
| Phone (SMS) OTP | Good UX, but paid | Needs Twilio, MessageBird, Vonage or TextLocal; default 30 SMS/hour (https://supabase.com/docs/guides/auth/phone-login) |
| Sign in with Apple / Google | Good: one tap | Optional add-on (§8) |
| Anonymous | Not needed | Free users don't touch the backend at all (https://supabase.com/docs/guides/auth/auth-anonymous) |

**How email OTP works:**

- It is the same call as a magic link (`signInWithOtp`). Put `{{ .Token }}` in the **Magic Link** email template to send a code.
- Verify with `verifyOtp({ email, token, type: 'email' })`.
- `shouldCreateUser: false` blocks unknown emails where needed. For example, members must first redeem an invite.

**Timing limits:**

- Expiry is 1 hour by default and at most 86,400 s. We'd set 15–30 min.
- A user can request a new code once every 60 s.
- Code length: the docs say "six digit code"; no length setting was found for hosted email OTP *(check the dashboard)*.

**UI:** one large numeric field with `textContentType="oneTimeCode"` / `autoComplete="one-time-code"`, a big "Send a new code" button that respects the 60 s limit, and no passwords.

## 8. Supabase free plan limits for auth

**Plan limits** (https://supabase.com/pricing):

- **Users:** 50,000 monthly active users (plus 50,000 third-party MAU). Fine for this product.
- **Projects:** 2 active.
- **Database:** 500 MB.
- **Audit logs:** kept 24 h.
- **Custom SMTP:** allowed on Free.

**Built-in email is not usable for real users** (https://supabase.com/docs/guides/auth/auth-smtp):

- It only delivers to the project's team members and is limited to 2 emails/hour.
- **Custom SMTP is required before any club signs up.** Options: Amazon SES (fits the AWS-only rule) or Resend, Postmark and others.
- After switching, the email rate limit starts at 30/hour and can be raised.
- SES pricing was not checked *(unverified)*.

**Other rate limits** (https://supabase.com/docs/guides/auth/rate-limits):

- One OTP per user per 60 s.
- `/verify`: 30 per 5 min.
- Token refresh / ID-token sign-in: 150 per 5 min.
- Signup, OTP and recovery: 30 per 5 min per IP.

**Pausing:** "Free projects are paused after 1 week of inactivity" (pricing page). The spec's daily EventBridge keep-alive covers this. Also confirm that a keep-alive is within Supabase's terms (SPEC already flags it).

**Apple and Google sign-in, if added later:**

- **Apple** (`expo-apple-authentication`, https://docs.expo.dev/versions/latest/sdk/apple-authentication/, https://supabase.com/docs/guides/auth/social-login/auth-apple):
  - Native on iOS only; Android needs the web OAuth flow with a deep link, so it's not equal across platforms.
  - Call `signInWithIdToken({ provider: 'apple', token })` and send a hashed nonce.
  - The user's name arrives only on the first sign-in, so save it immediately.
  - The web OAuth flow needs a new secret every 6 months; native iOS doesn't.
- **Google:**
  - `@react-native-google-signin/google-signin`'s free version is built on the **deprecated** legacy Android SDK. The Credential Manager version is paid.
  - Free alternative: `react-native-nitro-google-signin`.
  - Sources: https://react-native-google-signin.github.io/docs/install, https://docs.expo.dev/guides/google-authentication/, https://supabase.com/docs/guides/auth/social-login/auth-google
- **App Store 4.8:** offering Google login requires an equivalent privacy-preserving option such as Sign in with Apple. **Email OTP alone needs neither.**
- **App Store 5.1.1(v):** if users can create an account in the app, they must be able to **delete it in the app**. That applies to us with email OTP too.
- **Recommendation:** ship email OTP only at first. Consider Apple and Google after the field test, together.

## 9. Deep links, sessions and tokens

### Club QR invites

- Use `https://<admin-domain>/join?t=<token>`, an iOS universal link and Android app link, not `huntclub://join`.
- If the app is installed, the link opens it. If not, the web page shows store links plus the code.
- **iOS:**
  - Serve `/.well-known/apple-app-site-association` from CloudFront, ≤ 128 KB, with `appID` `<TEAMID>.com.overcastly.huntclub`.
  - Set `ios.associatedDomains: ["applinks:<domain>"]`.
  - iOS fetches the file only at install or update.
  - Source: https://docs.expo.dev/linking/ios-universal-links/
- **Android:**
  - Serve `/.well-known/assetlinks.json` with the release and upload SHA-256 fingerprints.
  - Set `android.intentFilters` with `autoVerify: true`.
  - Source: https://docs.expo.dev/linking/android-app-links/
- **S3:** set `Content-Type: application/json` on the extension-less file yourself *(CloudFront specifics unverified)*.
- **Keep `huntclub://join`** for the in-app scanner and as a fallback.
- **Spec impact:** the spec says QR codes use `huntclub://join?...`. Party QR codes (free, no account) can stay custom-scheme because they're scanned in-app. Club invite QR codes should move to https. **Proposed spec change.**

### Redirect URLs

Only needed for magic links and OAuth.

- Use exact entries in Supabase's allow-list, for example `huntclub://auth-callback` and `https://<admin-domain>/auth/callback`.
- `**` matches anything; `*` doesn't cross `.` or `/`.
- With email OTP, no redirect is involved.
- Source: https://supabase.com/docs/guides/auth/redirect-urls

### supabase-js in the Expo app

Expo's guide is at https://docs.expo.dev/guides/using-supabase/.

- **Storage:**
  - `import 'expo-sqlite/localStorage/install'` with `storage: localStorage`.
  - No `react-native-url-polyfill` needed (Expo provides `URL`).
  - Options: `detectSessionInUrl: false`, `autoRefreshToken: true`, `persistSession: true`, using the publishable key.
- **Encrypted alternative:** Supabase's `LargeSecureStore`, which keeps an AES key in expo-secure-store and the ciphertext in storage. It adds `aes-js` and `react-native-get-random-values`. Source: https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
- **App state:** call `startAutoRefresh()` on `AppState` `active` and `stopAutoRefresh()` otherwise.
- **Offline:**
  - Access tokens last 1 h (https://supabase.com/docs/guides/auth/sessions). In the field the refresh will fail for hours.
  - **No field feature may need a valid JWT.** Cache club membership, roster, role and the signed entitlement locally (SPEC already does).
  - Treat the user as signed out only on an explicit `SIGNED_OUT` event or an invalid-refresh-token error, never on a network error.
  - Test in airplane mode for more than 1 h.

### Web admin page

- Same project, same `auth.users`, same email OTP flow in the browser with no redirect.
- The publishable key is safe in browser code. The secret key never leaves Lambdas (https://supabase.com/docs/guides/api/api-keys).

### Verifying tokens in Lambdas

- Turn on asymmetric JWT signing keys (ES256) in the project.
- Verify with `jose`: `createRemoteJWKSet('https://<ref>.supabase.co/auth/v1/.well-known/jwks.json')` plus `jwtVerify`, checking issuer `https://<ref>.supabase.co/auth/v1` and audience `authenticated`.
- The endpoint is edge-cached for 10 min, so wait at least 20 min after rotating keys.
- Sources: https://supabase.com/docs/guides/auth/signing-keys, https://supabase.com/docs/guides/auth/jwts
- *(unverified: whether new projects default to asymmetric keys; check the JWT Keys settings.)*

---

## Recommendations

### Decisions needed from the owner

1. **Season billing:**
   - (a) yearly anniversary; or
   - (b) fixed renewal date with a prorated first invoice; or
   - (c) fixed renewal date where joining mid-season is free until the next renewal; or
   - (d) one-time yearly payment with no auto-renew.
2. **Free trial:** yes or no, and its length.
3. **Stripe Tax:** turn it on? That depends on where the business is registered.
4. **Apple and Google sign-in:** add later, or never? Email OTP covers launch.

### Build plan for Milestone 9

1. **Migration:**
   - `plans.stripe_price_id`.
   - A `pending` state for clubs (or a `subscriptions` row created at checkout).
   - `apply_stripe_event(...)` (security definer, service role only), with pgTAP tests for duplicate events and out-of-order upserts.
2. **Lambdas** (Node 24, Function URLs, secrets from Secrets Manager):
   - `stripe-webhook`: auth `NONE`, signature check, thin events, re-fetch, then RPC.
   - `checkout`: verify the JWT, create a club if needed, create the Customer and Checkout Session.
   - `portal`: verify the JWT, check the admin role, create a portal session.
   - Shared code (Stripe client, JWT verify, Supabase RPC call) goes in a `packages/` module, not copied between Lambdas.
3. **Web admin page:** email OTP sign-in, then buy or renew (redirect to Checkout), then manage billing (redirect to the portal).
4. **App:**
   - Email OTP sign-in screen.
   - supabase-js with the Expo localStorage adapter.
   - Universal/app links for `/join`.
   - In-app account deletion.
   - Never sign out on network errors.
5. **Ops:** custom SMTP (SES) before the first real club; a Stripe sandbox for development and one for CI; test clocks for renewals.

### Dependencies to approve

| Package | Where | Why |
|---|---|---|
| `stripe` 23.x | Lambdas | Typed API, signature verification, thin events |
| `@supabase/supabase-js` | app, web, Lambdas | Auth and RPC (spec names Supabase but not the client) |
| `jose` | Lambdas | JWKS verification of Supabase tokens |
| `expo-secure-store` + `aes-js` + `react-native-get-random-values` | app | Only if encrypted session storage is wanted; otherwise `expo-sqlite` localStorage, already used |

### Spec changes to propose

- Club invite QR codes become `https://<admin-domain>/join?...` universal/app links. Party QR codes stay `huntclub://join`.
- Sign-in method: email plus 6-digit code; no passwords.
- Add "custom SMTP (SES)" and "in-app account deletion" to the launch checklist.

### Risks

- **Season-billing proration** confuses admins if it is left implicit. Show the first charge clearly on the web page.
- **Custom SMTP** is a hard launch blocker. Without it, sign-in emails won't reach anyone outside the team.
- **Supabase key and JWT migrations** (early 2027): start on publishable/secret keys and asymmetric JWTs now, to avoid a forced change mid-season.
- **App-store rules on external purchase links** are in flux. Keep all purchasing out of the app.
