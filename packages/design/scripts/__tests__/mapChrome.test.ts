import { mapChromeVariables, rootVariablesCss } from '../../src/css';
import {
  coverageBudget,
  coveredFraction,
  formatCoverage,
  mapChrome,
  measureCoverage,
  type Rect,
} from '../../src/mapChrome';
import { breakpoints, sizes } from '../../src/sizes';

const viewport: Rect = { x: 0, y: 0, width: 100, height: 100 };
const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});

describe('coveredFraction', () => {
  it('is 0 with no overlays and for an empty viewport', () => {
    expect(coveredFraction(viewport, [])).toBe(0);
    expect(coveredFraction(rect(0, 0, 0, 100), [rect(0, 0, 10, 10)])).toBe(0);
  });

  it('measures one overlay', () => {
    expect(coveredFraction(viewport, [rect(0, 0, 50, 20)])).toBeCloseTo(0.1);
  });

  it('counts overlapping overlays once', () => {
    expect(coveredFraction(viewport, [rect(0, 0, 50, 50), rect(25, 25, 50, 50)])).toBeCloseTo(
      0.4375,
    );
    expect(coveredFraction(viewport, [rect(10, 10, 20, 20), rect(10, 10, 20, 20)])).toBeCloseTo(
      0.04,
    );
    // One inside another.
    expect(coveredFraction(viewport, [rect(0, 0, 60, 60), rect(10, 10, 5, 5)])).toBeCloseTo(0.36);
  });

  it('adds disjoint overlays, including two in the same column', () => {
    expect(
      coveredFraction(viewport, [rect(0, 0, 10, 10), rect(0, 50, 10, 10), rect(80, 0, 20, 5)]),
    ).toBeCloseTo(0.03);
  });

  it('clips overlays to the viewport and ignores ones outside or of zero size', () => {
    expect(coveredFraction(viewport, [rect(-50, -50, 100, 100)])).toBeCloseTo(0.25);
    expect(coveredFraction(viewport, [rect(200, 0, 10, 10), rect(5, 5, 0, 40)])).toBe(0);
  });

  it('works with an offset viewport (the map below an app bar)', () => {
    const map = rect(0, 56, 390, 644);
    // A pill 300x48 at the 12px inset: inside the map, so 14400 px out of 251160.
    const pill = rect(12, 68, 300, 48);
    expect(coveredFraction(map, [pill])).toBeCloseTo(14400 / (390 * 644));
    // The app bar itself is not part of the map.
    expect(coveredFraction(map, [rect(0, 0, 390, 56)])).toBe(0);
  });
});

describe('budget', () => {
  it('is 25% on phones and 15% from the desktop breakpoint', () => {
    expect(coverageBudget(390)).toBe(0.25);
    expect(coverageBudget(500)).toBe(0.25);
    expect(coverageBudget(breakpoints.desktop)).toBe(0.15);
    expect(coverageBudget(1280)).toBe(0.15);
  });

  it('reports a measurement against the budget', () => {
    expect(measureCoverage(viewport, [rect(0, 0, 50, 50)])).toEqual({
      fraction: 0.25,
      budget: 0.25,
      withinBudget: true,
    });
    expect(measureCoverage(viewport, [rect(0, 0, 51, 50)]).withinBudget).toBe(false);
    expect(formatCoverage(0.1834)).toBe('18.3%');
  });

  it('leaves room in the phone budget for the spec at rest (390 wide)', () => {
    // The rest layout the spec itself draws, on the smallest map it allows (390x600).
    const map = rect(0, 0, 390, 600);
    const { inset, pill, stack, sheet, footer } = mapChrome;
    const overlays = [
      rect(inset, inset, pill.maxWidth, pill.height),
      rect(390 - inset - stack.button, inset, stack.button, stack.button * 2 + stack.gap),
      rect(0, 600 - sheet.detents.peek, 390, sheet.detents.peek),
      rect(inset, 600 - sheet.detents.peek - footer.height, 390 - inset * 2, footer.height),
    ];
    expect(coveredFraction(map, overlays)).toBeLessThan(mapChrome.budget.phone);
  });
});

describe('mapChrome spec', () => {
  it('keeps every target at the 48px minimum', () => {
    expect(mapChrome.pill.height).toBeGreaterThanOrEqual(sizes.minTapTarget);
    expect(mapChrome.stack.button).toBeGreaterThanOrEqual(sizes.minTapTarget);
    expect(mapChrome.sheet.handleZone).toBeGreaterThanOrEqual(sizes.minTapTarget);
    expect(mapChrome.sheet.detents.peek).toBeGreaterThanOrEqual(mapChrome.sheet.handleZone);
  });

  it('orders the detents', () => {
    const { half, full } = mapChrome.sheet.detents;
    expect(half).toBeGreaterThan(0);
    expect(full).toBeGreaterThan(half);
    expect(full).toBeLessThan(1);
  });

  it('is in the generated CSS, with the fade instant under reduced motion', () => {
    expect(mapChromeVariables()['--map-chrome-pill-max-width']).toBe('300px');
    expect(mapChromeVariables()['--map-chrome-fade']).toBe('150ms');
    const css = rootVariablesCss();
    expect(css).toContain('--map-chrome-sheet-peek: 64px;');
    expect(css).toMatch(/prefers-reduced-motion[^}]*--map-chrome-fade: 0ms/);
  });
});
