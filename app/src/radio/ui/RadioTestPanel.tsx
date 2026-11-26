import { MAX_TEXT_CHARS } from '@huntclub/mesh';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors, radii, sizes, spacing, textStyles } from '../../theme';
import { radioCopy } from '../copy';
import type { RadioText } from '../RadioController';
import { useRadio } from '../RadioProvider';

/**
 * Temporary Milestone 2 acceptance test, shown on the Pair your radio screen
 * once a radio is paired: text on the radio's primary channel with delivery
 * status, so two phones can text with no cell service. Remove once the Chat
 * tab is wired to RadioProvider.
 */
export function RadioTestPanel() {
  const { link, texts, sendText } = useRadio();
  const [draft, setDraft] = useState('');
  const ready = link === 'ready';
  const trimmed = draft.trim();

  const send = () => {
    if (!ready || trimmed.length === 0) return;
    sendText(trimmed);
    setDraft('');
  };

  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.title}>
        {radioCopy.test.title}
      </Text>
      <Text style={styles.hint}>{radioCopy.test.hint}</Text>

      <View style={styles.messages} accessibilityRole="list">
        {texts.map((t) => (
          <TextBubble key={t.key} text={t} />
        ))}
      </View>

      <TextField
        value={draft}
        onChangeText={setDraft}
        maxLength={MAX_TEXT_CHARS}
        placeholder={radioCopy.test.placeholder}
        editable={ready}
        multiline
        style={styles.input}
      />
      <Text style={styles.hint}>{radioCopy.test.remaining(MAX_TEXT_CHARS - draft.length)}</Text>
      <Button
        variant="primary"
        label={radioCopy.test.send}
        disabled={!ready || trimmed.length === 0}
        onPress={send}
      />
    </View>
  );
}

function TextBubble({ text }: { text: RadioText }) {
  const sender = text.mine ? radioCopy.test.you : text.fromName;
  const time = new Date(text.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <View style={[styles.bubble, text.mine && styles.mine]}>
      <Text style={styles.sender}>
        {sender} · {time}
      </Text>
      <Text style={styles.body}>{text.text}</Text>
      {text.status ? <Text style={styles.hint}>{radioCopy.test.status[text.status]}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  title: { ...textStyles.label, color: colors.text },
  hint: { ...textStyles.body, color: colors.textSecondary },
  messages: { gap: spacing.sm },
  bubble: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceRaised,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  mine: { alignSelf: 'flex-end' },
  sender: { ...textStyles.label, color: colors.textSecondary },
  body: { ...textStyles.bodyLarge, color: colors.text },
  /** Room for a two-line message; the rest comes from TextField. */
  input: { minHeight: sizes.primaryButtonMinHeight, paddingVertical: spacing.md },
});
