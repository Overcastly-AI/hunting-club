import {
  THEME_LABEL,
  THEME_PREFERENCE_LABELS,
  THEME_PREFERENCES,
  type ThemePreference,
} from '@huntclub/design';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { applyThemePreference, readThemePreference } from '../../theme/preference';
import { Segmented, type ChoiceOption } from './Choice';

const ICONS: Record<ThemePreference, LucideIcon> = { system: Monitor, dark: Moon, light: Sun };

const OPTIONS: readonly ChoiceOption<ThemePreference>[] = THEME_PREFERENCES.map((value) => ({
  value,
  label: THEME_PREFERENCE_LABELS[value],
  icon: ICONS[value],
}));

/** Theme: System / Dark / Light. Applies at once and is kept in this browser. */
export function ThemeToggle(props: { hideLegend?: boolean; block?: boolean }) {
  const [preference, setPreference] = useState(readThemePreference);
  return (
    <Segmented
      legend={THEME_LABEL}
      hideLegend={props.hideLegend}
      block={props.block}
      options={OPTIONS}
      value={preference}
      onChange={(next) => {
        applyThemePreference(next);
        setPreference(next);
      }}
    />
  );
}
