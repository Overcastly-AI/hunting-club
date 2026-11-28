import { router } from 'expo-router';

import { CheckInScreen } from '../checkin/CheckInScreen';
import { useNamePromptAtCheckIn } from '../profile/NamePrompt';

/** Back to the map: where Check In opens from (the sheet's Check In and Change spot). */
function backToMap() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Check In, opened from the map's sheet (it is no longer a tab: docs/DESIGN.md "Map chrome").
 * The same screen and every mode as before, with a way back to the map.
 */
export default function CheckInRoute() {
  // The first check-in with no name set asks for one, after the check-in has gone out.
  const namePrompt = useNamePromptAtCheckIn();
  return (
    <>
      <CheckInScreen onCheckedIn={namePrompt.offer} onClose={backToMap} />
      {namePrompt.sheet}
    </>
  );
}
