import { overdueAt } from '@huntclub/core';
import { breakpoints, space } from '@huntclub/design';
import {
  CLUB_PRICING,
  ClubCreateRequestSchema,
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_PROBLEMS,
  DISPLAY_NAME_PURPOSE,
  INITIALS_HINT,
  INITIALS_MAX,
  INITIALS_PROBLEM,
  needsYou,
  pluralize,
  polygonBounds,
  SUBSCRIPTION_STATUS_LABELS,
  SUN,
  sunReadout,
  type Area,
  type BasemapId,
  type Club,
  type Harvest,
  type Invite,
  type MapPack,
  type Member,
  type NeedsYouAction,
  type NeedsYouItem,
  type Stand,
  type Subscription,
} from '@huntclub/shared';
import { CircleCheck, PenLine, Plus, RadioTower } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import type { ClubApi } from '../api/types';
import { ConditionsStrip } from '../components/ConditionsStrip';
import { Loadable } from '../components/Loadable';
import { Page, usePageHeadingFocus } from '../components/Page';
import { isOffline, useAsync } from '../components/useAsync';
import { useElementSize } from '../components/useElementSize';
import { Banner, Button, ButtonLink, EmptyState, Field, Input } from '../components/ui';
import { basemapPack, useBasemap } from '../map/basemap';
import { AreaFields, checkAreaName } from '../map/AreaFields';
import { ClubMap, FIT_PADDING, type MapFrame } from '../map/ClubMap';
import { drawReducer, startDrawing, type DrawAction, type DrawState } from '../map/draw';
import { boundsCentre, DRAW_BAR_HEIGHT, planBounds } from '../map/plan';
import { DRAW_SUBJECTS, DrawControls, DrawLayer, saveError } from '../map/PropertyLineEditor';
import {
  newStand,
  StandFields,
  StandMarkerLayer,
  standDraft,
  type StandDraft,
} from '../map/StandEditor';
import { StandDrawer } from '../map/StandDrawer';
import { cx } from '../components/ui/cx';
import { pageHref, PAGES, type PagePath } from '../shell/routes';
import { useReloadShell } from '../shell/shellClub';
import { useSignedInUser } from '../signedInUser';
import { needsYourName, YourNamePrompt } from './YourName';

/** Your club, or a form to start one. Payment is on the Billing page. */
export function MyClub(props: { api: ClubApi }) {
  const state = useAsync(() => props.api.getClub(), [props.api]);
  const [created, setCreated] = useState(false);
  const reloadShell = useReloadShell();

  return (
    <Loadable state={state} padded skeleton="map">
      {(club) =>
        club ? (
          <ClubView api={props.api} club={club} created={created} />
        ) : (
          <div className="page-pad">
            <Page
              title="My club"
              description="Start a club to share stands, areas and the club radio channel with your members."
            >
              <CreateClub
                api={props.api}
                onCreated={() => {
                  setCreated(true);
                  state.reload();
                  reloadShell(); // the shell names the new club
                }}
              />
            </Page>
          </div>
        )
      }
    </Loadable>
  );
}

/** Everything My club reads about the club; a list that failed to load is undefined. */
interface ClubDetails {
  members?: readonly Member[];
  stands?: readonly Stand[];
  areas?: readonly Area[];
  subscription?: Subscription | null;
  invites?: readonly Invite[];
  mapPacks?: readonly MapPack[];
  /** For a stand's recent harvests (StandDrawer). */
  harvests?: readonly Harvest[];
}

/** One failed list must not blank the page: it reads as "not loaded" (undefined). */
const settle = <T,>(load: Promise<T>) => load.catch(() => undefined);

function useClubDetails(api: ClubApi) {
  return useAsync(
    async (): Promise<ClubDetails> => {
      const [members, stands, areas, subscription, invites, mapPacks, harvests] = await Promise.all(
        [
          settle(api.listMembers()),
          settle(api.listStands()),
          settle(api.listAreas()),
          settle(api.getSubscription()),
          settle(api.listInvites()),
          settle(api.listMapPacks()),
          settle(api.listHarvests()),
        ],
      );
      return { members, stands, areas, subscription, invites, mapPacks, harvests };
    },
    [api],
    { keepLastOn: isOffline },
  );
}

