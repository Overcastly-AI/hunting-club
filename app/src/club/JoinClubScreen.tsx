import { ChannelUrlError, decodeJoinUrl } from '@huntclub/mesh';
import type { MemberJoin } from '@huntclub/shared';
import { router } from 'expo-router';
import { LogIn, UserPlus } from 'lucide-react-native';
import { useState } from 'react';

import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { ProfileFields, useProfileDraft } from '../profile/ProfileFields';
import { useClub } from './ClubProvider';
import { clubCopy } from './copy';
import { SIGN_IN_ROUTE } from './routes';

const copy = clubCopy.join;

/** What a scanned link is, checked with the mesh package's one join-link parser. */
function linkKind(url: string | null): 'club' | 'party' | 'bad' {
  if (!url) return 'bad';
  try {
    return decodeJoinUrl(url).target.kind;
  } catch (error) {
    if (error instanceof ChannelUrlError) return 'bad';
    throw error;
  }
}

/** Opened by a Club QR code (huntclub://join?…&club=…&invite=…). Works offline. */
export function JoinClubScreen({ url, onDone }: { url: string | null; onDone: () => void }) {
  const { join, signedIn, cloudAvailable, myProfile } = useClub();
  const [joined, setJoined] = useState(false);
  const kind = linkKind(url);

  if (kind !== 'club' || !url) {
    return (
      <Screen title={copy.title}>
        {kind === 'party' ? (
          <Banner tone="info">{copy.notClub}</Banner>
        ) : (
          <Banner tone="warning">{copy.badLink}</Banner>
        )}
        <Button variant="primary" label={copy.done} onPress={onDone} />
      </Screen>
    );
  }

  if (joined) {
    // One main action: finish joining when sign-in is possible, otherwise Done.
    const canSignIn = !signedIn && cloudAvailable;
    return (
      <Screen title={copy.title}>
        <Banner tone="success">{copy.joined}</Banner>
        {canSignIn ? (
          <Button
            variant="primary"
            size="lg"
            icon={LogIn}
            label={copy.signInToFinish}
            onPress={() => router.replace(SIGN_IN_ROUTE)}
          />
        ) : null}
        <Button variant={canSignIn ? 'secondary' : 'primary'} label={copy.done} onPress={onDone} />
      </Screen>
    );
  }

  // Remount when the onboarding profile arrives so it prefills the fields.
  return (
    <JoinForm
      key={myProfile ? 'profile' : 'empty'}
      initial={myProfile}
      onJoin={(profile) => void join(url, profile).then(() => setJoined(true))}
    />
  );
}

/** Name and initials for the club roster (prefilled from onboarding), by the shared rules. */
function JoinForm({
  initial,
  onJoin,
}: {
  initial: MemberJoin | null;
  onJoin: (profile: MemberJoin) => void;
}) {
  const draft = useProfileDraft({ initial });
  const { profile } = draft;
  return (
    <Screen title={copy.title} description={copy.intro}>
      <ProfileFields draft={draft} />
      <Button
        variant="primary"
        size="lg"
        icon={UserPlus}
        label={copy.join}
        disabled={!profile}
        onPress={() => profile && onJoin(profile)}
      />
    </Screen>
  );
}
