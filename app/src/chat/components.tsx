import { MAX_TEXT_CHARS } from '@huntclub/mesh';
import { Send } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Button } from '../components/Button';
import { OptionButtons } from '../components/OptionButtons';
import { Field } from '../components/Field';
import { formatClockTime } from '@huntclub/shared';
import { QUICK_REPLIES } from '../domain/quickReplies';
import { placeLabel } from '../map/labels';
import { makeStyles, radii, spacing, textStyles } from '../theme';
import type { ChatItem } from './model';
import { bubbleLabel, charactersLeft, deliveryText } from './wording';

type Text_ = Extract<ChatItem, { kind: 'text' }>;
type System = Extract<ChatItem, { kind: 'system' }>;

/** A message: sender, their stand/spot/area or On the move, time, and delivery for ours. */
export function MessageBubble({ item }: { item: Text_ }) {
  const styles = useStyles();
  const time = formatClockTime(new Date(item.at));
  const delivery = deliveryText(item);
  return (
    <View
      accessible
      accessibilityLabel={bubbleLabel(item, time)}
      style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}
    >
      <Text style={styles.meta}>
        {item.mine ? 'You' : item.fromName}
        {item.place ? ` · ${placeLabel(item.place)}` : ''} · {time}
      </Text>
      <Text style={styles.body}>{item.text}</Text>
      {delivery ? (
        <Text style={[styles.meta, item.sendState === 'failed' && styles.problem]}>{delivery}</Text>
      ) : null}
    </View>
  );
}

/** Check-ins, help requests and shared harvests in the stream. */
export function SystemCard({ item }: { item: System }) {
  const styles = useStyles();
  const time = formatClockTime(new Date(item.at));
  return (
    <View
      accessible
      accessibilityLabel={`${item.text}, ${time}`}
      style={[styles.card, item.event === 'help' && styles.helpCard]}
    >
      <Text style={[styles.cardText, item.event === 'help' && styles.helpText]}>{item.text}</Text>
      <Text style={[styles.meta, item.event === 'help' && styles.helpText]}>{time}</Text>
    </View>
  );
}

/** The spec's quick replies, one tap to send. */
export function QuickReplies({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <OptionButtons
      options={Object.values(QUICK_REPLIES)}
      onPress={onSend}
      accessibilityLabelFor={(reply) => `Send: ${reply}`}
      disabled={disabled}
    />
  );
}

type ComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
};

/** Text field with the live 200-character counter. */
export function Composer({ value, onChange, onSend, disabled }: ComposerProps) {
  const styles = useStyles();
  const counter = charactersLeft(value);
  const nearLimit = counter.left <= 20;
  return (
    <View style={styles.composer}>
      <Field
        label="Message"
        hideLabel
        placeholder="Message"
        value={value}
        onChangeText={onChange}
        multiline
        maxLength={MAX_TEXT_CHARS + 20}
      />
      <View style={styles.composerRow}>
        <Text
          accessibilityLiveRegion={nearLimit ? 'polite' : 'none'}
          style={[styles.meta, counter.over && styles.problem]}
        >
          {counter.text}
        </Text>
        <Button
          variant="primary"
          icon={Send}
          label="Send"
          onPress={onSend}
          disabled={disabled || counter.over || !value.trim()}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  bubble: {
    maxWidth: '86%',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    gap: spacing.xs,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: theme.colors.surface2 },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface1,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  meta: { ...textStyles.body, color: theme.colors.textSecondary },
  body: { ...textStyles.bodyLarge, color: theme.colors.text },
  problem: { color: theme.colors.warning },
  card: {
    alignSelf: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.surface1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  // Ask for a Hand in the stream: gold on the warning tint, never red, never an emergency.
  helpCard: { borderColor: theme.colors.warning, backgroundColor: theme.colors.warningTint },
  cardText: { ...textStyles.label, color: theme.colors.text, textAlign: 'center' },
  helpText: { color: theme.colors.warning },
  composer: { gap: spacing.sm },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
}));
