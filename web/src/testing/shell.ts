// Test helpers for the signed-in shell, shared by the page and session tests.
import { fireEvent, screen, within } from '@testing-library/react';
import { ACCOUNT_LABEL } from '../shell/Account';

/** The account button (its name is "Account" and the email). */
export const accountButton = () =>
  screen.findByRole('button', { name: new RegExp(`^${ACCOUNT_LABEL}`) });

/** Opens the account menu and returns it. */
export async function openAccountMenu() {
  fireEvent.click(await accountButton());
  return screen.getByRole('group', { name: ACCOUNT_LABEL });
}

/** Signs out the only way there is: the account menu. */
export async function signOutFromMenu() {
  fireEvent.click(within(await openAccountMenu()).getByRole('button', { name: 'Sign out' }));
}
