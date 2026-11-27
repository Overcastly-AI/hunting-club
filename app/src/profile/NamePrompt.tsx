import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Sheet } from '../components/Sheet';
import { useRadio } from '../radio/RadioProvider';
import { makeStyles, textStyles } from '../theme';
import { nameCopy } from './copy';
import { NameForm } from './ProfileFields';
import { useProfile } from './ProfileProvider';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  /** "Skip for now" (and Close): the caller decides whether to remember it. */
  onSkip?: () => void;
};

/**
 * The name prompt as a sheet over the app: what the name is for, the name (the saved one,
 * else the linked radio's) and initials, Save name and, where the name can wait, Skip for now.
 * Saving writes the phone's profile; OwnerSync then puts it on the radio. No account, no
 * signal needed.
 */
export function NamePromptSheet({ visible, onClose, onSkip }: SheetProps) {
  const styles = useStyles();
  const { profile, save } = useProfile();
  const { radio } = useRadio();
  const dismiss = onSkip ?? onClose;
  return (
    <Sheet visible={visible} title={nameCopy.title} onClose={dismiss}>
      <Text style={styles.body}>{nameCopy.body}</Text>
      {/* Mounted only while open, so it starts from the latest profile and radio name. */}
      {visible ? (
        <NameForm
          initial={profile ?? null}
          radio={radio}
          onSave={(next) => void save(next).then(onClose)}
          {...(onSkip ? { onSkip } : {})}
        />
      ) : null}
    </Sheet>
  );
}

/**
 * The name prompt at the first check-in: shown once the hunter checks in with no name set
 * (skipped at first run), unless they skipped it here before. The check-in itself never waits
 * for it. Returns `offer` for the check-in to call, and the sheet to render.
 */
export function useNamePromptAtCheckIn() {
  const { profile, nameSkipped, skipName } = useProfile();
  const [open, setOpen] = useState(false);
  const offer = () => {
    if (profile === null && !nameSkipped) setOpen(true);
  };
  const sheet = (
    <NamePromptSheet
      visible={open}
      onClose={() => setOpen(false)}
      onSkip={() => void skipName().then(() => setOpen(false))}
    />
  );
  return { offer, sheet };
}

/** Party tab → Your name: who others see you as, and a way to set or change it. */
export function YourNameSection() {
  const styles = useStyles();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  return (
    <Card title={nameCopy.title}>
      <Text style={profile ? styles.name : styles.body}>
        {profile ? `${profile.displayName} (${profile.initials})` : nameCopy.section.notSet}
      </Text>
      <Button
        label={profile ? nameCopy.section.change : nameCopy.section.set}
        onPress={() => setOpen(true)}
      />
      <NamePromptSheet visible={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

const useStyles = makeStyles((theme) => ({
  body: { ...textStyles.body, color: theme.colors.textSecondary },
  name: { ...textStyles.bodyLarge, color: theme.colors.text },
}));
