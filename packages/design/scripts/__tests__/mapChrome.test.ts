import { boundary } from '../../src/colors';
import { contrastRatio } from '../../src/contrast';
import { mapChromeVariables, rootVariablesCss } from '../../src/css';
import { themes } from '../../src/theme';
import { fitText, fontSize, fontWeight } from '../../src/type';
import {
  chromePinned,
  coverageBudget,
  coveredFraction,
  areaLabelBox,
  formatCoverage,
  giveWay,
  LABEL_FROM_CENTRE,
  LABEL_HEIGHT,
  mapChrome,
  measureCoverage,
  placeAreaLabels,
  PLATE_EDGE_ROOM,
  plateSide,
  rectsOverlap,
  sheetDetentHeights,
  snapDetent,
  standLabelCandidate,
  standLabelLayout,
  visibleLabels,
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
    // A desktop map is narrower than the screen it is on: the screen's budget applies.
    expect(measureCoverage(rect(232, 0, 648, 860), [], 1280).budget).toBe(0.15);
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

  it('draws stand labels as 13px semibold text on a 2px themed halo, 6px from a 32px marker', () => {
    const { marker, gap, text, maxHeight } = mapChrome.labels;
    expect(text.size).toBe(fontSize.mapLabelMin);
    expect(text.size).toBeGreaterThanOrEqual(13);
    expect(text.weight).toBe(fontWeight.semiBold);
    expect(text.halo).toBe(2);
    expect([marker, gap]).toEqual([32, 6]);
    expect(marker).toBeLessThan(sizes.minTapTarget);
    expect(text.size + 2 * text.halo).toBeLessThanOrEqual(maxHeight);
    const vars = mapChromeVariables();
    expect(vars['--map-chrome-label-color']).toBe('var(--theme-text)');
    expect(vars['--map-chrome-label-halo-color']).toBe('var(--theme-plate)');
    // Light on dark in the dark theme, dark on light in daylight; readable either way.
    for (const theme of [themes.dark, themes.light]) {
      const ink = theme.colors[text.color];
      const halo = theme.colors[text.haloColor];
      expect(contrastRatio(ink, halo)).toBeGreaterThanOrEqual(7);
    }
    expect(contrastRatio(themes.dark.colors[text.color], '#000000')).toBeGreaterThan(
      contrastRatio(themes.dark.colors[text.haloColor], '#000000'),
    );
    expect(contrastRatio(themes.light.colors[text.color], '#000000')).toBeLessThan(
      contrastRatio(themes.light.colors[text.haloColor], '#000000'),
    );
  });
});

describe('the property line on a light basemap', () => {
  /** USGS Topo's paper and its tint for wooded land, the lightest grounds the line crosses. */
  const TOPO_GROUNDS = ['#FFFFFF', '#F4F2EC', '#D3E9C8'];
  it('is wider over a dark halo that stands out at 3:1 or better on the paper', () => {
    const { onLight } = boundary;
    expect(onLight.width).toBeGreaterThan(boundary.width);
    expect(onLight.haloWidth).toBeGreaterThanOrEqual(onLight.width + 2 * 2);
    expect(onLight.innerLineWidth).toBeGreaterThan(boundary.innerLineWidth);
    for (const ground of TOPO_GROUNDS)
      expect(contrastRatio(onLight.halo, ground)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(onLight.stroke, onLight.halo)).toBeGreaterThanOrEqual(3);
  });
});

describe('chromePinned', () => {
  const overdueAt = Date.UTC(2026, 10, 28, 23, 8);
  const minutes = (n: number) => n * 60 * 1000;

  it('pins during an alert and while the mesh is quiet', () => {
    expect(chromePinned({ now: 0, alertActive: true })).toBe(true);
    expect(chromePinned({ now: 0, meshQuiet: true })).toBe(true);
    expect(chromePinned({ now: 0 })).toBe(false);
  });

  it('pins from 30 minutes before the overdue time until it passes', () => {
    expect(chromePinned({ now: overdueAt - minutes(31), overdueAt })).toBe(false);
    expect(chromePinned({ now: overdueAt - minutes(30), overdueAt })).toBe(true);
    expect(chromePinned({ now: overdueAt, overdueAt })).toBe(true);
    expect(chromePinned({ now: overdueAt + 1, overdueAt })).toBe(false);
    expect(chromePinned({ now: overdueAt, overdueAt: undefined })).toBe(false);
  });
});

