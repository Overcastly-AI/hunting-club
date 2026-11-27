import { useEffect, useState, type ReactNode } from 'react';
import { cx } from './cx';

/**
 * One placeholder shape: a text line, a title line, a stat tile or a map block. Static under
 * reduced motion.
 */
export function Skeleton(props: { shape?: 'text' | 'title' | 'tile' | 'map'; short?: boolean }) {
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

/** Nothing is drawn for this long: a quick load never flashes placeholders. */
export const SKELETON_DELAY_MS = 200;

/** True once `ms` have passed since mount. */
function useDelayed(ms: number): boolean {
  const [due, setDue] = useState(ms <= 0);
  useEffect(() => {
    if (ms <= 0) return;
    const timer = setTimeout(() => setDue(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return due;
}

/**
 * A loading region: the placeholder shapes are hidden from screen readers, which hear
 * `label` once through a polite status instead. The status is there at once; the shapes only
 * after SKELETON_DELAY_MS (`delay`), so a quick load shows nothing at all.
 */
export function LoadingRegion(props: {
  label: string;
  children: ReactNode;
  /** Wait this long before drawing the shapes (default: draw them at once). */
  delay?: number;
  className?: string;
}) {
  const shown = useDelayed(props.delay ?? 0);
  return (
    <div className={cx('ui-skeleton-group', props.className)} aria-busy="true">
      <span role="status" aria-live="polite" className="visually-hidden">
        {props.label}
      </span>
      {shown ? props.children : null}
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

/** Rows shown while a table loads (DataTable and the page skeletons). */
export const SKELETON_ROWS = 3;

/** Placeholder rows at the table's own row height: a line in each cell, the later ones short. */
export function SkeletonRows(props: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: props.rows ?? SKELETON_ROWS }, (_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: props.columns }, (_, j) => (
            <td key={j}>
              <Skeleton short={j > 0} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** A whole table placeholder: the table's plate and rows, no header words to invent. */
export function SkeletonTable(props: { columns?: number; rows?: number }) {
  return (
    <div className="ui-table-wrap" aria-hidden="true">
      <table className="ui-table">
        <tbody>
          <SkeletonRows columns={props.columns ?? 3} rows={props.rows} />
        </tbody>
      </table>
    </div>
  );
}

/** The readout strip's placeholder: the strip's plate with four empty cells. */
export function SkeletonStats(props: { cells?: number }) {
  return (
    <ul className="ui-stat-grid" aria-hidden="true">
      {Array.from({ length: props.cells ?? 4 }, (_, i) => (
        <li key={i}>
          <Skeleton shape="tile" />
        </li>
      ))}
    </ul>
  );
}
