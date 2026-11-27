import { MAX_TEXT_CHARS } from '@huntclub/mesh';
import { formatClockTime } from '@huntclub/shared';
import { Hand, MapPin, Send } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { OptionButtons } from '../components/OptionButtons';
import { QUICK_REPLIES } from '../domain/quickReplies';
import { placeLabel } from '../map/labels';
import {
  ICON_SIZE,
  makeStyles,
  radii,
  sizes,
  spacing,
  tabularNums,
  textStyles,
  useTheme,
} from '../theme';
import type { ChatItem } from './model';
import { bubbleLabel, charactersLeft, deliveryText } from './wording';

type Text_ = Extract<ChatItem, { kind: 'text' }>;
type System = Extract<ChatItem, { kind: 'system' }>;

/**
 * A message plate: who (bold), where they are and the time, then the text. Yours sits on the
 * right in the raised tone with an orange edge (orange's first job is you); how far it got
 * is under it.
 */
export function MessageBubble({ item }: { item: Text_ }) {
  const styles = useStyles();
  const time = formatClockTime(new Date(item.at));
  const delivery = deliveryText(item);
  return (
    <View accessible accessibilityLabel={bubbleLabel(item, time)} style={styles.message}>
      <View style={[styles.plate, item.mine ? styles.mine : styles.theirs]}>
        <View style={styles.meta}>
          <Text style={styles.who}>{item.mine ? 'You' : item.fromName}</Text>
          {item.place ? <Text style={styles.metaText}>{placeLabel(item.place)}</Text> : null}
          <Text style={styles.metaText}>{time}</Text>
        </View>
        <Text style={styles.body}>{item.text}</Text>
      </View>
      {delivery ? (
        <Text style={[styles.delivery, item.sendState === 'failed' && styles.problem]}>
          {delivery}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Check-ins, check-outs and shared harvests: one quiet line with a pin. Ask for a Hand stands
 * out in gold on its wash, never red, never worded like an emergency.
 */
export function SystemCard({ item }: { item: System }) {
  const styles = useStyles();
  const theme = useTheme();
  const time = formatClockTime(new Date(item.at));
  const help = item.event === 'help';
  const Icon = help ? Hand : MapPin;
  return (
    <View
      accessible
      accessibilityLabel={`${item.text}, ${time}`}
      style={[styles.system, help && styles.help]}
    >
      <Icon
        size={ICON_SIZE.sm}
        color={help ? theme.colors.warning : theme.colors.textSecondary}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text style={[styles.systemText, help && styles.helpText]}>
        {item.text}, {time}
      </Text>
    </View>
  );
}

/** The spec's quick replies, one tap to send, two to a row. */
export function QuickReplies({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <OptionButtons
      grid
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
  /** "Message the club", "Message your party", "Message Dale". */
  placeholder: string;
};

/** The text field with its live "11 of 200" counter inside, and Send beside it. */
export function Composer({ value, onChange, onSend, disabled, placeholder }: ComposerProps) {
  const styles = useStyles();
  const counter = charactersLeft(value);
  const nearLimit = counter.left <= 20;
  return (
    <View style={styles.composer}>
      <View style={styles.field}>
        <Field
          label="Message"
          hideLabel
          placeholder={placeholder}
          value={value}
          onChangeText={onChange}
          multiline
          maxLength={MAX_TEXT_CHARS + 20}
          trailing={
            <Text
              accessibilityLiveRegion={nearLimit ? 'polite' : 'none'}
              style={[styles.counter, counter.over && styles.problem]}
            >
              {counter.text}
            </Text>
          }
        />
      </View>
      <Button
        variant="primary"
        icon={Send}
        label="Send"
        onPress={onSend}
        disabled={disabled || counter.over || !value.trim()}
      />
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  message: { gap: spacing.xs },
  plate: {
    maxWidth: '86%',
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm + 1,
    gap: spacing.xs / 2,
  },
  // Theirs: a plate with its corner toward the left; yours: raised, corner toward the right.
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.plate,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: radii.lg,
    borderTopLeftRadius: radii.sm - 2,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.raised,
    borderRightWidth: sizes.mineEdge,
    borderColor: theme.colors.accent,
    borderRadius: radii.lg,
    borderTopRightRadius: radii.sm - 2,
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.sm },
  who: { ...textStyles.markerName, color: theme.colors.text },
  metaText: { ...textStyles.caption, color: theme.colors.textSecondary },
  body: { ...textStyles.bodyLarge, color: theme.colors.text },
  delivery: { ...textStyles.caption, color: theme.colors.textSecondary, alignSelf: 'flex-end' },
  problem: { color: theme.colors.warning },
  system: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  help: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    backgroundColor: theme.colors.warningTint,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.sm,
  },
  systemText: { ...textStyles.caption, color: theme.colors.textSecondary, flexShrink: 1 },
  helpText: { ...textStyles.badge, color: theme.colors.warning },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  field: { flex: 1 },
  counter: { ...textStyles.caption, ...tabularNums, color: theme.colors.textSecondary },
}));
