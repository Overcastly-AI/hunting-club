/**
 * Type scale from docs/DESIGN.md "Archivo", platform-neutral. The app turns it into React
 * Native text styles (app/src/theme/typography.ts) and the web into CSS (./css.ts).
 *
 * One family, with a rule that carries meaning: words are set at normal width, and anything
 * measured (a time, a distance, a count, a bearing, a price) is set condensed with tabular
 * figures, like a readout. Titles, buttons and marker plates are tightened a little.
 */

/**
 * Archivo variable font (axes `wght` and `wdth`). The single font file lives in
 * app/assets/fonts/Archivo-Variable.ttf; the web build bundles its Latin subset.
 */
export const fontFamily = 'Archivo';

/** Weights the design system uses (450–800). */
export const fontWeight = {
  /** Body text. */
  regular: 450,
  medium: 500,
  semiBold: 600,
  /** Tab labels, nav items, map labels. */
  demiBold: 650,
  bold: 700,
  /** Buttons. */
  heavy: 750,
  extraBold: 800,
} as const;

/** Readouts: times, distances, counts, "2 min". */
const READOUT_WIDTH = 76;
/** Page, sheet and dialog titles. */
const TITLE_WIDTH = 88;

/** Widths as a percentage of normal (`wdth` axis), each with a job. */
export const fontWidth = {
  /** Words: body, labels, captions. */
  normal: 100,
  /** Labels that must fit a tight cell (the conditions strip's labels). */
  narrow: 84,
  /** Page, sheet and dialog titles. */
  title: TITLE_WIDTH,
  /** Bottom sheet title (a title). */
  sheetTitle: TITLE_WIDTH,
  /** Buttons. */
  button: 92,
  /** Tab labels. */
  tab: 90,
  /** A marker plate's first line (the stand or hunter). */
  marker: 86,
  /** A marker plate's second line (who, how long ago). */
  markerDetail: 78,
  /** Anything measured, always with tabular figures. */
  readout: READOUT_WIDTH,
} as const;

/** Axis ranges allowed by the design system. */
export const fontAxisLimits = {
  weight: { min: 450, max: 800 },
  width: { min: 75, max: 100 },
} as const;

export type FontWeight = (typeof fontWeight)[keyof typeof fontWeight];
export type FontWidth = (typeof fontWidth)[keyof typeof fontWidth];

const DISPLAY_SIZE = 50;

/** Type sizes in px from the design system. */
export const fontSize = {
  /** Minimum for any text drawn on the map, and a marker plate's second line. */
  mapLabelMin: 13,
  /** Tab bar labels; second lines in sheets. */
  tabLabel: 14,
  /** A marker plate's first line. */
  markerName: 15,
  /** Body text, minimum (the phone). */
  body: 16,
  /** Body text on the web; buttons. */
  bodyLarge: 17,
  /** Bottom sheet title. */
  sheetTitle: 25,
  /** Clubhouse board: details read from across a room (place, since when). */
  boardDetail: 24,
  /** Clubhouse board: names and section headings read from across a room. */
  boardName: 32,
  /** Clubhouse board: the club name and clock. */
  boardTitle: 40,
  /** Display: the site headline (`displayCompact` on a phone). */
  display: DISPLAY_SIZE,
  displayCompact: 36,
  /** Page title (title-1); `title1Compact` below the tablet breakpoint. */
  title1: 32,
  title1Compact: 28,
  /** Dialog and section titles (title-2). */
  title2: 23,
  /** Plate and table group titles (title-3). */
  title3: 19,
  /** A readout in a cell: the conditions strip, a stat. */
  readout: 23,
  /** A readout in a line of text or a list row ("2 min"). */
  readoutInline: 17,
  /** Hints, table headers, meta text, badges. The smallest text outside the map. */
  caption: 14,
  /** Invite codes. */
  code: 16,
  /** The sign-in code field. */
  codeField: 24,
} as const;

/** One named text style: font axes, size and (optionally) line height, in px. */
export interface TextScaleEntry {
  readonly weight: FontWeight;
  /** Defaults to fontWidth.normal. */
  readonly width?: FontWidth;
  readonly size: number;
  readonly lineHeight?: number;
  /** Size and line height below the tablet breakpoint (web), when they differ. */
  readonly compact?: { readonly size: number; readonly lineHeight: number };
  /** Tabular (fixed-width) digits, for numbers that line up or change in place. */
  readonly tabularNums?: boolean;
}

const label = { weight: fontWeight.bold, size: fontSize.body, lineHeight: 20 } as const;

/** Anything measured: condensed, bold, tabular. */
const readout = {
  weight: fontWeight.bold,
  width: fontWidth.readout,
  tabularNums: true,
} as const;

