import type { HunterPlace } from '../map/types';

/** Chat segments (docs/SPEC.md "Chat"): Party and Direct free; Whole Club, Hunting Party and Direct for clubs. */
export type ChatSegment = 'club' | 'party' | 'direct';

export const SEGMENT_LABELS: Record<ChatSegment, string> = {
  club: 'Whole Club',
  party: 'Party',
  direct: 'Direct',
};

export function chatSegments(club: boolean): readonly ChatSegment[] {
  return club ? ['club', 'party', 'direct'] : ['party', 'direct'];
}

/** A conversation: a group segment, or a direct thread with one node. */
export type ConversationKey = `group:${'club' | 'party'}` | `direct:${number}`;

export const groupConversation = (segment: 'club' | 'party'): ConversationKey => `group:${segment}`;
export const directConversation = (node: number): ConversationKey => `direct:${node}`;

export const SEND_STATES = ['sending', 'sent', 'failed'] as const;
export type SendState = (typeof SEND_STATES)[number];

/**
 * A message's identity on the mesh: who sent it and their id for it (the
 * Meshtastic packet id for texts, the app message id for system cards).
 * The spec de-duplicates on (sender, message id); `id` is built from them.
 */
type MeshIdentity = { id: string; from: number; messageId: number };

export const CHAT_ITEM_KINDS = ['text', 'system'] as const;
export type ChatItemKind = (typeof CHAT_ITEM_KINDS)[number];

export const chatItemId = (kind: ChatItemKind, from: number, messageId: number): string =>
  `${kind === 'text' ? 'text' : 'app'}:${from}:${messageId}`;

export type ChatItem =
  | (MeshIdentity & {
      kind: 'text';
      conversation: ConversationKey;
      fromName: string;
      mine: boolean;
      text: string;
      at: number;
      /** Where the sender was hunting when they sent it. */
      place?: HunterPlace;
      /** Our own messages: radio send state and app-level receipts. */
      sendState?: SendState;
      packetId?: number;
      delivered?: { to: number; of: number };
    })
  | (MeshIdentity & {
      kind: 'system';
      conversation: ConversationKey;
      event: 'checkIn' | 'checkOut' | 'help' | 'harvest';
      fromName: string;
      at: number;
      text: string;
    });

export type TextItem = Extract<ChatItem, { kind: 'text' }>;

/** Messages kept per conversation, in memory and on the phone (the newest). */
export const CHAT_HISTORY_LIMIT = 200;

/** What changed in the store (for saving history). */
export type ChatChange = { type: 'add'; item: ChatItem } | { type: 'update'; item: TextItem };

export type ChatStore = {
  getSnapshot(): readonly ChatItem[];
  subscribe(listener: () => void): () => void;
  /** Each new or changed item; not called for `hydrate`. */
  onChange(listener: (change: ChatChange) => void): () => void;
  /** Adds a message unless one with the same (sender, message id) is already here. */
  add(item: ChatItem): void;
  /** Updates our own text by Meshtastic packet id (send state, receipts). */
  updateByPacket(packetId: number, patch: Partial<TextItem>): void;
  /** Merges saved history in (by time), skipping what arrived again since start. */
  hydrate(saved: readonly ChatItem[]): void;
};

/** Keeps the newest CHAT_HISTORY_LIMIT items of each conversation (by time). */
export function trimHistory(items: readonly ChatItem[]): ChatItem[] {
  const kept = new Set<ChatItem>();
  const byConversation = new Map<ConversationKey, ChatItem[]>();
  for (const item of items) {
    byConversation.set(item.conversation, [...(byConversation.get(item.conversation) ?? []), item]);
  }
  for (const list of byConversation.values()) {
    list
      .slice()
      .sort((a, b) => b.at - a.at)
      .slice(0, CHAT_HISTORY_LIMIT)
      .forEach((item) => kept.add(item));
  }
  return items.filter((item) => kept.has(item));
}

export function createChatStore(): ChatStore {
  let items: readonly ChatItem[] = [];
  const listeners = new Set<() => void>();
  const changeListeners = new Set<(change: ChatChange) => void>();
  const set = (next: readonly ChatItem[]) => {
    items = next;
    listeners.forEach((l) => l());
  };
  const changed = (change: ChatChange) => changeListeners.forEach((l) => l(change));
  return {
    getSnapshot: () => items,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onChange(listener) {
      changeListeners.add(listener);
      return () => changeListeners.delete(listener);
    },
    add(item) {
      if (items.some((i) => i.id === item.id)) return;
      set(trimHistory([...items, item]));
      changed({ type: 'add', item });
    },
    updateByPacket(packetId, patch) {
      const updated: TextItem[] = [];
      set(
        items.map((i) => {
          if (i.kind !== 'text' || !i.mine || i.packetId !== packetId) return i;
          const next = { ...i, ...patch };
          updated.push(next);
          return next;
        }),
      );
      updated.forEach((item) => changed({ type: 'update', item }));
    },
    hydrate(saved) {
      const here = new Set(items.map((i) => i.id));
      const merged = [...saved.filter((i) => !here.has(i.id)), ...items];
      set(trimHistory(merged.sort((a, b) => a.at - b.at)));
    },
  };
}

/** One conversation, oldest first. */
export function conversationItems(items: readonly ChatItem[], key: ConversationKey): ChatItem[] {
  return items.filter((i) => i.conversation === key).sort((a, b) => a.at - b.at);
}

/** Direct threads, most recent first. */
export function directPeers(items: readonly ChatItem[]): { node: number; lastAt: number }[] {
  const lastAt = new Map<number, number>();
  for (const item of items) {
    if (!item.conversation.startsWith('direct:')) continue;
    const node = Number(item.conversation.slice('direct:'.length));
    lastAt.set(node, Math.max(lastAt.get(node) ?? 0, item.at));
  }
  return [...lastAt]
    .map(([node, at]) => ({ node, lastAt: at }))
    .sort((a, b) => b.lastAt - a.lastAt);
}
