import type { Unsubscribe } from '@huntclub/mesh';

import type { ChatItem, ChatStore, TextItem } from './model';

/** Where chat history is kept between app runs (SQLite in the app). */
export type ChatHistory = {
  /** Saved items, oldest first. */
  load(): Promise<ChatItem[]>;
  /** Saves a new item; ignores one already saved with the same (sender, message id). */
  add(item: ChatItem): Promise<void>;
  /** Saves our own text's new send state and delivery counts. */
  update(item: TextItem): Promise<void>;
};

/**
 * A text still "sending" when the app closed never got its result (the
 * radio link and its tracker went with the app): show it as not sent.
 */
export function restored(item: ChatItem): ChatItem {
  return item.kind === 'text' && item.sendState === 'sending'
    ? { ...item, sendState: 'failed' }
    : item;
}

/**
 * Loads saved history into the store, then saves every item already there
 * and every new or changed one, in order. Saving never blocks chat; a failed write is dropped
 * (and never logged: it holds a message body).
 */
export function persistChat(store: ChatStore, history: ChatHistory): Unsubscribe {
  let stopped = false;
  let writes = Promise.resolve();
  const write = (task: () => Promise<void>) => {
    writes = writes.then(task).catch(() => undefined);
  };
  // Anything that arrived before this started (saving ignores what is already saved).
  for (const item of store.getSnapshot()) write(() => history.add(item));
  const off = store.onChange((change) =>
    write(() => (change.type === 'add' ? history.add(change.item) : history.update(change.item))),
  );
  void history
    .load()
    .then((saved) => {
      if (!stopped) store.hydrate(saved.map(restored));
    })
    .catch(() => undefined);
  return () => {
    stopped = true;
    off();
  };
}
