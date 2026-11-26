import { PlaceholderScreen } from '../../components/PlaceholderScreen';
import { HarvestList } from '../../harvest/HarvestList';
import { SafetyNote } from '../../safety/components/SafetyNote';

export default function PartyScreen() {
  return (
    <PlaceholderScreen
      title="Party"
      description="Start a party or scan a Party QR code to hunt together."
    >
      <HarvestList />
      <SafetyNote />
    </PlaceholderScreen>
  );
}
