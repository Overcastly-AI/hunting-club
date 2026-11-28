// The map's chrome: the one spec for everything that floats over a map (docs/DESIGN.md "Map
// chrome"), shared by the app and the web, plus the pure helper that measures how much of the
// map that chrome covers. Plain numbers and functions: no DOM or React Native code here.
import { breakpoints, sizes } from './sizes';
import type { ThemeColorToken } from './theme';
import { fontSize, fontWeight } from './type';

/**
 * The sheet's peek on each surface, px. The web's is the grabber and one summary line; the
 * app's is the 48 px grabber zone (grabber and status line) over a 56 px action row (Check In
 * or Check Out, and the 56 by 56 Ask for a Hand).
 */
const SHEET_PEEK = { web: 64, app: 104 } as const;
export type ChromeSurface = keyof typeof SHEET_PEEK;

/** The map chrome spec, in px, ms and fractions. */
export const mapChrome = {
  /**
   * At rest, chrome may cover at most this fraction of the map: `phone` below the desktop
   * breakpoint (the phone at 390x844, the web at 390 and 500), `desktop` from it (1280). The
   * map is the area between the status or app bar and the tab bar.
   */
  budget: { phone: 0.25, desktop: 0.15 },
  /** Gap between every piece of chrome and the map's edge. */
  inset: 12,
  /**
   * The one top pill. In the app: mesh dot, club name, the next time (up to `maxWidth`). On the
   * web, whose app bar or sidebar already names the club: the next time only, `width` wide.
   * A tap drops the conditions card where they are not beside the map.
   */
  pill: { height: sizes.minTapTarget, maxWidth: 300, width: 200 },
  /** The right-edge icon stack: Layers, (desktop) split zoom, Find me. */
  stack: {
    button: sizes.minTapTarget,
    gap: 8,
    /** The split zoom +/- control on desktop: one button wide, two tall. */
    zoomWidth: sizes.minTapTarget,
    zoomHeight: sizes.minTapTarget * 2,
  },
  /** The bottom sheet on phones (the app, and the web below the desktop breakpoint). */
  sheet: {
    /** The draggable zone at the top of the sheet; the whole peek is this tall. */
    handleZone: sizes.minTapTarget,
    /** The peek's height on each surface, px. Never hides. */
    peekBySurface: SHEET_PEEK,
    /** The app's action row under the grabber zone: Check In or Check Out, and Ask for a Hand. */
    actionRow: 56,
    detents: {
      /** px: the web's peek (`peekBySurface.web`). */
      peek: SHEET_PEEK.web,
      /** Fraction of the map's height. */
      half: 0.5,
      /** Fraction of the map's height. The sheet covers the map, and the web hides the map's chrome. */
      full: 0.88,
    },
    /** A release faster than this (px per ms) moves one detent in the swipe's direction. */
    flickVelocity: 0.5,
  },
  /**
   * The single footer line: scale bar and attribution, bottom left, above the peek. It moves
   * with the sheet and keeps `clearance` px between its lowest ink and the sheet's top.
   */
  footer: { height: 24, clearance: 8 },
  /** Auto-hide while the map moves (pan, zoom, rotate). */
  autoHide: {
    /** Fade out (and back in) over this long. Instant under reduced motion. */
    fadeMs: 150,
    /** Chrome returns after the map has been still this long, or on a map tap. */
    idleMs: 1500,
    /** Chrome stays pinned from this long before an overdue time. */
    pinBeforeOverdueMs: 30 * 60 * 1000,
  },
  /** Stand labels on the map. */
  labels: {
    maxWidth: 140,
    maxHeight: 32,
    /** Below this map zoom, stands are icons only; the name shows on tap. */
    minZoom: 15,
    /** The stand marker a label sits beside, px (its tap target stays `sizes.minTapTarget`). */
    marker: 32,
    /** Gap between the marker's edge and its label, px. */
    gap: 6,
    /**
     * The label itself: no box, just the name over a halo. Colours are theme tokens: light text
     * on a dark halo in the dark theme, dark text on a light halo in daylight.
     */
    text: {
      size: fontSize.mapLabelMin,
      weight: fontWeight.semiBold,
      /** The halo's width around each glyph, px. */
      halo: 2,
      color: 'text',
      haloColor: 'plate',
    } as const satisfies {
      size: number;
      weight: number;
      halo: number;
      color: ThemeColorToken;
      haloColor: ThemeColorToken;
    },
  },
} as const;

/** The coverage budget for a map this many px wide. */
export function coverageBudget(viewportWidth: number): number {
  return viewportWidth >= breakpoints.desktop ? mapChrome.budget.desktop : mapChrome.budget.phone;
}

/** A rectangle in px, as `getBoundingClientRect()` and `onLayout` report one. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The fraction (0 to 1) of `viewport` that `overlays` cover. Overlays are clipped to the
 * viewport and where they overlap the area counts once. Empty or zero-size rects add nothing.
 */
