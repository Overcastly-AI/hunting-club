# Hunt Club Mesh

An off-grid hunting app. Phones pair over Bluetooth LE with stock [Meshtastic](https://meshtastic.org) LoRa radios to share a live map, texts and check-ins with no cell service. Hunters and parties of up to 3 use it free; hunting clubs pay a subscription for the cloud and admin layer.

- Spec (source of truth): [`docs/SPEC.md`](docs/SPEC.md)
- Agent rules: [`CLAUDE.md`](CLAUDE.md) and [`docs/AGENTS.md`](docs/AGENTS.md)

## Layout

| Path        | What                                                     |
| ----------- | -------------------------------------------------------- |
| `app/`      | Expo (React Native, TypeScript) app, Expo Router, SQLite |
| `packages/` | Shared TypeScript packages (npm workspaces)              |
| `docs/`     | Spec, status, agent playbook                             |

Inside `app/src/`: `app/` holds the routes (four tabs: Map, Chat, Check In, Party/Club), `theme/` the design tokens, `db/` the local SQLite database and migrations.

## Install

Requires Node.js LTS (see [`.nvmrc`](.nvmrc)) and npm.

```sh
nvm use
npm install
```

`npm install` also points git at the repo's hooks (`.githooks/`).

## Run a development build

The app uses native modules (expo-sqlite, and BLE later), so it runs in a [development build](https://docs.expo.dev/develop/development-builds/introduction/), not Expo Go.

Build and install the dev client once (and again whenever native dependencies change):

```sh
cd app
npx expo run:android   # Android device or emulator (needs Android Studio)
npx expo run:ios       # iOS simulator or device (needs macOS and Xcode)
# or in the cloud:
npx eas-cli@latest build --profile development --platform android
```

Then start the bundler and open the app on the device:

```sh
npm start --workspace app
```

## Checks

Run from the repo root; each runs across all workspaces.

```sh
npm run typecheck   # TypeScript, strict mode
npm run lint        # ESLint + Prettier check
npm test            # Jest (jest-expo)
npm run format      # Prettier write
```

CI (`.github/workflows/ci.yml`) runs install, typecheck, lint and test on pull requests and pushes to `main`.
