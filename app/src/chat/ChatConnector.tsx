import { useSQLiteContext } from 'expo-sqlite';
import { useContext, useEffect } from 'react';

import { sqliteChatHistory } from '../db/chatHistory';
import { ChatRadioContext, connectChat } from './ChatRadio';
import { chatStore } from './chatStore';
import { persistChat } from './history';

/**
 * Mounted once over the tabs: loads saved chat history and keeps saving it,
 * and feeds messages in whichever tab is open.
 */
export function ChatConnector() {
  const db = useSQLiteContext();
  const radio = useContext(ChatRadioContext);
  useEffect(() => persistChat(chatStore, sqliteChatHistory(db)), [db]);
  useEffect(() => (radio ? connectChat(radio, chatStore) : undefined), [radio]);
  return null;
}
