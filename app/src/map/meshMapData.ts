import {
  FRESHNESS_THRESHOLDS_MS,
  positionAge,
  type CheckInBoard,
  type MemberCheckIn,
} from '@huntclub/core';
import {
  type ClientState,
  type LatLon,
  type MeshClient,
  type NodeRecord,
  type Unsubscribe,
} from '@huntclub/mesh';
import { INITIALS_MAX } from '@huntclub/shared';

import type { MapDataStore } from './dataSource';
import { placeOf, type PlaceNames } from './place';
import type { HunterOnMap, MapData, MeshStatus } from './types';

/**
 * Turns what the radio knows (node DB, positions, everyone's open check-ins)
 * into what the map draws. Pure and radio-agnostic: the RadioProvider passes
 * its MeshClient and CheckInBoard to `connectMapData`.
 *
 * Privacy: only hunters with an open check-in are shown (location is shared
 * only while checked in). Our own node is never in the hunter list.
 */

/** The fields of a node record the map reads (MeshClient's NodeRecord fits). */
export type MapNode = Pick<NodeRecord, 'num' | 'lastHeard'> & {
  user?: { longName?: string; shortName?: string };
  position?: { latitudeI?: number; longitudeI?: number; time?: number };
};

/** Names this phone knows for members, stands and areas (local DB). All optional. */
export type MapNames = PlaceNames & {
  member?: (node: number) => { displayName: string; initials: string } | undefined;
};

export type MeshSnapshot = {
  myNodeNum: number;
  radioConnected: boolean;
  nodes: Iterable<MapNode>;
  checkIns: readonly MemberCheckIn[];
};

const SECOND_MS = 1000;

/** Short Meshtastic-style id for a node with no name, e.g. "!a1b2". */
const nodeTag = (num: number) => `!${(num >>> 0).toString(16).slice(-4)}`;

/** The name to show for a node: its long name, else its short name, else a short id. */
export function nodeDisplayName(node: Pick<MapNode, 'user'> | undefined, num: number): string {
  return node?.user?.longName?.trim() || node?.user?.shortName?.trim() || nodeTag(num);
}

export function nodePosition(node: MapNode): (LatLon & { heardAt: number }) | undefined {
  const p = node.position;
  if (p?.latitudeI === undefined || p.longitudeI === undefined) return undefined;
  if (p.latitudeI === 0 && p.longitudeI === 0) return undefined; // no GPS fix
  // Prefer the GPS time in the position, then when the radio last heard the node.
  const seconds = p.time || node.lastHeard;
  if (!seconds) return undefined;
  return { lat: p.latitudeI / 1e7, lon: p.longitudeI / 1e7, heardAt: seconds * SECOND_MS };
}

export function memberIdentity(node: MapNode | undefined, num: number, names: MapNames) {
  const known = names.member?.(num);
  if (known) return known;
  const shortName = node?.user?.shortName?.trim();
  const displayName = nodeDisplayName(node, num);
  return { displayName, initials: (shortName || displayName).slice(0, INITIALS_MAX) };
}

function hunterFrom(
  checkIn: MemberCheckIn,
  node: MapNode | undefined,
  names: MapNames,
): HunterOnMap | undefined {
  // The radio's GPS position, or for a spot, the pin sent with the check-in.
  const gps = node ? nodePosition(node) : undefined;
  const at = gps ?? (checkIn.pin ? { ...checkIn.pin, heardAt: checkIn.since } : undefined);
  if (!at) return undefined;
  return {
    id: String(checkIn.node),
    ...memberIdentity(node, checkIn.node, names),
    position: { lat: at.lat, lon: at.lon },
    heardAt: at.heardAt,
    place: placeOf(checkIn, names),
  };
}

/** Radios heard (other than ours) within the stale window, and when any was last heard. */
export function meshStatusOf(snapshot: MeshSnapshot, now: number): MeshStatus {
  let radioCount = 0;
  let lastHeardAt: number | null = null;
  for (const node of snapshot.nodes) {
    if (node.num === snapshot.myNodeNum || !node.lastHeard) continue;
    const heardAt = node.lastHeard * SECOND_MS;
    if (positionAge(heardAt, now) < FRESHNESS_THRESHOLDS_MS.stale) radioCount++;
    lastHeardAt = Math.max(lastHeardAt ?? 0, heardAt);
  }
  return { radioConnected: snapshot.radioConnected, radioCount, lastHeardAt };
}

export function buildMapData(snapshot: MeshSnapshot, names: MapNames, now: number): MapData {
  const nodes = new Map<number, MapNode>();
  for (const node of snapshot.nodes) nodes.set(node.num, node);
  const hunters = snapshot.checkIns
    .filter((checkIn) => checkIn.node !== snapshot.myNodeNum)
    .map((checkIn) => hunterFrom(checkIn, nodes.get(checkIn.node), names))
    .filter((hunter): hunter is HunterOnMap => hunter !== undefined);
  // Club open stands arrive with club stand sync (Milestone 10).
  return { hunters, openStands: [], mesh: meshStatusOf(snapshot, now) };
}

/** The parts of the radio's public API the map listens to. */
export type MapRadio = {
  client: Pick<MeshClient, 'on' | 'myNodeNum' | 'state'> & { nodes: ReadonlyMap<number, MapNode> };
  board: Pick<CheckInBoard, 'on' | 'all'>;
};

const READY: ClientState = 'ready';

/**
 * Keeps a map data store in step with the radio: recomputes on every
 * position, node info, check-in change and link change. Returns a stop function.
 */
export function connectMapData(
  radio: MapRadio,
  store: MapDataStore,
  names: MapNames = {},
  now: () => number = Date.now,
): Unsubscribe {
  const update = () =>
    store.set(
      buildMapData(
        {
          myNodeNum: radio.client.myNodeNum,
          radioConnected: radio.client.state === READY,
          nodes: radio.client.nodes.values(),
          checkIns: radio.board.all,
        },
        names,
        now(),
      ),
    );
  const offs = [
    radio.client.on('position', update),
    radio.client.on('nodeinfo', update),
    radio.client.on('state', update),
    radio.client.on('text', update),
    radio.client.on('appMessage', update),
    radio.board.on('change', update),
  ];
  update();
  return () => offs.forEach((off) => off());
}
