// Takes the app's screenshots on a running Android emulator (the manual-only workflow
// .github/workflows/app-screenshots.yml). Expects the debug build installed and Metro serving
// the app with EXPO_PUBLIC_SCREENSHOT_MODE=1 on port 8081. For each theme it restarts the app
// in that appearance, opens each shot by deep link and saves `adb exec-out screencap -p`.
//
//   cd app && node ../scripts/run-ts.mjs scripts/android-screenshots.ts <out-dir>
import { APP_ID, URL_SCHEME } from '@huntclub/shared/app';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { SCREENSHOT_HERE } from '../src/screenshot/sample';
import {
  SCREENSHOT_FRAME,
  SCREENSHOT_SHOTS,
  SCREENSHOT_THEMES,
  shotFile,
  shotUrl,
  type ScreenshotTheme,
} from '../src/screenshot/shots';

const OUT = resolve(process.argv[2] ?? 'screenshots');
const METRO_PORT = 8081;
/** First start: the dev build fetches the whole bundle from Metro. */
const FIRST_LOAD_MS = Number(process.env.FIRST_LOAD_MS ?? 120_000);
/** Later starts (bundle cached) and each deep link (the map's tiles load). */
const LOAD_MS = Number(process.env.LOAD_MS ?? 30_000);
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 8_000);

const adb = (...args: string[]) => execFileSync('adb', args, { encoding: 'utf8' });
const shell = (...args: string[]) => adb('shell', ...args);
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const view = (url: string) =>
  shell('am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `'${url}'`, APP_ID);

/** Opens the dev build on the local Metro (no dev-launcher screen, no dev-menu tour). */
async function launch(waitMs: number) {
  shell('am', 'force-stop', APP_ID);
  const metro = encodeURIComponent(`http://localhost:${METRO_PORT}`);
  view(`${URL_SCHEME}://expo-development-client/?url=${metro}&disableOnboarding=1`);
  await sleep(waitMs);
  if (!shell('pidof', APP_ID).trim()) throw new Error('The app is not running after launch');
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  adb('reverse', `tcp:${METRO_PORT}`, `tcp:${METRO_PORT}`);
  // The 390 dp frame, and the phone in the sample property, in its own time zone.
  shell('wm', 'size', `${SCREENSHOT_FRAME.widthPx}x${SCREENSHOT_FRAME.heightPx}`);
  shell('wm', 'density', String(SCREENSHOT_FRAME.density));
  shell('service', 'call', 'alarm', '3', 's16', 'America/Chicago');
  adb('emu', 'geo', 'fix', String(SCREENSHOT_HERE.lon), String(SCREENSHOT_HERE.lat));
  // Answered up front, so no permission prompt covers a shot.
  for (const permission of ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS'])
    shell('pm', 'grant', APP_ID, `android.permission.${permission}`);

  let first = true;
  for (const theme of Object.keys(SCREENSHOT_THEMES) as ScreenshotTheme[]) {
    shell('cmd', 'uimode', 'night', SCREENSHOT_THEMES[theme]);
    await launch(first ? FIRST_LOAD_MS : LOAD_MS);
    first = false;
    for (const shot of SCREENSHOT_SHOTS) {
      view(shotUrl(shot));
      await sleep(SETTLE_MS);
      const file = join(OUT, shotFile(shot, theme));
      writeFileSync(file, execFileSync('adb', ['exec-out', 'screencap', '-p']));
      console.log(file);
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
