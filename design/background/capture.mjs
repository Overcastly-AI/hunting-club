// Records the dawn scene review page (out/preview.html) with Playwright: stills for desktop, phone and
// reduced motion, close-ups of the deer and the turkeys, and screen captures as mp4 (needs ffmpeg).
// Review aids only; none of it ships.
//
//   npm run dawn:preview -w @huntclub/design
//   NODE_PATH=$(npm root -g) node design/background/capture.mjs [seconds]
//
// Playwright is the machine's global install, not a dependency of this repo.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
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
/** Close-ups: a window of the scene (viewBox units, 16:9) shown full screen, still vector-sharp. */
const TURKEYS = '440 650 384 216';
const DEER = '440 545 500 281';

mkdirSync(review, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
});

/** Shows only the given part of the scene, without the sample copy. */
async function closeUp(page, viewBox) {
  await page.addStyleTag({ content: '.hero-copy { display: none !important; }' });
  await page.evaluate(
    (box) => document.querySelector('.dawn').setAttribute('viewBox', box),
    viewBox,
  );
}

async function still(name, viewport, { options = {}, settle = 6000, viewBox } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, ...options });
  const page = await context.newPage();
  await page.goto(url);
  if (viewBox) await closeUp(page, viewBox);
  await page.waitForTimeout(settle);
  await page.screenshot({ path: join(review, name), type: 'jpeg', quality: 86 });
  await context.close();
}
await still('dawn-desktop.jpg', DESKTOP);
await still('dawn-phone.jpg', PHONE);
await still('dawn-reduced-motion.jpg', DESKTOP, {
  options: { reducedMotion: 'reduce' },
  settle: 500,
});
await still('dawn-deer-closeup.jpg', DESKTOP, {
  options: { reducedMotion: 'reduce' },
  settle: 500,
  viewBox: DEER,
});

async function record(name, length, viewBox) {
  const tmp = join(review, `.video-${name}`);
  const context = await browser.newContext({
    viewport: DESKTOP,
    recordVideo: { dir: tmp, size: DESKTOP },
  });
  const page = await context.newPage();
  await page.goto(url);
  if (viewBox) await closeUp(page, viewBox);
  await page.waitForTimeout(length * 1000);
  await context.close();
  const webm = join(
    tmp,
    readdirSync(tmp).find((f) => f.endsWith('.webm')),
  );
  execFileSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    webm,
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '26',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    join(review, `${name}.mp4`),
  ]);
  rmSync(tmp, { recursive: true });
}
await record('dawn-capture', seconds);
await record('dawn-turkeys-closeup', 10, TURKEYS);
await browser.close();
