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

export type SendState = 'sending' | 'sent' | 'failed';

export type ChatItem =
  | {
      kind: 'text';
      id: string;
      conversation: ConversationKey;
      from: number;
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
    }
  | {
      kind: 'system';
      id: string;
      conversation: ConversationKey;
      event: 'checkIn' | 'checkOut' | 'help' | 'harvest';
      from: number;
      fromName: string;
      at: number;
      text: string;
    };

/** Messages kept per conversation in memory (the newest). */
export const CHAT_HISTORY_LIMIT = 200;

export type ChatStore = {
  getSnapshot(): readonly ChatItem[];
  subscribe(listener: () => void): () => void;
  add(item: ChatItem): void;
  /** Updates our own text by Meshtastic packet id (send state, receipts). */
  updateByPacket(packetId: number, patch: Partial<Extract<ChatItem, { kind: 'text' }>>): void;
};

export function createChatStore(): ChatStore {
  let items: readonly ChatItem[] = [];
  const listeners = new Set<() => void>();
  const set = (next: readonly ChatItem[]) => {
    items = next;
    listeners.forEach((l) => l());
  };
  return {
    getSnapshot: () => items,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    add(item) {
      if (items.some((i) => i.id === item.id)) return;
      const next = [...items, item];
      const inConversation = next.filter((i) => i.conversation === item.conversation);
      const drop = inConversation.length - CHAT_HISTORY_LIMIT;
      set(drop > 0 ? next.filter((i) => !inConversation.slice(0, drop).includes(i)) : next);
    },
    updateByPacket(packetId, patch) {
      set(
        items.map((i) =>
          i.kind === 'text' && i.mine && i.packetId === packetId ? { ...i, ...patch } : i,
        ),
      );
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
