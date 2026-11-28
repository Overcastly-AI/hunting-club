// The Map tab's chrome (docs/DESIGN.md "Map chrome") on a 390 x 844 phone: the coverage budget
// in each state, the one top pill and its card, the icon stack, the sheet's detents, auto-hide
// and stand labels. Jest has no layout, so each piece's rect comes from what it rendered: its
// position and size styles, and for the pieces sized by their words (the pill, the footer) the
// shared text-width estimate of the words it drew.
import {
  darkTheme,
  fontSize,
  fontWidth,
  formatCoverage,
  mapChrome,
  SHEET_TOGGLE,
  measureCoverage,
  textWidth,
  type CoverageReport,
  type Rect,
} from '@huntclub/design';
import { CheckInMode } from '@huntclub/mesh';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import type { TestInstance } from 'test-renderer';

import { CheckInRadioContext, type CheckInRadio } from '../../checkin/CheckInRadio';
import { ClubEntitlementContext } from '../../club/entitlement';
import { tabBarHeight } from '../../navigation/tabBarLayout';
import { ICON_SIZE, sizes } from '../../theme';
import { createMapDataStore } from '../dataSource';
import { hunterFixture, openStandFixture } from '../../test-utils/mapFixtures';
import { inTheme } from '../../test-utils/themeAudit';
import { CONTROL_LABELS } from '../components/MapControls';
import { FOOTER_GAP } from '../components/MapFooter';
import { PARTY_LINK } from '../components/MapPill';
import { SCALE_LABEL_GAP } from '../components/ScaleBar';
import { MapScreen } from '../MapScreen';
import type { MapData } from '../types';

jest.mock(
  '@maplibre/maplibre-react-native',
  () => jest.requireActual('../../test-utils/fakeMapLibre').fakeMapLibreModule,
);
jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), push: jest.fn() } }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn() }));
jest.mock('../useMapPacks', () => ({
  useMapPacks: () => ({ packs: [], progress: {}, start: jest.fn(), remove: jest.fn() }),
}));
jest.mock('../useYourLocation', () => ({
  useYourLocation: () => ({ position: { lat: 40.8, lon: -77.86 }, locate: jest.fn() }),
}));
// The phone's cached forecast: wind and temperature, as the strip reads them.
jest.mock('../../weather/useConditions', () => ({
  useConditions: () => ({
    windMph: 6,
    windFromDeg: 315,
    temperatureF: 34,
    updated: null,
    updatedSpoken: null,
  }),
}));
// An iPhone-sized 390 x 844: the status bar and the home indicator.
const mockInsets = { top: 47, bottom: 34, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context/jest/mock').default,
  useSafeAreaInsets: () => mockInsets,
}));

/** The real clock (Testing Library's waits need it to run); every time here is from it. */
const NOW = Date.now();

const SCREEN = { width: 390, height: 844 };
/** The tab scene: the screen down to the top of the tab bar. */
const SCENE = {
  width: SCREEN.width,
  height: SCREEN.height - tabBarHeight({ fontScale: 1, bottomInset: mockInsets.bottom }),
};
/** The map, for the budget: between the status bar and the tab bar. */
const MAP: Rect = {
  x: 0,
  y: mockInsets.top,
  width: SCENE.width,
  height: SCENE.height - mockInsets.top,
};

