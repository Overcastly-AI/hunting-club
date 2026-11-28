// The map's one top pill (docs/DESIGN.md "Map chrome" 2), 48 px tall and about 200 wide: on the
// web only the next time ("2 h 14 min until sunset", or when the overdue alert goes out), since
// the app bar or the sidebar already names the club. Where the conditions are not beside the
// map (phones, tablets), the pill is a button whose tap drops a card with them; on a desktop
// they are in the panel, so the pill is plain text. While editing it becomes one line naming
// what is being edited, with Done and Cancel (EditPill).
import { ICON_SIZE } from '@huntclub/design';
import type { Wording } from '@huntclub/shared';
import { ChevronDown, X, type LucideIcon } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Spoken } from '../components/ConditionsStrip';
import { Button } from '../components/ui';
import { cx } from '../components/ui/cx';
import { useDismiss } from '../components/ui/useDismiss';

/** The pill's button name, before the time it shows. */
export const PILL_LABEL = 'Today at the property';

export function MapPill(props: {
  next: Wording;
  /** The next time's icon: sunset, or the overdue alarm. */
  icon: LucideIcon;
  /** The card a tap drops (null: no card and no button, the conditions are beside the map). */
  card: ReactNode | null;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  const onKeyDown = useDismiss(open, () => setOpen(false), root, toggle);
  const time = (
    <>
      <props.icon size={ICON_SIZE.sm} aria-hidden className="map-pill__icon" />
      <span className="map-pill__next text-readout-inline">
        <Spoken wording={props.next} />
      </span>
    </>
  );
  if (props.card === null)
    return <p className="map-pill map-pill--static map-pill__face map-fade">{time}</p>;
  return (
    <div
      ref={root}
      className={cx('map-pill', 'map-fade', open && 'map-pill--open')}
      onKeyDown={onKeyDown}
    >
      <button
        ref={toggle}
        type="button"
        className="map-pill__face map-pill__toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="visually-hidden">{PILL_LABEL}, </span>
        {time}
        <ChevronDown size={ICON_SIZE.sm} aria-hidden className="map-pill__chevron" />
      </button>
      <div id={id} className="map-pill__card" hidden={!open}>
        {open ? props.card : null}
      </div>
    </div>
  );
}

/** The pill while editing: what is being edited, Done (saves) and Cancel. */
export function EditPill(props: {
  label: string;
  onDone: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className="map-pill map-pill--edit map-fade" role="group" aria-label={props.label}>
      <p className="map-pill__edit-label">{props.label}</p>
      <Button variant="primary" size="sm" loading={props.busy ?? false} onClick={props.onDone}>
        Done
      </Button>
      <Button
        size="sm"
        iconOnly
        label="Cancel"
        icon={X}
        onClick={props.onCancel}
        disabled={props.busy}
      />
    </div>
  );
}
