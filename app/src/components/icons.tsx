import type { StandType } from '@huntclub/shared';
import {
  ArrowUp,
  ArrowUpFromLine,
  Layers,
  LocateFixed,
  Navigation2,
  Tent,
  TreePine,
  type LucideIcon,
} from 'lucide-react-native';

import { sizes, useTheme } from '../theme';

/**
 * Icons inside controls and markers, from Lucide (drawn with react-native-svg).
 * Every control that shows one also has a word label, so the icons are hidden
 * from screen readers. Map markers themselves stay custom (they are map symbols).
 */
type IconProps = { color?: string };

const S = sizes.icon;

/** Lucide's draw props shared by every icon here: a fixed size, hidden from screen readers. */
const DRAW = {
  size: S,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

function useIconColor(color: string | undefined): string {
  const theme = useTheme();
  return color ?? theme.colors.text;
}

/** Map layers. */
export function LayersIcon({ color }: IconProps) {
  return <Layers {...DRAW} color={useIconColor(color)} />;
}

/** North-up: a compass needle with a red point. */
export function NorthIcon({ color }: IconProps) {
  const theme = useTheme();
  return <Navigation2 {...DRAW} color={useIconColor(color)} fill={theme.colors.danger} />;
}

/** Center on me. */
export function LocateIcon({ color }: IconProps) {
  return <LocateFixed {...DRAW} color={useIconColor(color)} />;
}

/** Arrow pointing `towardDeg` clockwise from north (up): where the wind blows toward. */
export function WindArrowIcon({ towardDeg, color }: IconProps & { towardDeg: number }) {
  const theme = useTheme();
  return (
    <ArrowUp
      {...DRAW}
      color={color ?? theme.colors.info}
      style={{ transform: [{ rotate: `${towardDeg}deg` }] }}
    />
  );
}

/** One Lucide icon per stand type (the club admin uses the same three). */
export const STAND_TYPE_ICONS = {
  tree_stand: TreePine,
  ladder: ArrowUpFromLine,
  ground_blind: Tent,
} as const satisfies Record<StandType, LucideIcon>;

/** Tree stand: a pine. Ladder: an arrow up from the ground. Ground blind: a tent. */
export function StandTypeIcon({ type, color }: IconProps & { type: StandType }) {
  const Icon = STAND_TYPE_ICONS[type];
  return <Icon {...DRAW} color={useIconColor(color)} />;
}
