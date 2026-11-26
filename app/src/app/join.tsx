import { useLinkingURL } from 'expo-linking';
import { router } from 'expo-router';

import { JoinClubScreen } from '../club/JoinClubScreen';

/** Deep link target for Club QR codes (huntclub://join?…). */
export default function JoinRoute() {
  const url = useLinkingURL();
  return <JoinClubScreen url={url} onDone={() => router.replace('/party')} />;
}
