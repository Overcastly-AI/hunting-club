// The dev-only screenshot mode (src/screenshot) and its shot list: off unless a dev bundle is
// built with EXPO_PUBLIC_SCREENSHOT_MODE=1, kept out of every other file, and its stand-in radio
// fills Check In and Chat with the sample club.
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
import { answerPermissionAlerts } from '../../test-utils/alerts';
import { placePhone } from '../../test-utils/fakeMapLibre';
import { SRC, sourceFiles } from '../../test-utils/sourceFiles';
import { screenshotMode } from '../index';
import { fixClock, standInChat, standInCheckIn } from '../mode';
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
  it('are the map at rest, checked in, the sheet half open, Layers, Chat and Check In, in dark and daylight at 390 dp, opened by deep link', () => {
    expect(SCREENSHOT_FRAME.widthPx / (SCREENSHOT_FRAME.density / 160)).toBe(390);
    const files = Object.keys(SCREENSHOT_THEMES).flatMap((theme) =>
      SCREENSHOT_SHOTS.map((shot) => shotFile(shot, theme as keyof typeof SCREENSHOT_THEMES)),
    );
    expect(new Set(files).size).toBe(12);
    expect(files).toContain('phone-layers-390-daylight.png');
    expect(files).toContain('phone-checked-in-390-dark.png');
    expect(SCREENSHOT_SHOTS.map(shotUrl)).toEqual([
      `${URL_SCHEME}:///?shot=map`,
      `${URL_SCHEME}:///?shot=checked-in`,
      `${URL_SCHEME}:///?shot=sheet-half`,
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
    expect(MAP_SHOTS['checked-in']).toEqual({ checkedIn: true });
    expect(MAP_SHOTS['sheet-half']).toEqual({ detent: 'half' });
  });
});