const flat = (node: TestInstance) =>
  (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;
const num = (value: unknown) => (typeof value === 'number' ? value : 0);
/** The words a Text drew, its nested Texts included. */
const textOf = (node: TestInstance): string =>
  [node.props.children]
    .flat()
    .map((child: unknown) =>
      typeof child === 'string' || typeof child === 'number'
        ? String(child)
        : child && typeof child === 'object' && 'props' in child
          ? textOf(child as TestInstance)
          : '',
    )
    .join('');
const byId = (id: string) => screen.getByTestId(id, { includeHiddenElements: true });

/** The pill: at its wrapper's corner, as wide as its words (at most 300), 48 tall. */
function pillRect(): Rect {
  const wrapper = flat(byId('map-chrome-pill'));
  const pill = byId('map-pill');
  const [name, next] = pill.queryAll((n) => n.type === 'Text').map((n) => textOf(n));
  const words = Math.max(
    textWidth(name!, fontSize.markerName, fontWidth.marker),
    textWidth(next!, fontSize.mapLabelMin, fontWidth.markerDetail),
  );
  const { paddingHorizontal, gap, borderWidth, minHeight, maxWidth } = flat(pill);
  const content = 2 * num(paddingHorizontal) + 2 * num(borderWidth) + 2 * num(gap);
  const width = content + 10 + words + ICON_SIZE.sm;
  return {
    x: num(wrapper.left),
    y: num(wrapper.top),
    width: Math.min(num(maxWidth), num(wrapper.width), width),
    height: num(minHeight),
  };
}

/** The stack: its buttons, 48 px each and 8 apart, from the right edge. */
function stackRect(): Rect {
  const wrapper = flat(byId('map-chrome-stack'));
  const buttons = byId('map-chrome-stack').queryAll(
    (n) => n.props.accessibilityRole === 'button' && typeof n.type === 'string',
  ).length;
  const { button, gap } = mapChrome.stack;
  return {
    x: SCENE.width - num(wrapper.right) - button,
    y: num(wrapper.top),
    width: button,
    height: buttons * button + (buttons - 1) * gap,
  };
}

/** The footer: the scale bar, its length and the credit on one 24 px line, above the peek. */
function footerRect(): Rect {
  const wrapper = flat(byId('map-chrome-footer'));
  const footer = byId('map-chrome-footer');
  const bar = footer.queryAll((n) => n.type === 'View' && typeof flat(n).width === 'number')[0]!;
  const [label, credit] = footer.queryAll((n) => n.type === 'Text').map((n) => textOf(n));
  const words = (text: string) => textWidth(text, fontSize.mapLabelMin, fontWidth.markerDetail);
  const height = mapChrome.footer.height;
  return {
    x: num(wrapper.left),
    y: SCENE.height - num(wrapper.bottom) - height,
    width: num(flat(bar).width) + SCALE_LABEL_GAP + words(label!) + FOOTER_GAP + words(credit!),
    height,
  };
}

/** The sheet: from its top, moved down by its detent, to the tab bar. */
function sheetRect(): Rect {
  const style = flat(byId('map-chrome-sheet'));
  const translate = (style.transform as { translateY: number }[])[0]!.translateY;
  const y = num(style.top) + translate;
  return { x: 0, y, width: SCENE.width, height: SCENE.height - y };
}

/** Every piece of chrome on the map: the faded ones count only while they show. */
function coverage(): CoverageReport {
  const shown = (id: string) => num(flat(byId(id)).opacity ?? 1) > 0;
  const rects = [
    shown('map-chrome-pill') ? pillRect() : null,
    shown('map-chrome-stack') ? stackRect() : null,
    shown('map-chrome-footer') ? footerRect() : null,
    sheetRect(),
  ].filter((r): r is Rect => r !== null);
  return measureCoverage(MAP, rects, SCREEN.width);
}

const heard = (minutesAgo: number): MapData['mesh'] => ({
  radioConnected: true,
  radioCount: 3,
  lastHeardAt: NOW - minutesAgo * 60_000,
});

/** A club member's radio: nobody checked in, or checked in at a stand. */
function clubRadio(checkedIn = false): CheckInRadio {
  return {
    audience: 'club',
    graceMinutes: 30,
    club: {
      stands: [{ meshId: 1, name: 'Ridge Stand', position: openStandFixture.position }],
      areas: [],
    },
    checkIns: {
      current: checkedIn
        ? {
            placement: { mode: CheckInMode.Stand, standId: 1, pin: openStandFixture.position },
            messageId: 1,
            checkedInAt: NOW - 40 * 60_000,
            modeSince: NOW - 40 * 60_000,
          }
        : null,
      on: () => () => undefined,
    } as unknown as CheckInRadio['checkIns'],
  };
}

const STANDS = [
  openStandFixture,
  { ...openStandFixture, id: 'b', name: 'Big Oak Ladder', position: { lat: 40.8, lon: -77.8498 } },
];

async function showMap({
  checkedIn = false,
  mesh = heard(1),
  stands = [openStandFixture],
}: { checkedIn?: boolean; mesh?: MapData['mesh']; stands?: MapData['openStands'] } = {}) {
  const store = createMapDataStore({
    hunters: [hunterFixture(0, { heardAt: NOW - 2 * 60_000 })],
    openStands: stands,
    mesh,
  });
  await render(
    await inTheme(
      <ClubEntitlementContext.Provider
        value={{ clubId: 'c1', clubName: 'Pine Ridge Hunt Club', featuresUntil: NOW + 1e9 }}
      >
        <CheckInRadioContext.Provider value={clubRadio(checkedIn)}>
          <MapScreen dataSource={store} initialView={{ center: [-77.86, 40.8], zoom: 14 }} />
        </CheckInRadioContext.Provider>
      </ClubEntitlementContext.Provider>,
      'dark',
    ),
  );
  await screen.findByText('Pine Ridge Hunt Club');
  await fireEvent(screen.getByTestId('map-screen'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, ...SCENE } },
  });
  // Reduce motion settles (the fades and the sheet are instant under it).
  await act(async () => undefined);
}

