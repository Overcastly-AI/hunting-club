import { overdueAt } from '@huntclub/core';
import {
  chromePinned,
  mapChrome,
  radii,
  sizes,
  sheetDetentHeights,
  type SheetDetent,
} from '@huntclub/design';
import {
  CLUB_PRICING,
  clockReadout,
  ClubCreateRequestSchema,
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_PROBLEMS,
  DISPLAY_NAME_PURPOSE,
  INITIALS_HINT,
  INITIALS_MAX,
  INITIALS_PROBLEM,
  needsYou,
  nextTimeReadout,
  OVERDUE_ALERT_LABEL,
  pluralize,
  polygonBounds,
  SUBSCRIPTION_STATUS_LABELS,
  SUN,
  sunReadout,
  type Area,
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
import { DOWNLOAD_PATH } from '@huntclub/shared/app';
import { AlarmClock, ChevronRight, CircleCheck, Plus, Sunset } from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import type { ClubApi } from '../api/types';
import { ConditionsStrip, Spoken } from '../components/ConditionsStrip';
import { Loadable } from '../components/Loadable';
import { Page, usePageHeadingFocus } from '../components/Page';
import { isOffline, useAsync } from '../components/useAsync';
import { useElementSize } from '../components/useElementSize';
import { useMediaQuery } from '../components/useMediaQuery';
import { DESKTOP_QUERY } from '../components/ui/styles/shared';
import { standIcon } from '../components/standIcons';
import { Banner, Button, ButtonLink, EmptyState, Field, Input, Popover } from '../components/ui';
import { useClubBasemap } from '../map/basemap';
import { AreaFields, checkAreaName } from '../map/AreaFields';
import { ClubMap, FIT_PADDING, PropertyLine, type MapFrame } from '../map/ClubMap';
import { drawReducer, startDrawing, type DrawAction, type DrawState } from '../map/draw';
import { EditSlotsContext, type EditSlots } from '../map/editSlots';
import { MapPill } from '../map/MapPill';
import { MapSheet } from '../map/MapSheet';
import { boundsCentre, planBounds } from '../map/plan';
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

/** The bottom of the top pill, from the map's top edge, in px: what the plan fits under. */
const PILL_BOTTOM = mapChrome.inset + mapChrome.pill.height;

/**
 * What the web says in place of live positions, which only ever travel over the mesh: one line,
 * and a link to get the app.
 */
export const OUT_NOW_EMPTY = {
  line: 'Live positions show only in the app.',
  link: 'Get the app',
} as const;

/** The map with nothing on it yet, for a member (an admin is offered the draw tool instead). */
export const MAP_EMPTY = {
  title: 'Nothing on the map yet',
  line: 'The property line, areas and stands show here once a club admin draws them.',
} as const;

/** The Stands and areas line for an admin whose club has no property line yet. */
export const NO_LINE = 'No property line yet. Find the property on the map, then draw it.';

/** The peek's chip: how many to-dos need the admin. */
const needsYouChip = (n: number) => `${n} ${n === 1 ? 'needs' : 'need'} you`;

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
 * The club on its map (docs/DESIGN.md "Map chrome"): the property line, areas and stands edge
 * to edge, with only the top pill, the icon stack and the footer line over it; beside it on a
 * desktop the side panel, and on phones and tablets the same panel as a bottom sheet. Nobody's
 * position is shown: positions only travel over the mesh, so "Out now" says where to see them.
 */
function ClubView(props: { api: ClubApi; club: Club; created: boolean }) {
  // The club as last saved here (a new property line), else as loaded.
  const [saved, setSaved] = useState<Club | null>(null);
  const club = saved ?? props.club;
  const details = useClubDetails(props.api);
  const [now] = useState(() => Date.now());
  const heading = usePageHeadingFocus();
  const wide = useMediaQuery(DESKTOP_QUERY);
  const [detent, setDetent] = useState<SheetDetent>('peek');
  const sectionRef = useRef<HTMLElement>(null);
  const sectionSize = useElementSize(sectionRef, { width: 0, height: 0 });
  const loaded: ClubDetails = details.status === 'ready' ? details.value : {};
  const stands = loaded.stands ?? [];
  const areas = loaded.areas ?? [];
  const bounds = planBounds({ boundary: club.boundary, areas, stands });
  const place = bounds ? boundsCentre(bounds) : null;
  const sun = sunReadout(place, now);
  const overdue = place ? overdueAt(now, place, club.overdueGraceMinutes, SUN) : undefined;
  const facts = clubFacts(club, loaded);
  // The shared club-map picture: the basemap this browser chose last, kept across reloads.
  const { live, setLive, basemap } = useClubBasemap(loaded.mapPacks);
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
  const todo = details.status === 'ready' ? needsYou({ club, ...details.value, now }) : null;
  const needsHeading = useRef<HTMLHeadingElement>(null);
  // Where an editor puts its pill, draw bar and fields (map/editSlots.tsx).
  const [pillSlot, setPillSlot] = useState<HTMLElement | null>(null);
  const [barSlot, setBarSlot] = useState<HTMLElement | null>(null);
  const [bodySlot, setBodySlot] = useState<HTMLElement | null>(null);
  const slots: EditSlots = {
    pill: pillSlot,
    bar: barSlot,
    body: bodySlot,
    reveal: () => setDetent((d) => (d === 'peek' ? 'half' : d)),
  };
  // The sheet's top edge is the map's bottom: the footer line and the plan's fit sit above it.
  const sheetHeight = wide ? 0 : sheetDetentHeights(sectionSize.height)[detent];
  // At full the sheet covers the map: only peek and half show the map's chrome.
  const covered = !wide && detent === 'full';
  const begin = (next: Edit) => {
    setStandId(null);
    setEdit(next);
    // A stand is mostly its fields; a shape is drawn on the map with the sheet down.
    setDetent(next.kind === 'stand' ? 'half' : 'peek');
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
  /** Saved, deleted or cancelled: the editor closes (and after a change, the places load again). */
  const close = () => {
    setEdit(null);
    setDetent('peek');
  };
  const done = () => {
    close();
    details.reload();
  };
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
    if (edit.kind === 'stand') {
      const move = (to: [number, number]) =>
        setEdit({ ...edit, draft: { ...edit.draft, lon: to[0], lat: to[1] } });
      return (
        <>
          <StandMarkerLayer frame={frame} draft={edit.draft} onMove={move} />
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
            onCancel={close}
          />
        </>
      );
    }
    const area = edit.kind === 'area' ? edit : null;
    return (
      <>
        <DrawLayer
          frame={frame}
          state={edit.draw}
          dispatch={dispatch}
          label={area ? 'Area corners' : 'Property line corners'}
        />
        <DrawControls
          frame={frame}
          state={edit.draw}
          dispatch={dispatch}
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
              close();
              return;
            }
            const fields = { name: area.name, boundary };
            if (area.area) await props.api.updateArea(area.area.id, fields);
            else await props.api.createArea(fields);
            done();
          }}
          onCancel={close}
        />
      </>
    );
  };

  const lineLabel = club.boundary ? 'Edit property line' : 'Draw property line';
  const conditions = <ConditionsStrip sun={sun} overdueAt={overdue} />;
  // The sheet's peek leads with what the admin acts on: when the overdue alert goes out (or the
  // most urgent to-do), and a chip with how many to-dos need them, which opens the list.
  const lead: ReactNode =
    overdue !== undefined ? (
      <Spoken
        wording={{
          short: `${OVERDUE_ALERT_LABEL} ${clockReadout(overdue).short}`,
          spoken: `${OVERDUE_ALERT_LABEL} ${clockReadout(overdue).spoken}`,
        }}
      />
    ) : (
      (todo?.[0]?.title ?? (facts || club.name))
    );
  const peek = (
    <div className="clubview__peek">
      <p className="clubview__lead">{lead}</p>
      {todo?.length ? (
        <button
          type="button"
          className="clubview__chip text-readout-inline"
          onClick={() => {
            setDetent('half');
            needsHeading.current?.focus();
          }}
        >
          {needsYouChip(todo.length)}
        </button>
      ) : null}
    </div>
  );
  // The editor's draw bar, in the peek or at the top of the panel.
  const bar = <div ref={setBarSlot} className="clubview__bar" />;
  const panel = (
    <>
      <div ref={setBodySlot} className="clubview__editor" hidden={!edit} />
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
      {wide ? (
        <section className="side-section" aria-labelledby="today">
          <h2 id="today" className="side-section__title">
            Today
          </h2>
          {conditions}
        </section>
      ) : null}
      <Loadable state={details} skeleton="table">
        {(value) => (
          <>
            <NeedsYou
              items={todo ?? []}
              onDraw={canDraw ? startDraw : undefined}
              drawing={edit?.kind === 'line'}
              headingRef={needsHeading}
            />
            <Places
              facts={facts}
              stands={value.stands ?? []}
              areas={value.areas ?? []}
              noLine={canDraw && !club.boundary}
              editing={edit !== null}
              onStand={(s) => setStandId(s.id)}
              {...(canDraw
                ? {
                    admin: {
                      lineLabel,
                      onLine: startDraw,
                      onAddStand: () => startStand(null),
                      onAddArea: () => startArea(null),
                      onArea: startArea,
                    },
                  }
                : {})}
            />
            <MapKey />
            <OutNow />
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
    </>
  );

  return (
    <EditSlotsContext.Provider value={slots}>
      <section
        ref={sectionRef}
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
          editing={edit !== null}
          pinned={chromePinned({ now, overdueAt: overdue })}
          insets={{ top: PILL_BOTTOM + FIT_PADDING }}
          footer={sheetHeight}
          covered={covered}
          focus={focusAt && focusKey ? { key: focusKey, at: focusAt, top: PILL_BOTTOM } : null}
          empty={details.status === 'ready' && !canDraw ? MAP_EMPTY : null}
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
          {/* The app bar (phones) or the sidebar (desktop) shows the club's name; here it is
              the page's heading for screen readers, and the pill shows only the next time. */}
          <h1 id="club-title" className="visually-hidden" tabIndex={-1} ref={heading}>
            {club.name}
          </h1>
          {edit ? (
            <div ref={setPillSlot} className="clubview__pill" />
          ) : (
            <MapPill
              next={nextTimeReadout(sun, overdue, now)}
              icon={
                sun.untilSunset || overdue === undefined || overdue <= now ? Sunset : AlarmClock
              }
              card={wide ? null : conditions}
            />
          )}
        </ClubMap>
        {wide ? (
          <aside className="clubview__side" aria-label="Club panel">
            {edit ? bar : null}
            {panel}
          </aside>
        ) : (
          <MapSheet
            label="Club panel"
            detent={detent}
            onDetent={setDetent}
            mapHeight={sectionSize.height}
            summary={edit ? bar : peek}
            title={edit ? null : <h2 className="map-sheet__title">{club.name}</h2>}
          >
            {panel}
          </MapSheet>
        )}
        <StandDrawer
          stand={stand}
          onClose={() => setStandId(null)}
          areas={loaded.areas}
          harvests={loaded.harvests}
          members={loaded.members}
          onEdit={canDraw ? startStand : undefined}
        />
      </section>
    </EditSlotsContext.Provider>
  );
}

/** What the admin can do to the club's places: the property line, and adding stands and areas. */
interface PlacesAdmin {
  lineLabel: string;
  onLine: () => void;
  onAddStand: () => void;
  onAddArea: () => void;
  onArea: (area: Area) => void;
}

/**
 * Stands and areas: one header row (the title, then for an admin the property line as a quiet
 * text action and one "+" menu with Add stand and Add area), what the club holds, then a row
 * per stand and area (its icon, name and a chevron). A stand opens its details; an area opens
 * in the area editor for an admin.
 */
function Places(props: {
  facts: string;
  stands: readonly Stand[];
  areas: readonly Area[];
  noLine: boolean;
  editing: boolean;
  onStand: (stand: Stand) => void;
  admin?: PlacesAdmin;
}) {
  const { admin } = props;
  return (
    <section className="side-section" aria-labelledby="places">
      <div className="side-section__head">
        <h2 id="places" className="side-section__title">
          Stands and areas
        </h2>
        {admin && !props.editing ? (
          <>
            <button type="button" className="side-section__quiet" onClick={admin.onLine}>
              {admin.lineLabel}
            </button>
            <Popover
              label="Add to the map"
              tooltip="Add a stand or area"
              trigger={<Plus size={sizes.icon} aria-hidden />}
              placement="bottom-end"
              triggerClassName="side-section__add"
              panelClassName="add-menu"
            >
              {(close) => (
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      close();
                      admin.onAddStand();
                    }}
                  >
                    Add stand
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      close();
                      admin.onAddArea();
                    }}
                  >
                    Add area
                  </Button>
                </>
              )}
            </Popover>
          </>
        ) : null}
      </div>
      {props.facts ? <p className="clubview__facts">{props.facts}</p> : null}
      {props.noLine ? <p className="side-section__hint">{NO_LINE}</p> : null}
      {props.stands.length || props.areas.length ? (
        <ul className="rows" aria-label="Stands and areas">
          {props.stands.map((stand) => (
            <PlaceRow
              key={stand.id}
              icon={standIcon(stand.type)}
              name={stand.name}
              onOpen={() => props.onStand(stand)}
              disabled={props.editing}
            />
          ))}
          {props.areas.map((area) => (
            <PlaceRow
              key={area.id}
              icon={AreaIcon}
              name={area.name}
              label={`Edit ${area.name}`}
              onOpen={admin ? () => admin.onArea(area) : undefined}
              disabled={props.editing}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** An area's mark in the lists: the map's own dotted outline. */
function AreaIcon(props: { size?: number | string; 'aria-hidden'?: boolean | 'true' }) {
  const size = Number(props.size ?? sizes.icon);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="place-row__area"
    >
      <rect className="plan__area" x={3} y={3} width={18} height={18} rx={3} />
    </svg>
  );
}

/** One stand or area: its icon, name and, when it opens, a chevron. */
function PlaceRow(props: {
  icon: (p: { size?: number | string; 'aria-hidden'?: boolean | 'true' }) => ReactNode;
  name: string;
  /** The button's name, when it is not the name alone (an area's "Edit North 40"). */
  label?: string;
  onOpen?: (() => void) | undefined;
  disabled?: boolean;
}) {
  const content = (
    <>
      <props.icon size={sizes.icon} aria-hidden />
      <span className="place-row__name">{props.name}</span>
      {props.onOpen ? (
        <ChevronRight size={sizes.icon} aria-hidden className="place-row__chevron" />
      ) : null}
    </>
  );
  return (
    <li>
      {props.onOpen ? (
        <button
          type="button"
          className="place-row"
          aria-label={props.label}
          onClick={props.onOpen}
          disabled={props.disabled}
        >
          {content}
        </button>
      ) : (
        <div className="place-row">{content}</div>
      )}
    </li>
  );
}

/**
 * The map key: what each mark on the map means, folded away under one line so the map itself
 * keeps its room. The marks are drawn with the map's own classes, so they always match.
 */
function MapKey() {
  const swatch = (children: ReactNode) => (
    <svg className="map-key__swatch" width={48} height={32} viewBox="0 0 48 32" aria-hidden="true">
      {children}
    </svg>
  );
  const marker = (className: string) =>
    swatch(
      <g transform="translate(24 16)" className={className}>
        <rect
          className="plan__stand-box"
          x={-12}
          y={-12}
          width={24}
          height={24}
          rx={radii.standMarker}
        />
      </g>,
    );
  const rows: { key: string; mark: ReactNode; label: string }[] = [
    { key: 'line', mark: swatch(<PropertyLine d="M4 26 L16 6 L44 10" />), label: 'Property line' },
    {
      key: 'area',
      mark: swatch(<rect className="plan__area" x={6} y={6} width={36} height={20} rx={3} />),
      label: 'Club area',
    },
    { key: 'stand', mark: marker('plan__stand'), label: 'Stand' },
    {
      key: 'selected',
      mark: marker('plan__stand plan__stand--selected'),
      label: 'Stand you opened',
    },
  ];
  return (
    <details className="map-key side-section">
      <summary className="map-key__summary">Map key</summary>
      <ul className="map-key__list">
        {rows.map((row) => (
          <li key={row.key} className="map-key__row">
            {row.mark}
            <span>{row.label}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Who is out now: never known here (positions travel only over the mesh, and the web never
 * receives one), so one line says where to look, with a link to get the app.
 */
function OutNow() {
  return (
    <section className="side-section" aria-labelledby="out-now">
      <h2 id="out-now" className="side-section__title">
        Out now
      </h2>
      <p className="side-section__note">
        {OUT_NOW_EMPTY.line} <a href={DOWNLOAD_PATH}>{OUT_NOW_EMPTY.link}</a>
      </p>
    </section>
  );
}

/** The admin's to-dos (the shared needsYou rules), each with the way to deal with it. */
function NeedsYou(props: {
  items: readonly NeedsYouItem[];
  onDraw?: (() => void) | undefined;
  drawing?: boolean;
  /** The heading, focused when the peek's chip opens the list. */
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <section className="side-section" aria-labelledby="needs-you">
      <h2 id="needs-you" className="side-section__title" tabIndex={-1} ref={props.headingRef}>
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
