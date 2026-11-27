# Proposal: app screenshots in CI (M3)

Status: proposal only. Nothing here is added to `.github/workflows/`. The coordinator decides.

## Why

The web admin's screenshots come from `web/scripts/shoot.ts` (Playwright over the demo). The phone
app has no equivalent: its Map, Layers, Chat and Check In screens are only checked by Jest render
tests, which never draw a pixel. A CI job that captures the real Android build at 390 dp in both
themes gives design review the same evidence for the app that it has for the web.

## What the job would do

One job, `app-screenshots`, run on demand (`workflow_dispatch`) and on pull requests that touch
`app/**` or `packages/design/**`. Not on every push to main.

1. Check out, set up Node from `.nvmrc` and Java 17, `npm ci`.
2. Build a debug APK: `npx expo prebuild --platform android --no-install`, then
   `./gradlew assembleDebug` in `app/android`, with the Gradle cache (`gradle/actions/setup-gradle`).
   The app has its own native module (`app/modules/radio-service`), so Expo Go cannot be used; it
   has to be a real build.
3. Start an emulator with **`reactivecircus/android-emulator-runner@v2`** (the well-known action for
   this; it uses KVM on `ubuntu-latest`), API 34, `google_apis`, x86_64, with an AVD snapshot
   cached by `actions/cache` so later runs boot in about a minute.
4. Pin the screen to the design's 390 width: `adb shell wm size 1170x2532` and
   `adb shell wm density 480` (1170 px / 3 = 390 dp, the iPhone-sized frame the mockups use).
5. Install the APK and open it in a screenshot mode with sample data and a stand-in radio (see
   "Needed in the app first"), then for each theme (`adb shell cmd uimode night yes` and `no`, with
   the app's theme on System) open each screen and run `adb exec-out screencap -p`:
   - Map
   - Map with Layers open
   - Chat
   - Check In
6. Upload the eight PNGs as a workflow artifact (`actions/upload-artifact`), named like the web
   shots: `phone-map-390-dark.png`, `phone-layers-390-daylight.png` and so on. They are not
   committed by the job; a person copies the ones worth keeping into `docs/redesign/`.

Navigation between screens uses deep links (`adb shell am start -a android.intent.action.VIEW -d
"<scheme>://..."`), so no UI-automation tool is needed. Maestro would make taps easier but is a new
dependency not in docs/SPEC.md, so it is not proposed.

## Needed in the app first

- A screenshot mode (dev builds only, like the web's `?demo=`): the sample club from
  `web/src/map/sampleProperty.ts` moved to a shared package so both use one copy, a stand-in radio
  that reports "Mesh: 3 radios" with fixed positions, and a fixed clock so sunrise and sunset do not
  change between runs. No network, no account.
- Deep-link routes for the four screens and for opening Layers.

## Cost per run

GitHub-hosted Linux runners bill at 1x against the free allowance (2,000 minutes a month on the
Free plan for private repositories; public repositories are free).

| Step | First run | Cached run |
|---|---|---|
| Checkout, Node, `npm ci` | 2 min | 2 min |
| Prebuild and Gradle debug build | 12 min | 6 min |
| Emulator boot (AVD snapshot) | 6 min | 1 min |
| Install, 8 captures, upload | 3 min | 3 min |
| **Total** | **about 23 min** | **about 12 min** |

So roughly 12 free minutes per run once caches are warm (about 23 on a cold cache). Run on app
pull requests only, at around 30 runs a month, that is about 360 to 700 of the 2,000 minutes.
iOS (macOS runners bill at 10x) is left out: the same screens on the iOS simulator would cost
about 150 minutes a run.

## Risks

- Emulator runs are slower and flakier than Playwright; the action's retries and a snapshot
  cache keep that down.
- Android-only pixels: iOS rendering differences are not caught. The app must still have equal
  features on both platforms; this job checks how screens look, not parity.
