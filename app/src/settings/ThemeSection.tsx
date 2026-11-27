import { Text } from 'react-native';

import { Card } from '../components/Card';
import { SegmentedControl } from '../components/SegmentedControl';
import {
  makeStyles,
  textStyles,
  THEME_LABEL,
  THEME_PREFERENCE_LABELS,
  THEME_PREFERENCES,
  useThemePreference,
} from '../theme';

/** Settings → Theme: follow the phone, or always dark or light. Saved on this phone. */
export function ThemeSection() {
  const styles = useStyles();
  const { preference, setPreference } = useThemePreference();
  return (
    <Card title={THEME_LABEL}>
      <SegmentedControl
        segments={THEME_PREFERENCES}
        labels={THEME_PREFERENCE_LABELS}
        selected={preference}
        onSelect={(next) => void setPreference(next)}
      />
      <Text style={styles.detail}>System follows your phone’s light or dark setting.</Text>
    </Card>
  );
}

const useStyles = makeStyles((theme) => ({
  detail: { ...textStyles.body, color: theme.colors.textSecondary },
}));
