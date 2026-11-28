// The map-first map chrome (docs/DESIGN.md): the freshness ring, padded marker tap areas, the
// readout strip with missing data, and the bottom sheet's states, in both themes.
import {
  darkTheme,
  lightTheme,
  mapChrome,
  sheetDetentHeights,
  type Theme,
  type ThemePreference,
} from '@huntclub/design';
import { CALM, UNKNOWN_VALUE, conditionsReadout, type ConditionsReadout } from '@huntclub/shared';
import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';

import { NOW, hunterFixture, openStandFixture, sheetFixture } from '../../test-utils/mapFixtures';
import { inTheme } from '../../test-utils/themeAudit';
import { sizes } from '../../theme';
import { FRESHNESS_RING, HunterMarker } from '../components/HunterMarker';
import {
  MapBottomSheet,
  NOBODY_SEES_YOU,
  NOT_CHECKED_IN,
  OUT_NOW,
} from '../components/MapBottomSheet';
import { MARKER_ANCHOR } from '../components/MarkerPlate';
import { OpenStandMarker } from '../components/OpenStandMarker';
import { ReadoutStrip, splitUnit } from '../components/ReadoutStrip';

const flat = (style: unknown) =>
  (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
const styleOf = (testID: string, index = 0) =>
  flat(screen.getAllByTestId(testID)[index]!.props.style);

const NEAR = { lat: 40.8, lon: -77.85 };

const THEMES: [ThemePreference, Theme][] = [
  ['dark', darkTheme],
  ['light', lightTheme],
];

async function draw(ui: ReactElement, theme: ThemePreference, ready: string | RegExp) {
  const view = await render(await inTheme(ui, theme));
  await screen.findAllByText(ready);
  return view.container;
}

describe('the freshness ring', () => {
  it.each(THEMES)(
    'is solid green when fresh, broken gold when stale, faded grey after (%s)',
    async (name, theme) => {
      await draw(
        <>
          <HunterMarker hunter={hunterFixture(1)} now={NOW} />
          <HunterMarker hunter={hunterFixture(5)} now={NOW} />
          <HunterMarker hunter={hunterFixture(30)} now={NOW} />
        </>,
        name,
        'Dale, 1 min ago',
      );
      const rings = [0, 1, 2].map((i) => styleOf('freshness-ring', i));
      expect(rings.map((r) => [r.borderColor, r.borderStyle, r.opacity])).toEqual([
        [theme.colors.fresh, 'solid', 1],
        [theme.colors.stale, 'dashed', 1],
        [theme.colors.textSecondary, 'solid', FRESHNESS_RING.faded.opacity],
      ]);
      expect(FRESHNESS_RING.faded.opacity).toBeLessThan(1);
      // The plate keeps full contrast and says how old: an old position never reads as live.
      expect(screen.getByText('Dale, 5 min ago')).toBeTruthy();
      expect(screen.getByText('Dale, 30 min ago')).toBeTruthy();
      expect(screen.getByLabelText(/30 minutes ago, last known position$/)).toBeTruthy();
    },
  );

  it('never draws a radio with a wrong clock as live', async () => {
    await draw(<HunterMarker hunter={hunterFixture(-30)} now={NOW} />, 'dark', /time unknown/);
    expect(styleOf('freshness-ring').borderStyle).toBe('dashed');
  });

  it('draws rings only, no plate, in the chat’s strip', async () => {
    await draw(<HunterMarker hunter={hunterFixture(1)} now={NOW} compact />, 'dark', 'DM');
    expect(screen.queryByText('Creek Stand')).toBeNull();
  });
});

describe('marker tap areas', () => {
  it('pads the 42 px hunter circle to a 48 px tap area', async () => {
    await draw(<HunterMarker hunter={hunterFixture(1)} now={NOW} />, 'dark', 'Creek Stand');
    const hit = styleOf('hunter-hit-area');
    expect(hit.minWidth).toBe(sizes.minTapTarget);
    expect(hit.minHeight).toBe(sizes.minTapTarget);
    const ring = styleOf('freshness-ring');
    expect(ring.minWidth).toBe(sizes.hunterMarker);
    expect(sizes.hunterMarker).toBe(42);
    expect(sizes.hunterMarker).toBeLessThan(sizes.minTapTarget);
  });

  it('pads the 38 px stand square to a 48 px tap area, with "Available" on its plate (the shared stand wording)', async () => {
    await draw(<OpenStandMarker stand={openStandFixture} />, 'dark', 'Ridge Stand');
    const hit = styleOf('stand-hit-area');
    expect([hit.minWidth, hit.minHeight]).toEqual([sizes.minTapTarget, sizes.minTapTarget]);
    const square = styleOf('stand-square');
    expect([square.width, square.height]).toEqual([38, 38]);
    expect(flat(screen.getByText('Available').props.style).color).toBe(darkTheme.colors.fresh);
    expect(screen.getByLabelText('Ridge Stand, ladder stand, available')).toBeTruthy();
  });

  it('puts the centre of the 48 px box, not the plate, on the point', () => {
    expect(MARKER_ANCHOR).toEqual({ anchor: 'left', offset: [-sizes.minTapTarget / 2, 0] });
  });
});

describe('the readout strip', () => {
  const full = conditionsReadout({
    place: { lat: 46, lon: -94 },
    now: NOW,
    windMph: 6,
    windFromDeg: 315,
    temperatureF: 34,
  });

  it('splits each readout into its number and a small unit', () => {
    expect(splitUnit('6:52 AM')).toEqual({ value: '6:52', unit: 'am' });
    expect(splitUnit('NW 6 mph')).toEqual({ value: 'NW 6', unit: 'mph' });
    expect(splitUnit('34°F')).toEqual({ value: '34', unit: '°f' });
    expect(splitUnit(CALM)).toEqual({ value: CALM, unit: null });
    expect(splitUnit(UNKNOWN_VALUE)).toEqual({ value: UNKNOWN_VALUE, unit: null });
  });

  it('reads sunrise, sunset, wind from and temperature, in that order', async () => {
    await draw(<ReadoutStrip readout={full} />, 'dark', 'Sunrise');
    expect(
      screen.getAllByText(/^(Sunrise|Sunset|Wind from|Temp)$/).map((n) => n.props.children),
    ).toEqual(['Sunrise', 'Sunset', 'Wind from', 'Temp']);
    // The number in a readout, its unit drawn small inside it.
    expect(screen.getByText('NW 6 mph')).toBeTruthy();
    expect(
      screen.getByLabelText(/Wind 6 mph from NW, blowing toward SE\. Temperature 34°F\.$/),
    ).toBeTruthy();
  });

  it.each([
    ['no place and no forecast', conditionsReadout({ place: null, now: NOW })],
    [
      'a place but no forecast',
      conditionsReadout({ place: { lat: 46, lon: -94 }, now: NOW, windMph: null }),
    ],
  ] as [string, ConditionsReadout][])(
    'shows "—" for what is not known: %s',
    async (_name, readout) => {
      await draw(<ReadoutStrip readout={readout} />, 'dark', 'Wind from');
      const unknown = screen.queryAllByText(UNKNOWN_VALUE);
      expect(unknown.length).toBe(
        [readout.sunrise, readout.sunset, readout.wind, readout.temperature].filter(
          (cell) => cell.short === UNKNOWN_VALUE,
        ).length,
      );
      expect(unknown.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByLabelText(/Wind not known\. Temperature not known\.$/)).toBeTruthy();
    },
  );

  it('never mentions legal shooting hours, first light or last light', async () => {
    const container = await draw(<ReadoutStrip readout={full} />, 'dark', 'Sunrise');
    const words = container
      .queryAll(() => true)
      .flatMap((node) => (typeof node.props.children === 'string' ? [node.props.children] : []));
    expect(words.join(' ')).not.toMatch(/shooting|legal|light/i);
  });
});

describe('the bottom sheet', () => {
  it('not checked in: one status line, Check In and the 56 px Ask for a Hand, no sunset', async () => {
    await draw(
      <MapBottomSheet
        {...sheetFixture({ audience: 'club' })}
        state="notCheckedIn"
        onCheckIn={jest.fn()}
      />,
      'dark',
      NOT_CHECKED_IN,
    );
    expect(screen.getByText(new RegExp(NOBODY_SEES_YOU))).toBeTruthy();
    // The sunset time is in the top pill only.
    expect(screen.queryByText(/until sunset|Sunset/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Check In' })).toBeTruthy();
    const ask = flat(
      screen.getByRole('button', { name: 'Ask for a Hand. Pings club members' }).props.style,
    );
    expect([ask.width, ask.height]).toEqual([mapChrome.sheet.actionRow, mapChrome.sheet.actionRow]);
  });

  it.each(THEMES)(
    'draws Ask for a Hand gold on its wash with a hand, never red (%s)',
    async (name, theme) => {
      await draw(
        <MapBottomSheet {...sheetFixture()} state="notCheckedIn" onCheckIn={jest.fn()} />,
        name,
        NOT_CHECKED_IN,
      );
      const ask = flat(
        screen.getByRole('button', { name: 'Ask for a Hand. Pings your party' }).props.style,
      );
      expect([ask.backgroundColor, ask.borderColor]).toEqual([
        theme.colors.warningTint,
        theme.colors.warning,
      ]);
      for (const red of [theme.colors.alert, theme.colors.danger]) {
        expect([ask.backgroundColor, ask.borderColor]).not.toContain(red);
      }
      expect(screen.queryByText(/SOS|911|emergency/i)).toBeNull();
    },
  );

  it('checked in on the move: where and since when, Check Out and Ask for a Hand; half has the rest', async () => {
    await draw(
      <MapBottomSheet
        {...sheetFixture({
          detent: 'half',
          nearestStand: {
            stand: { meshId: 2, name: 'Ridge Ladder', position: NEAR },
            distance: '0.3 mi',
          },
          hunters: [hunterFixture(2)],
        })}
        state="checkedIn"
        place={{ kind: 'moving' }}
        checkedInAt={NOW - 5 * 60_000}
        onCheckOut={jest.fn()}
        onChangeSpot={jest.fn()}
      />,
      'dark',
      /On the move, since 5 min ago/,
    );
    expect(screen.queryByText(NOBODY_SEES_YOU)).toBeNull();
    for (const name of [
      'Check Out',
      'Ask for a Hand. Pings your party',
      'Change spot',
      'Log a harvest. Private',
      'Nearest stand: Ridge Ladder, 0.3 mi away',
    ]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(screen.getByText(OUT_NOW)).toBeTruthy();
    expect(screen.getByText('Dale, 2 min ago')).toBeTruthy();
  });

  it("peeks at the app's 104 px, the grabber zone over the action row", async () => {
    await draw(
      <MapBottomSheet {...sheetFixture()} state="notCheckedIn" onCheckIn={jest.fn()} />,
      'dark',
      NOT_CHECKED_IN,
    );
    const sheet = flat(screen.getByTestId('map-chrome-sheet').props.style);
    const { full } = sheetDetentHeights(701, 'app');
    expect(sheet.top).toBe(47 + 701 - full);
    expect(sheet.transform).toEqual([{ translateY: full - mapChrome.sheet.peekBySurface.app }]);
    expect(mapChrome.sheet.peekBySurface.app).toBe(104);
    expect(flat(screen.getByTestId('map-sheet-handle').props.style).minHeight).toBe(
      mapChrome.sheet.handleZone,
    );
  });
});
