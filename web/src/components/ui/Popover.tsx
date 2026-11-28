import { useId, useRef, useState, type ReactNode } from 'react';
import { cx } from './cx';
import { Tooltip } from './Tooltip';
import { useDismiss } from './useDismiss';

export type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'right-end';

/**
 * A button that shows and hides a floating panel under it (a disclosure; the account menu,
 * the club switcher). Not Radix DropdownMenu: its modal mode injects a <style> element the
 * CSP blocks, and a panel holding a radio group (Theme) and links is not an ARIA menu.
 * The panel follows the button in the DOM, so Tab walks into it; Esc closes it and puts focus
 * back on the button; a click or focus outside closes it.
 */
export function Popover(props: {
  /** The button's contents (its accessible name comes from them). */
  trigger: ReactNode;
  /** The panel's contents; `close` hides the panel (e.g. after a link is followed). */
  children: (close: () => void) => ReactNode;
  /** Names the panel for screen readers. */
  label: string;
  /** An icon-only trigger's name: its aria-label, also shown as a tooltip. */
  tooltip?: string;
  placement?: PopoverPlacement;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => setOpen(false);

  const onKeyDown = useDismiss(open, close, root, button);

  return (
    <div ref={root} className={cx('ui-popover', props.className)} onKeyDown={onKeyDown}>
      {(() => {
        const trigger = (
          <button
            ref={button}
            type="button"
            className={cx('ui-popover__trigger', props.triggerClassName)}
            aria-label={props.tooltip}
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
          >
            {props.trigger}
          </button>
        );
        return props.tooltip ? <Tooltip content={props.tooltip}>{trigger}</Tooltip> : trigger;
      })()}
      <div
        id={id}
        role="group"
        aria-label={props.label}
        hidden={!open}
        className={cx(
          'ui-popover__panel',
          `ui-popover__panel--${props.placement ?? 'bottom-start'}`,
          props.panelClassName,
        )}
      >
        {open ? props.children(close) : null}
      </div>
    </div>
  );
}
