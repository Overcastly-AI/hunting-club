import type { ClubApi } from '../api/types';
import { Loadable } from '../components/Loadable';
import { useAsync } from '../components/useAsync';
import { STAND_TYPE_LABELS } from '../format';

/** The club's stands and named areas. Editing (and drawing on the map) comes later. */
export function StandsAndAreas(props: { api: ClubApi }) {
  // Both lists together: stand rows show their area's name, area rows count their stands.
  const places = useAsync(
    () => Promise.all([props.api.listStands(), props.api.listAreas()]),
    [props.api],
  );

  return (
    <section aria-labelledby="stands-title">
      <h1 id="stands-title">Stands and areas</h1>
      <Loadable state={places}>
        {([stands, areas]) => (
          <>
            <h2>Stands</h2>
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Area</th>
                  <th scope="col">In use</th>
                </tr>
              </thead>
              <tbody>
                {stands.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{STAND_TYPE_LABELS[s.type]}</td>
                    <td>{areas.find((a) => a.id === s.areaId)?.name ?? '—'}</td>
                    <td>{s.active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h2>Areas</h2>
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Stands</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td>{stands.filter((s) => s.areaId === a.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Loadable>
    </section>
  );
}
