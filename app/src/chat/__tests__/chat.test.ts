import type { CheckInBoard, DeliveryState, DeliveryTracker, MemberCheckIn } from '@huntclub/core';
import {
  AppMessageType,
  CheckInMode,
  Emitter,
  MAX_TEXT_CHARS,
  type AppMessage,
  type DeliveryResult,
  type MeshClient,
  type MeshClientEvents,
  type SendOptions,
} from '@huntclub/mesh';

import { NOW } from '../../test-utils/mapFixtures';
import type { MapNode } from '../../map/meshMapData';
import { ChatSendError, connectChat, sendChat, type ChatRadio } from '../ChatRadio';
import {
  CHAT_HISTORY_LIMIT,
  chatSegments,
  conversationItems,
  createChatStore,
  directConversation,
  directPeers,
  groupConversation,
  type ChatItem,
} from '../model';
import { bubbleLabel, charactersLeft, deliveryText, systemCardText } from '../wording';

// Compile-time checks: what RadioProvider will pass fits ChatRadio.
type Fits<T, U extends T> = U;
export type ClientFits = Fits<ChatRadio['client'], MeshClient>;
export type DeliveryFits = Fits<ChatRadio['delivery'], DeliveryTracker>;
export type BoardFits = Fits<ChatRadio['board'], CheckInBoard>;

const ME = 0x1000;
const DALE = 0x2000;
const party = groupConversation('party');

const text = (
  over: Partial<Extract<ChatItem, { kind: 'text' }>> = {},
): Extract<ChatItem, { kind: 'text' }> => ({
  kind: 'text',
  id: 't1',
  conversation: party,
  from: DALE,
  fromName: 'Dale',
  mine: false,
  text: 'Seeing deer',
  at: NOW,
  ...over,
});

describe('chat model', () => {
  it('offers Party and Direct free, and Whole Club for clubs', () => {
    expect(chatSegments(false)).toEqual(['party', 'direct']);
    expect(chatSegments(true)).toEqual(['club', 'party', 'direct']);
  });

  it('drops duplicates, keeps conversations apart and caps history', () => {
    const store = createChatStore();
    store.add(text({ id: 'a' }));
    store.add(text({ id: 'a' }));
    store.add(text({ id: 'd', conversation: directConversation(DALE), at: NOW + 5 }));
    expect(conversationItems(store.getSnapshot(), party).map((i) => i.id)).toEqual(['a']);
    expect(directPeers(store.getSnapshot())).toEqual([{ node: DALE, lastAt: NOW + 5 }]);

    for (let i = 0; i < CHAT_HISTORY_LIMIT + 5; i++) store.add(text({ id: `m${i}`, at: NOW + i }));
    const kept = conversationItems(store.getSnapshot(), party);
    expect(kept).toHaveLength(CHAT_HISTORY_LIMIT);
    expect(kept[kept.length - 1]?.id).toBe(`m${CHAT_HISTORY_LIMIT + 4}`);
    expect(conversationItems(store.getSnapshot(), directConversation(DALE))).toHaveLength(1);
  });
});

describe('chat wording', () => {
  it('writes system cards for check-ins, help and harvests', () => {
    expect(
      systemCardText('checkIn', 'Dale', { place: { kind: 'stand', name: 'Creek Stand' } }),
    ).toBe('Dale checked in at Creek Stand');
    expect(systemCardText('checkIn', 'Sam', { place: { kind: 'moving' } })).toBe(
      'Sam checked in: On the move',
    );
    expect(systemCardText('checkOut', 'Dale')).toBe('Dale checked out');
    expect(systemCardText('help', 'Dale')).toBe('Dale asked for a hand');
    expect(systemCardText('harvest', 'Dale', { species: 'deer' })).toBe(
      'Dale shared a harvest: deer',
    );
  });

  it('counts down the 200-character limit, counting emoji as one', () => {
    expect(charactersLeft('')).toEqual({ left: MAX_TEXT_CHARS, over: false, text: '200 left' });
    expect(charactersLeft('🦌🦌').left).toBe(198);
    expect(charactersLeft('a'.repeat(203))).toEqual({ left: -3, over: true, text: '3 too many' });
  });

  it('shows delivery under our own messages only', () => {
    expect(deliveryText(text())).toBeUndefined();
    expect(
      deliveryText(text({ mine: true, sendState: 'sending', delivered: { to: 0, of: 0 } })),
    ).toBe('Sending…');
    expect(deliveryText(text({ mine: true, sendState: 'sent', delivered: { to: 2, of: 3 } }))).toBe(
      'Delivered to 2 of 3',
    );
    expect(deliveryText(text({ mine: true, sendState: 'failed' }))).toBe(
      'Not sent. Check your radio.',
    );
  });

  it('reads a bubble with sender, place, time and text', () => {
    expect(bubbleLabel(text({ place: { kind: 'stand', name: 'Creek Stand' } }), '6:52 AM')).toBe(
      'Dale, Creek Stand, 6:52 AM: Seeing deer',
    );
  });
});