const region = (
  over: Partial<{
    center: [number, number];
    zoom: number;
    bearing: number;
    userInteraction: boolean;
  }> = {},
) => ({
  nativeEvent: {
    center: [-77.86, 40.8],
    zoom: 14,
    bearing: 0,
    pitch: 0,
    animated: false,
    userInteraction: true,
    ...over,
  },
});
const map = () => screen.getByTestId('map');

/**
 * A screen reader's swipe up (increment) or down (decrement) on the sheet's grabber zone. Called
 * on the handler itself: the zone's pan handlers decline touches, so Testing Library would skip
 * the event, but a screen reader's action reaches it.
 */
const swipe = (actionName: 'increment' | 'decrement') =>
  act(() =>
    screen
      .getByTestId('map-sheet-handle')
      .props.onAccessibilityAction({ nativeEvent: { actionName } }),
  );

/** Measured in each state, for the PR's coverage table. */
const measured: Record<string, string> = {};

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});
afterEach(() => jest.useRealTimers());
afterAll(() => {
  console.log(
    `Map chrome coverage at 390 x 844 (map ${MAP.width} x ${MAP.height}):\n` +
      Object.entries(measured)
        .map(([state, value]) => `  ${state}: ${value}`)
        .join('\n'),
  );
});

describe('the coverage budget (25% of the map at rest)', () => {
  it.each([
    ['at rest', {}],
    ['checked in', { checkedIn: true }],
    ['quiet mesh', { mesh: heard(15) }],
  ] as const)('%s', async (state, options) => {
    await showMap(options);
    const report = coverage();
    measured[state] = formatCoverage(report.fraction);
    expect(report.budget).toBe(mapChrome.budget.phone);
    expect(report.withinBudget).toBe(true);
  });

  it('sheet back at peek after opening it', async () => {
    await showMap();
    await swipe('increment');
    const half = coverage();
    measured['sheet half (not budgeted)'] = formatCoverage(half.fraction);
    expect(half.withinBudget).toBe(false);
    await swipe('decrement');
    const report = coverage();
    measured['sheet at peek'] = formatCoverage(report.fraction);
    expect(report.withinBudget).toBe(true);
  });

  it('turned (the compass shows)', async () => {
    await showMap();
    await fireEvent(map(), 'regionDidChange', region({ bearing: 40 }));
    expect(screen.getByRole('button', { name: CONTROL_LABELS.northUp })).toBeTruthy();
    const report = coverage();
    measured['map turned, compass shown'] = formatCoverage(report.fraction);
    expect(report.withinBudget).toBe(true);
  });

  it('counts the pieces it should: a wider pill would break it', async () => {
    await showMap();
    const at = coverage().fraction;
    const wide = measureCoverage(
      MAP,
      [{ ...pillRect(), width: 300, height: 48 * 4 }, stackRect(), footerRect(), sheetRect()],
      SCREEN.width,
    );
    expect(wide.fraction).toBeGreaterThan(at);
    expect(wide.withinBudget).toBe(false);
  });
});

