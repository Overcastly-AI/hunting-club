import { THEME_PREFERENCES, type ThemePreference } from '@huntclub/design';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { applyThemePreference, readThemePreference } from '../../theme/preference';
import { Segmented, type ChoiceOption } from './Choice';

// TODO(P5a merge): import THEME_PREFERENCE_LABELS from @huntclub/design (being added next to
// THEME_PREFERENCES by the app's theme work) and delete this stand-in of the same name.
const THEME_PREFERENCE_LABELS: Record<ThemePreference, string> = {
  system: 'System',
  dark: 'Dark',
  light: 'Light',
};

const ICONS: Record<ThemePreference, LucideIcon> = { system: Monitor, dark: Moon, light: Sun };

const OPTIONS: readonly ChoiceOption<ThemePreference>[] = THEME_PREFERENCES.map((value) => ({
  value,
  label: THEME_PREFERENCE_LABELS[value],
  icon: ICONS[value],
}));

/** Theme: System / Dark / Light. Applies at once and is kept in this browser. */
export function ThemeToggle(props: { hideLegend?: boolean }) {
  const [preference, setPreference] = useState(readThemePreference);
  return (
    <Segmented
      legend="Theme"
      hideLegend={props.hideLegend}
      options={OPTIONS}
      value={preference}
      onChange={(next) => {
        applyThemePreference(next);
        setPreference(next);
      }}
    />
  );
}
