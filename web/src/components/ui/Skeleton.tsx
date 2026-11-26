import type { ReactNode } from 'react';
import { cx } from './cx';

/** One placeholder shape: a text line, a title line or a stat tile. Static under reduced motion. */
export function Skeleton(props: { shape?: 'text' | 'title' | 'tile'; short?: boolean }) {
  return (
    <span
      className={cx(
        'ui-skeleton',
        `ui-skeleton--${props.shape ?? 'text'}`,
        props.short && 'ui-skeleton--short',
      )}
      aria-hidden="true"
    />
  );
}

/**
 * A loading region: the placeholder shapes are hidden from screen readers, which hear
 * `label` once through a polite status instead. Replaces every "Loading" line.
 */
export function LoadingRegion(props: { label: string; children: ReactNode }) {
  return (
    <div className="ui-skeleton-group" aria-busy="true">
      <span role="status" className="visually-hidden">
        {props.label}
      </span>
      {props.children}
    </div>
  );
}

/** A few lines of placeholder text, the last one short. */
export function SkeletonText(props: { lines?: number }) {
  const lines = props.lines ?? 3;
  return (
    <>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} short={i === lines - 1 && lines > 1} />
      ))}
    </>
  );
}
