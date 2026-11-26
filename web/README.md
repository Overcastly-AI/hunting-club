# Web admin page (`@huntclub/web`)

The club admin page at `huntclub-dev.jaycobjones.com`: Vite + React + TypeScript, served from S3 + CloudFront by `infra`'s Web stack (it deploys `web/dist`).

```sh
npm run dev -w @huntclub/web      # local dev server
npm run build -w @huntclub/web    # typecheck + build to web/dist (needed before `npm run synth`)
npm test -w @huntclub/web         # vitest + Testing Library (jsdom)
```

- **Design tokens** come from `@huntclub/design`, the same source as the app. `src/theme/css.ts` turns them into CSS variables and text classes. The Archivo font is bundled from the app's single copy (`app/assets/fonts/Archivo-Variable.ttf`).
- **Environment IDs** (region, Cognito pool and web client) are read at build time from `infra/config/<env>.ts` (see `vite.config.ts`), so they are defined once.
- **Sign-in:** email plus a 6-digit code, using Cognito `USER_AUTH` / `EMAIL_OTP` (`src/auth/cognito.ts`). Until the web client ID is in the infra config, the page runs a demo sign-in (`src/auth/demo.ts`, code `123456`) and says so.
- **Data:** every page reads a `ClubApi` (`src/api/types.ts`). For now that's the in-memory `mockClubApi`; the real club API comes later.
- **Invites:** the link comes from `encodeJoinUrl` in `@huntclub/mesh`, and the QR from `qrMatrix` in `@huntclub/shared/qr`, drawn as SVG.
- **Routing:** hash routes (`#/roster`), so CloudFront needs no rewrite rules.
