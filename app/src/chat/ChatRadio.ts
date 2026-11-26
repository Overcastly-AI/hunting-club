import type { CheckInBoard, DeliveryTracker } from '@huntclub/core';
import {
  AppMessageType,
  MAX_TEXT_CHARS,
  type AppMessage,
  type MeshClient,
  type Unsubscribe,
} from '@huntclub/mesh';
import { createContext } from 'react';

import type { Audience } from '../domain/audience';
import { memberIdentity, type MapNames, type MapNode } from '../map/meshMapData';
import { placeOf } from '../map/place';
import {
  directConversation,
  groupConversation,
  type ChatItem,
  type ChatStore,
  type ConversationKey,
} from './model';
import { systemCardText } from './wording';

/**
 * What Chat needs from the radio. RadioProvider (Milestone 2) provides it with
 * `<ChatRadioContext.Provider>`; until then it is null and Chat says to connect a radio.
 */
export type ChatRadio = {
  client: Pick<MeshClient, 'on' | 'sendText' | 'myNodeNum'> & {
    nodes: ReadonlyMap<number, MapNode>;
  };
  delivery: Pick<DeliveryTracker, 'track' | 'on'>;
  board: Pick<CheckInBoard, 'get'>;
  audience: Audience;
  names?: MapNames;
  /** How many others should get a group message (party or club size minus us), for "Delivered to N of M". */
  groupSize: (segment: 'club' | 'party') => number;
  /** Radio channel index for a group segment, and the segment a received channel belongs to. */
  channelOf: (segment: 'club' | 'party') => number;
  segmentOfChannel: (channel: number) => 'club' | 'party';
};

export const ChatRadioContext = createContext<ChatRadio | null>(null);

export const nameOf = (radio: ChatRadio, node: number) =>
  memberIdentity(radio.client.nodes.get(node), node, radio.names ?? {}).displayName;

const placeNow = (radio: ChatRadio, node: number) => {
  const checkIn = radio.board.get(node);
  return checkIn ? placeOf(checkIn, radio.names ?? {}) : undefined;
};

function systemItem(radio: ChatRadio, message: AppMessage, at: number): ChatItem | undefined {
  const event =
    message.type === AppMessageType.CheckIn
      ? 'checkIn'
      : message.type === AppMessageType.CheckOut
        ? 'checkOut'
        : message.type === AppMessageType.HelpRequest
          ? 'help'
          : message.type === AppMessageType.HarvestShare
            ? 'harvest'
            : undefined;
  if (!event) return undefined;
  const name = nameOf(radio, message.sender);
  const place =
    message.type === AppMessageType.CheckIn ? placeOf(message, radio.names ?? {}) : undefined;
  const species = message.type === AppMessageType.HarvestShare ? message.species : undefined;
  return {
    kind: 'system',
    id: `app:${message.sender}:${message.id}`,
    conversation: groupConversation('party'),
    event,
    from: message.sender,
    fromName: name,
    at,
    text: systemCardText(event, name, {
      ...(place ? { place } : {}),
      ...(species ? { species } : {}),
    }),
  };
}

/** Feeds the chat store from the radio: texts, system cards and delivery receipts. */
export function connectChat(
  radio: ChatRadio,
  store: ChatStore,
  now: () => number = Date.now,
): Unsubscribe {
  const offs = [
    radio.client.on('text', (event) => {
      if (event.from === radio.client.myNodeNum) return;
      const conversation: ConversationKey = event.isDirect
        ? directConversation(event.from)
        : groupConversation(radio.segmentOfChannel(event.channel));
      const place = placeNow(radio, event.from);
      store.add({
        kind: 'text',
        id: `text:${event.from}:${event.packetId}`,
        conversation,
        from: event.from,
        fromName: nameOf(radio, event.from),
        mine: false,
        text: event.text,
        at: event.rxTime ? event.rxTime * 1000 : now(),
        ...(place ? { place } : {}),
      });
    }),
    radio.client.on('appMessage', ({ message }) => {
      if (message.sender === radio.client.myNodeNum) return;
      const item = systemItem(radio, message, message.time ? message.time * 1000 : now());
      if (item) store.add(item);
    }),
    radio.delivery.on('delivery', (d) =>
      store.updateByPacket(d.id, { delivered: { to: d.deliveredTo.length, of: d.expected } }),
    ),
  ];
  return () => offs.forEach((off) => off());
}

export class ChatSendError extends Error {}

/** Sends a text to a conversation and tracks it; returns the item added. */
export function sendChat(
  radio: ChatRadio,
  store: ChatStore,
  conversation: ConversationKey,
  text: string,
  now: () => number = Date.now,
): ChatItem {
  const body = text.trim();
  if (!body) throw new ChatSendError('Type a message first');
  if ([...body].length > MAX_TEXT_CHARS)
    throw new ChatSendError(`Keep it to ${MAX_TEXT_CHARS} characters`);
  const direct = conversation.startsWith('direct:')
    ? Number(conversation.slice('direct:'.length))
    : undefined;
  const segment =
    direct === undefined ? (conversation.slice('group:'.length) as 'club' | 'party') : undefined;
  const handle = radio.client.sendText(
    body,
    direct !== undefined ? { to: direct, wantAck: true } : { channel: radio.channelOf(segment!) },
  );
  const expected = direct !== undefined ? 1 : radio.groupSize(segment!);
  radio.delivery.track(handle.id, expected);
  const me = radio.client.myNodeNum;
  const item: ChatItem = {
    kind: 'text',
    id: `text:${me}:${handle.id}`,
    conversation,
    from: me,
    fromName: 'You',
    mine: true,
    text: body,
    at: now(),
    sendState: 'sending',
    packetId: handle.id,
    delivered: { to: 0, of: expected },
  };
  store.add(item);
  void handle.result.then((result) =>
    store.updateByPacket(handle.id, {
      sendState: result.status === 'failed' || result.status === 'timeout' ? 'failed' : 'sent',
    }),
  );
  return item;
}
