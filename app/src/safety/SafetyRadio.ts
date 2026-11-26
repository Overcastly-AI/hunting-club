import type { CheckInBoard, HelpRequester, OverdueMonitor } from '@huntclub/core';
import { AppMessageType, type MeshClient, type Unsubscribe } from '@huntclub/mesh';
import { createContext } from 'react';

import type { Audience } from '../domain/audience';
import { memberIdentity, nodePosition, type MapNames, type MapNode } from '../map/meshMapData';
import { placeOf } from '../map/place';
import type { AlertStore } from './alerts';

/**
 * What the safety UI needs from the radio. RadioProvider (Milestone 2)
 * provides it with `<SafetyRadioContext.Provider>`; until then it is null and
 * Ask for a Hand says to connect a radio.
 */
export type SafetyRadio = {
  client: Pick<MeshClient, 'on' | 'sendText' | 'myNodeNum'> & {
    nodes: ReadonlyMap<number, MapNode>;
  };
  help: Pick<HelpRequester, 'ask' | 'cancel' | 'current' | 'on'>;
  overdue: Pick<OverdueMonitor, 'on'>;
  board: Pick<CheckInBoard, 'get'>;
  audience: Audience;
  names?: MapNames;
};

export const SafetyRadioContext = createContext<SafetyRadio | null>(null);

/** Name, place and last known spot of another hunter, from what our radio knows. */
export function whoIs(radio: SafetyRadio, node: number) {
  const record = radio.client.nodes.get(node);
  const checkIn = radio.board.get(node);
  const names = radio.names ?? {};
  const gps = record ? nodePosition(record) : undefined;
  const pin = gps ? { lat: gps.lat, lon: gps.lon } : checkIn?.pin;
  return {
    name: memberIdentity(record, node, names).displayName,
    ...(pin ? { pin } : {}),
    ...(checkIn ? { place: placeOf(checkIn, names) } : {}),
  };
}

/**
 * Puts other hunters' help requests and overdue alerts into the alert store.
 * Retries of the same request arrive as `appMessageRepeat` and are ignored;
 * our own messages never alert us.
 */
export function connectSafetyAlerts(
  radio: SafetyRadio,
  store: AlertStore,
  now: () => number = Date.now,
): Unsubscribe {
  const offs = [
    radio.client.on('appMessage', ({ message }) => {
      if (message.type !== AppMessageType.HelpRequest || message.sender === radio.client.myNodeNum)
        return;
      const who = whoIs(radio, message.sender);
      store.add({
        kind: 'help',
        key: `help:${message.sender}:${message.id}`,
        node: message.sender,
        heardAt: now(),
        ...who,
        // The request's own location is newer than anything else we know.
        ...(message.pin ? { pin: message.pin } : {}),
        ...(message.note ? { note: message.note } : {}),
      });
    }),
    radio.overdue.on('overdue', (event) => {
      if (event.self) return;
      store.add({
        kind: 'overdue',
        key: `overdue:${event.subject}:${event.checkInId}`,
        node: event.subject,
        heardAt: now(),
        ...whoIs(radio, event.subject),
      });
    }),
  ];
  return () => offs.forEach((off) => off());
}