/** The clubhouse board's club name and clock. */
const boardTitle = {
  weight: fontWeight.extraBold,
  width: fontWidth.title,
  size: fontSize.boardTitle,
  lineHeight: 48,
} as const satisfies TextScaleEntry;

/**
 * Named text styles. Mixed case only; no letter-spaced all-caps, no monospace. Sizes in px,
 * set in rem on the web so they follow the reader's text size.
 */
export const textScale = {
  /** The site headline and the sign-in page title. */
  display: {
    weight: fontWeight.extraBold,
    width: fontWidth.title,
    size: fontSize.display,
    lineHeight: 56,
    compact: { size: fontSize.displayCompact, lineHeight: 42 },
  },
  /** Page title. */
  title1: {
    weight: fontWeight.extraBold,
    width: fontWidth.title,
    size: fontSize.title1,
    lineHeight: 38,
    compact: { size: fontSize.title1Compact, lineHeight: 34 },
  },
  /** Dialog and section titles. */
  title2: {
    weight: fontWeight.extraBold,
    width: fontWidth.title,
    size: fontSize.title2,
    lineHeight: 28,
  },
  /** Plate and table group titles. */
  title3: {
    weight: fontWeight.extraBold,
    width: fontWidth.title,
    size: fontSize.title3,
    lineHeight: 24,
  },
  /** A readout in a cell: the conditions strip, a stat. */
  readout: { ...readout, size: fontSize.readout, lineHeight: 28 },
  /** A readout in a line or a list row. */
  readoutInline: { ...readout, size: fontSize.readoutInline, lineHeight: 22 },
  body: { weight: fontWeight.regular, size: fontSize.body, lineHeight: 24 },
  /** Body text on the web, page descriptions and lead text (body-lg). */
  bodyLarge: { weight: fontWeight.regular, size: fontSize.bodyLarge, lineHeight: 26 },
  /** Field labels, list-row names. */
  label,
  /** `label` at the narrow width, for cells that must not truncate (the conditions strip). */
  labelNarrow: { ...label, weight: fontWeight.semiBold, width: fontWidth.narrow },
  /** Buttons. */
  button: {
    weight: fontWeight.heavy,
    width: fontWidth.button,
    size: fontSize.bodyLarge,
    lineHeight: 22,
  },
  /** Hints, table headers (at semiBold), meta text. */
  caption: { weight: fontWeight.medium, size: fontSize.caption, lineHeight: 20 },
  /** Status badges. */
  badge: { weight: fontWeight.bold, size: fontSize.caption, lineHeight: 20 },
  /** Invite codes: Archivo with tabular figures (no monospace). */
  code: { weight: fontWeight.bold, size: fontSize.code, lineHeight: 24, tabularNums: true },
  /** The sign-in code field. */
  codeField: {
    ...readout,
    size: fontSize.codeField,
    lineHeight: 32,
  },
  tabLabel: {
    weight: fontWeight.demiBold,
    width: fontWidth.tab,
    size: fontSize.tabLabel,
    lineHeight: 20,
  },
  mapLabel: { weight: fontWeight.demiBold, size: fontSize.mapLabelMin },
  /** A marker plate's first line. */
  markerName: { weight: fontWeight.extraBold, width: fontWidth.marker, size: fontSize.markerName },
  /** A marker plate's second line ("Dale B., 2 min ago"). */
  markerDetail: {
    weight: fontWeight.semiBold,
    width: fontWidth.markerDetail,
    size: fontSize.mapLabelMin,
  },
  sheetTitle: {
    weight: fontWeight.extraBold,
    width: fontWidth.sheetTitle,
    size: fontSize.sheetTitle,
    lineHeight: 30,
  },
  boardDetail: { weight: fontWeight.semiBold, size: fontSize.boardDetail, lineHeight: 32 },
  boardName: { weight: fontWeight.extraBold, size: fontSize.boardName, lineHeight: 40 },
  boardTitle,
} as const satisfies Record<string, TextScaleEntry>;

export type TextStyleName = keyof typeof textScale;

/**
 * Archivo's average advance width at the plate weights, as a share of the font size. With the
 * width axis it estimates how wide a line of text is where nothing lays it out: the web map's
 * SVG plates, and the app's map chrome coverage test (Jest has no layout).
 */
export const AVERAGE_ADVANCE = 0.56;

/** About how wide `text` is, in px, at `size` px and `width` percent of normal width. */
export const textWidth = (text: string, size: number, width: number = fontWidth.normal) =>
  text.length * size * AVERAGE_ADVANCE * (width / 100);
