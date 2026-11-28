import { Map as MapIcon, MessageSquare, Users, type LucideIcon } from 'lucide-react-native';

/** One bottom tab: its route under src/app/(tabs), word label, spoken label and icon. */
export type TabSpec = {
  readonly name: string;
  readonly title: string;
  readonly accessibilityLabel: string;
  readonly icon: LucideIcon;
};

/**
 * The bottom tabs in order: Map, Chat and Club. Every tab has an icon above a word label.
 * Check In is not a tab: it opens from the map's sheet (src/app/check-in.tsx).
 */
export const TABS = [
  { name: 'index', title: 'Map', accessibilityLabel: 'Map', icon: MapIcon },
  { name: 'chat', title: 'Chat', accessibilityLabel: 'Chat', icon: MessageSquare },
  { name: 'party', title: 'Club', accessibilityLabel: 'Club', icon: Users },
] as const satisfies readonly TabSpec[];