class FakeClient extends Emitter<MeshClientEvents> {
  myNodeNum = ME;
  nodes = new Map<number, MapNode>([[DALE, { num: DALE, user: { longName: 'Dale' } }]]);
  sent: { text: string; opts: SendOptions | undefined }[] = [];
  results: DeliveryResult[] = [{ status: 'sent' }];
  sendText = (body: string, opts?: SendOptions) => {
    this.sent.push({ text: body, opts });
    return {
      id: 100 + this.sent.length,
      result: Promise.resolve<DeliveryResult>(this.results.shift() ?? { status: 'sent' }),
    };
  };
  fire<K extends keyof MeshClientEvents>(event: K, payload: MeshClientEvents[K]) {
    this.emit(event, payload);
  }
}
class FakeTracker extends Emitter<{ delivery: DeliveryState }> {
  tracked: [number, number][] = [];
  track = (id: number, expected: number) => void this.tracked.push([id, expected]);
  fire(d: DeliveryState) {
    this.emit('delivery', d);
  }
}

function setup() {
  const client = new FakeClient();
  const delivery = new FakeTracker();
  const checkIn: MemberCheckIn = {
    node: DALE,
    mode: CheckInMode.Stand,
    standId: 7,
    checkInId: 1,
    since: NOW,
  };
  const radio = {
    client,
    delivery,
    board: { get: (n: number) => (n === DALE ? checkIn : undefined) },
    audience: 'party',
    names: { stand: () => 'Creek Stand' },
    groupSize: () => 2,
    channelOf: () => 0,
    segmentOfChannel: () => 'party' as const,
  } satisfies ChatRadio;
  const store = createChatStore();
  const stop = connectChat(radio, store, () => NOW);
  return { radio, client, delivery, store, stop };
}

const meta = { packetId: 7, to: 0, channel: 0, rxTime: 0, rxSnr: 0 };

describe('connectChat', () => {
  it('puts party and direct texts in their conversations with the sender’s place', () => {
    const { client, store } = setup();
    client.fire('text', { ...meta, from: DALE, text: 'Seeing deer', isDirect: false });
    client.fire('text', {
      ...meta,
      packetId: 8,
      from: DALE,
      text: 'Coming to you',
      isDirect: true,
    });
    client.fire('text', { ...meta, packetId: 9, from: ME, text: 'echo', isDirect: false });
    expect(conversationItems(store.getSnapshot(), party)).toEqual([
      text({ id: `text:${DALE}:7`, place: { kind: 'stand', name: 'Creek Stand' } }),
    ]);
    expect(
      conversationItems(store.getSnapshot(), directConversation(DALE)).map(
        (i) => i.kind === 'text' && i.text,
      ),
    ).toEqual(['Coming to you']);
  });

  it('adds system cards for check-ins, help and shared harvests', () => {
    const { client, store } = setup();
    const hear = (message: AppMessage) =>
      client.fire('appMessage', { ...meta, from: message.sender, message });
    hear({ type: AppMessageType.CheckIn, id: 1, sender: DALE, time: 0, mode: CheckInMode.Moving });
    hear({ type: AppMessageType.HelpRequest, id: 2, sender: DALE, time: 0 });
    hear({ type: AppMessageType.HarvestShare, id: 3, sender: DALE, time: 0, species: 'deer' });
    hear({ type: AppMessageType.Receipt, id: 4, sender: DALE, time: 0, ackedId: 1 });
    hear({ type: AppMessageType.CheckOut, id: 5, sender: ME, time: 0, checkInId: 1 });
    expect(store.getSnapshot().map((i) => i.kind === 'system' && i.text)).toEqual([
      'Dale checked in: On the move',
      'Dale asked for a hand',
      'Dale shared a harvest: deer',
    ]);
  });
});

describe('sendChat', () => {
  it('sends to the party channel, tracks receipts and shows "Delivered to N of M"', async () => {
    const { radio, client, delivery, store } = setup();
    const item = sendChat(radio, store, party, '  All quiet  ', () => NOW);
    expect(client.sent).toEqual([{ text: 'All quiet', opts: { channel: 0 } }]);
    expect(delivery.tracked).toEqual([[101, 2]]);
    expect(item).toMatchObject({ mine: true, sendState: 'sending', delivered: { to: 0, of: 2 } });

    await Promise.resolve();
    delivery.fire({ id: 101, deliveredTo: [DALE], expected: 2 });
    const [sent] = store.getSnapshot();
    expect(sent && sent.kind === 'text' && deliveryText(sent)).toBe('Delivered to 1 of 2');
  });

  it('sends direct messages to one node and reports a failed send', async () => {
    const { radio, client, store } = setup();
    client.results = [{ status: 'timeout' }];
    sendChat(radio, store, directConversation(DALE), 'Coming to you');
    expect(client.sent[0]?.opts).toEqual({ to: DALE, wantAck: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getSnapshot()[0]).toMatchObject({ sendState: 'failed' });
  });

  it('refuses empty and over-long messages', () => {
    const { radio, store } = setup();
    expect(() => sendChat(radio, store, party, '   ')).toThrow(ChatSendError);
    expect(() => sendChat(radio, store, party, 'a'.repeat(MAX_TEXT_CHARS + 1))).toThrow(
      /200 characters/,
    );
  });
});
