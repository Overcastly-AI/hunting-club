import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { colors, spacing, textStyles } from '../theme';
import { useClub } from './ClubProvider';
import { clubCopy } from './copy';
import { hasClubFeatures } from '@huntclub/shared';
import { entitlementOf } from './entitlement';
import { SIGN_IN_ROUTE } from './routes';

const copy = clubCopy.section;

/** Club mode on the Party/Club tab: the clubs on this phone, sign-in and sync. */
export function ClubSection({ now = Date.now }: { now?: () => number }) {
  const { clubs, signedIn, cloudAvailable, sync, session, reload } = useClub();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const runSync = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setFailed((await sync()).failed > 0);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {copy.heading}
      </Text>
      {clubs.length === 0 ? <Text style={styles.body}>{copy.none}</Text> : null}
      {clubs.map((club) => (
        <View key={club.id} style={styles.club}>
          <Text style={styles.name}>{club.name}</Text>
          {club.role ? <Text style={styles.body}>{copy.role[club.role]}</Text> : null}
          {club.pendingInvite ? <Text style={styles.body}>{copy.pending}</Text> : null}
          {club.syncedAt !== null ? (
            <Text style={styles.body}>
              {hasClubFeatures(entitlementOf(club), now())
                ? copy.featuresOpen
                : copy.featuresClosed}
            </Text>
          ) : null}
        </View>
      ))}
      {failed ? <Text style={styles.body}>{copy.syncFailed}</Text> : null}
      {!cloudAvailable ? (
        clubs.length > 0 ? (
          <Text style={styles.body}>{copy.unavailable}</Text>
        ) : null
      ) : signedIn ? (
        <>
          {clubs.length > 0 ? (
            <Button
              label={busy ? copy.syncing : copy.sync}
              disabled={busy}
              onPress={() => void runSync()}
            />
          ) : null}
          <Button label={copy.signOut} onPress={() => void session.signOut().then(reload)} />
        </>
      ) : (
        <Button label={copy.signIn} onPress={() => router.push(SIGN_IN_ROUTE)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  club: { gap: spacing.xs },
  heading: { ...textStyles.label, color: colors.text },
  name: { ...textStyles.bodyLarge, color: colors.text },
  body: { ...textStyles.body, color: colors.textSecondary },
});
