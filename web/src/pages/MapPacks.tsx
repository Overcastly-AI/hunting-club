import {
  BASEMAP_IDS,
  BASEMAPS,
  basemapBySource,
  CLUB_PRICING,
  ClubApiRequestError,
  clubPlanState,
  estimateClubPack,
  formatBytes,
  MAP_PACK_BUILD,
  MAP_PACK_LIMITS,
  type BasemapId,
  type Club,
  type ClubPlanState,
  type MapPack,
} from '@huntclub/shared';
import { CreditCard, Download, Hammer, Map as MapIcon, RefreshCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NoClubError, type ClubApi } from '../api/types';
import { Loadable } from '../components/Loadable';
import { Page } from '../components/Page';
import { isOffline, useAsync } from '../components/useAsync';
import {
  Badge,
  Banner,
  Button,
  ButtonLink,
  DataTable,
  EmptyState,
  Segmented,
  StatGrid,
  StatTile,
} from '../components/ui';
import { formatDate } from '../format';
import { ClubMap } from '../map/ClubMap';
import { pageHref } from '../shell/routes';

/** Where the property line is drawn: the draw tool on My club's map (admins). */
export const DRAW_LINE_FIRST = 'Draw it on the My club map. A map pack covers exactly that area.';

/** How long a build may take, in words ("15 minutes"). */
const BUILD_MINUTES = `${Math.ceil(MAP_PACK_BUILD.timeoutSeconds / 60)} minutes`;

type RequestState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string }
  /** The club service refused it for the club's plan (403 club_inactive). */
  | { kind: 'plan' };

/** A club without an open plan: what it needs before it can build (Billing has the button). */
export const PLAN_NEEDED = {
  title: 'Map packs come with a club plan',
  none: `Start the ${CLUB_PRICING.trialDays}-day free trial in Billing to build one.`,
  lapsed:
    'Renew the club plan in Billing to build a new one. Map packs already built keep working.',
} as const;

/** Plain words for the club API's refusals of a pack request (club_inactive shows the plan). */
function requestError(error: unknown): string {
  if (error instanceof ClubApiRequestError) {
    switch (error.code) {
      case 'conflict':
        return `A map pack is already being built. Try again when it is done (up to ${BUILD_MINUTES}).`;
      case 'invalid':
        return `The club service refused this map pack: ${error.message}.`;
      case 'not_configured':
        return 'Map packs are not set up yet.';
      case 'network':
        return 'No connection. Try again when you are online.';
    }
  }
  return 'Could not start the map pack. Try again.';
}

/**
 * Offline map packs of the club's property line: members download ready ones in the
 * app. The admin picks a basemap; the cloud builds the pack in the background.
 */
export function MapPacks(props: { api: ClubApi }) {
  const state = useAsync(
    async () => {
      // No club yet: nothing to list, and the page asks for a club first.
      const club = await props.api.getClub();
      if (!club) throw new NoClubError();
      const [packs, subscription] = await Promise.all([
        props.api.listMapPacks(),
        props.api.getSubscription(),
      ]);
      // Map packs are a club plan feature: the same rule the club service checks.
      return [club, packs, clubPlanState(subscription, Date.now())] as const;
    },
    [props.api],
    { keepLastOn: isOffline },
  );
  // The basemap a new pack is built from; the map beside the form shows it live.
  const [basemap, setBasemap] = useState<BasemapId>(BASEMAP_IDS[0]!);

  return (
    <Page
      title="Map packs"
      description="Download the property in full detail before you go. Maps work with no cell service."
    >
      <Loadable state={state} skeleton="table">
        {([club, packs, plan]) => (
          <>
            <div className="beside-map">
              <div className="beside-map__lists">
                <BuildPack
                  api={props.api}
                  club={club}
                  plan={plan}
                  basemap={basemap}
                  onBasemap={setBasemap}
                  building={packs.some((p) => p.status === 'building')}
                  onStarted={state.reload}
                />
              </div>
              <ClubMap
                className="beside-map__map"
                boundary={club.boundary}
                areas={[]}
                stands={[]}
                compact
                live={club.boundary ? basemap : null}
                label={
                  club.boundary
                    ? 'The area a map pack covers: the club property line.'
                    : 'No property line yet.'
                }
                insets={{ top: 24, right: 24, bottom: 40, left: 24 }}
                empty={{ title: 'No property line yet', line: DRAW_LINE_FIRST }}
              />
            </div>
            <div className="section-head">
              <h2 className="section-title">Map packs</h2>
              {packs.length > 0 ? (
                <Button icon={RefreshCw} size="sm" onClick={state.reload}>
                  Check again
                </Button>
              ) : null}
            </div>
            <PackTable packs={packs} blocker={buildBlocker(club, plan)} />
          </>
        )}
      </Loadable>
    </Page>
  );
}

/** What stands between the club and a new pack, if anything: the plan first, then the line. */
function buildBlocker(club: Club, plan: ClubPlanState): keyof typeof EMPTY_PACKS_BODY {
  if (plan !== 'open') return 'needsPlan';
  return club.boundary ? 'canBuild' : 'needsLine';
}

/** The paid state, shown in place of the build form: why, and the way to Billing. */
function PlanNeeded(props: { plan: Exclude<ClubPlanState, 'open'> }) {
  return (
    <EmptyState
      icon={CreditCard}
      title={PLAN_NEEDED.title}
      titleAs="h2"
      action={
        <ButtonLink variant="primary" size="sm" href={pageHref('billing')}>
          Go to Billing
        </ButtonLink>
      }
    >
      {PLAN_NEEDED[props.plan]}
    </EmptyState>
  );
}

