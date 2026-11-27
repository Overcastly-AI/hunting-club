import { pluralize, STAND_TYPE_LABELS, type Area, type Club, type Stand } from '@huntclub/shared';
import { MapPin } from 'lucide-react';
import type { ClubApi } from '../api/types';
import { Loadable } from '../components/Loadable';
import { Page } from '../components/Page';
import { standIcon } from '../components/standIcons';
import { isOffline, useAsync } from '../components/useAsync';
import { StandStatus } from '../components/StandStatus';
import { DataTable, EmptyState } from '../components/ui';
import { ICON_SIZE } from '@huntclub/design';
import { ClubMap } from '../map/ClubMap';

/**
 * The club's stands and named areas, beside the club plan. They are placed and drawn in the
 * app (on the phone, at the spot); the web lists them.
 */
export function StandsAndAreas(props: { api: ClubApi }) {
  // Both lists together: stand rows show their area's name, area rows count their stands.
  const places = useAsync(
    () =>
      Promise.all([props.api.listStands(), props.api.listAreas(), props.api.getClub()] as const),
    [props.api],
    { keepLastOn: isOffline },
  );

  return (
    <Page
      title="Stands and areas"
      description={
        places.status === 'ready'
          ? `${pluralize(places.value[0].length, 'stand')} and ${pluralize(places.value[1].length, 'area')}. Place and draw them in the app.`
          : undefined
      }
    >
      <Loadable state={places} skeleton="table">
        {([stands, areas, club]) => <Places stands={stands} areas={areas} club={club} />}
      </Loadable>
    </Page>
  );
}

function Places(props: { stands: readonly Stand[]; areas: readonly Area[]; club: Club | null }) {
  const { stands, areas, club } = props;
  const areaName = (id?: string) => areas.find((a) => a.id === id)?.name ?? '—';
  return (
    <div className="beside-map">
      <div className="beside-map__lists">
        <h2 id="stands-list" className="section-title">
          Stands <span className="section-title__count text-readout-inline">{stands.length}</span>
        </h2>
        <DataTable
          caption={`Stands (${stands.length})`}
          rows={stands}
          rowKey={(s) => s.id}
          initialSort={{ key: 'name', direction: 'ascending' }}
          empty={
            <EmptyState icon={MapPin} title="No stands yet" titleAs="h3">
              Add stands in the app, standing at the spot.
            </EmptyState>
          }
          columns={[
            {
              key: 'name',
              header: 'Name',
              sortValue: (s) => s.name,
              cell: (s) => {
                const Icon = standIcon(s.type);
                return (
                  <span className="place">
                    <span className="place__mark">
                      <Icon size={ICON_SIZE.md} aria-hidden />
                    </span>
                    {s.name}
                  </span>
                );
              },
            },
            { key: 'type', header: 'Type', cell: (s) => STAND_TYPE_LABELS[s.type] },
            {
              key: 'area',
              header: 'Area',
              sortValue: (s) => areaName(s.areaId),
              cell: (s) => areaName(s.areaId),
            },
            {
              // Closed stands are hidden from check-in in the app (store: active = 1).
              key: 'check-in',
              header: 'Check-in',
              cell: (s) => <StandStatus active={s.active} />,
            },
          ]}
        />
        <h2 id="areas-list" className="section-title">
          Areas <span className="section-title__count text-readout-inline">{areas.length}</span>
        </h2>
        <DataTable
          caption={`Areas (${areas.length})`}
          rows={areas}
          rowKey={(a) => a.id}
          initialSort={{ key: 'name', direction: 'ascending' }}
          empty={
            <EmptyState icon={MapPin} title="No areas yet" titleAs="h3">
              Draw areas in the app to split the property into named parts.
            </EmptyState>
          }
          columns={[
            { key: 'name', header: 'Name', sortValue: (a) => a.name, cell: (a) => a.name },
            {
              key: 'stands',
              header: 'Stands',
              sortValue: (a) => stands.filter((s) => s.areaId === a.id).length,
              cell: (a) => (
                <span className="text-readout-inline">
                  {stands.filter((s) => s.areaId === a.id).length}
                </span>
              ),
            },
          ]}
        />
      </div>
      <ClubMap
        className="beside-map__map"
        boundary={club?.boundary}
        areas={areas}
        stands={stands}
        compact
        label={`Map of the club: ${pluralize(areas.length, 'area')} and ${pluralize(stands.length, 'stand')}.`}
        insets={{ top: 24, right: 24, bottom: 40, left: 24 }}
        empty={{
          title: 'Nothing to draw yet',
          line: 'Place stands and draw areas in the app, at the spot.',
        }}
      />
    </div>
  );
}
