# iOS test builds (TestFlight)

How the owner gets Hunt Club Mesh onto iPhones to test with real Meshtastic radios.
Builds go to **TestFlight**: EAS builds the app with the `testflight` profile
(`app/eas.json`, App Store signing, build number bumped automatically) and submits it to
App Store Connect. Testers install it from the TestFlight app. No device registration.

## One-time setup (in this order)

1. **Apple Developer Program.** Enroll at developer.apple.com/programs (paid, yearly).
   Note your **Team ID** (developer.apple.com → Account → Membership details).
2. **Expo account.** Sign up at expo.dev, then on your computer:
   `npm i -g eas-cli@27.11.0` and `eas login`.
3. **Link the project.** From `app/`: `eas init`. It creates the EAS project and prints a
   project id. Paste it into `EAS_PROJECT_ID` at the top of `app/app.config.ts` (the only
   place it lives) and commit it. The id is not a secret.
4. **App Store Connect app record.** At appstoreconnect.apple.com → Apps → **+** → New App:
   platform iOS, name *Hunt Club Mesh*, bundle ID **com.overcastly.huntclub** (register it
   under Certificates, Identifiers & Profiles first if it is not offered), any SKU. Open
   the app → App Information and copy the **Apple ID** (a number). Put it in
   `app/eas.json` → `submit.production.ios.ascAppId` (the `testflight` submit profile
   extends it), replacing `SET_ASC_APP_ID`, and commit.
5. **App Store Connect API key.** Users and Access → Integrations → App Store Connect API
   → generate a key with the **App Manager** role. Download the `.p8` file (offered only
   once) and note the **Key ID** and **Issuer ID**.
6. **First build, interactively.** From `app/`: `eas build -p ios --profile testflight`.
   Sign in with your Apple ID when asked and let EAS create the distribution certificate
   and provisioning profile. EAS stores them, so GitHub's builds reuse them. (This build
   is not submitted; the GitHub workflow submits from then on.)
7. **GitHub secrets.** Repo → Settings → Secrets and variables → Actions:
   - Secrets: `EXPO_TOKEN` (expo.dev → Account settings → Access tokens), `ASC_KEY_ID`,
     `ASC_ISSUER_ID`, `ASC_KEY_P8` (the whole contents of the `.p8` file).
   - Variable: `APPLE_TEAM_ID` (from step 1).

   Nothing secret goes in the repo; only the EAS project id and the App Store Connect app id.
8. **Internal testers.** App Store Connect → the app → TestFlight → Internal Testing →
   create a group and add testers (they must be users on your App Store Connect team; up
   to 100). Internal testers get new builds without Beta App Review.

### Export compliance

The app uses only standard encryption (Meshtastic's AES channel encryption and HTTPS), so
the iOS config sets `ITSAppUsesNonExemptEncryption` to `false` (`app/app.config.ts`).
App Store Connect then doesn't ask the export-compliance question for each build. If
asked anyway, answer that the app uses only exempt, standard encryption.

## Building

- **From GitHub:** Actions → *Build iOS for TestFlight* → Run workflow. It builds on EAS
  (about 15–30 minutes) and submits to App Store Connect.
- **From your computer:** `eas build -p ios --profile testflight --auto-submit` in `app/`,
  with `ASC_KEY_PATH` (path to the `.p8`), `ASC_KEY_ID` and `ASC_ISSUER_ID` set in your
  shell: the submit profile reads the API key from them.

After submission, Apple processes the build (usually 5–30 minutes); it then appears in
TestFlight for the internal testers.

## Installing

On the iPhone, install **TestFlight** from the App Store, sign in with the Apple ID that
was added as a tester, and accept the invite (email or TestFlight app). Tap **Install**.
New builds show up there automatically.

Then pair the radio from the app: it asks for Bluetooth and location the first time.

## Android

Unchanged: `eas build -p android --profile preview` builds an installable APK, after
steps 2 and 3 above (no Apple steps). The `preview` profile is for Android only; iOS
builds use `testflight`.
