import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { LogIn, LogOut, RefreshCw, ShieldCheck, UserRound } from 'lucide-react-native';

import { Badge } from '../components/Badge';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { makeStyles, spacing, textStyles } from '../theme';
import { useClub } from './ClubProvider';
import { clubCopy } from './copy';
import { hasClubFeatures } from '@huntclub/shared';
import { entitlementOf } from './entitlement';
import { SIGN_IN_ROUTE } from './routes';

const copy = clubCopy.section;

/** Club mode on the Party/Club tab: the clubs on this phone, sign-in and sync. */
export function ClubSection({ now = Date.now }: { now?: () => number }) {
  const styles = useStyles();
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
    <Card title={copy.heading}>
      {clubs.length === 0 ? <Text style={styles.body}>{copy.none}</Text> : null}
      {clubs.map((club) => (
        <View key={club.id} style={styles.club}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{club.name}</Text>
            {club.role ? (
              <Badge
                tone={club.role === 'admin' ? 'info' : 'neutral'}
                icon={club.role === 'admin' ? ShieldCheck : UserRound}
                label={copy.role[club.role]}
              />
            ) : null}
          </View>
          {club.pendingInvite ? <Banner tone="info">{copy.pending}</Banner> : null}
          {club.syncedAt !== null ? (
            hasClubFeatures(entitlementOf(club), now()) ? (
              <Badge tone="success" label={copy.featuresOpen} />
            ) : (
              <Banner tone="warning">{copy.featuresClosed}</Banner>
            )
          ) : null}
        </View>
      ))}
      {failed ? (
        <Banner tone="warning" live>
          {copy.syncFailed}
        </Banner>
      ) : null}
      {!cloudAvailable ? (
        clubs.length > 0 ? (
          <Banner tone="info">{copy.unavailable}</Banner>
        ) : null
      ) : signedIn ? (
        <>
          {clubs.length > 0 ? (
            <Button
              icon={RefreshCw}
              label={busy ? copy.syncing : copy.sync}
              loading={busy}
              onPress={() => void runSync()}
            />
          ) : null}
          <Button
            variant="tertiary"
            icon={LogOut}
            label={copy.signOut}
            onPress={() => void session.signOut().then(reload)}
          />
        </>
      ) : (
        <Button icon={LogIn} label={copy.signIn} onPress={() => router.push(SIGN_IN_ROUTE)} />
      )}
    </Card>
  );
}

const useStyles = makeStyles((theme) => ({
  club: { gap: spacing.sm },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  name: { ...textStyles.title3, color: theme.colors.text },
  body: { ...textStyles.body, color: theme.colors.textSecondary },
}));
