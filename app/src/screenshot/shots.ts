// What the Android screenshot job captures (.github/workflows/app-screenshots.yml, driven by
// scripts/android-screenshots.ts): the screens, how a deep link opens each, the themes and the
// file names. Plain data, so the Node driver and the app read the same list.
import { URL_SCHEME } from '@huntclub/shared/app';

/** The Map tab's `shot` search param: which state of the map the screenshot shows. */
export const MAP_SHOT_PARAM = 'shot';

/**
 * The map's states the UI Director reviews (docs/DESIGN.md "Map chrome"): at rest, checked in,
 * the sheet half open and Layers open. The app has no drawing mode, so there is no drawing shot.
 */
export const MAP_SHOTS = {
  map: {},
  'checked-in': { checkedIn: true },
  'sheet-half': { detent: 'half' },
  layers: { panel: 'layers' },
} as const satisfies Record<string, { checkedIn?: boolean; detent?: 'half'; panel?: 'layers' }>;
export type MapShotName = keyof typeof MAP_SHOTS;

const mapShot = <N extends MapShotName>(name: N) =>
  ({ name, path: `/?${MAP_SHOT_PARAM}=${name}` }) as const;

export const SCREENSHOT_SHOTS = [
  mapShot('map'),
  mapShot('checked-in'),
  mapShot('sheet-half'),
  mapShot('layers'),
  { name: 'chat', path: '/chat' },
  { name: 'check-in', path: '/check-in' },
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
