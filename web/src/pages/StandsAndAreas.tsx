import { STAND_TYPE_LABELS, type Area, type Stand } from '@huntclub/shared';
import type { ClubApi } from '../api/types';
import { DataTable } from '../components/DataTable';
import { Loadable } from '../components/Loadable';
import { PageHeading } from '../components/PageHeading';
import { isOffline, useAsync } from '../components/useAsync';

/** The club's stands and named areas. Editing (and drawing on the map) comes later. */
export function StandsAndAreas(props: { api: ClubApi }) {
  // Both lists together: stand rows show their area's name, area rows count their stands.
  const places = useAsync(
    () => Promise.all([props.api.listStands(), props.api.listAreas()]),
    [props.api],
    { keepLastOn: isOffline },
  );

  return (
    <section aria-labelledby="stands-title">
      <PageHeading id="stands-title">Stands and areas</PageHeading>
      <Loadable state={places}>
        {([stands, areas]) => <Places stands={stands} areas={areas} />}
      </Loadable>
    </section>
  );
}

function Places({ stands, areas }: { stands: readonly Stand[]; areas: readonly Area[] }) {
  return (
    <>
      <h2 id="stands-list">Stands ({stands.length})</h2>
      {stands.length === 0 ? (
        <p>No stands yet.</p>
      ) : (
        <DataTable
          labelledBy="stands-list"
          rows={stands}
          rowKey={(s) => s.id}
          stack
          columns={[
            { label: 'Name', cell: (s) => s.name },
            { label: 'Type', cell: (s) => STAND_TYPE_LABELS[s.type] },
            { label: 'Area', cell: (s) => areas.find((a) => a.id === s.areaId)?.name ?? '—' },
            // Inactive stands are hidden from check-in in the app (store: active = 1).
            { label: 'Available for check-in', cell: (s) => (s.active ? 'Yes' : 'No') },
          ]}
        />
      )}
      <h2 id="areas-list">Areas ({areas.length})</h2>
      {areas.length === 0 ? (
        <p>No areas yet.</p>
      ) : (
        <DataTable
          labelledBy="areas-list"
          rows={areas}
          rowKey={(a) => a.id}
          stack
          columns={[
            { label: 'Name', cell: (a) => a.name },
            { label: 'Stands', cell: (a) => stands.filter((s) => s.areaId === a.id).length },
          ]}
        />
      )}
    </>
  );
}
