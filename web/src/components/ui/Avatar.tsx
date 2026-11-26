import { suggestInitials } from '@huntclub/shared';
import { cx } from './cx';
import type { AvatarSize } from './sizes';

/** A name, or an email's local part with its dots and dashes read as spaces. */
const nameOf = (nameOrEmail: string) => nameOrEmail.split('@')[0]!.replace(/[._+-]+/g, ' ');

/**
 * Initials in a circle. Decorative by default (the name is written beside it); give it a
 * `label` when it stands alone. `you` draws it in the accent: orange is for you.
 */
export function Avatar(props: { name: string; size?: AvatarSize; you?: boolean; label?: string }) {
  const initials = suggestInitials(nameOf(props.name)) || '?';
  return (
    <span
      className={cx('ui-avatar', `ui-avatar--${props.size ?? 'md'}`, props.you && 'ui-avatar--you')}
      {...(props.label ? { role: 'img', 'aria-label': props.label } : { 'aria-hidden': true })}
    >
      {initials}
    </span>
  );
}
