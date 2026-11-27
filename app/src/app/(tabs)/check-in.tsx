import { CheckInScreen } from '../../checkin/CheckInScreen';
import { useNamePromptAtCheckIn } from '../../profile/NamePrompt';

export default function CheckInTab() {
  // The first check-in with no name set asks for one, after the check-in has gone out.
  const namePrompt = useNamePromptAtCheckIn();
  return (
    <>
      <CheckInScreen onCheckedIn={namePrompt.offer} />
      {namePrompt.sheet}
    </>
  );
}
