// Test helpers for signing in and the signed-in shell, shared by the page and session tests.
import { signInCopy, type CodeChallenge } from '@huntclub/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { ACCOUNT_LABEL } from '../shell/Account';
import { testCode } from './fakeClubApi';

/** Asks for a sign-in code on the sign-in screen; resolves to the code field. */
export async function requestCode(kind: CodeChallenge['kind'] = 'signIn') {
  fireEvent.change(await screen.findByLabelText(signInCopy.email), {
    target: { value: 'dale@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: signInCopy.sendCode }));
  return screen.findByLabelText(signInCopy.code(kind));
}

/** Signs in with the emailed code (it goes when its last digit lands); resolves once the admin shows. */
export async function signIn() {
  fireEvent.change(await requestCode(), { target: { value: testCode() } });
  await screen.findByRole('navigation', { name: 'Club admin' });
}

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
