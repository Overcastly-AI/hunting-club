import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { cx } from './cx';

/** On <html> while any dialog is open: the page behind does not scroll. */
const SCROLL_LOCK = 'ui-scroll-lock';
let openDialogs = 0;

/**
 * A modal dialog on the native <dialog> (Radix Dialog's scroll lock injects a <style>
 * element, which the CSP blocks). showModal() makes the rest of the page inert, so focus
 * stays inside; Esc and a click on the scrim call onClose (an open tooltip takes the first
 * Esc, as the top layer); focus goes back to the control that opened it, even when the
 * dialog is unmounted with its content; the opener may be an SVG control (a map marker). A bottom
 * sheet under 640 px; above it, centred, or a panel down the right edge (`placement="side"`, for
 * details of something picked on the map). Footer: secondary actions first, the main one last.
 */
export function Dialog(props: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** The close button's word (default "Close"). */
  closeLabel?: string;
  /** The <dialog>'s id, for the opener's aria-controls (it stays in the page while closed). */
  id?: string;
  /** Centred (default), or a panel down the right edge from the tablet width up. */
  placement?: 'center' | 'side';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !props.open) return;
    // Focus goes back here on close, also when the page removes the dialog with it (the
    // browser's own return only works for a dialog that is closed and still in the page).
    const active = document.activeElement;
    const opener = active instanceof HTMLElement || active instanceof SVGElement ? active : null;
    dialog.showModal();
    // Start on the dialog itself (its title is read): focusing the close button first would
    // pop its tooltip, and the first Esc would close only that.
    dialog.focus();
    openDialogs += 1;
    document.documentElement.classList.add(SCROLL_LOCK);
    return () => {
      dialog.close();
      openDialogs -= 1;
      if (openDialogs === 0) document.documentElement.classList.remove(SCROLL_LOCK);
      if (opener?.isConnected) opener.focus();
    };
  }, [props.open]);

  return (
    <dialog
      ref={ref}
      id={props.id}
      className={cx('ui-dialog', props.placement === 'side' && 'ui-dialog--side')}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      aria-describedby={props.description ? `${id}-description` : undefined}
      // Esc: the parent decides (it sets open to false), so the dialog never closes behind React's back.
      onCancel={(e) => {
        e.preventDefault();
        props.onClose();
      }}
      // A click on the dialog element itself is a click on the scrim around the content.
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      {props.open ? (
        <>
          <div className="ui-dialog__header">
            <div>
              <h2 id={`${id}-title`} className="ui-dialog__title">
                {props.title}
              </h2>
              {props.description ? (
                <p id={`${id}-description`} className="ui-dialog__description">
                  {props.description}
                </p>
              ) : null}
            </div>
            <Button
              variant="tertiary"
              iconOnly
              icon={X}
              label={props.closeLabel ?? 'Close'}
              onClick={props.onClose}
            />
          </div>
          {props.children ? <div className="ui-dialog__body">{props.children}</div> : null}
          {props.footer ? <div className="ui-dialog__footer">{props.footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}
