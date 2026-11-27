import type { ReactNode } from 'react';
import { Loading, type LoadingLayout } from './Loading';
import { NoClub } from './NoClub';
import { Banner, Button } from './ui';
import type { AsyncResult } from './useAsync';

/** Said while a reload failed for lack of a connection and the last good data stays up. */
export const STALE_NOTICE = 'No connection to the club service. Showing what was last loaded.';

/**
 * Renders loading and error states the same way on every page. `noClub` replaces the
 * standard "Create your club first" for a page that has something to show before a club.
 * `padded`: on a page where the map is the page, the states get the page's padding.
 * `skeleton`: the placeholder's layout while loading, matching the page (default `page`);
 * a map placeholder runs edge to edge, never padded.
 */
export function Loadable<T>(props: {
  state: AsyncResult<T>;
  children: (value: T) => ReactNode;
  noClub?: ReactNode;
  padded?: boolean;
  skeleton?: LoadingLayout;
}) {
  const { state } = props;
  const pad = (node: ReactNode) => (props.padded ? <div className="page-pad">{node}</div> : node);
  if (state.status === 'loading') {
    const loading = <Loading layout={props.skeleton} />;
    return props.skeleton === 'map' ? loading : pad(loading);
  }
  if (state.status === 'noClub') return pad(props.noClub ?? <NoClub />);
  if (state.status === 'error') {
    return pad(
      <div role="alert">
        <Banner
          tone="danger"
          action={
            <Button size="sm" onClick={state.reload}>
              Try again
            </Button>
          }
        >
          {state.message}
        </Banner>
      </div>,
    );
  }
  return (
    <>
      {state.stale ? (
        <div className="stale-notice">
          <Banner tone="warning" live>
            {STALE_NOTICE}
          </Banner>
        </div>
      ) : null}
      {props.children(state.value)}
    </>
  );
}
