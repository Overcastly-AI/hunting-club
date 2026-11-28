import { MESHTASTIC_BLE } from '@huntclub/mesh';
import { BluetoothSearching, Radio, RadioOff, Settings, Unlink } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';

import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ensureBluetoothPermission, type BluetoothReadiness } from '../../permissions/bluetooth';
import { Screen } from '../../components/Screen';
import {
  ICON_SIZE,
  makeStyles,
  radii,
  sizes,
  spacing,
  tabularNums,
  textStyles,
  useTheme,
} from '../../theme';
import { radioCopy } from '../copy';
import { useRadio } from '../RadioProvider';
import { scanForRadios, type FoundRadio } from '../scan';
import { signalLabel } from '../signal';
import { RadioStatus } from './RadioStatus';

const ANDROID_BLUETOOTH_SETTINGS = 'android.settings.BLUETOOTH_SETTINGS';

function openBluetoothSettings() {
  if (Platform.OS === 'android') {
    Linking.sendIntent(ANDROID_BLUETOOTH_SETTINGS).catch(() => Linking.openSettings());
  } else {
    void Linking.openSettings();
  }
}

type Props = {
  /** Called after "Done" (onboarding moves on; settings goes back). */
  onDone?: () => void;
  /** Onboarding: lets the hunter skip pairing for now. */
  onSkip?: () => void;
};

/** Onboarding step 1 and Club tab settings: find, pair and connect a radio. */
export function PairRadioScreen({ onDone, onSkip }: Props) {
  const styles = useStyles();
  const theme = useTheme();
  const { link, pairedRadio, repairNeeded, pair, forget } = useRadio();
  const [found, setFound] = useState<FoundRadio[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [readiness, setReadiness] = useState<BluetoothReadiness | null>(null);
  const stopScan = useRef<(() => void) | null>(null);

  useEffect(() => () => stopScan.current?.(), []);

  const findRadios = useCallback(async () => {
    setFailed(false);
    const state = await ensureBluetoothPermission();
    setReadiness(state);
    if (state !== 'granted') return;
    stopScan.current?.();
    setFound([]);
    setScanning(true);
    try {
      stopScan.current = await scanForRadios({
        onFound: (radio) =>
          setFound((list) =>
            [...list.filter((r) => r.id !== radio.id), radio].sort((a, b) => b.rssi - a.rssi),
          ),
        onDone: () => setScanning(false),
      });
    } catch {
      setScanning(false);
    }
  }, []);

  const connect = useCallback(
    async (radio: FoundRadio) => {
      stopScan.current?.();
      setFailed(false);
      setConnectingId(radio.id);
      try {
        await pair(radio);
        setFound([]);
      } catch {
        setFailed(true);
      } finally {
        setConnectingId(null);
      }
    },
    [pair],
  );

  const linked = pairedRadio !== null && link !== 'none' && link !== 'disconnected';

  const openSettings = (
    <Button icon={Settings} label={radioCopy.repair.openSettings} onPress={openBluetoothSettings} />
  );

  return (
    <Screen title={radioCopy.pair.title} description={linked ? undefined : radioCopy.pair.intro}>
      {pairedRadio ? (
        <Card title={radioCopy.settingsEntry}>
          <RadioStatus />
          {link === 'ready' && onDone ? (
            <Button variant="primary" size="lg" label={radioCopy.pair.done} onPress={onDone} />
          ) : null}
          <Button
            variant="danger"
            icon={Unlink}
            label={radioCopy.repair.forgetHere}
            onPress={() => void forget()}
          />
        </Card>
      ) : null}

      {repairNeeded ? (
        <Banner tone="warning" action={openSettings}>
          {radioCopy.repair.needed}
        </Banner>
      ) : null}

      {readiness === 'bluetoothOff' ? (
        <Banner tone="warning" action={openSettings}>
          {radioCopy.permissions.bluetoothOff}
        </Banner>
      ) : null}

      {!linked ? (
        <Button
          variant="primary"
          size="lg"
          icon={BluetoothSearching}
          label={
            scanning
              ? radioCopy.pair.searching
              : found.length > 0
                ? radioCopy.pair.searchAgain
                : radioCopy.pair.findRadios
          }
          loading={scanning}
          disabled={connectingId !== null}
          onPress={() => void findRadios()}
        />
      ) : null}

      {failed ? (
        <Banner tone="warning" live>
          {radioCopy.pair.failed}
        </Banner>
      ) : null}

      {!linked && found.length > 0 ? (
        <View style={styles.list} accessibilityRole="list">
          {found.map((radio) => {
            const busy = connectingId === radio.id;
            return (
              <Pressable
                key={radio.id}
                accessibilityRole="button"
                accessibilityLabel={`${radioCopy.pair.connect} ${radio.name}, ${signalLabel(radio.rssi)}`}
                accessibilityState={{ disabled: connectingId !== null, busy }}
                disabled={connectingId !== null}
                onPress={() => void connect(radio)}
                style={({ pressed }) => [styles.radioRow, pressed && styles.pressed]}
              >
                <Radio
                  size={ICON_SIZE.lg}
                  color={theme.colors.textSecondary}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
                <View style={styles.radioText}>
                  <Text style={styles.radioName}>{radio.name}</Text>
                  <Text style={styles.detail}>{signalLabel(radio.rssi)}</Text>
                </View>
                <Text style={styles.action}>
                  {busy ? radioCopy.pair.connecting : radioCopy.pair.connect}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!linked && !scanning && readiness === 'granted' && found.length === 0 ? (
        <EmptyState icon={RadioOff} title={radioCopy.pair.noneFoundTitle}>
          {radioCopy.pair.noneFound}
        </EmptyState>
      ) : null}

      {onSkip && !linked ? (
        <Button variant="tertiary" label={radioCopy.pair.setUpLater} onPress={onSkip} />
      ) : null}

      <Card title={radioCopy.pin.title}>
        <Text style={styles.body}>
          {radioCopy.pin.body} <Text style={styles.pin}>{MESHTASTIC_BLE.defaultFixedPin}</Text>.
        </Text>
      </Card>

      <Card title={radioCopy.repair.title}>
        {radioCopy.repair.body.map((line) => (
          <Text key={line} style={styles.body}>
            {line}
          </Text>
        ))}
        {openSettings}
      </Card>
    </Screen>
  );
}

const RADIO_ROW_HEIGHT = 64;

const useStyles = makeStyles((theme) => ({
  body: { ...textStyles.body, color: theme.colors.textSecondary },
  detail: { ...textStyles.body, color: theme.colors.textSecondary },
  pin: { ...textStyles.label, ...tabularNums, color: theme.colors.text },
  list: { gap: spacing.sm },
  radioRow: {
    minHeight: Math.max(RADIO_ROW_HEIGHT, sizes.minTapTarget),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.raised,
  },
  // Pressed is a tone step, never a fade (faded text drops under 4.5:1 in the light theme).
  pressed: { backgroundColor: theme.colors.pressed },
  radioText: { flex: 1, gap: spacing.xs },
  radioName: { ...textStyles.label, color: theme.colors.text },
  action: { ...textStyles.label, color: theme.colors.text },
}));
