import type { ReactNode } from 'react';
import type { AsyncState } from './useAsync';

/** Renders loading and error states the same way on every page. */
export function Loadable<T>(props: { state: AsyncState<T>; children: (value: T) => ReactNode }) {
  const { state } = props;
  if (state.status === 'loading') return <p className="muted">Loading…</p>;
  if (state.status === 'error') {
    return (
      <p className="error" role="alert">
        {state.message}
      </p>
    );
  }
  return <>{props.children(state.value)}</>;
}
