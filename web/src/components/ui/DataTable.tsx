import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { cx } from './cx';
import { ICON_SIZE } from '@huntclub/design';
import { SkeletonRows } from './Skeleton';

export interface TableColumn<R> {
  /** Unique within the table. */
  key: string;
  header: string;
  cell: (row: R) => ReactNode;
  /** Makes the column sortable by this value. */
  sortValue?: (row: R) => string | number;
}

type Sort = { key: string; direction: 'ascending' | 'descending' };

/**
 * A table of records: sortable columns (a button in the header, aria-sort), sticky header,
 * 56 px rows with hover, an optional per-row actions cell, skeleton rows while loading and an
 * `empty` slot. Under 640 px each row becomes a card: the first column on top (name and
 * badge), the rest as label and value pairs.
 */
export function DataTable<R>(props: {
  /** Names the table for screen readers (a hidden caption). */
  caption: string;
  columns: readonly TableColumn<R>[];
  rows: readonly R[];
  rowKey: (row: R) => string;
  /** Per-row actions (buttons, or a row menu), in a last column labelled `actionsLabel`. */
  rowActions?: (row: R) => ReactNode;
  actionsLabel?: string;
  loading?: boolean;
  /** Read to screen readers while loading. */
  loadingLabel?: string;
  /** Shown in place of rows when there are none (usually an EmptyState). */
  empty?: ReactNode;
  initialSort?: Sort;
  /** Scroll inside the card (header stays in view) instead of growing the page. */
  scroll?: boolean;
}) {
  const [sort, setSort] = useState<Sort | undefined>(props.initialSort);
  const rows = useMemo(() => {
    const column = sort && props.columns.find((c) => c.key === sort.key);
    if (!sort || !column?.sortValue) return props.rows;
    const value = column.sortValue;
    const sign = sort.direction === 'ascending' ? 1 : -1;
    return [...props.rows].sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      return (
        sign *
        (typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y)))
      );
    });
  }, [props.rows, props.columns, sort]);

  const toggle = (key: string) =>
    setSort((s) => ({
      key,
      direction: s?.key === key && s.direction === 'ascending' ? 'descending' : 'ascending',
    }));

  const actionsLabel = props.actionsLabel ?? 'Actions';
  const width = props.columns.length + (props.rowActions ? 1 : 0);
  const cells = (row: R) =>
    props.columns.map((c, i) => (
      <td key={c.key} className={i === 0 ? 'ui-table__primary' : undefined}>
        {i === 0 ? null : <span className="ui-table__label">{c.header}</span>}
        <span>{c.cell(row)}</span>
      </td>
    ));

  let body: ReactNode;
  if (props.loading) {
    body = <SkeletonRows columns={width} />;
  } else if (rows.length === 0) {
    body = (
      <tr className="ui-table__empty-row">
        <td colSpan={width}>{props.empty}</td>
      </tr>
    );
  } else {
    body = rows.map((row) => (
      <tr key={props.rowKey(row)}>
        {cells(row)}
        {props.rowActions ? (
          <td className="ui-table__actions">
            <span className="ui-table__label visually-hidden">{actionsLabel}</span>
            {props.rowActions(row)}
          </td>
        ) : null}
      </tr>
    ));
  }

  return (
    <div
      className={cx('ui-table-wrap', props.scroll && 'ui-table-wrap--scroll')}
      role="region"
      aria-label={props.caption}
      tabIndex={0}
    >
      {props.loading ? (
        <span role="status" className="visually-hidden">
          {props.loadingLabel ?? `Loading ${props.caption.toLowerCase()}`}
        </span>
      ) : null}
      <table className="ui-table" aria-busy={props.loading || undefined}>
        <caption className="visually-hidden">{props.caption}</caption>
        <thead>
          <tr>
            {props.columns.map((c) => {
              const sorted = sort?.key === c.key ? sort.direction : undefined;
              const SortIcon =
                sorted === 'ascending'
                  ? ArrowUp
                  : sorted === 'descending'
                    ? ArrowDown
                    : ChevronsUpDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={c.sortValue ? (sorted ?? 'none') : undefined}
                >
                  {c.sortValue ? (
                    <button type="button" className="ui-table__sort" onClick={() => toggle(c.key)}>
                      {c.header}
                      <SortIcon size={ICON_SIZE.sm} aria-hidden />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
            {props.rowActions ? (
              <th scope="col" className="ui-table__actions">
                <span className="visually-hidden">{actionsLabel}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}
