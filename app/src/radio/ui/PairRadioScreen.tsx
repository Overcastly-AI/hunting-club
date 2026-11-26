import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { colors, radii, sizes, spacing, textStyles } from '../../theme';
import { radioCopy } from '../copy';
import { MESHTASTIC_BLE } from '../meshPending';
import { requestRadioPermissions, type RadioPermissionState } from '../permissions';
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
};

/** Onboarding step 1 and Party/Club settings: find, pair and connect a radio. */
export function PairRadioScreen({ onDone }: Props) {
  const { link, pairedRadio, repairNeeded, pair, forget } = useRadio();
  const [found, setFound] = useState<FoundRadio[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [permission, setPermission] = useState<RadioPermissionState | null>(null);
  const stopScan = useRef<(() => void) | null>(null);

  useEffect(() => () => stopScan.current?.(), []);

  const findRadios = useCallback(async () => {
    setFailed(false);
    const state = await requestRadioPermissions();
    setPermission(state);
    if (state.status !== 'granted') return;
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

  return (
    <Screen title={radioCopy.pair.title} description={linked ? undefined : radioCopy.pair.intro}>
      {pairedRadio ? (
        <View style={styles.card}>
          <RadioStatus />
          {link === 'ready' && onDone ? (
            <Button variant="primary" label={radioCopy.pair.done} onPress={onDone} />
          ) : null}
          <Button label={radioCopy.repair.forgetHere} onPress={() => void forget()} />
        </View>
      ) : null}

      {repairNeeded ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{radioCopy.repair.needed}</Text>
          <Button label={radioCopy.repair.openSettings} onPress={openBluetoothSettings} />
        </View>
      ) : null}

      {permission && permission.status !== 'granted' ? (
        <View style={styles.card}>
          <Text style={styles.body}>
            {permission.status === 'bluetoothOff'
              ? radioCopy.permissions.bluetoothOff
              : permission.status === 'blocked'
                ? radioCopy.permissions.blocked
                : radioCopy.permissions.bluetooth}
          </Text>
          {permission.status === 'blocked' ? (
            <Button
              label={radioCopy.permissions.openSettings}
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
        </View>
      ) : null}

      {!linked ? (
        <Button
          variant="primary"
          label={
            scanning
              ? radioCopy.pair.searching
              : found.length > 0
                ? radioCopy.pair.searchAgain
                : radioCopy.pair.findRadios
          }
          disabled={scanning || connectingId !== null}
          onPress={() => void findRadios()}
        />
      ) : null}

      {failed ? <Text style={styles.body}>{radioCopy.pair.failed}</Text> : null}

      {!linked && found.length > 0 ? (
        <View style={styles.list} accessibilityRole="list">
          {found.map((radio) => {
            const busy = connectingId === radio.id;
            return (
              <Pressable
                key={radio.id}
                accessibilityRole="button"
                accessibilityLabel={`${radioCopy.pair.connect} ${radio.name}, ${signalLabel(radio.rssi)}`}
                disabled={connectingId !== null}
                onPress={() => void connect(radio)}
                style={({ pressed }) => [styles.radioRow, pressed && styles.pressed]}
              >
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

      {!linked && !scanning && permission?.status === 'granted' && found.length === 0 ? (
        <Text style={styles.body}>{radioCopy.pair.noneFound}</Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{radioCopy.pin.title}</Text>
        <Text style={styles.body}>
          {radioCopy.pin.body} <Text style={styles.pin}>{MESHTASTIC_BLE.defaultFixedPin}</Text>.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{radioCopy.repair.title}</Text>
        {radioCopy.repair.body.map((line) => (
          <Text key={line} style={styles.body}>
            {line}
          </Text>
        ))}
        <Button label={radioCopy.repair.openSettings} onPress={openBluetoothSettings} />
      </View>
    </Screen>
  );
}

const RADIO_ROW_HEIGHT = 64;

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { ...textStyles.label, color: colors.text },
  body: { ...textStyles.body, color: colors.textSecondary },
  detail: { ...textStyles.body, color: colors.textSecondary },
  pin: { ...textStyles.label, color: colors.text },
  list: { gap: spacing.sm },
  radioRow: {
    minHeight: Math.max(RADIO_ROW_HEIGHT, sizes.minTapTarget),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceRaised,
  },
  pressed: { opacity: 0.7 },
  radioText: { flex: 1, gap: spacing.xs },
  radioName: { ...textStyles.label, color: colors.text },
  action: { ...textStyles.label, color: colors.text },
});
