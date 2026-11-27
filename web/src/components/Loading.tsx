import {
  LoadingRegion,
  Skeleton,
  SKELETON_DELAY_MS,
  SkeletonStats,
  SkeletonTable,
  SkeletonText,
} from './ui';

/**
 * What the placeholder looks like, matching the page it stands in for: a page heading and
 * lines (`page`), a table at its own row height (`table`), the readout strip over a table
 * (`stats`), or a map block (`map`).
 */
export type LoadingLayout = 'page' | 'table' | 'stats' | 'map';

/** What screen readers hear while anything loads. */
export const LOADING_LABEL = 'Loading';

/**
 * The one loading state: nothing for the first SKELETON_DELAY_MS, then placeholder shapes in
 * the page's layout (static under reduced motion). A polite status says "Loading" throughout.
 */
export function Loading(props: { layout?: LoadingLayout; label?: string }) {
  const layout = props.layout ?? 'page';
  return (
    <LoadingRegion
      label={props.label ?? LOADING_LABEL}
      delay={SKELETON_DELAY_MS}
      className={`loading loading--${layout}`}
    >
      <Shapes layout={layout} />
    </LoadingRegion>
  );
}

function Shapes(props: { layout: LoadingLayout }) {
  switch (props.layout) {
    case 'map':
      return <Skeleton shape="map" />;
    case 'table':
      return <SkeletonTable />;
    case 'stats':
      return (
        <>
          <SkeletonStats />
          <SkeletonTable />
        </>
      );
    case 'page':
      return (
        <>
          <Skeleton shape="title" />
          <SkeletonText />
        </>
      );
  }
}
