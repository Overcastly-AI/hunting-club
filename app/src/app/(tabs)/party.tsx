import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ClubSection } from '../../club/ClubSection';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { HarvestList } from '../../harvest/HarvestList';
import { radioCopy } from '../../radio/copy';
import { PAIR_RADIO_ROUTE } from '../../radio/routes';
import { RadioStatus } from '../../radio/ui/RadioStatus';
import { SafetyNote } from '../../safety/components/SafetyNote';
import { colors, spacing, textStyles } from '../../theme';

export default function PartyScreen() {
  return (
    <Screen title="Party" description="Start a party or scan a Party QR code to hunt together.">
      <ClubSection />
      <HarvestList />
      <SafetyNote />
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          {radioCopy.settingsEntry}
        </Text>
        <RadioStatus />
        <Button label={radioCopy.pair.title} onPress={() => router.push(PAIR_RADIO_ROUTE)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { ...textStyles.label, color: colors.text },
});
