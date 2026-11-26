import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import type { PermissionCopy } from '../permissions/askPermission';
import { BLUETOOTH_PERMISSION_COPY, ensureBluetoothPermission } from '../permissions/bluetooth';
import { ensureLocationPermission, LOCATION_PERMISSION_COPY } from '../permissions/location';
import {
  ensureNotificationPermission,
  NOTIFICATIONS_PERMISSION_COPY,
} from '../permissions/notifications';
import { radioCopy } from '../radio/copy';
import { makeStyles, radii, spacing, textStyles } from '../theme';
import { onboardingCopy } from './copy';

const copy = onboardingCopy.permissions;

type Outcome = 'allowed' | 'notAllowed' | 'bluetoothOff';

type Row = {
  id: 'location' | 'bluetooth' | 'notifications';
  /** The permission's own plain-language reason (the same words its dialog uses). */
  reason: PermissionCopy;
  ask: () => Promise<Outcome>;
};

const allowedIf = (granted: boolean): Outcome => (granted ? 'allowed' : 'notAllowed');

/** Spec order: location, Bluetooth, notifications. */
const ROWS: readonly Row[] = [
  {
    id: 'location',
    reason: LOCATION_PERMISSION_COPY,
    ask: async () => allowedIf((await ensureLocationPermission()) !== null),
  },
  {
    id: 'bluetooth',
    reason: BLUETOOTH_PERMISSION_COPY,
    ask: async () => {
      const state = await ensureBluetoothPermission();
      return state === 'granted'
        ? 'allowed'
        : state === 'bluetoothOff'
          ? 'bluetoothOff'
          : 'notAllowed';
    },
  },
  {
    id: 'notifications',
    reason: NOTIFICATIONS_PERMISSION_COPY,
    ask: async () => allowedIf(await ensureNotificationPermission()),
  },
];

const OUTCOME_TEXT: Record<Outcome, string> = {
  allowed: copy.allowed,
  notAllowed: copy.notAllowed,
  bluetoothOff: radioCopy.permissions.bluetoothOff,
};

/**
 * Onboarding step 4 (spec: Screens → 5. Onboarding): allow location,
 * Bluetooth and notifications, each with its plain-language reason. Every
 * one is optional; the hunter can continue either way.
 */
export function PermissionsStep({ onNext }: { onNext: () => void }) {
  const styles = useStyles();
  const [outcomes, setOutcomes] = useState<Partial<Record<Row['id'], Outcome>>>({});
  const [asking, setAsking] = useState<Row['id'] | null>(null);

  const ask = async (row: Row) => {
    setAsking(row.id);
    try {
      const outcome = await row.ask();
      setOutcomes((current) => ({ ...current, [row.id]: outcome }));
    } finally {
      setAsking(null);
    }
  };

  return (
    <Screen title={copy.title} description={copy.body}>
      {ROWS.map((row) => {
        const outcome = outcomes[row.id];
        return (
          <View key={row.id} style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitle}>
              {copy[row.id]}
            </Text>
            <Text style={styles.body}>{row.reason.askBody}</Text>
            {outcome ? <Text style={styles.outcome}>{OUTCOME_TEXT[outcome]}</Text> : null}
            {outcome !== 'allowed' ? (
              <Button
                label={copy.allow[row.id]}
                disabled={asking !== null}
                onPress={() => void ask(row)}
              />
            ) : null}
          </View>
        );
      })}
      <Button variant="primary" label={copy.continue} disabled={asking !== null} onPress={onNext} />
    </Screen>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  cardTitle: { ...textStyles.label, color: theme.colors.text },
  body: { ...textStyles.body, color: theme.colors.textSecondary },
  outcome: { ...textStyles.label, color: theme.colors.text },
}));
