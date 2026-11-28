// What the Android screenshot job captures (.github/workflows/app-screenshots.yml, driven by
// scripts/android-screenshots.ts): the screens, how a deep link opens each, the themes and the
// file names. Plain data, so the Node driver and the app read the same list.
import type { SheetDetent } from '@huntclub/design';
import { URL_SCHEME } from '@huntclub/shared/app';

import type { RequestedPanel } from '../map/MapScreen';

/** The Map tab's `shot` search param: which state of the map the screenshot shows. */
export const MAP_SHOT_PARAM = 'shot';

/** One map state: checked in or not, the sheet's detent (peek unless set) and an open panel. */
export interface MapShotState {
  checkedIn?: boolean;
  detent?: SheetDetent;
  panel?: RequestedPanel;
}

/**
 * The map's states the UI Director reviews (docs/DESIGN.md "Map chrome"): at rest, checked in,
 * the sheet at each detent, Ask for a Hand open and Layers open, each with the caption that goes
 * with its file. At rest the sheet is at peek too: sheet-peek names that state for the detent
 * set. The app has no drawing mode, so there is no drawing shot.
 */
export const MAP_SHOTS = {
  map: { state: {}, caption: 'Map at rest' },
  'checked-in': { state: { checkedIn: true }, caption: 'Map, checked in at a stand' },
  'sheet-peek': { state: { detent: 'peek' }, caption: 'Sheet at peek' },
  'sheet-half': { state: { detent: 'half' }, caption: 'Sheet half open' },
  'sheet-full': {
    state: { detent: 'full' },
    caption: 'Sheet full open: the club name and Show less; no pill, stack or footer',
  },
  'ask-for-hand': {
    state: { checkedIn: true, panel: 'askForHand' },
    caption: 'Ask for a Hand open, checked in',
  },
  layers: { state: { panel: 'layers' }, caption: 'Layers open' },
} as const satisfies Record<string, { state: MapShotState; caption: string }>;
export type MapShotName = keyof typeof MAP_SHOTS;

/** The state a map shot's `shot` param names; none for any other value. */
export const mapShotState = (shot: string | undefined): MapShotState | undefined =>
  shot !== undefined && shot in MAP_SHOTS ? MAP_SHOTS[shot as MapShotName].state : undefined;

const mapShot = <N extends MapShotName>(name: N) =>
  ({
    name,
    path: `/?${MAP_SHOT_PARAM}=${name}`,
    caption: MAP_SHOTS[name].caption,
    map: true,
  }) as const;

export const SCREENSHOT_SHOTS = [
  mapShot('map'),
  mapShot('checked-in'),
  mapShot('sheet-peek'),
  mapShot('sheet-half'),
  mapShot('sheet-full'),
  mapShot('ask-for-hand'),
  mapShot('layers'),
  { name: 'chat', path: '/chat', caption: 'Chat', map: false },
  { name: 'check-in', path: '/check-in', caption: 'Check In', map: false },
] as const;
export type ScreenshotShot = (typeof SCREENSHOT_SHOTS)[number];

/** The phone's appearance for each theme (`adb shell cmd uimode night <value>`); the app is on System. */
export const SCREENSHOT_THEMES = { dark: 'yes', daylight: 'no' } as const;
export type ScreenshotTheme = keyof typeof SCREENSHOT_THEMES;

/**
 * The design's 390-wide phone frame: 1170 x 2532 px at density 480 (3x) is 390 x 844 dp, the
 * iPhone-sized frame the mockups and the web's phone shots use.
 */
export const SCREENSHOT_FRAME = { widthPx: 1170, heightPx: 2532, density: 480, widthDp: 390 };

/** The deep link that opens a shot: huntclub:///chat. */
export const shotUrl = (shot: ScreenshotShot) => `${URL_SCHEME}://${shot.path}`;

/** Named like the web's shots: phone-map-390-dark.png. */
export const shotFile = (shot: ScreenshotShot, theme: ScreenshotTheme) =>
  `phone-${shot.name}-${SCREENSHOT_FRAME.widthDp}-${theme}.png`;

/** Each file's caption, one line per shot, beside the PNGs in the artifact. */
export const CAPTIONS_FILE = 'captions.txt';
