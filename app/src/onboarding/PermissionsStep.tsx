import { Bell, Bluetooth, MapPin, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { Badge } from '../components/Badge';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import type { PermissionCopy } from '../permissions/askPermission';
import { BLUETOOTH_PERMISSION_COPY, ensureBluetoothPermission } from '../permissions/bluetooth';
import { ensureLocationPermission, LOCATION_PERMISSION_COPY } from '../permissions/location';
import {
  ensureNotificationPermission,
  NOTIFICATIONS_PERMISSION_COPY,
} from '../permissions/notifications';
import { radioCopy } from '../radio/copy';
import { makeStyles, textStyles } from '../theme';
import { onboardingCopy } from './copy';

const copy = onboardingCopy.permissions;

type Outcome = 'allowed' | 'notAllowed' | 'bluetoothOff';

type Row = {
  id: 'location' | 'bluetooth' | 'notifications';
  /** Drawn on the Allow button beside its word. */
  icon: LucideIcon;
  /** The permission's own plain-language reason (the same words its dialog uses). */
  reason: PermissionCopy;
  ask: () => Promise<Outcome>;
};

const allowedIf = (granted: boolean): Outcome => (granted ? 'allowed' : 'notAllowed');

/** Spec order: location, Bluetooth, notifications. */
const ROWS: readonly Row[] = [
  {
    id: 'location',
    icon: MapPin,
    reason: LOCATION_PERMISSION_COPY,
    ask: async () => allowedIf((await ensureLocationPermission()) !== null),
  },
  {
    id: 'bluetooth',
    icon: Bluetooth,
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
    icon: Bell,
    reason: NOTIFICATIONS_PERMISSION_COPY,
    ask: async () => allowedIf(await ensureNotificationPermission()),
  },
];

/** Why a permission is still off; "Allowed" shows as a badge beside the title instead. */
const NOT_ALLOWED_TEXT: Record<Exclude<Outcome, 'allowed'>, string> = {
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
          <Card
            key={row.id}
            title={copy[row.id]}
            status={outcome === 'allowed' ? <Badge tone="success" label={copy.allowed} /> : null}
          >
            <Text style={styles.body}>{row.reason.askBody}</Text>
            {outcome && outcome !== 'allowed' ? (
              <Banner tone="warning" live>
                {NOT_ALLOWED_TEXT[outcome]}
              </Banner>
            ) : null}
            {outcome !== 'allowed' ? (
              <Button
                icon={row.icon}
                label={copy.allow[row.id]}
                disabled={asking !== null && asking !== row.id}
                loading={asking === row.id}
                onPress={() => void ask(row)}
              />
            ) : null}
          </Card>
        );
      })}
      <Button
        variant="primary"
        size="lg"
        label={copy.continue}
        disabled={asking !== null}
        onPress={onNext}
      />
    </Screen>
  );
}

const useStyles = makeStyles((theme) => ({
  body: { ...textStyles.body, color: theme.colors.textSecondary },
}));
