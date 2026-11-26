import { FREE_PARTY_MAX_MEMBERS } from '@huntclub/core';
import { useContext } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { QrCode } from '../components/QrCode';
import { colors, spacing, textStyles } from '../theme';
import { partyCopy } from './copy';
import { PartyRadioContext } from './PartyRadio';
import { usePartyView } from './usePartyView';

/** Points across; big enough to scan from arm's length. */
export const PARTY_QR_SIZE = 240;

/**
 * Party tab: the Party QR code friends scan to join. Hidden once the party is
 * full (PartyService.qrLink is null then, per core's shouldShowPartyQr).
 * The link holds the channel key: never log it.
 */
export function PartyQr() {
  const copy = partyCopy.qr;
  const service = useContext(PartyRadioContext);
  const party = usePartyView(service);
  if (!service || !party) return null;

  const link = service.qrLink();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {copy.title}
      </Text>
      {link ? (
        <>
          <Text style={styles.body}>{copy.body}</Text>
          <View style={styles.code}>
            <QrCode value={link} size={PARTY_QR_SIZE} accessibilityLabel={copy.imageLabel} />
          </View>
        </>
      ) : (
        <Text style={styles.body}>{copy.full(FREE_PARTY_MAX_MEMBERS)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { ...textStyles.label, color: colors.text },
  body: { ...textStyles.body, color: colors.textSecondary },
  code: { alignItems: 'center' },
});
