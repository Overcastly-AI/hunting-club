import { useSyncExternalStore } from 'react';

import { createChatStore } from './model';

/** The app's chat history, fed by `connectChat` and saved by `persistChat`. */
export const chatStore = createChatStore();

export function useChatItems() {
  return useSyncExternalStore(chatStore.subscribe, chatStore.getSnapshot);
}
