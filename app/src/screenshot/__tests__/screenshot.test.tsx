// The dev-only screenshot mode (src/screenshot) and its shot list: off unless a dev bundle is
// built with EXPO_PUBLIC_SCREENSHOT_MODE=1, kept out of every other file, and its stand-in radio
// fills Check In and Chat with the sample club.
import { formatCoverage } from '@huntclub/design';
import { polygonBounds, STAND_STATUS_LABELS } from '@huntclub/shared';
import { URL_SCHEME } from '@huntclub/shared/app';
import { SAMPLE_PROPERTY } from '@huntclub/shared/sample';
import { render, screen } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { ChatRadioContext } from '../../chat/ChatRadio';
import { ChatScreen, NO_RADIO } from '../../chat/ChatScreen';
import { chatStore } from '../../chat/chatStore';
import { CheckInRadioContext } from '../../checkin/CheckInRadio';
import { CheckInScreen, WHERE_ARE_YOU_HUNTING } from '../../checkin/CheckInScreen';
import { AskForHandSheet } from '../../safety/components/AskForHandSheet';
import { SafetyRadioContext } from '../../safety/SafetyRadio';
import { answerPermissionAlerts } from '../../test-utils/alerts';
import { placePhone } from '../../test-utils/fakeMapLibre';
import { SRC, sourceFiles } from '../../test-utils/sourceFiles';
import { screenshotMode } from '../index';
import { CHROME_TEST_IDS, chromeCoverage, dumpRects, MAP_TEST_ID, shotCaption } from '../coverage';
import { fixClock, standInChat, standInCheckIn, standInSafety } from '../mode';
import {
  SCREENSHOT_CHECK_IN_STAND,
  SCREENSHOT_CLUB,
  SCREENSHOT_HERE,
  SCREENSHOT_NOW,
  screenshotChat,
  screenshotMapData,
} from '../sample';
import {
  MAP_SHOTS,
  mapShotState,
  SCREENSHOT_FRAME,
  SCREENSHOT_SHOTS,
  SCREENSHOT_THEMES,
  shotFile,
  shotUrl,
} from '../shots';

jest.mock(
  '@maplibre/maplibre-react-native',
  () => jest.requireActual('../../test-utils/fakeMapLibre').fakeMapLibreModule,
);
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));

describe('screenshot mode', () => {
  it('is off unless the bundle was built with EXPO_PUBLIC_SCREENSHOT_MODE=1', () => {
    expect(process.env.EXPO_PUBLIC_SCREENSHOT_MODE).toBeUndefined();
    expect(screenshotMode).toBeNull();
  });

  it('is reached only through the guarded entry, so release bundles drop it', () => {
    const dir = join(SRC, 'screenshot');
    const outside = sourceFiles(SRC, /\.tsx?$/, [dir]).filter((file) =>
      /from '[./]*screenshot\/(mode|sample)'/.test(readFileSync(file, 'utf8')),
    );
    expect(outside.map((file) => relative(SRC, file))).toEqual([]);
    const entry = readFileSync(join(dir, 'index.ts'), 'utf8');
    expect(entry).toMatch(/__DEV__ && process\.env\.EXPO_PUBLIC_SCREENSHOT_MODE === '1'/);
    expect(entry).not.toMatch(/^import (?!type).*'\.\/mode'/m);
  });

  it('moves the clock to the fixed day and puts it back', () => {
    const restore = fixClock();
    try {
      expect(Math.abs(Date.now() - SCREENSHOT_NOW)).toBeLessThan(1_000);
    } finally {
      restore();
    }
    expect(Math.abs(Date.now() - SCREENSHOT_NOW)).toBeGreaterThan(1_000);
  });
});

