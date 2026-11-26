import type { CheckInBoard, MemberCheckIn } from '@huntclub/core';
import {
  CheckInMode,
  Emitter,
  type ClientState,
  type MeshClient,
  type MeshClientEvents,
} from '@huntclub/mesh';

import { MINUTE_MS } from '@huntclub/core';

import { NOW } from '../../test-utils/mapFixtures';
import { createMapDataStore } from '../dataSource';
import { UNNAMED_STAND } from '../labels';
import {
  buildMapData,
  connectMapData,
  type MapNode,
  type MapRadio,
  type MeshSnapshot,
} from '../meshMapData';

// Compile-time check: the real radio objects fit what the map listens to.
type Fits<T, U extends T> = U;
export type RealClientFits = Fits<MapRadio['client'], MeshClient>;
export type RealBoardFits = Fits<MapRadio['board'], CheckInBoard>;

const ME = 0x1000;
const DALE = 0x2000;
const SAM = 0x3000;
const secondsAgo = (s: number) => Math.floor((NOW - s * 1000) / 1000);

const node = (
  num: number,
  name: string,
  short: string,
  lat?: number,
  lon?: number,
  ageS = 30,
): MapNode => ({
  num,
  lastHeard: secondsAgo(ageS),
  user: { longName: name, shortName: short },
  position:
    lat === undefined
      ? undefined
      : { latitudeI: lat * 1e7, longitudeI: lon! * 1e7, time: secondsAgo(ageS) },
});

const checkIn = (
  n: number,
  mode: CheckInMode,
  extra: Partial<MemberCheckIn> = {},
): MemberCheckIn => ({
  node: n,
  mode,
  checkInId: n,
  since: NOW - 30 * MINUTE_MS,
  ...extra,
});

const snapshot = (over: Partial<MeshSnapshot> = {}): MeshSnapshot => ({
  myNodeNum: ME,
  radioConnected: true,
  nodes: [
    node(ME, 'Me', 'ME', 40.7, -77.8),
    node(DALE, 'Dale', 'DM', 40.79, -77.86, 90),
    node(SAM, 'Sam', 'SK', 40.8, -77.85),
  ],
  checkIns: [checkIn(DALE, CheckInMode.Stand, { standId: 7 })],
  ...over,
});

describe('buildMapData', () => {
  it('shows checked-in hunters with their radio position, GPS time and stand name', () => {
    const data = buildMapData(
      snapshot(),
      { stand: (id) => (id === 7 ? 'Creek Stand' : undefined) },
      NOW,
    );
    expect(data.hunters).toEqual([
      {
        id: String(DALE),
        displayName: 'Dale',
        initials: 'DM',
        position: { lat: 40.79, lon: -77.86 },
        heardAt: secondsAgo(90) * 1000,
        place: { kind: 'stand', name: 'Creek Stand' },
      },
    ]);
  });

  it('never shows hunters who are not checked in, or ourselves', () => {
    const data = buildMapData(snapshot({ checkIns: [checkIn(ME, CheckInMode.Moving)] }), {}, NOW);
    expect(data.hunters).toEqual([]);
  });

  it('uses the spot pin when the radio has no GPS fix, timed from the check-in', () => {
    const pin = { lat: 40.81, lon: -77.84 };
    const data = buildMapData(
      snapshot({
        nodes: [{ num: SAM, lastHeard: secondsAgo(5), position: { latitudeI: 0, longitudeI: 0 } }],
        checkIns: [checkIn(SAM, CheckInMode.Spot, { pin })],
      }),
      {},
      NOW,
    );
    expect(data.hunters[0]).toMatchObject({
      position: pin,
      heardAt: NOW - 30 * MINUTE_MS,
      place: { kind: 'spot' },
    });
  });

  it('drops a hunter on the move with no position rather than guessing', () => {
    const data = buildMapData(
      snapshot({
        nodes: [{ num: SAM, lastHeard: secondsAgo(5) }],
        checkIns: [checkIn(SAM, CheckInMode.Moving)],
      }),
      {},
      NOW,
    );
    expect(data.hunters).toEqual([]);
  });

  it('prefers names from this phone and falls back to radio names, then the node id', () => {
    const named = buildMapData(
      snapshot(),
      { member: () => ({ displayName: 'Dale M.', initials: 'DM' }) },
      NOW,
    );
    expect(named.hunters[0]).toMatchObject({
      displayName: 'Dale M.',
      place: { name: UNNAMED_STAND },
    });

    const anonymous = buildMapData(
      snapshot({
        nodes: [{ num: DALE, position: { latitudeI: 1, longitudeI: 1, time: secondsAgo(1) } }],
      }),
      {},
      NOW,
    );
    expect(anonymous.hunters[0]).toMatchObject({ displayName: '!2000', initials: '!20' });
  });

  it('names the area for hunters on the move inside one', () => {
    const data = buildMapData(
      snapshot({ checkIns: [checkIn(SAM, CheckInMode.Moving, { areaId: 3 })] }),
      { area: () => 'North 40' },
      NOW,
    );
    expect(data.hunters[0]?.place).toEqual({ kind: 'moving', areaName: 'North 40' });
  });

  it('counts radios heard in the last 10 minutes, not ours', () => {
    const data = buildMapData(
      snapshot({
        nodes: [
          node(ME, 'Me', 'ME'),
          node(DALE, 'Dale', 'DM', undefined, undefined, 20),
          node(SAM, 'Sam', 'SK', undefined, undefined, 15 * 60),
        ],
      }),
      {},
      NOW,
    );
    expect(data.mesh).toEqual({
      radioConnected: true,
      radioCount: 1,
      lastHeardAt: secondsAgo(20) * 1000,
    });
  });
});

class FakeClient extends Emitter<MeshClientEvents> {
  nodes = new Map<number, MapNode>();
  myNodeNum = ME;
  state: ClientState = 'ready';
  fire<K extends keyof MeshClientEvents>(event: K, payload: MeshClientEvents[K]) {
    this.emit(event, payload);
  }
}

class FakeBoard extends Emitter<{ change: MemberCheckIn[] }> {
  all: MemberCheckIn[] = [];
  set(all: MemberCheckIn[]) {
    this.all = all;
    this.emit('change', all);
  }
}

describe('connectMapData', () => {
  it('updates the map store when check-ins and positions change, and stops cleanly', () => {
    const client = new FakeClient();
    const board = new FakeBoard();
    const store = createMapDataStore();
    const stop = connectMapData({ client, board }, store, {}, () => NOW);
    expect(store.getSnapshot().hunters).toEqual([]);
    expect(store.getSnapshot().mesh.radioConnected).toBe(true);

    client.nodes.set(DALE, node(DALE, 'Dale', 'DM', 40.79, -77.86));
    board.set([checkIn(DALE, CheckInMode.Moving)]);
    expect(store.getSnapshot().hunters.map((h) => h.displayName)).toEqual(['Dale']);

    board.set([]);
    expect(store.getSnapshot().hunters).toEqual([]);

    stop();
    board.set([checkIn(DALE, CheckInMode.Moving)]);
    expect(store.getSnapshot().hunters).toEqual([]);
  });
});
