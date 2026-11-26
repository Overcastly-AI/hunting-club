import type { ChatHistory } from '../chat/history';
import {
  CHAT_HISTORY_LIMIT,
  chatItemId,
  type ChatItem,
  type ChatItemKind,
  type ConversationKey,
  type SendState,
} from '../chat/model';
import type { HunterPlace } from '../map/types';
import type { SqlDatabase } from './types';

type Row = {
  kind: ChatItemKind;
  sender: number;
  message_id: number;
  conversation: ConversationKey;
  body: string;
  at: number;
  mine: number;
  send_state: SendState | null;
  delivered_to: number | null;
  delivered_of: number | null;
  extra: string;
};

/** Display-only fields kept as JSON. */
type Extra = {
  fromName: string;
  place?: HunterPlace;
  event?: Extract<ChatItem, { kind: 'system' }>['event'];
};

function toItem(row: Row): ChatItem {
  const extra = JSON.parse(row.extra) as Extra;
  const identity = {
    id: chatItemId(row.kind, row.sender, row.message_id),
    from: row.sender,
    messageId: row.message_id,
    conversation: row.conversation,
    fromName: extra.fromName,
    at: row.at,
  };
  if (row.kind === 'system') {
    return { ...identity, kind: 'system', event: extra.event!, text: row.body };
  }
  const mine = row.mine === 1;
  return {
    ...identity,
    kind: 'text',
    mine,
    text: row.body,
    ...(extra.place ? { place: extra.place } : {}),
    // Our own texts are tracked by the packet id they were sent with.
    ...(mine ? { packetId: row.message_id } : {}),
    ...(row.send_state ? { sendState: row.send_state } : {}),
    ...(row.delivered_to !== null && row.delivered_of !== null
      ? { delivered: { to: row.delivered_to, of: row.delivered_of } }
      : {}),
  };
}

function extraOf(item: ChatItem): Extra {
  return {
    fromName: item.fromName,
    ...(item.kind === 'text' && item.place ? { place: item.place } : {}),
    ...(item.kind === 'system' ? { event: item.event } : {}),
  };
}

/** Chat history in the phone's SQLite database (newest CHAT_HISTORY_LIMIT per conversation). */
export function sqliteChatHistory(db: SqlDatabase): ChatHistory {
  return {
    async load() {
      const rows = await db.getAllAsync<Row>('SELECT * FROM chat_messages ORDER BY at, rowid');
      return rows.map(toItem);
    },
    async add(item) {
      const text = item.kind === 'text' ? item : undefined;
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `INSERT OR IGNORE INTO chat_messages
             (kind, sender, message_id, conversation, body, at, mine, send_state,
              delivered_to, delivered_of, extra)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          item.kind,
          item.from,
          item.messageId,
          item.conversation,
          item.text,
          item.at,
          text?.mine ? 1 : 0,
          text?.sendState ?? null,
          text?.delivered?.to ?? null,
          text?.delivered?.of ?? null,
          JSON.stringify(extraOf(item)),
        );
        await db.runAsync(
          `DELETE FROM chat_messages WHERE conversation = ? AND rowid NOT IN (
             SELECT rowid FROM chat_messages WHERE conversation = ?
             ORDER BY at DESC, rowid DESC LIMIT ?)`,
          item.conversation,
          item.conversation,
          CHAT_HISTORY_LIMIT,
        );
      });
    },
    async update(item) {
      await db.runAsync(
        `UPDATE chat_messages SET send_state = ?, delivered_to = ?, delivered_of = ?
         WHERE kind = 'text' AND sender = ? AND message_id = ?`,
        item.sendState ?? null,
        item.delivered?.to ?? null,
        item.delivered?.of ?? null,
        item.from,
        item.messageId,
      );
    },
  };
}