export function coveredFraction(viewport: Rect, overlays: readonly Rect[]): number {
  const area = viewport.width * viewport.height;
  if (area <= 0) return 0;
  const right = viewport.x + viewport.width;
  const bottom = viewport.y + viewport.height;
  const clipped = overlays
    .map((r) => ({
      x0: Math.max(viewport.x, r.x),
      y0: Math.max(viewport.y, r.y),
      x1: Math.min(right, r.x + r.width),
      y1: Math.min(bottom, r.y + r.height),
    }))
    .filter((r) => r.x1 > r.x0 && r.y1 > r.y0);
  // Sweep the distinct x edges; in each slab, merge the covered y intervals.
  const xs = [...new Set(clipped.flatMap((r) => [r.x0, r.x1]))].sort((a, b) => a - b);
  let covered = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = xs[i]!;
    const x1 = xs[i + 1]!;
    const spans = clipped
      .filter((r) => r.x0 <= x0 && r.x1 >= x1)
      .map((r) => [r.y0, r.y1] as const)
      .sort((a, b) => a[0] - b[0]);
    let height = 0;
    let top = -Infinity;
    let end = -Infinity;
    for (const [y0, y1] of spans) {
      if (y0 > end) {
        height += end - top > 0 ? end - top : 0;
        top = y0;
        end = y1;
      } else if (y1 > end) end = y1;
    }
    height += end - top > 0 ? end - top : 0;
    covered += height * (x1 - x0);
  }
  return covered / area;
}

/** A coverage measurement against the budget for that width. */
export interface CoverageReport {
  fraction: number;
  budget: number;
  withinBudget: boolean;
}

/**
 * `coveredFraction` checked against the budget for the screen: `screenWidth` is the window's
 * width (1280 on a desktop whose map sits beside a rail and a panel), the map's own by default.
 */
export function measureCoverage(
  viewport: Rect,
  overlays: readonly Rect[],
  screenWidth: number = viewport.width,
): CoverageReport {
  const fraction = coveredFraction(viewport, overlays);
  const budget = coverageBudget(screenWidth);
  return { fraction, budget, withinBudget: fraction <= budget };
}

/** `0.1834` → `"18.3%"`, for test messages and PR reports. */
export const formatCoverage = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;

/** What keeps the chrome on screen while the map moves. */
export interface ChromePinInput {
  now: number;
  /** When the overdue alert goes out (sunset plus the club's grace), if known. */
  overdueAt?: number | undefined;
  /** An alert (Ask for a Hand, overdue) is open. */
  alertActive?: boolean | undefined;
  /** The mesh has gone quiet (no radio heard). */
  meshQuiet?: boolean | undefined;
}

/**
 * Whether the chrome stays pinned (never auto-hides): during an active alert, while the mesh is
 * quiet, and from `pinBeforeOverdueMs` before an overdue time until it has passed.
 */
export function chromePinned(input: ChromePinInput): boolean {
  if (input.alertActive || input.meshQuiet) return true;
  const at = input.overdueAt;
  if (at === undefined || !Number.isFinite(at)) return false;
  return input.now >= at - mapChrome.autoHide.pinBeforeOverdueMs && input.now <= at;
}

/** Whether two rects overlap (touching edges do not). */
export const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** A marker and the label it would show, in map px. */
export interface LabelCandidate {
  id: string;
  marker: Rect;
  label: Rect;
}

/**
 * Which markers show their label: none below `labels.minZoom` but the `selected` one; above it,
 * each in turn (the selected one first) unless its label would overlap a label already shown or
 * another marker. The rest are icons only, and show their name on a tap.
 */
export function visibleLabels(
  candidates: readonly LabelCandidate[],
  zoom: number,
  selected?: string | null,
): Set<string> {
  const shown = new Set<string>();
  const ordered = [...candidates].sort(
    (a, b) => Number(b.id === selected) - Number(a.id === selected),
  );
  const placed: Rect[] = [];
  for (const c of ordered) {
    const chosen = c.id === selected;
    if (!chosen && zoom < mapChrome.labels.minZoom) continue;
    const blocked =
      placed.some((r) => rectsOverlap(r, c.label)) ||
      candidates.some((o) => o.id !== c.id && rectsOverlap(o.marker, c.label));
    if (blocked && !chosen) continue;
    shown.add(c.id);
    placed.push(c.label);
  }
  return shown;
}

/** The bottom sheet's detents, in order from lowest. */
export const SHEET_DETENTS = ['peek', 'half', 'full'] as const;
export type SheetDetent = (typeof SHEET_DETENTS)[number];

/** Each detent's height in px on a map this tall, on `surface` (the web by default). */
export function sheetDetentHeights(
  mapHeight: number,
  surface: ChromeSurface = 'web',
): Record<SheetDetent, number> {
  const { half, full } = mapChrome.sheet.detents;
  const peek = mapChrome.sheet.peekBySurface[surface];
  return {
    peek,
    half: Math.max(peek, Math.round(mapHeight * half)),
    full: Math.max(peek, Math.round(mapHeight * full)),
  };
}

/**
 * Where a released sheet settles: a flick (faster than `sheet.flickVelocity`, in px per ms,
 * positive downward) moves to the next detent its way from `from`; a slow release snaps to the
 * detent nearest `height`.
 */
export function snapDetent(
  heights: Record<SheetDetent, number>,
  from: SheetDetent,
  height: number,
  velocity: number,
): SheetDetent {
  const at = SHEET_DETENTS.indexOf(from);
  if (Math.abs(velocity) > mapChrome.sheet.flickVelocity) {
    const next = at + (velocity < 0 ? 1 : -1);
    return SHEET_DETENTS[Math.max(0, Math.min(SHEET_DETENTS.length - 1, next))]!;
  }
  return SHEET_DETENTS.reduce((best, d) =>
    Math.abs(heights[d] - height) < Math.abs(heights[best] - height) ? d : best,
  );
}
