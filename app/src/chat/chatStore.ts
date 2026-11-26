import { useSyncExternalStore } from 'react';

import { createChatStore } from './model';

/** The app's chat history this session, fed by `connectChat`. */
export const chatStore = createChatStore();

export function useChatItems() {
  return useSyncExternalStore(chatStore.subscribe, chatStore.getSnapshot);
}
