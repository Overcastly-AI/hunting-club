import { FREE_PARTY_MAX_MEMBERS } from '@huntclub/core';
import { useContext } from 'react';
import { Text, View } from 'react-native';

import { Banner } from '../components/Banner';
import { Card } from '../components/Card';
import { QrCode } from '../components/QrCode';
import { makeStyles, radii, textStyles } from '../theme';
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
  const styles = useStyles();
  const copy = partyCopy.qr;
  const service = useContext(PartyRadioContext);
  const party = usePartyView(service);
  if (!service || !party) return null;

  const link = service.qrLink();
  return (
    <Card title={copy.title}>
      {link ? (
        <>
          <Text style={styles.body}>{copy.body}</Text>
          <View style={styles.code}>
            <QrCode value={link} size={PARTY_QR_SIZE} accessibilityLabel={copy.imageLabel} />
          </View>
        </>
      ) : (
        <Banner tone="info">{copy.full(FREE_PARTY_MAX_MEMBERS)}</Banner>
      )}
    </Card>
  );
}

const useStyles = makeStyles((theme) => ({
  body: { ...textStyles.body, color: theme.colors.textSecondary },
  // The code keeps its own white quiet zone; the rounded frame only sets it off the card.
  code: { alignSelf: 'center', borderRadius: radii.md, overflow: 'hidden' },
}));