describe('visibleLabels', () => {
  const marker = (x: number, y: number) => rect(x - 24, y - 24, 48, 48);
  const label = (x: number, y: number) => rect(x + 25, y - 14, 120, 28);
  const at = (id: string, x: number, y: number) => ({
    id,
    marker: marker(x, y),
    label: label(x, y),
  });
  const deep = mapChrome.labels.minZoom;

  it('shows no labels below the zoom threshold, except the selected one', () => {
    const stands = [at('a', 100, 100), at('b', 400, 400)];
    expect([...visibleLabels(stands, deep - 1)]).toEqual([]);
    expect([...visibleLabels(stands, deep - 1, 'b')]).toEqual(['b']);
    expect([...visibleLabels(stands, deep)].sort()).toEqual(['a', 'b']);
  });

  it('drops a label that would overlap another label or marker, keeping the selected one', () => {
    // b sits just right of a: a's label would cover b's marker.
    const stands = [at('a', 100, 100), at('b', 200, 100), at('c', 100, 300)];
    expect([...visibleLabels(stands, deep)].sort()).toEqual(['b', 'c']);
    expect([...visibleLabels(stands, deep, 'a')].sort()).toEqual(['a', 'c']);
  });

  it('knows touching rects do not overlap', () => {
    expect(rectsOverlap(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(false);
    expect(rectsOverlap(rect(0, 0, 10, 10), rect(9, 9, 10, 10))).toBe(true);
  });
});

describe('plateSide', () => {
  it('is right unless that crosses the edge and the left fits; then the side with more room', () => {
    expect(plateSide(100, 25, 120, 1000)).toBe('right');
    expect(plateSide(900, 25, 120, 1000)).toBe('left');
    // Exactly at the edge room still fits on the right.
    expect(plateSide(1000 - PLATE_EDGE_ROOM - 145, 25, 120, 1000)).toBe('right');
    // Too wide for either side of a narrow map.
    expect(plateSide(60, 25, 300, 200)).toBe('right');
    expect(plateSide(150, 25, 300, 200)).toBe('left');
  });
});

describe('stand label layout', () => {
  const { marker, gap, maxWidth, text } = mapChrome.labels;

  it('cuts a long name with an ellipsis within the 140 px cap, and keeps a short one', () => {
    expect(fitText('Creek', 100, 15, 86)).toBe('Creek');
    const long = standLabelLayout('East Ridge Box Blind by the Creek Bottom', 100, 1000);
    expect(long.text).toMatch(/…$/);
    expect(long.width).toBeLessThanOrEqual(maxWidth);
    expect(LABEL_HEIGHT).toBeLessThanOrEqual(mapChrome.labels.maxHeight);
    expect(LABEL_HEIGHT).toBeGreaterThanOrEqual(text.size + 2 * text.halo);
  });

  it('sits 6 px from the 32 px marker, on the right unless that crosses the edge', () => {
    expect(LABEL_FROM_CENTRE).toBe(marker / 2 + gap);
    const right = standLabelLayout('Creek', 100, 1000);
    expect([right.side, right.offset]).toEqual(['right', LABEL_FROM_CENTRE]);
    const left = standLabelLayout('Creek', 990, 1000);
    expect(left.side).toBe('left');
    expect(left.offset + left.width).toBe(-LABEL_FROM_CENTRE);
  });

  it("gives visibleLabels the stand's 48 px target and its label's rect", () => {
    const c = standLabelCandidate({ id: 's', name: 'Creek' }, 100, 200, 1000);
    expect(c.marker).toEqual(rect(76, 176, 48, 48));
    expect(c.label.x).toBe(100 + LABEL_FROM_CENTRE);
    expect(c.label.y + c.label.height / 2).toBe(200);
  });
});

describe('area labels give way to stands', () => {
  const { gap, area } = mapChrome.labels;
  const deep = mapChrome.labels.minZoom;
  /** A stand's 48 px tap target centred on (x, y). */
  const stand = (x: number, y: number) => rect(x - 24, y - 24, 48, 48);

  it('centres an area name below the point it is given', () => {
    const { text, rect: r } = areaLabelBox('North 40', 200, 100);
    expect(text).toBe('North 40');
    expect(r.x + r.width / 2).toBeCloseTo(200);
    expect(r.y + r.height / 2).toBe(100 + area.drop);
    expect(r.height).toBe(LABEL_HEIGHT);
  });

  it('stays put when nothing is in the way', () => {
    const label = rect(100, 100, 80, 21);
    expect(giveWay(label, [stand(400, 400)])).toBe(label);
  });

  it('moves down past a stand it would cover, the gap to spare, before trying up', () => {
    const label = rect(100, 100, 80, 21);
    // The stand's top edge is 10 px under the label's top: down needs 48 - 10 + 6 = 44 px,
    // up needs 21 - 10 + 6 = 17 px. The smaller move wins.
    const moved = giveWay(label, [rect(120, 110, 48, 48)])!;
    expect(moved.y).toBe(110 - gap - 21);
    expect(moved.x).toBe(label.x);
    // Equal moves either way: down first (into the area, away from its edge).
    const centred = rect(100, 100, 80, 20);
    const down = giveWay(centred, [rect(120, 100, 48, 20)])!;
    expect(down.y).toBe(100 + 20 + gap);
  });

  it('hides where no move within one tap target clears every stand', () => {
    const label = rect(100, 100, 80, 21);
    // Stands stacked above, on and below the label: every way out is too far.
    const wall = [stand(140, 60), stand(140, 110), stand(140, 160)];
    expect(giveWay(label, wall)).toBeNull();
    expect(area.maxShift).toBe(sizes.minTapTarget);
  });

  it('places area labels clear of stands and of each other, and none below zoom 15', () => {
    const labels = [
      { id: 'a', rect: rect(100, 100, 80, 21) },
      { id: 'b', rect: rect(110, 105, 80, 21) },
      { id: 'c', rect: rect(400, 400, 80, 21) },
    ];
    const stands = [stand(140, 112)];
    expect(placeAreaLabels(labels, stands, deep - 0.5).size).toBe(0);
    const placed = placeAreaLabels(labels, stands, deep);
    expect(placed.get('c')).toEqual(labels[2]!.rect);
    const shown = [...placed.values()];
    for (const r of shown) {
      expect(stands.some((s) => rectsOverlap(s, r))).toBe(false);
      expect(shown.filter((o) => o !== r).some((o) => rectsOverlap(o, r))).toBe(false);
    }
    expect(placed.has('a')).toBe(true);
    expect(placed.get('a')!.y).not.toBe(100);
  });
});

describe('the sheet', () => {
  const heights = sheetDetentHeights(700);

  it('has a fixed peek and half and full of the map', () => {
    expect(heights).toEqual({ peek: mapChrome.sheet.detents.peek, half: 350, full: 616 });
    expect(sheetDetentHeights(50).half).toBe(mapChrome.sheet.detents.peek);
  });

  it("has one peek per surface: the app's holds the grabber zone and the action row", () => {
    const { peekBySurface, handleZone, actionRow, detents } = mapChrome.sheet;
    expect(detents.peek).toBe(peekBySurface.web);
    expect(peekBySurface.app).toBe(handleZone + actionRow);
    expect(actionRow).toBeGreaterThanOrEqual(sizes.minTapTarget);
    expect(sheetDetentHeights(700, 'app')).toEqual({
      peek: peekBySurface.app,
      half: 350,
      full: 616,
    });
  });

  it('snaps a slow release to the nearest detent', () => {
    expect(snapDetent(heights, 'peek', 100, 0)).toBe('peek');
    expect(snapDetent(heights, 'peek', 300, 0.1)).toBe('half');
    expect(snapDetent(heights, 'half', 560, -0.2)).toBe('full');
  });

  it('moves a flick one detent its way, never past the ends', () => {
    const flick = mapChrome.sheet.flickVelocity + 0.1;
    expect(snapDetent(heights, 'peek', 90, -flick)).toBe('half');
    expect(snapDetent(heights, 'half', 340, -flick)).toBe('full');
    expect(snapDetent(heights, 'full', 600, flick)).toBe('half');
    expect(snapDetent(heights, 'peek', 64, flick)).toBe('peek');
    expect(snapDetent(heights, 'full', 616, -flick)).toBe('full');
  });
});
