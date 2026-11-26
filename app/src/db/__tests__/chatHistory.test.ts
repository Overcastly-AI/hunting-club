import {
  CHAT_HISTORY_LIMIT,
  chatItemId,
  createChatStore,
  directConversation,
  groupConversation,
  type ChatItem,
  type TextItem,
} from '../../chat/model';
import { persistChat } from '../../chat/history';
import { createMigratedTestDatabase } from '../../test-utils/nodeSqlite';
import { sqliteChatHistory } from '../chatHistory';

const ME = 0x1000;
const DALE = 0x2000;
const party = groupConversation('party');

const received = (messageId: number, at: number, over: Partial<TextItem> = {}): TextItem => ({
  kind: 'text',
  id: chatItemId('text', DALE, messageId),
  from: DALE,
  messageId,
  conversation: party,
  fromName: 'Dale',
  mine: false,
  text: `Message ${messageId}`,
  at,
  ...over,
});

const mine = (messageId: number, at: number): TextItem => ({
  ...received(messageId, at),
  id: chatItemId('text', ME, messageId),
  from: ME,
  fromName: 'You',
  mine: true,
  packetId: messageId,
  sendState: 'sending',
  delivered: { to: 0, of: 2 },
});

const card: ChatItem = {
  kind: 'system',
  id: chatItemId('system', DALE, 5),
  from: DALE,
  messageId: 5,
  conversation: party,
  event: 'checkIn',
  fromName: 'Dale',
  at: 3,
  text: 'Dale checked in: On the move',
};

describe('sqliteChatHistory', () => {
  it('saves and loads texts and system cards, oldest first', async () => {
    const history = sqliteChatHistory(await createMigratedTestDatabase());
    const placed = received(7, 2, {
      conversation: directConversation(DALE),
      place: { kind: 'stand', name: 'Creek Stand' },
    });
    await history.add(card);
    await history.add(placed);
    await history.add(mine(9, 1));

    expect(await history.load()).toEqual([mine(9, 1), placed, card]);
  });

  it('keeps one row per (sender, message id)', async () => {
    const history = sqliteChatHistory(await createMigratedTestDatabase());
    await history.add(received(7, 1));
    await history.add(received(7, 1, { text: 'a relayed copy' }));
    expect(await history.load()).toEqual([received(7, 1)]);
  });

  it('saves our own text’s send state and delivery counts', async () => {
    const history = sqliteChatHistory(await createMigratedTestDatabase());
    await history.add(mine(9, 1));
    await history.update({ ...mine(9, 1), sendState: 'sent', delivered: { to: 1, of: 2 } });
    expect(await history.load()).toEqual([
      { ...mine(9, 1), sendState: 'sent', delivered: { to: 1, of: 2 } },
    ]);
  });

  it('keeps the newest messages of each conversation', async () => {
    const history = sqliteChatHistory(await createMigratedTestDatabase());
    await history.add(received(1, 0, { conversation: directConversation(DALE) }));
    for (let i = 0; i < CHAT_HISTORY_LIMIT + 3; i++) await history.add(received(100 + i, 10 + i));

    const loaded = await history.load();
    const partyItems = loaded.filter((i) => i.conversation === party);
    expect(partyItems).toHaveLength(CHAT_HISTORY_LIMIT);
    expect(partyItems[0]).toEqual(received(103, 13)); // the 3 oldest went
    expect(loaded.filter((i) => i.conversation !== party)).toHaveLength(1);
  });
});

describe('persistChat', () => {
  it('restores history on start and saves new messages and receipts', async () => {
    const db = await createMigratedTestDatabase();
    const first = createChatStore();
    const stopFirst = persistChat(first, sqliteChatHistory(db));
    first.add(received(7, 1));
    first.add(mine(9, 2));
    first.updateByPacket(9, { sendState: 'sent', delivered: { to: 1, of: 2 } });
    first.add(mine(10, 3)); // still sending when the app closes
    await new Promise((resolve) => setTimeout(resolve, 0));
    stopFirst();

    // Next app start: messages arrive before the saved history has loaded,
    // one of them a relayed copy of a saved message.
    const next = createChatStore();
    next.add(received(7, 1));
    next.add(received(11, 4));
    const stopNext = persistChat(next, sqliteChatHistory(db));
    await new Promise((resolve) => setTimeout(resolve, 0));
    stopNext();

    const expected = [
      received(7, 1),
      { ...mine(9, 2), sendState: 'sent', delivered: { to: 1, of: 2 } },
      { ...mine(10, 3), sendState: 'failed' }, // its result was lost with the app
      received(11, 4),
    ];
    expect(next.getSnapshot()).toEqual(expected);

    // And the early arrival was saved too.
    const third = createChatStore();
    persistChat(third, sqliteChatHistory(db));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(third.getSnapshot()).toEqual(expected);
  });
});
