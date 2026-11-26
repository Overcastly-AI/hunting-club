import type { ClubApi } from '../api/types';
import { Loadable } from '../components/Loadable';
import { useAsync } from '../components/useAsync';
import { STAND_TYPE_LABELS } from '../format';

/** The club's stands and named areas. Editing (and drawing on the map) comes later. */
export function StandsAndAreas(props: { api: ClubApi }) {
  const stands = useAsync(() => props.api.listStands(), [props.api]);
  const areas = useAsync(() => props.api.listAreas(), [props.api]);

  return (
    <section aria-labelledby="stands-title">
      <h1 id="stands-title">Stands and areas</h1>
      <h2>Stands</h2>
      <Loadable state={stands}>
        {(list) => (
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
              {list.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{STAND_TYPE_LABELS[s.type]}</td>
                  <td>{s.areaName ?? '—'}</td>
                  <td>{s.active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Loadable>
      <h2>Areas</h2>
      <Loadable state={areas}>
        {(list) => (
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Stands</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.standCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Loadable>
    </section>
  );
}