describe('the sample club', () => {
  const [west, south, east, north] = polygonBounds(SAMPLE_PROPERTY.boundary);
  const inside = (p: { lat: number; lon: number }) =>
    p.lon >= west && p.lon <= east && p.lat >= south && p.lat <= north;

  it('puts three radios on the map, each hunter and the open stand on the property', () => {
    const data = screenshotMapData(SCREENSHOT_NOW);
    expect(data.mesh).toMatchObject({ radioConnected: true, radioCount: 3 });
    expect(data.hunters).toHaveLength(3);
    expect(data.openStands.map((s) => s.name)).toEqual(['Big Oak Ladder']);
    for (const p of [...data.hunters, ...data.openStands]) expect(inside(p.position)).toBe(true);
    expect(inside(SCREENSHOT_HERE)).toBe(true);
  });

  it('offers only open stands at check-in (Field Blind is closed)', () => {
    const active = SAMPLE_PROPERTY.stands.filter((s) => s.active).map((s) => s.name);
    expect(SCREENSHOT_CLUB.stands.map((s) => s.name)).toEqual(active);
    expect(active).not.toContain('Field Blind');
  });
});

describe('the stand-in radio', () => {
  beforeEach(() => {
    answerPermissionAlerts();
    placePhone(SCREENSHOT_HERE);
  });

  it('fills Check In with the club stands, the open one Available', async () => {
    await render(
      <CheckInRadioContext.Provider value={standInCheckIn()}>
        <CheckInScreen />
      </CheckInRadioContext.Provider>,
    );
    await screen.findByText(WHERE_ARE_YOU_HUNTING);
    await screen.findByRole('radio', { name: /^At a stand/ });
    expect(
      screen.getByRole('radio', {
        name: new RegExp(`^Big Oak Ladder\\. Ladder stand, ${STAND_STATUS_LABELS.open}`, 'i'),
      }),
    ).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Creek Stand\. Dale B\. is here/ })).toBeDisabled();
  });

  it('opens Ask for a Hand to club members, ready to slide, with no "connect your radio"', async () => {
    await render(
      <SafetyRadioContext.Provider value={standInSafety(standInChat(SCREENSHOT_NOW))}>
        <AskForHandSheet visible onClose={() => undefined} />
      </SafetyRadioContext.Provider>,
    );
    expect(await screen.findByText(/^Pings club members/)).toBeTruthy();
    expect(screen.queryByText(/Connect your radio/)).toBeNull();
  });

  it('shows the Whole club thread with no "connect a radio" banner', async () => {
    for (const item of screenshotChat(SCREENSHOT_NOW)) chatStore.add(item);
    await render(
      <ChatRadioContext.Provider value={standInChat(SCREENSHOT_NOW)}>
        <ChatScreen />
      </ChatRadioContext.Provider>,
    );
    expect(await screen.findByText(/Big Oak should be good/)).toBeTruthy();
    expect(screen.getByText(/Two does crossed the creek/)).toBeTruthy();
    expect(screen.queryByText(NO_RADIO)).toBeNull();
  });
});

