import { colors } from './colors';

/**
 * The Hunt Club Mesh mark: three radios linked in a mesh, the top one (you) in accent,
 * on the surface color. One source for the web favicon, the sign-in logo and the app's
 * icons and splash (APP_ICONS); colors come from the tokens, so every rendering follows
 * any token change.
 */
interface Node {
  x: number;
  y: number;
  fill: string;
}

/** Drawing area of the mark (viewBox units). */
const SIZE = 64;

export interface LogoMarkOptions {
  /**
   * `rounded`: the surface tile with rounded corners (favicon, in-app logo).
   * `square`: full-bleed surface (OS icon masks round it). `none`: transparent.
   */
  background?: 'rounded' | 'square' | 'none';
  /** Draw the radios and links (off for a plain background layer). */
  glyph?: boolean;
  /** One color for the whole glyph (Android themed-icon mask). */
  monochrome?: boolean;
  /** Empty margin around the drawing area, in viewBox units (keeps the glyph in a safe zone). */
  padding?: number;
}

export function logoMarkSvg(options: LogoMarkOptions = {}): string {
  const { background = 'rounded', glyph = true, monochrome = false, padding = 0 } = options;
  const ink = (color: string) => (monochrome ? colors.text : color);
  const top: Node = { x: 32, y: 17, fill: ink(colors.accent) };
  const left: Node = { x: 17, y: 45, fill: ink(colors.text) };
  const right: Node = { x: 47, y: 45, fill: ink(colors.text) };
  const nodes = [top, left, right];
  const link = (a: Node, b: Node) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
  const extent = SIZE + 2 * padding;
  const viewBox = padding ? `${-padding} ${-padding} ${extent} ${extent}` : `0 0 ${SIZE} ${SIZE}`;
  const tile = {
    rounded: `<rect width="${SIZE}" height="${SIZE}" rx="14" fill="${colors.surface}" />`,
    square: `<rect x="${-padding}" y="${-padding}" width="${extent}" height="${extent}" fill="${colors.surface}" />`,
    none: '',
  }[background];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">`,
    tile,
    ...(glyph
      ? [
          `<g stroke="${ink(colors.textSecondary)}" stroke-width="4" stroke-linecap="round">`,
          link(top, left),
          link(left, right),
          link(right, top),
          '</g>',
          ...nodes.map((n) => `<circle cx="${n.x}" cy="${n.y}" r="7" fill="${n.fill}" />`),
        ]
      : []),
    '</svg>',
  ].join('');
}

/**
 * The app's icon and splash PNGs (app/assets), all rendered from the mark by
 * `npm run icons -w @huntclub/design`; a test keeps the committed files in sync.
 * Sizes are the ones app.config.ts uses.
 */
export const APP_ICONS = [
  // iOS and the Android legacy icon: full-bleed tile, the OS applies its mask.
  { file: 'icon.png', size: 1024, mark: { background: 'square' } },
  // Android adaptive icon: the glyph inside the safe zone, over a plain surface layer.
  { file: 'android-icon-foreground.png', size: 512, mark: { background: 'none', padding: 18 } },
  { file: 'android-icon-background.png', size: 512, mark: { background: 'square', glyph: false } },
  {
    file: 'android-icon-monochrome.png',
    size: 432,
    mark: { background: 'none', padding: 18, monochrome: true },
  },
  // Splash: the glyph on the splash background color (app.config.ts).
  { file: 'splash-icon.png', size: 1024, mark: { background: 'none', padding: 4 } },
  { file: 'favicon.png', size: 48, mark: {} },
] as const satisfies readonly { file: string; size: number; mark: LogoMarkOptions }[];

/**
 * The web page's /favicon.ico (web/public, served as is): the rounded mark at the sizes
 * browsers and crawlers ask for, packed into one ICO by the same icons script.
 */
export const FAVICON_ICO = {
  file: 'favicon.ico',
  sizes: [16, 32, 48],
  mark: {},
} as const satisfies {
  file: string;
  sizes: readonly number[];
  mark: LogoMarkOptions;
};
