import { LEGAL_DRAFT_NOTICE, type LegalDoc } from '@huntclub/shared';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors, radii, spacing, textStyles } from '../theme';

type Props = { doc: LegalDoc; onDone: () => void };

/**
 * Privacy or Terms, from the shared copy (@huntclub/shared legal): the same words as the
 * web page. Bundled in the app, so it opens with no signal.
 */
export function LegalScreen({ doc, onDone }: Props) {
  return (
    <Screen title={doc.title} description={doc.intro}>
      <Text accessibilityRole="text" style={styles.draft}>
        {LEGAL_DRAFT_NOTICE}
      </Text>
      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            {section.heading}
          </Text>
          {section.paragraphs.map((text) => (
            <Text key={text} style={styles.body}>
              {text}
            </Text>
          ))}
        </View>
      ))}
      <Button label="Back" onPress={onDone} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  draft: {
    ...textStyles.label,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: radii.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  section: { gap: spacing.sm },
  heading: { ...textStyles.label, color: colors.text },
  body: { ...textStyles.body, color: colors.textSecondary },
});
