import { overdueAt } from '@huntclub/core';
import { space } from '@huntclub/design';
import {
  CLUB_PRICING,
  ClubCreateRequestSchema,
  DISPLAY_NAME_MAX,
  INITIALS_MAX,
  needsYou,
  pluralize,
  SUBSCRIPTION_STATUS_LABELS,
  SUN,
  sunReadout,
  type Area,
  type Club,
  type Invite,
  type MapPack,
  type Member,
  type NeedsYouAction,
  type NeedsYouItem,
  type Stand,
  type Subscription,
} from '@huntclub/shared';
import { RadioTower } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import type { ClubApi } from '../api/types';
import { ConditionsStrip } from '../components/ConditionsStrip';
import { Loadable } from '../components/Loadable';
import { Page, usePageHeadingFocus } from '../components/Page';
import { isOffline, useAsync } from '../components/useAsync';
import { useElementSize } from '../components/useElementSize';
import { Banner, Button, ButtonLink, EmptyState, Field, Input } from '../components/ui';
import { basemapPack, useBasemap } from '../map/basemap';
import { ClubMap, FIT_PADDING } from '../map/ClubMap';
import { boundsCentre, planBounds } from '../map/plan';
import { pageHref, PAGES, type PagePath } from '../shell/routes';
import { useReloadShell } from '../shell/shellClub';

/** Your club, or a form to start one. Payment is on the Billing page. */
export function MyClub(props: { api: ClubApi }) {
  const state = useAsync(() => props.api.getClub(), [props.api]);
  const [created, setCreated] = useState(false);
  const reloadShell = useReloadShell();

  return (
    <Loadable state={state} padded>
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
}

/** One failed list must not blank the page: it reads as "not loaded" (undefined). */
const settle = <T,>(load: Promise<T>) => load.catch(() => undefined);

function useClubDetails(api: ClubApi) {
  return useAsync(
    async (): Promise<ClubDetails> => {
      const [members, stands, areas, subscription, invites, mapPacks] = await Promise.all([
        settle(api.listMembers()),
        settle(api.listStands()),
        settle(api.listAreas()),
        settle(api.getSubscription()),
        settle(api.listInvites()),
        settle(api.listMapPacks()),
      ]);
      return { members, stands, areas, subscription, invites, mapPacks };
    },
    [api],
    { keepLastOn: isOffline },
  );
}

/** Where each kind of to-do is dealt with: a page of the admin, or the app (null). */
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

/**
 * The club on its map (docs/DESIGN.md, "Admin, My club"): the property line, areas and stands
 * edge to edge over the club's own map pack, with the club's plate and the conditions strip on
 * it, and beside it what needs the admin. Nobody's position is shown: positions only travel
 * over the mesh, so "Out now" says where to see them.
 */
function ClubView(props: { api: ClubApi; club: Club; created: boolean }) {
  const { club } = props;
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
  const basemap = useBasemap(basemapPack(loaded.mapPacks));

  return (
    <section className="clubview" aria-labelledby="club-title">
      <ClubMap
        className="clubview__map"
        boundary={club.boundary}
        areas={areas}
        stands={stands}
        label={`Map of ${club.name}: ${club.boundary ? 'the property line' : 'no property line yet'}, ${pluralize(areas.length, 'area')} and ${pluralize(stands.length, 'stand')}.`}
        basemap={basemap}
        insets={{ top: PLATE_TOP + plateSize.height + FIT_PADDING }}
        empty={
          details.status === 'ready' ? (
            <p className="plan__empty">
              No property line, areas or stands yet. Draw them in the app and they show here.
            </p>
          ) : null
        }
      >
        <div className="clubview__plate" ref={plate}>
          <div className="clubview__title">
            <h1 id="club-title" className="text-title-2" tabIndex={-1} ref={heading}>
              {club.name}
            </h1>
            {facts ? <p className="clubview__facts">{facts}</p> : null}
          </div>
          <ConditionsStrip sun={sun} overdueAt={overdue} />
        </div>
      </ClubMap>
      <div className="clubview__side">
        {props.created ? (
          <Banner tone="success" live title="Club created">
            Start your {CLUB_PRICING.trialDays}-day free trial on{' '}
            <a href={pageHref('billing')}>Billing</a>.
          </Banner>
        ) : null}
        <OutNow />
        <Loadable state={details}>
          {(value) => (
            <>
              <NeedsYou items={needsYou({ club, ...value, now })} />
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

/** The admin's to-dos (the shared needsYou rules), each with the way to deal with it. */
function NeedsYou(props: { items: readonly NeedsYouItem[] }) {
  return (
    <section className="side-section" aria-labelledby="needs-you">
      <h2 id="needs-you" className="side-section__title">
        Needs you{' '}
        <span className="side-section__count text-readout-inline">{props.items.length}</span>
      </h2>
      {props.items.length === 0 ? (
        <p className="side-section__empty">Nothing needs you right now.</p>
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

/** From the shared initials rule (initialsSchema), so the hint never drifts from it. */
const INITIALS_HINT = `Up to ${INITIALS_MAX} letters or numbers, shown on the map`;

/** Inline errors, by the request schema's field path. */
const CREATE_ERRORS = {
  'club.name': 'Enter the club name.',
  'admin.displayName': 'Enter your name.',
  'admin.initials': `Enter your initials: up to ${INITIALS_MAX} letters or numbers.`,
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
        if (field in CREATE_ERRORS) fields[field] ??= CREATE_ERRORS[field];
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
      <Field
        label="Your name"
        hint="Shown to club members on the map and in chat."
        error={invalid['admin.displayName']}
      >
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
