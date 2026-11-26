import { MAX_TEXT_CHARS } from '@huntclub/mesh';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { OptionButtons } from '../components/OptionButtons';
import { TextField } from '../components/TextField';
import { formatClockTime } from '../conditions/clock';
import { QUICK_REPLIES } from '../domain/quickReplies';
import { placeLabel } from '../map/labels';
import { colors, radii, spacing, textStyles } from '../theme';
import type { ChatItem } from './model';
import { bubbleLabel, charactersLeft, deliveryText } from './wording';

type Text_ = Extract<ChatItem, { kind: 'text' }>;
type System = Extract<ChatItem, { kind: 'system' }>;

/** A message: sender, their stand/spot/area or On the move, time, and delivery for ours. */
export function MessageBubble({ item }: { item: Text_ }) {
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
  const time = formatClockTime(new Date(item.at));
  return (
    <View
      accessible
      accessibilityLabel={`${item.text}, ${time}`}
      style={[styles.card, item.event === 'help' && styles.helpCard]}
    >
      <Text style={[styles.cardText, item.event === 'help' && styles.helpText]}>{item.text}</Text>
      <Text style={styles.meta}>{time}</Text>
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
  const counter = charactersLeft(value);
  const nearLimit = counter.left <= 20;
  return (
    <View style={styles.composer}>
      <TextField
        placeholder="Message"
        value={value}
        onChangeText={onChange}
        multiline
        maxLength={MAX_TEXT_CHARS + 20}
        style={styles.field}
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
          label="Send"
          onPress={onSend}
          disabled={disabled || counter.over || !value.trim()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '86%',
    borderRadius: radii.primaryButton,
    padding: spacing.sm + spacing.xs,
    gap: spacing.xs,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.surfaceRaised },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meta: { ...textStyles.body, color: colors.textSecondary },
  body: { ...textStyles.bodyLarge, color: colors.text },
  problem: { color: colors.help },
  card: {
    alignSelf: 'center',
    borderRadius: radii.primaryButton,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  helpCard: { borderColor: colors.help },
  cardText: { ...textStyles.label, color: colors.text, textAlign: 'center' },
  helpText: { color: colors.help },
  composer: { gap: spacing.sm },
  field: { paddingVertical: spacing.sm },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
