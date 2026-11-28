// Placing and editing a stand on the web (club admins only; the club API checks that too). A new
// stand goes where the map is tapped, or at the cross in the middle of the map (Put at the cross,
// for the keyboard); a tap moves it, a drag moves it, and with the marker focused the arrow keys
// move it. The plate names it,
// sets its type (STAND_TYPE_LABELS) and saves it, or deletes it after a confirm step. Whether it
// may be saved is the shared stand schema (StandCreateSchema), never a copy of it.
import { radii, sizes } from '@huntclub/design';
import {
  STAND_TYPE_LABELS,
  STAND_TYPES,
  StandCreateSchema,
  type Stand,
  type StandCreate,
  type StandType,
} from '@huntclub/shared';
import { Crosshair } from 'lucide-react';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { standIcon } from '../components/standIcons';
import { Button, Field, Input, Select, useToast } from '../components/ui';
import { mapPoint, TAP_SLOP, type MapFrame } from './ClubMap';
import { DeleteConfirm } from './DeleteConfirm';
import { InSlot, useEditSlots } from './editSlots';
import { EditPill } from './MapPill';
import { Cross, KEY_MOVE_PX, saveError, savedToast } from './PropertyLineEditor';

/** The stand as it is being edited: an existing one (with its id) or a new one. */
export interface StandDraft {
  id?: string;
  name: string;
  type: StandType;
  /** Where it is; a new stand has no place until the map is tapped. */
  lat?: number;
  lon?: number;
}

/** A new stand, not placed yet: a tree stand, the commonest kind, until the admin says otherwise. */
export const newStand = (): StandDraft => ({ name: '', type: 'tree_stand' });

/** An existing stand, to edit. */
export const standDraft = (stand: Stand): StandDraft => ({
  id: stand.id,
  name: stand.name,
  type: stand.type,
  lat: stand.lat,
  lon: stand.lon,
});

/** The words for a stand the shared schema refuses, by field. */
export const STAND_PROBLEMS = {
  name: 'Enter the stand name, up to 60 characters.',
  place: 'Click the map where the stand is, or use Put at the cross.',
} as const;

/** What the shared stand schema makes of the draft: the stand to send, or what to fix. */
export function checkStand(draft: StandDraft): StandCreate | string {
  if (draft.lat === undefined || draft.lon === undefined) return STAND_PROBLEMS.place;
  const result = StandCreateSchema.safeParse({
    name: draft.name,
    type: draft.type,
    lat: draft.lat,
    lon: draft.lon,
  });
  if (result.success) return result.data;
  return result.error.issues.some((i) => i.path[0] === 'name')
    ? STAND_PROBLEMS.name
    : STAND_PROBLEMS.place;
}

const HIT = sizes.minTapTarget;
const BOX = sizes.standMarker;
const ICON = sizes.icon;

/** The stand being placed, over the map: a 48 px button to drag or move with the arrow keys. */
export function StandMarkerLayer(props: {
  frame: MapFrame;
  draft: StandDraft;
  onMove: (to: [number, number]) => void;
}) {
  const { frame, draft } = props;
  const { projection, width, height } = frame;
  const placed = draft.lat !== undefined && draft.lon !== undefined;
  const [x, y] = placed ? projection.project(draft.lon!, draft.lat!) : frame.cross;
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const Icon = standIcon(draft.type);
  const onPointerDown = (e: PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < TAP_SLOP) return;
    d.moved = true;
    props.onMove(projection.unproject(...mapPoint(frame.box(), e)));
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? KEY_MOVE_PX * 10 : KEY_MOVE_PX;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const by = moves[e.key];
    if (!by) return;
    e.preventDefault();
    props.onMove(projection.unproject(x + by[0], y + by[1]));
  };
  return (
    <svg
      className="plan__svg plan__draw"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label="Stand being placed"
    >
      {placed ? null : <Cross at={frame.cross} />}
      {!placed ? null : (
        <g
          transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
          className="draw__corner draw__stand plan__stand--selected"
          role="button"
          tabIndex={0}
          aria-label={`${draft.name.trim() || 'New stand'}: drag it, or use the arrow keys, to move it`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={onKeyDown}
        >
          <rect
            className="draw__hit"
            x={-HIT / 2}
            y={-HIT / 2}
            width={HIT}
            height={HIT}
            rx={radii.md}
          />
          <rect
            className="plan__stand-box"
            x={-BOX / 2}
            y={-BOX / 2}
            width={BOX}
            height={BOX}
            rx={radii.standMarker}
          />
          <Icon x={-ICON / 2} y={-ICON / 2} size={ICON} className="plan__stand-icon" />
        </g>
      )}
    </svg>
  );
}