describe('the shots', () => {
  it('are the map at rest, checked in, the sheet at each detent, Ask for a Hand, Layers, Chat and Check In, in dark and daylight at 390x844, opened by deep link', () => {
    const dp = SCREENSHOT_FRAME.density / 160;
    expect(SCREENSHOT_FRAME.widthPx / dp).toBe(390);
    expect(SCREENSHOT_FRAME.heightPx / dp).toBe(844);
    const files = Object.keys(SCREENSHOT_THEMES).flatMap((theme) =>
      SCREENSHOT_SHOTS.map((shot) => shotFile(shot, theme as keyof typeof SCREENSHOT_THEMES)),
    );
    expect(new Set(files).size).toBe(18);
    expect(files).toContain('phone-layers-390-daylight.png');
    expect(files).toContain('phone-checked-in-390-dark.png');
    expect(files).toContain('phone-ask-for-hand-390-daylight.png');
    expect(files).toContain('phone-sheet-full-390-dark.png');
    expect(SCREENSHOT_SHOTS.map(shotUrl)).toEqual([
      `${URL_SCHEME}:///?shot=map`,
      `${URL_SCHEME}:///?shot=checked-in`,
      `${URL_SCHEME}:///?shot=sheet-peek`,
      `${URL_SCHEME}:///?shot=sheet-half`,
      `${URL_SCHEME}:///?shot=sheet-full`,
      `${URL_SCHEME}:///?shot=ask-for-hand`,
      `${URL_SCHEME}:///?shot=layers`,
      `${URL_SCHEME}:///chat`,
      `${URL_SCHEME}:///check-in`,
    ]);
  });

  it('checks the stand-in radio in at the open stand for the checked-in shot only', () => {
    const radio = standInCheckIn();
    const changed = jest.fn();
    radio.checkIns.on('change', changed);
    radio.setCheckedIn(true);
    expect(radio.checkIns.current?.placement).toMatchObject({
      standId: SCREENSHOT_CHECK_IN_STAND.meshId,
    });
    radio.setCheckedIn(false);
    expect(radio.checkIns.current).toBeNull();
    expect(changed).toHaveBeenCalledTimes(2);
    expect(mapShotState('checked-in')).toEqual({ checkedIn: true });
    expect(mapShotState('ask-for-hand')).toEqual({ checkedIn: true, panel: 'askForHand' });
    expect(mapShotState('sheet-half')).toEqual({ detent: 'half' });
    expect(mapShotState('map')?.checkedIn).toBeUndefined();
    expect(mapShotState('chat')).toBeUndefined();
  });

  it('gives every shot a caption', () => {
    for (const shot of SCREENSHOT_SHOTS) expect(shot.caption.length).toBeGreaterThan(0);
    expect(MAP_SHOTS.map.caption).toBe('Map at rest');
  });
});

describe('a shot caption with its chrome coverage', () => {
  // A 1170 x 2532 px screen: the map under the status bar, the chrome over it.
  const node = (id: string, [x0, y0, x1, y1]: number[]) =>
    `<node index="0" text="" resource-id="${id}" class="android.view.ViewGroup" bounds="[${x0},${y0}][${x1},${y1}]" />`;
  const dump = (...nodes: string[]) =>
    `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">${nodes.join('')}</hierarchy>`;
  const map = node(MAP_TEST_ID, [0, 100, 1000, 2100]);

  it('reads each testID box from the uiautomator dump', () => {
    expect(dumpRects(dump(map, node('map-chrome-pill', [10, 120, 610, 270])))).toEqual(
      new Map([
        [MAP_TEST_ID, { x: 0, y: 100, width: 1000, height: 2000 }],
        ['map-chrome-pill', { x: 10, y: 120, width: 600, height: 150 }],
      ]),
    );
  });

  it('measures the chrome with the shared measureCoverage, overlaps once', () => {
    const xml = dump(
      map,
      node(CHROME_TEST_IDS[0], [0, 100, 1000, 200]), // 5%
      node(CHROME_TEST_IDS[3], [0, 1900, 1000, 2532]), // 10% (clipped to the map)
      node(CHROME_TEST_IDS[2], [0, 2000, 500, 2100]), // inside the sheet: adds nothing
      node('something-else', [0, 0, 1000, 2532]),
    );
    const report = chromeCoverage(xml, SCREENSHOT_FRAME.widthDp)!;
    expect(report.fraction).toBeCloseTo(0.15, 5);
    expect(shotCaption('Map at rest', report)).toBe(
      `Map at rest: chrome covers 15.0% of the map (budget ${formatCoverage(report.budget)})`,
    );
  });

  it('says when it cannot measure, and leaves non-map shots as they are', () => {
    expect(chromeCoverage(dump(node('map-chrome-sheet', [0, 0, 10, 10])), 390)).toBeNull();
    expect(shotCaption('Ask for a Hand open', null)).toMatch(/not measured/);
    expect(shotCaption('Chat', undefined)).toBe('Chat');
  });
});
