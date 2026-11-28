import type { LucideIcon } from 'lucide-react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';
import { cx } from './cx';
import { ICON_SIZE, type ButtonSize } from '@huntclub/design';
import { Tooltip } from './Tooltip';

/**
 * primary: the one main action of a view (accent fill). secondary, tertiary (text only),
 * danger (outline; `danger-filled` only for the confirm step) and link.
 */
export const BUTTON_VARIANTS = [
  'primary',
  'secondary',
  'tertiary',
  'danger',
  'danger-filled',
  'link',
] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

interface ButtonLook {
  variant?: ButtonVariant;
  /** md 52 (default), lg 64 (the one big action: sign in), sm 48 (sheet and table headers). */
  size?: ButtonSize;
  /** Leading icon (Lucide), drawn at 20 px in currentColor. */
  icon?: LucideIcon;
  /** Full width. */
  block?: boolean;
}

/** An icon-only button still has a word: its aria-label, also shown as a tooltip. */
type Content =
  { iconOnly?: false; children: ReactNode } | { iconOnly: true; label: string; children?: never };

function buttonClass(
  look: ButtonLook & { iconOnly?: boolean; busyPad?: boolean; className?: string },
) {
  return cx(
    'ui-button',
    `ui-button--${look.variant ?? 'secondary'}`,
    `ui-button--${look.size ?? 'md'}`,
    look.iconOnly && 'ui-button--icon-only',
    look.busyPad && 'ui-button--busy-pad',
    look.block && 'ui-button--block',
    look.className,
  );
}

const Spinner = () => <span className="ui-spinner" aria-hidden="true" />;

export type ButtonProps = ButtonLook &
  Content &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
    /** Spinner plus the label: aria-busy, clicks ignored, the width holds. */
    loading?: boolean;
    /** While `loading`, these words in place of the label ("Saving…"), so the wait says what it is. */
    loadingLabel?: string;
    ref?: Ref<HTMLButtonElement>;
  };

export function Button(props: ButtonProps) {
  const {
    variant,
    size,
    icon: Icon,
    block,
    loading,
    loadingLabel,
    className,
    onClick,
    type,
    iconOnly,
    children,
    ...rest
  } = props;
  // `label` exists only on the icon-only form.
  const { label, ...native } = rest as typeof rest & { label?: string };
  const lead = loading ? <Spinner /> : Icon ? <Icon size={ICON_SIZE.md} aria-hidden /> : null;
  const button = (
    <button
      {...native}
      type={type ?? 'button'}
      className={buttonClass({
        variant,
        size,
        block,
        iconOnly,
        className,
        busyPad: loading && !Icon && !iconOnly,
      })}
      aria-label={label ?? native['aria-label']}
      aria-busy={loading || undefined}
      aria-disabled={loading || native['aria-disabled'] || undefined}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (loading) e.preventDefault();
        else onClick?.(e);
      }}
    >
      {lead}
      {iconOnly ? null : loading && loadingLabel ? loadingLabel : children}
    </button>
  );
  return label ? <Tooltip content={label}>{button}</Tooltip> : button;
}

/** A link that looks like a button (navigation, not an action). */
export function ButtonLink(
  props: ButtonLook &
    AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode },
) {
  const { variant, size, icon: Icon, block, className, children, ...anchor } = props;
  return (
    <a {...anchor} className={buttonClass({ variant, size, block, className })}>
      {Icon ? <Icon size={ICON_SIZE.md} aria-hidden /> : null}
      {children}
    </a>
  );
}
