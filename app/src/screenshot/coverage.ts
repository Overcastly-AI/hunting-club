// How much of the map a screenshot's chrome covers, from the app's real layout on the emulator:
// the screen's `uiautomator dump` (React Native gives each view its testID as resource-id) gives
// the map's and the chrome's boxes, and the shared measureCoverage measures them, as the web's
// shoot.ts does with its rendered rects. Read by the screenshot driver for each shot's caption.
import { formatCoverage, measureCoverage, type CoverageReport, type Rect } from '@huntclub/design';

/** The map's own view (MapScreen testID). */
export const MAP_TEST_ID = 'map';
/** The chrome over it: the top pill, the icon stack, the footer line and the sheet. */
export const CHROME_TEST_IDS = [
  'map-chrome-pill',
  'map-chrome-stack',
  'map-chrome-footer',
  'map-chrome-sheet',
] as const;

const attr = (node: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(node)?.[1];

/** Each resource-id's box in screen px, from a `uiautomator dump` (the first node with it). */
export function dumpRects(xml: string): Map<string, Rect> {
  const rects = new Map<string, Rect>();
  for (const [node] of xml.matchAll(/<node\s[^>]*>/g)) {
    const id = attr(node, 'resource-id');
    const box = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/.exec(attr(node, 'bounds') ?? '');
    if (!id || !box || rects.has(id)) continue;
    const [x0, y0, x1, y1] = box.slice(1).map(Number) as [number, number, number, number];
    rects.set(id, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
  }
  return rects;
}

/**
 * The chrome's coverage of the map in a dump, against the budget for a phone `screenWidth` wide
 * (dp). Null when the map is not in it (a panel's own window in front, or no testID boxes).
 */
export function chromeCoverage(xml: string, screenWidth: number): CoverageReport | null {
  const rects = dumpRects(xml);
  const map = rects.get(MAP_TEST_ID);
  if (!map || map.width <= 0 || map.height <= 0) return null;
  const chrome = CHROME_TEST_IDS.flatMap((id) => rects.get(id) ?? []);
  return measureCoverage(map, chrome, screenWidth);
}

/** "Map at rest: chrome covers 18.3% of the map (budget 20.0%)", or why it is not measured. */
export function shotCaption(caption: string, report: CoverageReport | null | undefined): string {
  if (report === undefined) return caption;
  if (report === null) return `${caption}: chrome coverage not measured (no map layout on screen)`;
  return `${caption}: chrome covers ${formatCoverage(report.fraction)} of the map (budget ${formatCoverage(report.budget)})`;
}
