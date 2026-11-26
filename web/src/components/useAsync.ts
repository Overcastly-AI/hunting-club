import { useEffect, useState } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; message: string };

/** Loads `load()` once per `deps` change; ignores results that arrive after unmount. */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  // Re-runs only when a dependency changes (the deps array is the caller's contract).
  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    load().then(
      (value) => live && setState({ status: 'ready', value }),
      () => live && setState({ status: 'error', message: 'Could not load this. Try again.' }),
    );
    return () => {
      live = false;
    };
  }, deps);
  return state;
}
