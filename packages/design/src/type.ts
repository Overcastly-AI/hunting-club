/**
 * Type scale from docs/SPEC.md "Design system (from Design D)", platform-neutral.
 * The app turns it into React Native text styles (app/src/theme/typography.ts) and
 * the web admin page into CSS (web/src/theme/css.ts).
 */

/**
 * Archivo variable font (axes `wght` and `wdth`). The single font file lives in
 * app/assets/fonts/Archivo-Variable.ttf; the web build bundles that same file.
 */
export const fontFamily = 'Archivo';

/** Weights the design system uses. The spec allows 500–800. */
export const fontWeight = {
  medium: 500,
  semiBold: 600,
  bold: 700,
  extraBold: 800,
} as const;

/** Design D's narrow width: the sheet title and any text that must fit a tight panel. */
const NARROW_WIDTH = 82;

/** Widths as a percentage of normal (`wdth` axis). The spec allows 75–100. */
export const fontWidth = {
  normal: 100,
  narrow: NARROW_WIDTH,
  /** Bottom sheet title. */
  sheetTitle: NARROW_WIDTH,
} as const;

/** Axis ranges allowed by the design system. */
export const fontAxisLimits = {
  weight: { min: 500, max: 800 },
  width: { min: 75, max: 100 },
} as const;

export type FontWeight = (typeof fontWeight)[keyof typeof fontWeight];
export type FontWidth = (typeof fontWidth)[keyof typeof fontWidth];

const DISPLAY_SIZE = 40;

/** Type sizes in px from the design system. */
export const fontSize = {
  /** Minimum for any text drawn on the map. */
  mapLabelMin: 13,
  /** Tab bar labels. */
  tabLabel: 14,
  /** Hunter and stand marker names. */
  markerName: 15,
  /** Body text, minimum. */
  body: 16,
  /** Body text, large. */
  bodyLarge: 17,
  /** Bottom sheet title. */
  sheetTitle: 25,
  /** Clubhouse board: details read from across a room (place, since when). */
  boardDetail: 24,
  /** Clubhouse board: names and section headings read from across a room. */
  boardName: 32,
  /** Clubhouse board: the club name and clock (the display size). */
  boardTitle: DISPLAY_SIZE,
  /** Display: the sign-in brand panel, board, marketing only. */
  display: DISPLAY_SIZE,
  /** Page title (title-1); `title1Compact` below the tablet breakpoint. */
  title1: 28,
  title1Compact: 24,
  /** Dialog and section titles (title-2). */
  title2: 22,
  /** Card and table group titles (title-3). */
  title3: 18,
  /** Stat tile value; `statCompact` below the tablet breakpoint. */
  stat: 36,
  statCompact: 30,
  /** Hints, table headers, meta text, badges. The smallest text outside the map. */
  caption: 14,
  /** Invite codes. */
  code: 15,
  /** The sign-in code field. */
  codeField: 24,
} as const;

/** Monospace stack for codes (web). The app draws codes in Archivo. */
export const monoFontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** One named text style: font axes, size and (optionally) line height, in px. */
export interface TextScaleEntry {
  readonly weight: FontWeight;
  /** Defaults to fontWidth.normal. */
  readonly width?: FontWidth;
  readonly size: number;
  readonly lineHeight?: number;
  /** Size and line height below the tablet breakpoint (web), when they differ. */
  readonly compact?: { readonly size: number; readonly lineHeight: number };
  /** `mono` for codes; defaults to Archivo. */
  readonly family?: 'mono';
  /** Tabular (fixed-width) digits, for numbers that line up or change in place. */
  readonly tabularNums?: boolean;
}

const display = {
  weight: fontWeight.extraBold,
  width: fontWidth.narrow,
  size: fontSize.display,
  lineHeight: 48,
} as const satisfies TextScaleEntry;

const label = { weight: fontWeight.semiBold, size: fontSize.body, lineHeight: 20 } as const;

/**
 * Named text styles (docs/UI_REDESIGN.md 4.2). Mixed case only; no letter-spaced all-caps.
 * Sizes in px, set in rem on the web so they follow the reader's text size.
 */
export const textScale = {
  /** Sign-in brand panel, board, marketing only. */
  display,
  /** Page title. */
  title1: {
    weight: fontWeight.extraBold,
    width: fontWidth.narrow,
    size: fontSize.title1,
    lineHeight: 36,
    compact: { size: fontSize.title1Compact, lineHeight: 32 },
  },
  title2: { weight: fontWeight.bold, size: fontSize.title2, lineHeight: 28 },
  title3: { weight: fontWeight.bold, size: fontSize.title3, lineHeight: 24 },
  /** StatTile value. */
  stat: {
    weight: fontWeight.extraBold,
    width: fontWidth.narrow,
    size: fontSize.stat,
    lineHeight: 40,
    compact: { size: fontSize.statCompact, lineHeight: 36 },
    tabularNums: true,
  },
  body: { weight: fontWeight.medium, size: fontSize.body, lineHeight: 24 },
  /** Page descriptions and lead text (body-lg). */
  bodyLarge: { weight: fontWeight.medium, size: fontSize.bodyLarge, lineHeight: 26 },
  /** Buttons, nav items, field labels. */
  label,
  /** `label` at the narrow width, for panels that must not truncate (map conditions). */
  labelNarrow: { ...label, width: fontWidth.narrow },
  /** Hints, table headers (at semiBold), meta text. */
  caption: { weight: fontWeight.medium, size: fontSize.caption, lineHeight: 20 },
  /** StatusPill. */
  badge: { weight: fontWeight.semiBold, size: fontSize.caption, lineHeight: 20 },
  /** Invite codes. */
  code: { weight: fontWeight.semiBold, size: fontSize.code, lineHeight: 24, family: 'mono' },
  /** The sign-in code field. */
  codeField: {
    weight: fontWeight.semiBold,
    size: fontSize.codeField,
    lineHeight: 32,
    tabularNums: true,
  },
  tabLabel: { weight: fontWeight.semiBold, size: fontSize.tabLabel, lineHeight: 20 },
  mapLabel: { weight: fontWeight.bold, size: fontSize.mapLabelMin },
  markerName: { weight: fontWeight.extraBold, size: fontSize.markerName },
  sheetTitle: {
    weight: fontWeight.extraBold,
    width: fontWidth.sheetTitle,
    size: fontSize.sheetTitle,
    lineHeight: 30,
  },
  boardDetail: { weight: fontWeight.semiBold, size: fontSize.boardDetail, lineHeight: 32 },
  boardName: { weight: fontWeight.extraBold, size: fontSize.boardName, lineHeight: 40 },
  /** The clubhouse board's club name and clock: the display style. */
  boardTitle: display,
} as const satisfies Record<string, TextScaleEntry>;

export type TextStyleName = keyof typeof textScale;
