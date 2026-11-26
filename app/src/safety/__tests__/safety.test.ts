import type {
  CheckInBoard,
  HelpRequester,
  HelpState,
  MemberCheckIn,
  OverdueEvents,
  OverdueMonitor,
} from '@huntclub/core';
import { MINUTE_MS } from '@huntclub/core';
import {
  AppMessageType,
  CheckInMode,
  Emitter,
  type AppMessage,
  type MeshClient,
  type MeshClientEvents,
} from '@huntclub/mesh';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { NOW } from '../../test-utils/mapFixtures';
import { SRC, sourceFiles } from '../../test-utils/sourceFiles';
import type { MapNode } from '../../map/meshMapData';
import { ALERT_PIN_TTL_MS, createAlertStore, nextUnseen } from '../alerts';
import { connectSafetyAlerts, type SafetyRadio } from '../SafetyRadio';
import {
  SAFETY_NOTE,
  helpProgress,
  incomingAlertText,
  listNames,
  selfPromptText,
} from '../wording';

// Compile-time checks: core and mesh objects are what RadioProvider will pass.
type Fits<T, U extends T> = U;
export type HelpFits = Fits<SafetyRadio['help'], HelpRequester>;
export type OverdueFits = Fits<SafetyRadio['overdue'], OverdueMonitor>;
export type BoardFits = Fits<SafetyRadio['board'], CheckInBoard>;
export type ClientFits = Fits<SafetyRadio['client'], MeshClient>;

const ME = 0x1000;
const DALE = 0x2000;
const HERE = { lat: 40.79, lon: -77.86 };
const NEAR = { lat: 40.795, lon: -77.855 };

const help = (over: Partial<HelpState>): HelpState => ({
  id: 1,
  status: 'sending',
  attempts: 1,
  acknowledgedBy: [],
  startedAt: NOW,
  ...over,
});
const names: Record<number, string> = { [DALE]: 'Dale', 0x3000: 'Sam', 0x4000: 'Joe' };
const nameOf = (n: number) => names[n] ?? '?';

describe('safety wording', () => {
  it('lists names naturally', () => {
    expect(listNames(['Dale'])).toBe('Dale');
    expect(listNames(['Dale', 'Sam'])).toBe('Dale and Sam');
    expect(listNames(['Dale', 'Sam', 'Joe'])).toBe('Dale, Sam and Joe');
  });

  it('shows Ask for a Hand progress and who has seen it', () => {
    expect(helpProgress(help({ attempts: 1 }), nameOf, 'party')).toEqual({
      title: 'Asking your party for a hand',
      detail: 'Sent once. It keeps trying until someone sees it.',
    });
    expect(helpProgress(help({ attempts: 3 }), nameOf, 'club').detail).toMatch(/^Sent 3 times/);
    expect(
      helpProgress(
        help({ status: 'acknowledged', acknowledgedBy: [DALE, 0x3000] }),
        nameOf,
        'party',
      ).title,
    ).toBe('Seen by Dale and Sam');
    expect(helpProgress(help({ status: 'cancelled' }), nameOf, 'party')).toEqual({
      title: 'Stopped asking',
      detail: 'Nobody had seen it yet.',
    });
  });

  it('says who needs a hand, where and how far', () => {
    const alert = {
      kind: 'help' as const,
      key: 'k',
      node: DALE,
      name: 'Dale',
      heardAt: NOW,
      seen: false,
      pin: NEAR,
      place: { kind: 'stand' as const, name: 'Creek Stand' },
    };
    expect(incomingAlertText(alert, HERE)).toEqual({
      title: 'Dale is asking for a hand',
      detail: 'Creek Stand · 0.4 mi northeast',
    });
    expect(
      incomingAlertText({ ...alert, kind: 'overdue', pin: undefined, place: undefined }, HERE),
    ).toEqual({
      title: 'Dale hasn’t checked out',
      detail: 'Location not known',
    });
  });

  it('asks "Still out?" with the time the alert would go out', () => {
    const alertAt = new Date(2026, 10, 30, 17, 26).getTime();
    expect(selfPromptText({ overdueAt: alertAt - 10 * MINUTE_MS, alertAt }, 30, 'party')).toBe(
      'It’s 30 minutes past sunset. If you don’t answer by 5:26 PM, your party gets an overdue alert.',
    );
  });

  it('has the exact settings note from the spec', () => {
    expect(SAFETY_NOTE).toBe('For emergencies, call 911 from your phone if you have service.');
  });
});