const TYPE_OPTIONS = STAND_TYPES.map((type) => ({ value: type, label: STAND_TYPE_LABELS[type] }));

/**
 * The stand editor's chrome, in the page's edit slots (editSlots.tsx): the pill with Done
 * (saves) and Cancel; the draw bar with what to do next and Put at the cross; the sheet or panel
 * with the name and type, and for a placed stand, Delete stand.
 */
export function StandFields(props: {
  draft: StandDraft;
  onChange: (draft: StandDraft) => void;
  /** Puts the stand at the cross in the middle of the open map. */
  onPlaceAtCross: () => void;
  onSave: (stand: StandCreate) => Promise<void>;
  onDelete?: (() => Promise<void>) | undefined;
  onCancel: () => void;
}) {
  const { draft } = props;
  const slots = useEditSlots();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const failed = (e: unknown) => {
    setError(saveError(e, 'stand'));
    slots.reveal();
  };
  const save = async () => {
    // The shared schema first: a stand it refuses is never sent.
    const checked = checkStand(draft);
    const named = checked !== STAND_PROBLEMS.name;
    setNameError(named ? null : STAND_PROBLEMS.name);
    if (typeof checked === 'string') {
      setError(named ? checked : null);
      slots.reveal();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await props.onSave(checked);
      toast(savedToast('stand'));
    } catch (e) {
      failed(e);
      setBusy(false);
    }
  };
  const placed = draft.lat !== undefined;
  return (
    <>
      <InSlot slot="pill">
        <EditPill
          label={draft.id ? 'Moving the stand' : 'Placing a stand'}
          onDone={() => void save()}
          onCancel={props.onCancel}
          busy={busy}
        />
      </InSlot>
      <InSlot slot="bar">
        <div className="draw-bar" role="group" aria-label="Placing the stand">
          <p className="draw__count">{placed ? 'Drag it to move it' : 'Tap the map where it is'}</p>
          {/* Put at the cross is how a keyboard places a new stand; a placed one moves with the arrows. */}
          {placed ? null : (
            <Button
              size="sm"
              iconOnly
              label="Put at the cross"
              icon={Crosshair}
              onClick={props.onPlaceAtCross}
            />
          )}
        </div>
      </InSlot>
      <InSlot slot="body">
        <div className="draw draw--stand">
          <p className="draw__how">
            {placed
              ? 'Click the map to move the stand there, or drag it. With the stand selected, the arrow keys move it.'
              : 'Click the map where the stand is, or move the map and use Put at the cross.'}
          </p>
          <div className="draw__fields">
            <Field label="Stand name" error={nameError}>
              <Input
                maxLength={60}
                value={draft.name}
                onChange={(e) => props.onChange({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <Select
                options={TYPE_OPTIONS}
                value={draft.type}
                onChange={(e) => props.onChange({ ...draft, type: e.target.value as StandType })}
              />
            </Field>
          </div>
          {props.onDelete ? (
            <div className="draw__actions">
              <DeleteConfirm
                noun="stand"
                name={draft.name}
                onDelete={props.onDelete}
                onError={failed}
                disabled={busy}
              />
            </div>
          ) : null}
          {error ? (
            <p className="draw__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </InSlot>
    </>
  );
}
