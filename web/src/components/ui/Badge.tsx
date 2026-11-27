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
import { ICON_SIZE, type StatusTone } from '@huntclub/design';
import { MEMBER_ROLE_LABELS, SUBSCRIPTION_STATUS_LABELS } from '@huntclub/shared';

/** Each tone's icon when the caller gives none: status is never colour alone. */
export const TONE_ICONS: Record<StatusTone, LucideIcon> = {
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
  info: Info,
  neutral: CircleDot,
};

/** Icon and word on the tone's tint (each pair is in the contrast test). */
export function Badge(props: { tone: StatusTone; icon?: LucideIcon; children: ReactNode }) {
  const Icon = props.icon ?? TONE_ICONS[props.tone];
  return (
    <span className={`ui-badge ui-badge--${props.tone}`}>
      <Icon size={ICON_SIZE.sm} aria-hidden />
      {props.children}
    </span>
  );
}

/**
 * The statuses the admin shows (docs/UI_REDESIGN.md section 6), each with its tone, icon and word.
 * Roles and subscription statuses use the shared words, so a pill and a table cell never differ.
 */
export const STATUSES = {
  active: { tone: 'success', icon: CircleCheck, label: SUBSCRIPTION_STATUS_LABELS.active },
  trial: { tone: 'warning', icon: Clock, label: SUBSCRIPTION_STATUS_LABELS.trialing },
  ending: { tone: 'warning', icon: Clock, label: 'Ending' },
  pastDue: { tone: 'danger', icon: CircleAlert, label: SUBSCRIPTION_STATUS_LABELS.past_due },
  admin: { tone: 'info', icon: ShieldCheck, label: MEMBER_ROLE_LABELS.admin },
  new: { tone: 'info', icon: Sparkles, label: 'New' },
  member: { tone: 'neutral', icon: User, label: MEMBER_ROLE_LABELS.member },
  inactive: { tone: 'neutral', icon: CircleMinus, label: 'Inactive' },
} as const satisfies Record<string, { tone: StatusTone; icon: LucideIcon; label: string }>;
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
