import { useContext, useEffect } from 'react';

import { ChatRadioContext, connectChat } from './ChatRadio';
import { chatStore } from './chatStore';

/** Mounted once over the tabs so messages arrive whichever tab is open. */
export function ChatConnector() {
  const radio = useContext(ChatRadioContext);
  useEffect(() => (radio ? connectChat(radio, chatStore) : undefined), [radio]);
  return null;
}
