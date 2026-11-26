import { useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  /** `stale`: the last good value, shown because a reload failed (e.g. offline). */
  | { status: 'ready'; value: T; stale?: boolean }
  | { status: 'error'; message: string };

export interface AsyncOptions {
  /** Keep showing the last loaded value (marked stale) when a reload fails like this. */
  keepLastOn?: (error: unknown) => boolean;
}

/** Loads `load()` once per `deps` change; ignores results that arrive after unmount. */
export function useAsync<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  options: AsyncOptions = {},
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const last = useRef<{ value: T } | null>(null);
  // Re-runs only when a dependency changes (the deps array is the caller's contract).
  useEffect(() => {
    let live = true;
    // While reloading, keep the last value on screen rather than flashing "Loading".
    setState(last.current ? { status: 'ready', value: last.current.value } : { status: 'loading' });
    load().then(
      (value) => {
        if (!live) return;
        last.current = { value };
        setState({ status: 'ready', value });
      },
      (error: unknown) => {
        if (!live) return;
        if (last.current && options.keepLastOn?.(error)) {
          setState({ status: 'ready', value: last.current.value, stale: true });
        } else {
          setState({ status: 'error', message: 'Could not load this. Try again.' });
        }
      },
    );
    return () => {
      live = false;
    };
  }, deps);
  return state;
}
