// The map's chrome: the one spec for everything that floats over a map (docs/DESIGN.md "Map
// chrome"), shared by the app and the web, plus the pure helper that measures how much of the
// map that chrome covers. Plain numbers and functions: no DOM or React Native code here.
import { breakpoints, sizes } from './sizes';

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
  /** The one top pill: mesh dot, club name, the next time. Tap drops the conditions card. */
  pill: { height: sizes.minTapTarget, maxWidth: 300 },
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
    detents: {
      /** px: the grabber and one summary line. Never hides. */
      peek: 64,
      /** Fraction of the map's height. */
      half: 0.5,
      /** Fraction of the map's height; the pill stays visible above it. */
      full: 0.88,
    },
    /** A release faster than this (px per ms) moves one detent in the swipe's direction. */
    flickVelocity: 0.5,
  },
  /** The single footer line: scale bar and attribution, bottom left, above the peek. */
  footer: { height: 24 },
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

/** `coveredFraction` checked against `coverageBudget(viewport.width)`. */
export function measureCoverage(viewport: Rect, overlays: readonly Rect[]): CoverageReport {
  const fraction = coveredFraction(viewport, overlays);
  const budget = coverageBudget(viewport.width);
  return { fraction, budget, withinBudget: fraction <= budget };
}

/** `0.1834` → `"18.3%"`, for test messages and PR reports. */
export const formatCoverage = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;
