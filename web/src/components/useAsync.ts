import { ClubApiRequestError } from '@huntclub/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NoClubError } from '../api/types';

export type AsyncState<T> =
  | { status: 'loading' }
  /** `stale`: the last good value, shown because a reload failed (e.g. offline). */
  | { status: 'ready'; value: T; stale?: boolean }
  | { status: 'error'; message: string }
  /** The person runs no club yet: not an error, the page asks them to create one. */
  | { status: 'noClub' };

/** The state plus `reload()`, which runs `load()` again (Try again, Check again, after a save). */
export type AsyncResult<T> = AsyncState<T> & { reload: () => void };

export interface AsyncOptions {
  /** Keep showing the last loaded value (marked stale) when a reload fails like this. */
  keepLastOn?: (error: unknown) => boolean;
}

/** The club service could not be reached: keep what was loaded rather than an error. */
export const isOffline = (error: unknown) =>
  error instanceof ClubApiRequestError && error.code === 'network';

export const LOAD_ERROR = 'Could not load this.';

/** Loads `load()` once per `deps` change or reload(); ignores results that arrive after unmount. */
export function useAsync<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  options: AsyncOptions = {},
): AsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const last = useRef<{ value: T } | null>(null);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  // Re-runs only when a dependency changes or on reload() (the deps array is the caller's contract).
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
        if (error instanceof NoClubError) {
          setState({ status: 'noClub' });
        } else if (last.current && options.keepLastOn?.(error)) {
          setState({ status: 'ready', value: last.current.value, stale: true });
        } else {
          setState({ status: 'error', message: LOAD_ERROR });
        }
      },
    );
    return () => {
      live = false;
    };
  }, [...deps, attempt]);
  return { ...state, reload };
}
