import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { AboutSection } from '../../about/AboutSection';
import { ClubSection } from '../../club/ClubSection';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { HarvestList } from '../../harvest/HarvestList';
import { PartyQr } from '../../party/PartyQr';
import { radioCopy } from '../../radio/copy';
import { PAIR_RADIO_ROUTE } from '../../radio/routes';
import { RadioStatus } from '../../radio/ui/RadioStatus';
import { SafetyNote } from '../../safety/components/SafetyNote';
import { ThemeSection } from '../../settings/ThemeSection';
import { makeStyles, spacing, textStyles } from '../../theme';

export default function PartyScreen() {
  const styles = useStyles();
  return (
    <Screen title="Party" description="Start a party or scan a Party QR code to hunt together.">
      <ClubSection />
      <PartyQr />
      <HarvestList />
      <SafetyNote />
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          {radioCopy.settingsEntry}
        </Text>
        <RadioStatus />
        <Button label={radioCopy.pair.title} onPress={() => router.push(PAIR_RADIO_ROUTE)} />
      </View>
      <ThemeSection />
      <AboutSection />
    </Screen>
  );
}

const useStyles = makeStyles((theme) => ({
  section: { gap: spacing.sm },
  heading: { ...textStyles.label, color: theme.colors.text },
}));
