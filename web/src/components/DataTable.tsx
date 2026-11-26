import type { ReactNode } from 'react';

export interface Column<R> {
  readonly label: string;
  readonly cell: (row: R) => ReactNode;
}

/**
 * Every table on the admin pages. It scrolls sideways in its own focusable region
 * instead of widening the page, and carries a caption for screen readers. With `stack`,
 * rows become labelled cards on narrow screens (≤600px; see `table.stack` in the theme).
 */
export function DataTable<R>(props: {
  caption: string;
  columns: readonly Column<R>[];
  rows: readonly R[];
  rowKey: (row: R) => string;
  stack?: boolean;
}) {
  return (
    <div className="table-scroll" role="region" aria-label={props.caption} tabIndex={0}>
      <table className={props.stack ? 'stack' : undefined}>
        <caption className="visually-hidden">{props.caption}</caption>
        <thead>
          <tr>
            {props.columns.map((c) => (
              <th key={c.label} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={props.rowKey(row)}>
              {props.columns.map((c) => (
                <td key={c.label} data-label={c.label}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
