import { LEGAL_DRAFT_NOTICE, type LegalDoc } from '@huntclub/shared';
import { ArrowLeft, FilePen } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { makeStyles, spacing, textStyles } from '../theme';

type Props = { doc: LegalDoc; onDone: () => void };

/**
 * Privacy or Terms, from the shared copy (@huntclub/shared legal): the same words as the
 * web page. Bundled in the app, so it opens with no signal.
 */
export function LegalScreen({ doc, onDone }: Props) {
  const styles = useStyles();
  return (
    <Screen title={doc.title} description={doc.intro}>
      <Badge tone="warning" icon={FilePen} label={LEGAL_DRAFT_NOTICE} />
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
      <Button icon={ArrowLeft} label="Back" onPress={onDone} />
    </Screen>
  );
}

const useStyles = makeStyles((theme) => ({
  section: { gap: spacing.sm, marginTop: spacing.sm },
  heading: { ...textStyles.title3, color: theme.colors.text },
  body: { ...textStyles.body, color: theme.colors.textSecondary },
}));