describe('the top pill', () => {
  it('shows the mesh dot, the club and one next time, and drops the card on a tap', async () => {
    await showMap();
    const pill = screen.getByRole('button', { name: /^Pine Ridge Hunt Club\./ });
    expect(screen.getByText(/until sunset$/)).toBeTruthy();
    expect(flat(screen.getByTestId('mesh-dot')).backgroundColor).toBe(darkTheme.colors.fresh);
    // Sunset shows once: in the pill, not in the sheet too.
    expect(screen.queryAllByText(/sunset/i)).toHaveLength(1);
    await fireEvent.press(pill);
    expect(screen.getByTestId('map-pill-card')).toBeTruthy();
    for (const label of ['Sunrise', 'Sunset', 'Wind from', 'Temp']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText('NW 6 mph')).toBeTruthy();
    expect(screen.getByText(/Mesh: 3 radios/)).toBeTruthy();
    expect(screen.getByRole('button', { name: PARTY_LINK })).toBeTruthy();
    // No legal shooting hours, no first or last light, anywhere.
    expect(screen.queryByText(/shooting|first light|last light/i)).toBeNull();
    await fireEvent.press(map());
    expect(screen.queryByTestId('map-pill-card')).toBeNull();
  });

  it('shows the overdue time while checked in, and Overdue at in the card', async () => {
    await showMap({ checkedIn: true });
    expect(screen.getByText(/^Overdue at \d/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Pine Ridge Hunt Club\./ }));
    expect(screen.getByLabelText(/^Overdue at \d/)).toBeTruthy();
  });

  it('turns the dot gold when the mesh goes quiet, with no banner', async () => {
    await showMap({ mesh: heard(15) });
    expect(flat(screen.getByTestId('mesh-dot')).backgroundColor).toBe(darkTheme.colors.warning);
    expect(screen.queryByText(/where they were last heard/)).toBeNull();
  });

  it('has no duplicate chips: one pill, and Party only from its card', async () => {
    await showMap();
    expect(screen.queryAllByRole('button', { name: /^Pine Ridge Hunt Club/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: PARTY_LINK })).toBeNull();
  });
});