/** Where each kind of to-do is dealt with: a page of the admin, or on this map (null). */
const ACTION_PAGES: Record<NeedsYouAction, PagePath | null> = {
  billing: 'billing',
  roster: 'roster',
  mapPacks: 'maps',
  drawPropertyLine: null,
};

/** "412 acres, 3 stands, 2 areas": what the club holds, from what loaded. */
function clubFacts(club: Club, details: ClubDetails): string {
  return [
    club.acreage === undefined ? null : `${club.acreage.toLocaleString('en-US')} acres`,
    details.stands ? pluralize(details.stands.length, 'stand') : null,
    details.areas ? pluralize(details.areas.length, 'area') : null,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Where the club's plate floats from the map's top edge, in px (pages/styles.ts). */
const PLATE_TOP = space[4];

/** What the web says in place of live positions, which only ever travel over the mesh. */
export const OUT_NOW_EMPTY = {
  title: 'See who is out in the app',
  line: 'Live positions travel only over the club radio mesh, so they show in the app, never on this website.',
} as const;

/** The map with nothing on it yet, for a member (an admin is offered the draw tool instead). */
export const MAP_EMPTY = {
  title: 'Nothing on the map yet',
  line: 'The property line, areas and stands show here once a club admin draws them.',
} as const;

/** The club plate's line for an admin whose club has no property line yet. */
export const NO_LINE = 'No property line yet. Find the property on the map, then draw it.';

/** The live basemap My club opens on: aerial, the picture the design is drawn for. */
const START_BASEMAP: BasemapId = 'aerial';

const lonLatOf = (p: { lon: number; lat: number }): [number, number] => [p.lon, p.lat];

/** What an admin is changing on the map: the property line, an area (new or saved) or a stand. */
type Edit =
  | { kind: 'line'; draw: DrawState }
  | { kind: 'area'; area: Area | null; name: string; draw: DrawState; error: string | null }
  | { kind: 'stand'; stand: Stand | null; draft: StandDraft };

/** Needs you with nothing in it. */
export const NEEDS_YOU_EMPTY = {
  title: 'Nothing needs you',
  line: 'Billing, guest passes, invites and map packs show here when they need you.',
} as const;

/**
 * The club on its map (docs/DESIGN.md, "Admin, My club"): the property line, areas and stands
 * edge to edge over the club's own map pack, with the club's plate and the conditions strip on
 * it, and beside it what needs the admin. Nobody's position is shown: positions only travel
 * over the mesh, so "Out now" says where to see them.
 */
function ClubView(props: { api: ClubApi; club: Club; created: boolean }) {
  // The club as last saved here (a new property line), else as loaded.
  const [saved, setSaved] = useState<Club | null>(null);
  const club = saved ?? props.club;
  const details = useClubDetails(props.api);
  const [now] = useState(() => Date.now());
  const heading = usePageHeadingFocus();
  const plate = useRef<HTMLDivElement>(null);
  const plateSize = useElementSize(plate, { width: 0, height: 0 });
  const loaded: ClubDetails = details.status === 'ready' ? details.value : {};
  const stands = loaded.stands ?? [];
  const areas = loaded.areas ?? [];
  const bounds = planBounds({ boundary: club.boundary, areas, stands });
  const place = bounds ? boundsCentre(bounds) : null;
  const sun = sunReadout(place, now);
  const overdue = place ? overdueAt(now, place, club.overdueGraceMinutes, SUN) : undefined;
  const facts = clubFacts(club, loaded);
  const [live, setLive] = useState<BasemapId>(START_BASEMAP);
  const basemap = useBasemap(basemapPack(loaded.mapPacks, live));
  // The stand whose details are open (tapped on the map).
  const [standId, setStandId] = useState<string | null>(null);
  const stand = stands.find((s) => s.id === standId) ?? null;
  // A name that is only the email's stand-in: ask for the one they go by.
  const user = useSignedInUser();
  const me = loaded.members?.find((m) => m.userId === user?.userId);
  const [nameDone, setNameDone] = useState(false);
  const reloadShell = useReloadShell();
  const askName = !nameDone && needsYourName(me, user?.email);
  // Only club admins change the property line, areas and stands (the club API refuses anyone else too).
  const canDraw = me?.role === 'admin';
  const [edit, setEdit] = useState<Edit | null>(null);
  // The editor's plate, so what is being edited is brought out from under it.
  // It mounts only while editing, so it is measured from when it appears (a ref per element).
  const [editPlateEl, editPlate] = useState<HTMLDivElement | null>(null);
  const editPlateSize = useElementSize(
    useMemo(() => ({ current: editPlateEl }), [editPlateEl]),
    { width: 0, height: 0 },
  );
  const section = useRef<HTMLElement>(null);
  const begin = (next: Edit) => {
    setStandId(null);
    setEdit(next);
    // Opened from the list under the map (on a phone): the editor is on the map, so show it.
    section.current?.scrollIntoView?.({ block: 'start' });
  };
  const startDraw = () => begin({ kind: 'line', draw: startDrawing(club.boundary) });
  const startArea = (area: Area | null) =>
    begin({
      kind: 'area',
      area,
      name: area?.name ?? '',
      draw: startDrawing(area?.boundary),
      error: null,
    });
  const startStand = (s: Stand | null) =>
    begin({ kind: 'stand', stand: s, draft: s ? standDraft(s) : newStand() });
  const dispatch = (action: DrawAction) =>
    setEdit((e) => (e && e.kind !== 'stand' ? { ...e, draw: drawReducer(e.draw, action) } : e));
  /** Saved or deleted: the editor closes and the club's places load again. */
  const done = () => {
    setEdit(null);
    details.reload();
  };
  const title = (
    <div className="clubview__title">
      <h1 id="club-title" className="text-title-2" tabIndex={-1} ref={heading}>
        {club.name}
      </h1>
      {facts ? <p className="clubview__facts">{facts}</p> : null}
    </div>
  );
  // What is being edited is drawn by its editor, not as part of the plan.
  const shownAreas = edit?.kind === 'area' ? areas.filter((a) => a.id !== edit.area?.id) : areas;
  // A saved stand or area is brought into the open map when its editor opens.
  const focusAt: [number, number] | null =
    edit?.kind === 'stand' && edit.stand
      ? [edit.stand.lon, edit.stand.lat]
      : edit?.kind === 'area' && edit.area
        ? lonLatOf(boundsCentre(polygonBounds(edit.area.boundary)))
        : null;
  const focusKey =
    edit?.kind === 'stand' ? edit.stand?.id : edit?.kind === 'area' ? edit.area?.id : undefined;
  const shownStands =
    edit?.kind === 'stand' ? stands.filter((s) => s.id !== edit.stand?.id) : stands;

  const editor = (frame: MapFrame): ReactNode => {
    if (!edit) return null;
    // On a phone the drawing tools are a bar along the map's bottom: the map keeps the screen.
    const bar = frame.width < breakpoints.tablet;
    if (edit.kind === 'stand') {
      const move = (to: [number, number]) =>
        setEdit({ ...edit, draft: { ...edit.draft, lon: to[0], lat: to[1] } });
      return (
        <>
          <StandMarkerLayer frame={frame} draft={edit.draft} onMove={move} />
          <ClubPlate plateRef={editPlate}>
            {title}
            <StandFields
              draft={edit.draft}
              onChange={(draft) => setEdit({ ...edit, draft })}
              onPlaceAtCross={() =>
                move(frame.projection.unproject(frame.width / 2, frame.height / 2))
              }
              onSave={async (fields) => {
                if (edit.stand) await props.api.updateStand(edit.stand.id, fields);
                else await props.api.createStand(fields);
                done();
              }}
              onDelete={
                edit.stand
                  ? async () => {
                      await props.api.deleteStand(edit.stand!.id);
                      done();
                    }
                  : undefined
              }
              onCancel={() => setEdit(null)}
            />
          </ClubPlate>
        </>
      );
    }
    const area = edit.kind === 'area' ? edit : null;
    const controls = (layout: 'plate' | 'bar') => (
      <DrawControls
        frame={frame}
        state={edit.draw}
        dispatch={dispatch}
        layout={layout}
        subject={area ? DRAW_SUBJECTS.area : DRAW_SUBJECTS.line}
        {...(area
          ? {
              validate: () => checkAreaName(area.name),
              fields: (
                <AreaFields
                  name={area.name}
                  onName={(name) => setEdit({ ...area, name })}
                  onDelete={
                    area.area
                      ? async () => {
                          await props.api.deleteArea(area.area!.id);
                          done();
                        }
                      : undefined
                  }
                  onDeleteError={(e) => setEdit({ ...area, error: saveError(e, 'area') })}
                  error={area.error}
                />
              ),
            }
          : {})}
        onSave={async (boundary) => {
          if (!area) {
            setSaved(await props.api.savePropertyLine(boundary));
            setEdit(null);
            return;
          }
          const fields = { name: area.name, boundary };
          if (area.area) await props.api.updateArea(area.area.id, fields);
          else await props.api.createArea(fields);
          done();
        }}
        onCancel={() => setEdit(null)}
      />
    );
    return (
      <>
        <DrawLayer
          frame={frame}
          state={edit.draw}
          dispatch={dispatch}
          label={area ? 'Area corners' : 'Property line corners'}
        />
        <ClubPlate plateRef={editPlate}>
          {title}
          {bar ? null : controls('plate')}
        </ClubPlate>
        {bar ? controls('bar') : null}
      </>
    );
  };

  return (
    <section
      ref={section}
      className={cx('clubview', edit && 'clubview--drawing')}
      aria-labelledby="club-title"
    >
      <ClubMap
        className="clubview__map"
        boundary={edit?.kind === 'line' ? undefined : club.boundary}
        areas={shownAreas}
        stands={shownStands}
        label={`Map of ${club.name}: ${club.boundary ? 'the property line' : 'no property line yet'}, ${pluralize(areas.length, 'area')} and ${pluralize(stands.length, 'stand')}.`}
        basemap={basemap}
        live={live}
        onLiveChange={setLive}
        interactive
        insets={{ top: PLATE_TOP + plateSize.height + FIT_PADDING }}
        focus={
          focusAt && focusKey
            ? {
                key: focusKey,
                at: focusAt,
                top: editPlateSize.height ? PLATE_TOP + editPlateSize.height : 0,
              }
            : null
        }
        empty={details.status === 'ready' && !canDraw ? MAP_EMPTY : null}
        footer={
          edit && edit.kind !== 'stand'
            ? (size) => (size.width < breakpoints.tablet ? DRAW_BAR_HEIGHT : 0)
            : 0
        }
        {...(edit
          ? {
              onMapClick: (at: [number, number]) =>
                edit.kind === 'stand'
                  ? setEdit({ ...edit, draft: { ...edit.draft, lon: at[0], lat: at[1] } })
                  : dispatch({ type: 'add', at }),
              overlay: editor,
            }
          : {
              onStandSelect: (s: { id: string }) => setStandId(s.id),
              selectedStandId: stand?.id ?? null,
              ...(canDraw
                ? {
                    onAreaSelect: (a: { id: string }) =>
                      startArea(areas.find((x) => x.id === a.id) ?? null),
                  }
                : {}),
            })}
      >
        {edit ? null : (
          <ClubPlate plateRef={plate}>
            {title}
            {canDraw ? (
              <div className="clubview__line">
                {club.boundary ? null : <p className="clubview__line-note">{NO_LINE}</p>}
                <Button size="sm" icon={PenLine} onClick={startDraw}>
                  {club.boundary ? 'Edit property line' : 'Draw property line'}
                </Button>
              </div>
            ) : null}
            <ConditionsStrip sun={sun} overdueAt={overdue} />
          </ClubPlate>
        )}
      </ClubMap>
      <StandDrawer
        stand={stand}
        onClose={() => setStandId(null)}
        areas={loaded.areas}
        harvests={loaded.harvests}
        members={loaded.members}
        onEdit={canDraw ? startStand : undefined}
      />
      <div className="clubview__side">
        {props.created ? (
          <Banner tone="success" live title="Club created">
            Start your {CLUB_PRICING.trialDays}-day free trial on{' '}
            <a href={pageHref('billing')}>Billing</a>.
          </Banner>
        ) : null}
        {askName && me ? (
          <YourNamePrompt
            api={props.api}
            me={me}
            onDone={() => {
              setNameDone(true);
              details.reload();
              reloadShell(); // the account menu shows the new name
            }}
          />
        ) : null}
        {canDraw ? (
          <PlacesTools
            areas={areas}
            onEditArea={startArea}
            onAddStand={() => startStand(null)}
            onAddArea={() => startArea(null)}
            editing={edit !== null}
          />
        ) : null}
        <OutNow />
        <Loadable state={details} skeleton="table">
          {(value) => (
            <>
              <NeedsYou
                items={needsYou({ club, ...value, now })}
                onDraw={canDraw ? startDraw : undefined}
                drawing={edit?.kind === 'line'}
              />
              {overdue === undefined ? null : (
                <p className="clubview__overdue">
                  The overdue alert goes to the club if anyone is still checked in at sunset plus{' '}
                  {pluralize(club.overdueGraceMinutes, 'minute')}.
                </p>
              )}
              <ClubSummary details={value} />
            </>
          )}
        </Loadable>
      </div>
    </section>
  );
}

/** What an admin can change on the map besides the property line: stands and areas. */
export const PLACES_HINT = 'To change a stand, tap it on the map. Areas are listed here.';

/** Admins: add a stand or an area; change an area from the list (stands open from the map). */
function PlacesTools(props: {
  areas: readonly Area[];
  onAddStand: () => void;
  onAddArea: () => void;
  onEditArea: (area: Area) => void;
  editing: boolean;
}) {
  return (
    <section className="side-section" aria-labelledby="places-tools">
      <h2 id="places-tools" className="side-section__title">
        Stands and areas
      </h2>
      <div className="side-section__tools">
        <p className="side-section__hint">{PLACES_HINT}</p>
        <div className="form-plate__actions">
          <Button size="sm" icon={Plus} onClick={props.onAddStand} disabled={props.editing}>
            Add stand
          </Button>
          <Button size="sm" icon={Plus} onClick={props.onAddArea} disabled={props.editing}>
            Add area
          </Button>
        </div>
      </div>
      {props.areas.length ? (
        <ul className="rows" aria-label="Areas">
          {props.areas.map((area) => (
            <li key={area.id} className="row-item">
              <div className="row-item__text">
                <p className="row-item__title">{area.name}</p>
              </div>
              <Button
                size="sm"
                icon={PenLine}
                aria-label={`Edit ${area.name}`}
                onClick={() => props.onEditArea(area)}
                disabled={props.editing}
              >
                Edit
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Who is out now: never known here (positions travel only over the mesh, and the web never
 * receives one), so it says where to look instead of showing a blank or made-up list.
 */
function OutNow() {
  return (
    <section className="side-section" aria-labelledby="out-now">
      <h2 id="out-now" className="side-section__title">
        Out now
      </h2>
      <div className="side-section__empty-state">
        <EmptyState icon={RadioTower} title={OUT_NOW_EMPTY.title} titleAs="h3">
          {OUT_NOW_EMPTY.line}
        </EmptyState>
      </div>
    </section>
  );
}

/** The club's plate on the map: its name, then the conditions strip or the draw tool. */
function ClubPlate(props: { children: ReactNode; plateRef?: Ref<HTMLDivElement> }) {
  return (
    <div className="clubview__plate" ref={props.plateRef}>
      {props.children}
    </div>
  );
}

/** The admin's to-dos (the shared needsYou rules), each with the way to deal with it. */
function NeedsYou(props: {
  items: readonly NeedsYouItem[];
  onDraw?: (() => void) | undefined;
  drawing?: boolean;
}) {
  return (
    <section className="side-section" aria-labelledby="needs-you">
      <h2 id="needs-you" className="side-section__title">
        Needs you{' '}
        <span className="side-section__count text-readout-inline">{props.items.length}</span>
      </h2>
      {props.items.length === 0 ? (
        <div className="side-section__empty-state">
          <EmptyState icon={CircleCheck} title={NEEDS_YOU_EMPTY.title} titleAs="h3">
            {NEEDS_YOU_EMPTY.line}
          </EmptyState>
        </div>
      ) : (
        <ul className="rows">
          {props.items.map((item) => {
            const page = ACTION_PAGES[item.action];
            const label = page ? PAGES.find((p) => p.path === page)!.label : null;
            const titleId = `needs-${item.id}`;
            return (
              <li key={item.id} className="row-item">
                <div className="row-item__text">
                  <p id={titleId} className="row-item__title">
                    {item.title}
                  </p>
                  {item.detail ? <p className="row-item__detail">{item.detail}</p> : null}
                </div>
                {page && label ? (
                  <ButtonLink size="sm" href={pageHref(page)} aria-describedby={titleId}>
                    {label}
                  </ButtonLink>
                ) : item.action === 'drawPropertyLine' && props.onDraw ? (
                  <Button
                    size="sm"
                    onClick={props.onDraw}
                    disabled={props.drawing}
                    aria-describedby={titleId}
                  >
                    {props.drawing ? 'Drawing' : 'Draw'}
                  </Button>
                ) : (
                  <span className="row-item__where">In the app</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Members, stands, areas and subscription at a glance, each linking to its page. */
function ClubSummary({ details }: { details: ClubDetails }) {
  const rows: { href: string; label: string; value: string }[] = [
    ...(details.members
      ? [{ href: pageHref('roster'), label: 'Members', value: String(details.members.length) }]
      : []),
    ...(details.stands
      ? [{ href: pageHref('stands'), label: 'Stands', value: String(details.stands.length) }]
      : []),
    ...(details.areas
      ? [{ href: pageHref('stands'), label: 'Areas', value: String(details.areas.length) }]
      : []),
    ...(details.subscription !== undefined
      ? [
          {
            href: pageHref('billing'),
            label: 'Subscription',
            value: details.subscription
              ? SUBSCRIPTION_STATUS_LABELS[details.subscription.status]
              : 'Not started',
          },
        ]
      : []),
  ];
  return (
    <section className="side-section" aria-labelledby="club-summary">
      <h2 id="club-summary" className="side-section__title">
        The club
      </h2>
      <ul className="rows" aria-label="Club summary">
        {rows.map((row) => (
          <li key={row.label}>
            <a className="row-link" href={row.href}>
              <span className="row-link__label">{row.label}</span>{' '}
              <span className="row-link__value text-readout-inline">{row.value}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Inline errors, by the request schema's field path (the shared name rules' own words). */
const CREATE_ERRORS = {
  'club.name': 'Enter the club name.',
  'admin.displayName': DISPLAY_NAME_PROBLEMS.empty,
  'admin.initials': INITIALS_PROBLEM,
} as const;
type CreateField = keyof typeof CREATE_ERRORS;

function CreateClub(props: { api: ClubApi; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [initials, setInitials] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<Partial<Record<CreateField, string>>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // The shared request schema is the one rule; the server checks the same.
    const request = ClubCreateRequestSchema.safeParse({
      club: { name: name.trim() },
      admin: { displayName: displayName.trim(), initials: initials.trim().toUpperCase() },
    });
    if (!request.success) {
      const fields: Partial<Record<CreateField, string>> = {};
      for (const issue of request.error.issues) {
        const field = issue.path.join('.') as CreateField;
        if (!(field in CREATE_ERRORS)) continue;
        // The name rule says which part it refuses (blank, too long, a character).
        fields[field] ??= field === 'admin.displayName' ? issue.message : CREATE_ERRORS[field];
      }
      setInvalid(fields);
      return;
    }
    setInvalid({});
    setBusy(true);
    setError(null);
    try {
      await props.api.createClub(request.data);
      props.onCreated();
    } catch (e) {
      setError(
        isOffline(e)
          ? 'No connection. Try again when you are online.'
          : 'Could not create the club. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form-plate" onSubmit={submit} noValidate>
      <Field label="Club name" error={invalid['club.name']}>
        <Input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Your name" hint={DISPLAY_NAME_PURPOSE} error={invalid['admin.displayName']}>
        <Input
          required
          maxLength={DISPLAY_NAME_MAX}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </Field>
      <Field label="Your initials" hint={INITIALS_HINT} error={invalid['admin.initials']}>
        <Input
          required
          maxLength={INITIALS_MAX}
          value={initials}
          onChange={(e) => setInitials(e.target.value)}
        />
      </Field>
      <div className="form-plate__actions">
        <Button variant="primary" type="submit" loading={busy}>
          {busy ? 'Creating club…' : 'Create club'}
        </Button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="form-note">Next, start the free trial on the Billing page.</p>
    </form>
  );
}
