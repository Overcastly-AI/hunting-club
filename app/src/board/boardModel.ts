import { SUN, overdueAt, type MemberCheckIn, type SunApi } from '@huntclub/core';
import type { ClientState, LatLon } from '@huntclub/mesh';

import type { ClubStand } from '../checkin/placement';
import { formatClockTime } from '@huntclub/shared';
import { placeLabel } from '../map/labels';
import {
  memberIdentity,
  meshStatusOf,
  nodePosition,
  type MapNames,
  type MapNode,
} from '../map/meshMapData';
import { describeMeshStatus, type MeshTone } from '../map/meshStatus';
import { placeOf } from '../map/place';

/** Someone who is out, as the clubhouse board lists them. */
export type BoardEntry = {
  node: number;
  name: string;
  /** Stand, spot or area name, or "On the move". */
  place: string;
  /** When they checked in (ms). */
  since: number;
  /** Sunset + grace (or their extension); undefined when it can't be worked out. */
  overdueAt?: number;
  overdue: boolean;
};

export type BoardModel = {
  /** Overdue first (longest overdue at the top), then everyone else by check-in time. */
  out: BoardEntry[];
  /** Club stands nobody is checked in to, by name. */
  openStands: ClubStand[];
};

export type BoardInput = {
  myNodeNum: number;
  nodes: ReadonlyMap<number, MapNode>;
  checkIns: readonly MemberCheckIn[];
  stands: readonly ClubStand[];
  graceMinutes: number;
  names?: MapNames;
  /** Defaults to the on-device sunrise/sunset calculation; tests pass fixed times. */
  sun?: SunApi;
};

/** Best known location for someone's sunset: their radio's GPS, their check-in pin, or the board's own radio. */
function locationFor(checkIn: MemberCheckIn, input: BoardInput): LatLon | undefined {
  const record = input.nodes.get(checkIn.node);
  const board = input.nodes.get(input.myNodeNum);
  return (
    (record && nodePosition(record)) ?? checkIn.pin ?? (board ? nodePosition(board) : undefined)
  );
}

export function buildBoard(input: BoardInput, now: number): BoardModel {
  const names = input.names ?? {};
  const out = input.checkIns
    .filter((checkIn) => checkIn.node !== input.myNodeNum)
    .map((checkIn): BoardEntry => {
      const where = locationFor(checkIn, input);
      const due = where
        ? overdueAt(checkIn.since, where, input.graceMinutes, input.sun ?? SUN, checkIn.until)
        : checkIn.until;
      return {
        node: checkIn.node,
        name: memberIdentity(input.nodes.get(checkIn.node), checkIn.node, names).displayName,
        place: placeLabel(placeOf(checkIn, names)),
        since: checkIn.since,
        ...(due === undefined ? {} : { overdueAt: due }),
        overdue: due !== undefined && now >= due,
      };
    })
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        (a.overdue ? a.overdueAt! - b.overdueAt! : a.since - b.since),
    );

  const taken = new Set(input.checkIns.map((c) => c.standId).filter((id) => id !== undefined));
  const openStands = input.stands
    .filter((stand) => !stand.occupiedBy && !taken.has(stand.meshId))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { out, openStands };
}

/** "Since 6:12 AM" or "Overdue since 5:12 PM" — what the board prints under a name. */
export function entryTimeText(entry: BoardEntry): string {
  return entry.overdue
    ? `Overdue since ${formatClockTime(new Date(entry.overdueAt!))}`
    : `Since ${formatClockTime(new Date(entry.since))}`;
}

/** Spoken label for one row, e.g. "Dale, Creek Stand, since 6:12 AM". */
export function entryAccessibilityLabel(entry: BoardEntry): string {
  return `${entry.name}, ${entry.place}, ${entryTimeText(entry).toLowerCase()}`;
}

/**
 * The board radio's link, shown big at the top: whether the tablet is
 * connected to its radio and whether the mesh is heard. RadioProvider
 * reconnects by itself; this only says what is happening.
 */
export function boardLinkStatus(
  state: ClientState | null,
  input: Pick<BoardInput, 'myNodeNum' | 'nodes'>,
  now: number,
): { text: string; tone: MeshTone } {
  if (state === null) return { text: 'Board radio not set up', tone: 'none' };
  if (state === 'connecting' || state === 'configuring')
    return { text: 'Reconnecting to the board radio…', tone: 'quiet' };
  if (state === 'disconnected')
    return { text: 'Board radio not connected. Retrying…', tone: 'none' };
  const { text, tone } = describeMeshStatus(
    meshStatusOf(
      {
        myNodeNum: input.myNodeNum,
        radioConnected: true,
        nodes: input.nodes.values(),
        checkIns: [],
      },
      now,
    ),
    now,
  );
  return { text, tone };
}