describe('the icon stack', () => {
  it('is Layers and Find me with spoken names, no zoom buttons, and no compass while north up', async () => {
    await showMap();
    const stack = byId('map-chrome-stack');
    const names = stack
      .queryAll((n) => n.props.accessibilityRole === 'button' && typeof n.type === 'string')
      .map((n) => n.props.accessibilityLabel);
    expect(names).toEqual([CONTROL_LABELS.layers, CONTROL_LABELS.findMe]);
    expect(screen.queryByRole('button', { name: /zoom/i })).toBeNull();
  });

  it('opens Layers with the basemaps, Fit property and stands, hunters and scent', async () => {
    await showMap();
    await fireEvent.press(screen.getByRole('button', { name: CONTROL_LABELS.layers }));
    expect(await screen.findByText('Map layers')).toBeTruthy();
    for (const name of ['Aerial', 'Topo', 'Fit property']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    for (const name of ['Stands', 'Hunters checked in']) {
      expect(screen.getByRole('switch', { name })).toBeTruthy();
    }
    // This club's areas have no outlines on the phone, so there is nothing to show or hide.
    expect(screen.queryByRole('switch', { name: 'Club areas' })).toBeNull();
  });
});

describe('the sheet', () => {
  it('peeks with the status, Check In and Ask for a Hand, and moves between detents', async () => {
    await showMap();
    expect(screen.getByTestId('map-sheet-handle').props.accessibilityValue).toEqual({
      text: 'Peek',
    });
    expect(screen.getByRole('button', { name: 'Check In' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ask for a Hand. Pings club members' })).toBeTruthy();
    await swipe('increment');
    expect(screen.getByTestId('map-sheet-handle').props.accessibilityValue).toEqual({
      text: 'Half open',
    });
    expect(screen.getByRole('button', { name: /^Nearest stand: Ridge Stand/ })).toBeTruthy();
    await swipe('increment');
    expect(screen.getByTestId('map-sheet-handle').props.accessibilityValue).toEqual({
      text: 'Open',
    });
    await swipe('increment');
    expect(screen.getByTestId('map-sheet-handle').props.accessibilityValue).toEqual({
      text: 'Open',
    });
  });

  it('checked in: the status, Ask for a Hand and Check Out', async () => {
    await showMap({ checkedIn: true });
    expect(screen.getByText(/at Ridge Stand, since 40 min ago/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check Out' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ask for a Hand. Pings club members' })).toBeTruthy();
  });
});

describe('auto-hide', () => {
  const opacity = (id: string) => flat(byId(id)).opacity;

  it('fades the pill, stack and footer while the hunter moves the map, never the sheet', async () => {
    await showMap();
    jest.useFakeTimers();
    await fireEvent(map(), 'regionWillChange', region());
    for (const id of ['map-chrome-pill', 'map-chrome-stack', 'map-chrome-footer']) {
      expect(opacity(id)).toBe(0);
    }
    expect(screen.getByRole('button', { name: 'Check In' })).toBeTruthy();
    await fireEvent(map(), 'regionDidChange', region());
    await act(() => jest.advanceTimersByTime(mapChrome.autoHide.idleMs - 1));
    expect(opacity('map-chrome-pill')).toBe(0);
    await act(() => jest.advanceTimersByTime(1));
    expect(opacity('map-chrome-pill')).toBe(1);
    // A tap brings it back at once.
    await fireEvent(map(), 'regionWillChange', region());
    expect(opacity('map-chrome-stack')).toBe(0);
    await fireEvent.press(map());
    expect(opacity('map-chrome-stack')).toBe(1);
  });

  it('does not hide for a camera move the hunter did not make (Find me)', async () => {
    await showMap();
    await fireEvent(map(), 'regionWillChange', region({ userInteraction: false }));
    expect(opacity('map-chrome-pill')).toBe(1);
  });

  it('stays pinned while the mesh is quiet', async () => {
    await showMap({ mesh: heard(15) });
    await fireEvent(map(), 'regionWillChange', region());
    expect(opacity('map-chrome-pill')).toBe(1);
  });
});

describe('stand labels', () => {
  const labelled = () => screen.queryAllByText(/Ridge Stand|Big Oak Ladder/);

  it('are icons only below the zoom threshold, and a tap shows the name', async () => {
    await showMap({ stands: STANDS });
    expect(labelled()).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: /^Big Oak Ladder, ladder stand/ }));
    expect(screen.getAllByText('Big Oak Ladder')).toHaveLength(1);
  });

  it('show from zoom 15, one line within the 140 px cap, dropping one that would overlap', async () => {
    await showMap({ stands: STANDS });
    await fireEvent(map(), 'regionDidChange', region({ zoom: mapChrome.labels.minZoom + 1 }));
    // The two stands are about 15 px apart at zoom 16: only one name fits.
    expect(labelled()).toHaveLength(1);
    const text = labelled()[0]!;
    expect(text.props.numberOfLines).toBe(1);
    expect(flat(text.parent!).maxWidth).toBe(mapChrome.labels.maxWidth);
    expect(screen.queryByText('Available')).toBeNull();
    // Zoomed in with both on screen, each name fits beside its stand.
    await fireEvent(map(), 'regionDidChange', region({ zoom: 19, center: [-77.84985, 40.8] }));
    expect(labelled()).toHaveLength(2);
  });

  it('hide just below zoom 15 and show at it', async () => {
    await showMap({ stands: [openStandFixture] });
    const at = (zoom: number) =>
      fireEvent(map(), 'regionDidChange', region({ zoom, center: [-77.8501, 40.8] }));
    await at(mapChrome.labels.minZoom - 0.01);
    expect(labelled()).toHaveLength(0);
    expect(screen.queryByTestId('stand-label')).toBeNull();
    await at(mapChrome.labels.minZoom);
    expect(labelled()).toHaveLength(1);
    await at(mapChrome.labels.minZoom - 1);
    expect(labelled()).toHaveLength(0);
  });

  it('draw no box: 13 px semibold theme text on a 2 px plate halo, beside a 32 px marker, in a 48 px target', async () => {
    await showMap({ stands: [openStandFixture] });
    await fireEvent(map(), 'regionDidChange', region({ zoom: 16, center: [-77.8501, 40.8] }));
    const { text, marker, halo } = { ...mapChrome.labels, halo: mapChrome.labels.text.halo };
    const name = flat(screen.getByText('Ridge Stand'));
    expect([name.fontSize, name.color]).toEqual([text.size, darkTheme.colors[text.color]]);
    expect(name.fontVariationSettings).toMatchObject({ wght: text.weight });
    expect(name.fontSize).toBeGreaterThanOrEqual(13);
    // The halo: the name again in the plate colour, 2 px around it, hidden from screen readers.
    const copies = byId('stand-label').queryAll(
      (n) => n.type === 'Text' && flat(n).color === darkTheme.colors[text.haloColor],
    );
    expect(copies.length).toBeGreaterThan(0);
    for (const copy of copies) {
      const { left, top } = flat(copy);
      expect(Math.hypot(num(left) - halo, num(top) - halo)).toBeCloseTo(halo, 1);
    }
    // No plate behind it.
    expect(flat(byId('stand-label')).backgroundColor).toBeUndefined();
    expect(flat(byId('stand-square')).width).toBe(marker);
    const target = screen.getByRole('button', { name: /^Ridge Stand, ladder stand/ });
    expect(flat(target).minHeight).toBe(sizes.minTapTarget);
  });
});

