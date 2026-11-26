# Web admin page (`@huntclub/web`)

The club admin page at `huntclub-dev.jaycobjones.com`: Vite + React + TypeScript, served from S3 + CloudFront by `infra`'s Web stack (it deploys `web/dist`).

```sh
npm run dev -w @huntclub/web      # local dev server
npm run build -w @huntclub/web    # typecheck + build to web/dist (needed before `npm run synth`)
npm test -w @huntclub/web         # vitest + Testing Library (jsdom)
```

- **Design tokens** come from `@huntclub/design`, the same source as the app. `src/theme/css.ts` turns them into CSS variables and text classes. The Archivo font is bundled from the app's single copy (`app/assets/fonts/Archivo-Variable.ttf`).
- **Environment IDs** (region, Cognito pool, web client, club API URL) come from `CLOUD_ENVIRONMENTS` in `@huntclub/shared/cloud`, the same source the app and infra use (`src/cloud.ts`).
- **Sign-in:** email plus a 6-digit code through the shared `createCognitoAuth` and `ClubSession` (`@huntclub/shared`), with the same words as the app (`signInCopy`). Tokens stay in memory only.
- **Data:** every page reads a `ClubApi` (`src/api/types.ts`), implemented by `src/api/admin.ts` over the shared typed client (`createClubApiClient`, `API_PATHS`). Until the club API URL is in `CLOUD_ENVIRONMENTS`, the page says the club service is not available yet. Tests run the same adapter against an in-memory `ClubApiClient` (`src/__tests__/fakeClubApi.ts`).
- **Invites:** the link comes from `encodeJoinUrl` in `@huntclub/mesh`, and the QR from `qrMatrix` in `@huntclub/shared/qr`, drawn as SVG.
- **Routing:** the admin pages use hash routes (`#/roster`). The page also answers three real paths with no sign-in (`WEB_PAGE_PATHS` in `@huntclub/shared/app`, chosen in `src/Root.tsx`): `/join`, the fallback for https invite links (hands the invite to the app and shows its QR for a phone), and `/checkout/done` and `/checkout/cancel`, where Stripe Checkout returns. infra's Web stack serves `index.html` for exactly those paths with a CloudFront Function generated from the same list.
- **Harvests:** season summaries of the harvests members shared with the club (by species, sex, member and week) for a date range the admin picks, with CSV export. The counting rule is `harvestReport` in `@huntclub/shared`; days and weeks are the admin's local calendar days. If a reload fails for lack of a connection, the page keeps showing what was last loaded (`useAsync`'s `keepLastOn`).
- **Payment:** Billing starts Stripe Checkout through the club API (`startCheckout`) for an active plan whenever the club has no paid-up subscription; the page never holds Stripe keys.
