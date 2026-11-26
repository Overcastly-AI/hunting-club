import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleMinus,
  Clock,
  Info,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  User,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { ICON } from './sizes';

export const TONES = ['success', 'warning', 'danger', 'info', 'neutral'] as const;
export type Tone = (typeof TONES)[number];

/** Each tone's icon when the caller gives none: status is never colour alone. */
export const TONE_ICONS: Record<Tone, LucideIcon> = {
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
  info: Info,
  neutral: CircleDot,
};

/** Icon and word on the tone's tint (each pair is in the contrast test). */
export function Badge(props: { tone: Tone; icon?: LucideIcon; children: ReactNode }) {
  const Icon = props.icon ?? TONE_ICONS[props.tone];
  return (
    <span className={`ui-badge ui-badge--${props.tone}`}>
      <Icon size={ICON.sm} aria-hidden />
      {props.children}
    </span>
  );
}

/** The statuses the admin shows (docs/UI_REDESIGN.md section 6), each with its tone, icon and word. */
export const STATUSES = {
  active: { tone: 'success', icon: CircleCheck, label: 'Active' },
  trial: { tone: 'warning', icon: Clock, label: 'Trial' },
  ending: { tone: 'warning', icon: Clock, label: 'Ending' },
  pastDue: { tone: 'danger', icon: CircleAlert, label: 'Past due' },
  admin: { tone: 'info', icon: ShieldCheck, label: 'Admin' },
  new: { tone: 'info', icon: Sparkles, label: 'New' },
  member: { tone: 'neutral', icon: User, label: 'Member' },
  inactive: { tone: 'neutral', icon: CircleMinus, label: 'Inactive' },
} as const satisfies Record<string, { tone: Tone; icon: LucideIcon; label: string }>;
export type Status = keyof typeof STATUSES;

/** A Badge for one of the admin's statuses: Active, Trial, Past due, Admin, Member, … */
export function StatusPill(props: { status: Status }) {
  const { tone, icon, label } = STATUSES[props.status];
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}
