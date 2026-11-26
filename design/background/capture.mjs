// Records the dawn scene review page (out/preview.html) with Playwright: stills for desktop, phone and
// reduced motion, and a screen capture as mp4 (needs ffmpeg). Review aids only; none of it ships.
//
//   npm run dawn:preview -w @huntclub/design
//   NODE_PATH=$(npm root -g) node design/background/capture.mjs [seconds]
//
// Playwright is the machine's global install, not a dependency of this repo.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
const review = join(out, 'review');
const url = pathToFileURL(join(out, 'preview.html')).href;
const seconds = Number(process.argv[2] ?? 24);
const DESKTOP = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 780 };

mkdirSync(review, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome' });

async function still(name, viewport, options = {}, settle = 6000) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, ...options });
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForTimeout(settle);
  await page.screenshot({ path: join(review, name), type: 'jpeg', quality: 86 });
  await context.close();
}
await still('dawn-desktop.jpg', DESKTOP);
await still('dawn-phone.jpg', PHONE);
await still('dawn-reduced-motion.jpg', DESKTOP, { reducedMotion: 'reduce' }, 500);

const tmp = join(review, '.video');
const context = await browser.newContext({ viewport: DESKTOP, recordVideo: { dir: tmp, size: DESKTOP } });
const page = await context.newPage();
await page.goto(url);
await page.waitForTimeout(seconds * 1000);
await context.close();
await browser.close();

const webm = join(tmp, readdirSync(tmp).find((f) => f.endsWith('.webm')));
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', webm, '-an', '-c:v', 'libx264', '-preset', 'slow',
  '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(review, 'dawn-capture.mp4')]);
renameSync(webm, join(review, 'dawn-capture.webm'));
rmSync(tmp, { recursive: true });
rmSync(join(review, 'dawn-capture.webm'));