describe('nothing looks like a 911 call', () => {
  it('mentions 911, SOS or emergency only in the settings note', () => {
    const offenders = sourceFiles(SRC, /\.tsx?$/).flatMap((file) =>
      readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
        .filter((line) => /\b911\b|\bSOS\b|emergenc/i.test(line))
        .filter((line) => !line.includes('SAFETY_NOTE ='))
        .map((line) => `${relative(SRC, file)}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe('alert store', () => {
  const base = { kind: 'help' as const, node: DALE, name: 'Dale', heardAt: NOW };

  it('keeps one alert per request, remembers it was seen, and expires old pins', () => {
    const store = createAlertStore();
    store.add({ ...base, key: 'a' });
    store.add({ ...base, key: 'b', heardAt: NOW + 1 });
    expect(nextUnseen(store.getSnapshot())?.key).toBe('a');

    store.markSeen('a');
    store.add({ ...base, key: 'a', heardAt: NOW + 2 }); // a retry or update
    expect(store.getSnapshot().find((x) => x.key === 'a')).toMatchObject({
      seen: true,
      heardAt: NOW + 2,
    });
    expect(nextUnseen(store.getSnapshot())?.key).toBe('b');

    store.expire(NOW + 1 + ALERT_PIN_TTL_MS);
    expect(store.getSnapshot().map((x) => x.key)).toEqual(['a']);
  });
});

class FakeClient extends Emitter<MeshClientEvents> {
  myNodeNum = ME;
  nodes = new Map<number, MapNode>([[DALE, { num: DALE, user: { longName: 'Dale' } }]]);
  sent: string[] = [];
  sendText = (text: string) => {
    this.sent.push(text);
    return { id: 1, result: Promise.resolve({ status: 'sent' as const }) };
  };
  hear(message: AppMessage) {
    this.emit('appMessage', {
      message,
      packetId: 1,
      from: message.sender,
      to: 0,
      channel: 0,
      rxTime: 0,
      rxSnr: 0,
    });
  }
}
class FakeOverdue extends Emitter<OverdueEvents> {
  fire<K extends keyof OverdueEvents>(event: K, payload: OverdueEvents[K]) {
    this.emit(event, payload);
  }
}

describe('connectSafetyAlerts', () => {
  const setup = () => {
    const client = new FakeClient();
    const overdue = new FakeOverdue();
    const checkIn: MemberCheckIn = {
      node: DALE,
      mode: CheckInMode.Stand,
      standId: 7,
      checkInId: 9,
      since: NOW,
    };
    const radio = {
      client,
      overdue,
      help: {} as SafetyRadio['help'],
      board: { get: (n: number) => (n === DALE ? checkIn : undefined) },
      audience: 'party',
      names: { stand: () => 'Creek Stand' },
    } satisfies SafetyRadio;
    const store = createAlertStore();
    const stop = connectSafetyAlerts(radio, store, () => NOW);
    return { client, overdue, store, stop };
  };

  it('alerts on another hunter’s help request with their latest location', () => {
    const { client, store } = setup();
    client.hear({
      type: AppMessageType.HelpRequest,
      id: 5,
      sender: DALE,
      time: 0,
      pin: NEAR,
      note: 'Truck stuck',
    });
    expect(store.getSnapshot()).toEqual([
      {
        kind: 'help',
        key: `help:${DALE}:5`,
        node: DALE,
        name: 'Dale',
        heardAt: NOW,
        pin: NEAR,
        place: { kind: 'stand', name: 'Creek Stand' },
        note: 'Truck stuck',
        seen: false,
      },
    ]);
  });

  it('ignores our own messages and other message types', () => {
    const { client, store } = setup();
    client.hear({ type: AppMessageType.HelpRequest, id: 6, sender: ME, time: 0 });
    client.hear({ type: AppMessageType.CheckOut, id: 7, sender: DALE, time: 0, checkInId: 9 });
    expect(store.getSnapshot()).toEqual([]);
  });

  it('alerts when someone else is overdue, not when we are, and stops cleanly', () => {
    const { overdue, store, stop } = setup();
    overdue.fire('overdue', {
      subject: ME,
      self: true,
      checkInId: 1,
      overdueAt: NOW,
      source: 'detected',
    });
    overdue.fire('overdue', {
      subject: DALE,
      self: false,
      checkInId: 9,
      overdueAt: NOW,
      source: 'heard',
    });
    expect(store.getSnapshot().map((a) => [a.kind, a.key])).toEqual([
      ['overdue', `overdue:${DALE}:9`],
    ]);

    stop();
    overdue.fire('overdue', {
      subject: DALE,
      self: false,
      checkInId: 10,
      overdueAt: NOW,
      source: 'heard',
    });
    expect(store.getSnapshot()).toHaveLength(1);
  });
});
