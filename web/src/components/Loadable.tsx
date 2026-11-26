import type { ReactNode } from 'react';
import { Loading } from './Loading';
import { NoClub } from './NoClub';
import type { AsyncResult } from './useAsync';

/** Renders loading and error states the same way on every page. */
export function Loadable<T>(props: { state: AsyncResult<T>; children: (value: T) => ReactNode }) {
  const { state } = props;
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'noClub') return <NoClub />;
  if (state.status === 'error') {
    return (
      <div role="alert" className="row">
        <p className="error">{state.message}</p>
        <button className="button" type="button" onClick={state.reload}>
          Try again
        </button>
      </div>
    );
  }
  return (
    <>
      {state.stale ? (
        <p className="banner" role="status">
          No connection to the club service. Showing what was last loaded.
        </p>
      ) : null}
      {props.children(state.value)}
    </>
  );
}
