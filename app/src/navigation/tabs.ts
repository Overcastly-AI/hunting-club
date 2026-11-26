import {
  CircleCheck,
  Map as MapIcon,
  MessageSquare,
  Users,
  type LucideIcon,
} from 'lucide-react-native';

/** One bottom tab: its route under src/app/(tabs), word label, spoken label and icon. */
export type TabSpec = {
  readonly name: string;
  readonly title: string;
  readonly accessibilityLabel: string;
  readonly icon: LucideIcon;
};

/**
 * The bottom tabs in order. Every tab has an icon above a word label. Check In
 * uses Lucide's CircleCheck (the icon the brief calls CheckCircle; Lucide renamed it).
 */
export const TABS = [
  { name: 'index', title: 'Map', accessibilityLabel: 'Map', icon: MapIcon },
  { name: 'chat', title: 'Chat', accessibilityLabel: 'Chat', icon: MessageSquare },
  { name: 'check-in', title: 'Check In', accessibilityLabel: 'Check In', icon: CircleCheck },
  { name: 'party', title: 'Party/Club', accessibilityLabel: 'Party or Club', icon: Users },
] as const satisfies readonly TabSpec[];
