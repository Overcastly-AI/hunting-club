import { Text, View } from 'react-native';

import { SegmentedControl } from '../components/SegmentedControl';
import {
  makeStyles,
  spacing,
  textStyles,
  THEME_PREFERENCE_LABELS,
  THEME_PREFERENCES,
  useThemePreference,
} from '../theme';

/** Settings → Theme: follow the phone, or always dark or light. Saved on this phone. */
export function ThemeSection() {
  const styles = useStyles();
  const { preference, setPreference } = useThemePreference();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        Theme
      </Text>
      <SegmentedControl
        segments={THEME_PREFERENCES}
        labels={THEME_PREFERENCE_LABELS}
        selected={preference}
        onSelect={(next) => void setPreference(next)}
      />
      <Text style={styles.detail}>System follows your phone’s light or dark setting.</Text>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  section: { gap: spacing.sm },
  heading: { ...textStyles.label, color: theme.colors.text },
  detail: { ...textStyles.body, color: theme.colors.textSecondary },
}));
