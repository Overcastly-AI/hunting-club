// The map's one top pill (docs/DESIGN.md "Map chrome" 2): the club's name and the next time
// ("2 h 14 min until sunset"), 48 px tall and at most 300 wide. Where the conditions are not
// beside the map (phones, tablets), a tap drops a card with them. While editing it becomes one
// line naming what is being edited, with Done and Cancel (EditPill).
import { ICON_SIZE } from '@huntclub/design';
import type { Wording } from '@huntclub/shared';
import { ChevronDown, X, type LucideIcon } from 'lucide-react';
import { useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { Spoken } from '../components/ConditionsStrip';
import { Button } from '../components/ui';
import { cx } from '../components/ui/cx';
import { useDismiss } from '../components/ui/useDismiss';

export function MapPill(props: {
  /** The page's heading: the club's name. */
  name: string;
  headingId: string;
  headingRef?: Ref<HTMLHeadingElement>;
  next: Wording;
  /** The next time's icon: sunset, or the overdue alarm. */
  icon: LucideIcon;
  /** The card a tap drops (null: no card, the conditions are elsewhere on the page). */
  card: ReactNode | null;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  const onKeyDown = useDismiss(open, () => setOpen(false), root, toggle);
  const card = open ? props.card : null;
  return (
    <div
      ref={root}
      className={cx(
        'map-pill',
        'map-fade',
        props.card === null && 'map-pill--static',
        card !== null && 'map-pill--open',
      )}
      onKeyDown={onKeyDown}
    >
      <div className="map-pill__face">
        <h1 id={props.headingId} className="map-pill__name" tabIndex={-1} ref={props.headingRef}>
          {props.name}
        </h1>
        <p className="map-pill__next text-readout-inline">
          <props.icon size={ICON_SIZE.sm} aria-hidden />
          <span>
            <Spoken wording={props.next} />
          </span>
        </p>
        {props.card === null ? null : (
          <button
            ref={toggle}
            type="button"
            className="map-pill__toggle"
            aria-label="Today at the property"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronDown size={ICON_SIZE.sm} aria-hidden className="map-pill__chevron" />
          </button>
        )}
      </div>
      <div id={id} className="map-pill__card" hidden={card === null}>
        {card}
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
