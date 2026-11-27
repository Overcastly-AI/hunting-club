import { router } from 'expo-router';
import { Bluetooth } from 'lucide-react-native';

import { AboutSection } from '../../about/AboutSection';
import { ClubSection } from '../../club/ClubSection';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { HarvestList } from '../../harvest/HarvestList';
import { PartyQr } from '../../party/PartyQr';
import { YourNameSection } from '../../profile/NamePrompt';
import { radioCopy } from '../../radio/copy';
import { PAIR_RADIO_ROUTE } from '../../radio/routes';
import { RadioStatus } from '../../radio/ui/RadioStatus';
import { SafetyNote } from '../../safety/components/SafetyNote';
import { ThemeSection } from '../../settings/ThemeSection';

export default function PartyScreen() {
  return (
    <Screen title="Party" description="Start a party or scan a Party QR code to hunt together.">
      <ClubSection />
      <PartyQr />
      <YourNameSection />
      <HarvestList />
      <Card title={radioCopy.settingsEntry}>
        <RadioStatus />
        <Button
          icon={Bluetooth}
          label={radioCopy.pair.title}
          onPress={() => router.push(PAIR_RADIO_ROUTE)}
        />
      </Card>
      <ThemeSection />
      <AboutSection />
      <SafetyNote />
    </Screen>
  );
}