function BuildPack(props: {
  api: ClubApi;
  club: Club;
  plan: ClubPlanState;
  basemap: BasemapId;
  onBasemap: (basemap: BasemapId) => void;
  building: boolean;
  onStarted: () => void;
}) {
  const { basemap } = props;
  const [request, setRequest] = useState<RequestState>({ kind: 'idle' });

  // No open plan: say so up front instead of offering a build the club service refuses.
  if (props.plan !== 'open') return <PlanNeeded plan={props.plan} />;
  // Open here, but the club service found the plan over (it ended since the page loaded).
  if (request.kind === 'plan') return <PlanNeeded plan="lapsed" />;
  if (!props.club.boundary) {
    // No estimate without a boundary; the line is drawn on My club's map.
    return (
      <EmptyState
        icon={MapIcon}
        title="Draw the property line first"
        titleAs="h2"
        action={
          <ButtonLink size="sm" href={pageHref('club')}>
            Go to My club
          </ButtonLink>
        }
      >
        {DRAW_LINE_FIRST}
      </EmptyState>
    );
  }
  // The same rule the club service applies before it accepts a build.
  const estimate = estimateClubPack(props.club.boundary, { basemap });

  const build = async () => {
    setRequest({ kind: 'busy' });
    try {
      await props.api.requestMapPack(basemap);
      setRequest({ kind: 'idle' });
      props.onStarted();
    } catch (error) {
      if (error instanceof ClubApiRequestError && error.code === 'club_inactive')
        setRequest({ kind: 'plan' });
      else setRequest({ kind: 'error', message: requestError(error) });
    }
  };

  return (
    <section className="form-plate" aria-labelledby="build-pack">
      <h2 id="build-pack" className="section-title">
        Build a map pack
      </h2>
      <Segmented
        legend="Basemap"
        options={BASEMAP_IDS.map((id) => ({ value: id, label: BASEMAPS[id].label }))}
        value={basemap}
        onChange={(id) => {
          props.onBasemap(id);
          setRequest({ kind: 'idle' });
        }}
      />
      {estimate.overLimit ? (
        <div role="alert">
          <Banner tone="danger" title="Too big for one map pack">
            About {estimate.tiles.toLocaleString('en-US')} map tiles, and a pack can hold{' '}
            {MAP_PACK_LIMITS.maxTiles.toLocaleString('en-US')} tiles and{' '}
            {formatBytes(MAP_PACK_LIMITS.maxBytes)}.
          </Banner>
        </div>
      ) : (
        <div className="estimate">
          <StatGrid aria-label="Estimate">
            <StatTile label="Map tiles" value={`About ${estimate.tiles.toLocaleString('en-US')}`} />
            <StatTile label="Download" value={`About ${formatBytes(estimate.bytes)}`} />
          </StatGrid>
        </div>
      )}
      {props.building ? (
        <Banner tone="info" live>
          A map pack is being built. It can take up to {BUILD_MINUTES}.
        </Banner>
      ) : null}
      <div className="form-plate__actions">
        <Button
          variant="primary"
          icon={Hammer}
          loading={request.kind === 'busy'}
          disabled={props.building || estimate.overLimit !== null}
          onClick={() => void build()}
        >
          Build map pack
        </Button>
      </div>
      {request.kind === 'error' ? (
        <div role="alert">
          <Banner tone="danger">{request.message}</Banner>
        </div>
      ) : null}
      <p className="form-note">Members download ready packs in the app, under Map packs.</p>
    </section>
  );
}

/** Status as a tagged word, and the detail that goes with it. */
function packStatus(p: MapPack): { status: ReactNode; size: string; date: string } {
  switch (p.status) {
    case 'building':
      return {
        status: <Badge tone="info">Being built</Badge>,
        size: '—',
        date: formatDate(p.createdAt),
      };
    case 'ready':
      return {
        status: <Badge tone="success">Ready</Badge>,
        size: formatBytes(p.sizeBytes),
        date: formatDate(p.builtAt),
      };
    case 'failed':
      return {
        status: (
          <span className="status-reason">
            <Badge tone="danger">Failed</Badge> {p.reason}
          </span>
        ),
        size: '—',
        date: formatDate(p.updatedAt),
      };
  }
}

/** What the empty list says: it points at the build control only when the page shows one. */
const EMPTY_PACKS_BODY = {
  canBuild: 'Build one above. It takes a few minutes.',
  needsLine: 'Draw the property line on the My club map first, then build one here.',
  needsPlan: 'Built packs show here once the club has a plan. Start one in Billing.',
} as const;

function PackTable(props: { packs: readonly MapPack[]; blocker: keyof typeof EMPTY_PACKS_BODY }) {
  const { packs } = props;
  const rows = [...packs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => ({
      id: p.id,
      basemap: basemapBySource(p.source)?.label ?? p.source,
      ...packStatus(p),
    }));
  return (
    <DataTable
      caption="Club map packs, newest first"
      rows={rows}
      rowKey={(r) => r.id}
      empty={
        <EmptyState icon={Download} title="No map packs yet" titleAs="h3">
          {EMPTY_PACKS_BODY[props.blocker]}
        </EmptyState>
      }
      columns={[
        { key: 'basemap', header: 'Basemap', cell: (r) => r.basemap },
        { key: 'status', header: 'Status', cell: (r) => r.status },
        {
          key: 'size',
          header: 'Size',
          cell: (r) => <span className="text-readout-inline">{r.size}</span>,
        },
        { key: 'date', header: 'Date', cell: (r) => r.date },
      ]}
    />
  );
}
