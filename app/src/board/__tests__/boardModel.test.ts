import { HOUR_MS, MINUTE_MS } from '@huntclub/core';
import { fixedSun, HOME, T0 } from '@huntclub/core/testing';
import type { MemberCheckIn } from '@huntclub/core';
import { CheckInMode } from '@huntclub/mesh';

import type { ClubStand } from '../../checkin/placement';
import type { MapNode } from '../../map/meshMapData';
import {
  boardLinkStatus,
  buildBoard,
  entryAccessibilityLabel,
  entryTimeText,
  type BoardInput,
} from '../boardModel';

/** T0 is 14:00 UTC; fixedSun(23) sets the sun at 23:00 UTC, so with 30 min grace people are overdue from 23:30. */
const SUN = fixedSun(23);
const GRACE = 30;
const OVERDUE_FROM = T0 + 9 * HOUR_MS + GRACE * MINUTE_MS;
const BOARD = 1;

const node = (num: number, longName: string, at?: { lat: number; lon: number }): MapNode => ({
  num,
  lastHeard: Math.floor(T0 / 1000),
  user: { longName },
  ...(at
    ? {
        position: {
          latitudeI: at.lat * 1e7,
          longitudeI: at.lon * 1e7,
          time: Math.floor(T0 / 1000),
        },
      }
    : {}),
});

const checkIn = (
  n: number,
  mode: CheckInMode,
  extra: Partial<MemberCheckIn> = {},
): MemberCheckIn => ({
  node: n,
  mode,
  checkInId: n * 10,
  since: T0,
  ...extra,
});

const stands: ClubStand[] = [
  { meshId: 7, name: 'Ridge Stand', position: HOME },
  { meshId: 8, name: 'Creek Stand', position: HOME },
  { meshId: 9, name: 'Apple Stand', position: HOME },
];

function input(checkIns: MemberCheckIn[], nodes: MapNode[] = []): BoardInput {
  return {
    myNodeNum: BOARD,
    nodes: new Map([node(BOARD, 'Clubhouse', HOME), ...nodes].map((n) => [n.num, n])),
    checkIns,
    stands,
    graceMinutes: GRACE,
    names: { stand: (id) => stands.find((s) => s.meshId === id)?.name },
    sun: SUN,
  };
}

describe('buildBoard', () => {
  const dale = node(2, 'Dale', HOME);
  const ann = node(3, 'Ann', HOME);
  const both = [
    checkIn(2, CheckInMode.Stand, { standId: 8, since: T0 }),
    checkIn(3, CheckInMode.Moving, { since: T0 + HOUR_MS }),
  ];

  it('lists everyone out by check-in time with their place, and never the board itself', () => {
    const { out } = buildBoard(
      input([...both, checkIn(BOARD, CheckInMode.Spot)], [dale, ann]),
      T0 + 2 * HOUR_MS,
    );
    expect(out.map((e) => [e.name, e.place, e.overdue])).toEqual([
      ['Dale', 'Creek Stand', false],
      ['Ann', 'On the move', false],
    ]);
  });

  it('marks people overdue after sunset plus grace and puts them first', () => {
    const late = checkIn(3, CheckInMode.Moving, { since: T0 + HOUR_MS });
    const extended = checkIn(2, CheckInMode.Stand, { standId: 8, until: OVERDUE_FROM + HOUR_MS });
    const { out } = buildBoard(input([extended, late], [dale, ann]), OVERDUE_FROM + MINUTE_MS);
    expect(out.map((e) => [e.name, e.overdue])).toEqual([
      ['Ann', true],
      ['Dale', false],
    ]);
    expect(out[0]!.overdueAt).toBe(OVERDUE_FROM);
  });

  it("uses the check-in pin, then the board's own radio, when a hunter's radio has no GPS", () => {
    const noGps = node(4, 'Bo');
    const { out } = buildBoard(
      input([checkIn(4, CheckInMode.Spot, { pin: HOME })], [noGps]),
      OVERDUE_FROM,
    );
    expect(out[0]!.overdueAt).toBe(OVERDUE_FROM);
    const fromBoard = buildBoard(input([checkIn(4, CheckInMode.Spot)], [noGps]), OVERDUE_FROM);
    expect(fromBoard.out[0]!.overdue).toBe(true);
  });

  it('lists open stands by name, without stands someone is in', () => {
    const { openStands } = buildBoard(input(both, [dale, ann]), T0);
    expect(openStands.map((s) => s.name)).toEqual(['Apple Stand', 'Ridge Stand']);
  });

  it('words each row for the board and for screen readers', () => {
    const [entry] = buildBoard(input([both[0]!], [dale]), T0).out;
    expect(entryTimeText(entry!)).toMatch(/^Since \d{1,2}:\d{2} (AM|PM)$/);
    expect(entryAccessibilityLabel(entry!)).toMatch(/^Dale, Creek Stand, since /);
    const [late] = buildBoard(input([both[0]!], [dale]), OVERDUE_FROM).out;
    expect(entryTimeText(late!)).toMatch(/^Overdue since /);
  });
});

describe('boardLinkStatus', () => {
  const heard = input([], [node(2, 'Dale', HOME)]);

  it('says plainly when the board radio is missing, reconnecting or down', () => {
    expect(boardLinkStatus(null, heard, T0).text).toBe('Board radio not set up');
    expect(boardLinkStatus('connecting', heard, T0)).toEqual({
      text: 'Reconnecting to the board radio…',
      tone: 'quiet',
    });
    expect(boardLinkStatus('disconnected', heard, T0).tone).toBe('none');
  });

  it('shows the mesh status once connected', () => {
    expect(boardLinkStatus('ready', heard, T0 + 5_000)).toEqual({
      text: 'Mesh: 1 radio, heard 5s ago',
      tone: 'ok',
    });
    expect(boardLinkStatus('ready', heard, T0 + HOUR_MS).tone).toBe('quiet');
  });
});
