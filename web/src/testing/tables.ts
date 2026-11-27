// Reads a DataTable the way a person reads it: the body rows' values, without the labels the
// table repeats in each cell for phones.
import { within } from '@testing-library/react';

/** Each body row's cell values. */
export function tableRows(table: HTMLElement): (string | null)[][] {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [...row.querySelectorAll('td')].map((td) => (td.lastElementChild ?? td).textContent),
    );
}
