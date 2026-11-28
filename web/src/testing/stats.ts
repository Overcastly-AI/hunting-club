// Reads a StatGrid (a list named by its aria-label) the way a person reads it, so a test
// asserts a readout inside its own strip, never a word that the shell may also show.
import { screen, within } from '@testing-library/react';

/** The named stat strip, once it shows. */
export const statGrid = (name: string) => screen.findByRole('list', { name });

/** The named stat strip's cells as "Label value" (and hint), once it shows. */
export async function statCells(name: string) {
  return within(await statGrid(name))
    .getAllByRole('listitem')
    .map((li) => li.textContent);
}