describe('the sheet at full', () => {
  const chromeIds = ['map-chrome-pill', 'map-chrome-stack', 'map-chrome-footer'];

  it('hides the pill, stack and footer, and its header names the club with a collapse to half', async () => {
    await showMap();
    await swipe('increment');
    await swipe('increment');
    expect(screen.getByTestId('map-sheet-handle').props.accessibilityValue).toEqual({
      text: 'Open',
    });
    for (const id of chromeIds) {
      const piece = byId(id);
      expect(flat(piece).opacity).toBe(0);
      expect(piece.props.pointerEvents).toBe('none');
      expect(piece.props.accessibilityElementsHidden).toBe(true);
    }
    // Hidden from screen readers: the only club name read out is the sheet's header.
    expect(screen.queryByRole('button', { name: /^Pine Ridge Hunt Club\./ })).toBeNull();
    expect(within(byId('map-chrome-sheet')).getByText('Pine Ridge Hunt Club')).toBeTruthy();
    // Ask for a Hand stays one tap away at every detent.
    expect(screen.getByRole('button', { name: 'Ask for a Hand. Pings club members' })).toBeTruthy();
    const collapse = screen.getByRole('button', { name: SHEET_TOGGLE.less });
    expect([flat(collapse).width, flat(collapse).height]).toEqual([
      sizes.minTapTarget,
      sizes.minTapTarget,
    ]);
    await fireEvent.press(collapse);
    expect(screen.getByTestId('map-sheet-handle').props.accessibilityValue).toEqual({
      text: 'Half open',
    });
    for (const id of chromeIds) expect(flat(byId(id)).opacity).toBe(1);
    expect(screen.queryByRole('button', { name: SHEET_TOGGLE.less })).toBeNull();
    expect(screen.getByRole('button', { name: /^Pine Ridge Hunt Club\./ })).toBeTruthy();
  });
});
