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
export function DataTable<R>(
  props: {
    columns: readonly Column<R>[];
    rows: readonly R[];
    rowKey: (row: R) => string;
    stack?: boolean;
  } & (
    | { caption: string; labelledBy?: never }
    /** The id of a visible heading that names the table (no hidden caption then). */
    | { labelledBy: string; caption?: never }
  ),
) {
  const named = props.caption
    ? { 'aria-label': props.caption }
    : { 'aria-labelledby': props.labelledBy };
  return (
    <div className="table-scroll" role="region" {...named} tabIndex={0}>
      <table className={props.stack ? 'stack' : undefined} {...(props.labelledBy ? named : {})}>
        {props.caption ? <caption className="visually-hidden">{props.caption}</caption> : null}
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
