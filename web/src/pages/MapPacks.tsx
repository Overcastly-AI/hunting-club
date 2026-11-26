import {
  BASEMAP_IDS,
  BASEMAPS,
  basemapBySource,
  ClubApiRequestError,
  estimateClubPack,
  formatBytes,
  MAP_PACK_BUILD,
  MAP_PACK_LIMITS,
  type BasemapId,
  type Club,
  type MapPack,
} from '@huntclub/shared';
import { useState } from 'react';
import type { ClubApi } from '../api/types';
import { Loadable } from '../components/Loadable';
import { DataTable } from '../components/DataTable';
import { PageHeading } from '../components/PageHeading';
import { isOffline, useAsync } from '../components/useAsync';
import { formatDate } from '../format';

/** How long a build may take, in words ("15 minutes"). */
const BUILD_MINUTES = `${Math.ceil(MAP_PACK_BUILD.timeoutSeconds / 60)} minutes`;

type RequestState = { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; message: string };

/** Plain words for the club API's refusals of a pack request. */
function requestError(error: unknown): string {
  if (error instanceof ClubApiRequestError) {
    switch (error.code) {
      case 'conflict':
        return `A map pack is already being built. Try again when it is done (up to ${BUILD_MINUTES}).`;
      case 'club_inactive':
        return 'New map packs need an active club subscription. Map packs already built keep working.';
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
      return [club, club ? await props.api.listMapPacks() : []] as const;
    },
    [props.api],
    { keepLastOn: isOffline },
  );

  return (
    <section aria-labelledby="packs-title">
      <PageHeading id="packs-title">Map packs</PageHeading>
      <p>
        A map pack covers your property line in full detail. Members download it in the app, so the
        map works with no cell service.
      </p>
      <Loadable state={state}>
        {([club, packs]) =>
          !club ? (
            <p>
              Create your club first. <a href="#/club">Go to My club</a>
            </p>
          ) : (
            <>
              <BuildPack
                api={props.api}
                club={club}
                building={packs.some((p) => p.status === 'building')}
                onStarted={state.reload}
              />
              <h2>Map packs</h2>
              {packs.length === 0 ? (
                <p>No map packs yet.</p>
              ) : (
                <>
                  <PackTable packs={packs} />
                  <button className="button" type="button" onClick={state.reload}>
                    Check again
                  </button>
                </>
              )}
            </>
          )
        }
      </Loadable>
    </section>
  );
}

function BuildPack(props: { api: ClubApi; club: Club; building: boolean; onStarted: () => void }) {
  const [basemap, setBasemap] = useState<BasemapId>(BASEMAP_IDS[0]!);
  const [request, setRequest] = useState<RequestState>({ kind: 'idle' });

  if (!props.club.boundary) {
    return <p>Set the club's property line first. The map pack covers exactly that area.</p>;
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
      setRequest({ kind: 'error', message: requestError(error) });
    }
  };

  return (
    <>
      <fieldset className="choices">
        <legend>Basemap</legend>
        {BASEMAP_IDS.map((id) => (
          <label key={id} className="choice">
            <input
              type="radio"
              name="basemap"
              value={id}
              checked={basemap === id}
              onChange={() => {
                setBasemap(id);
                setRequest({ kind: 'idle' });
              }}
            />
            {BASEMAPS[id].label}
          </label>
        ))}
      </fieldset>
      {estimate.overLimit ? (
        <p className="error" role="alert">
          The property is too big for one map pack: about {estimate.tiles.toLocaleString('en-US')}{' '}
          map tiles, and a pack can hold {MAP_PACK_LIMITS.maxTiles.toLocaleString('en-US')} tiles
          and {formatBytes(MAP_PACK_LIMITS.maxBytes)}.
        </p>
      ) : (
        <p className="muted" data-testid="pack-estimate">
          About {estimate.tiles.toLocaleString('en-US')} map tiles, about{' '}
          {formatBytes(estimate.bytes)}.
        </p>
      )}
      {props.building ? <p>A map pack is being built. It can take up to {BUILD_MINUTES}.</p> : null}
      <button
        className="button primary"
        type="button"
        disabled={request.kind === 'busy' || props.building || estimate.overLimit !== null}
        onClick={() => void build()}
      >
        Build map pack
      </button>
      {request.kind === 'error' ? (
        <p className="error" role="alert">
          {request.message}
        </p>
      ) : null}
    </>
  );
}

/** Status in words, and the detail that goes with it. */
function packStatus(p: MapPack): { status: string; size: string; date: string } {
  switch (p.status) {
    case 'building':
      return { status: 'Being built', size: '—', date: formatDate(p.createdAt) };
    case 'ready':
      return { status: 'Ready', size: formatBytes(p.sizeBytes), date: formatDate(p.builtAt) };
    case 'failed':
      return { status: `Failed: ${p.reason}`, size: '—', date: formatDate(p.updatedAt) };
  }
}

function PackTable({ packs }: { packs: readonly MapPack[] }) {
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
      columns={[
        { label: 'Basemap', cell: (r) => r.basemap },
        { label: 'Status', cell: (r) => r.status },
        { label: 'Size', cell: (r) => r.size },
        { label: 'Date', cell: (r) => r.date },
      ]}
    />
  );
}
