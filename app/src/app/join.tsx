import { useLinkingURL } from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';

import { JoinClubScreen } from '../club/JoinClubScreen';

/**
 * Club QR codes: opened by the deep link (huntclub://join?…) or from the
 * in-app scanner, which passes the scanned link as `link` and gets the
 * hunter back where they were afterwards.
 */
export default function JoinRoute() {
  const linkingUrl = useLinkingURL();
  const { link } = useLocalSearchParams<{ link?: string }>();
  return (
    <JoinClubScreen
      url={link ?? linkingUrl}
      onDone={() => (link ? router.back() : router.replace('/party'))}
    />
  );
}
