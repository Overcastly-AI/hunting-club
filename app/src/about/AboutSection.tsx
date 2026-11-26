import { LEGAL_DOCS, type LegalDocId } from '@huntclub/shared';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '../components/Button';
import { makeStyles, spacing, textStyles } from '../theme';
import { legalRoute } from './routes';

const DOCS = Object.keys(LEGAL_DOCS) as LegalDocId[];

/** Settings → About: Privacy and Terms, readable offline. */
export function AboutSection() {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        About
      </Text>
      {DOCS.map((id) => (
        <Button key={id} label={LEGAL_DOCS[id].title} onPress={() => router.push(legalRoute(id))} />
      ))}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  section: { gap: spacing.sm },
  heading: { ...textStyles.label, color: theme.colors.text },
}));
