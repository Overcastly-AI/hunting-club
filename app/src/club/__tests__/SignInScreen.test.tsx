// The app's email-code sign-in: the expected code length comes from the challenge kind.
import {
  type CodeChallenge,
  emailCodeRules,
  EMAIL_OTP_CODE_LENGTH,
  SIGN_UP_CODE_LENGTH,
  signInCopy,
} from '@huntclub/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { migrate } from '../../db/migrate';
import { migrations } from '../../db/migrations';
import { createTestDatabase } from '../../test-utils/nodeSqlite';
import { fakeClubApi, fakeSession, memorySecureStorage } from '../../test-utils/fakeClubApi';
import { ProfileProvider } from '../../profile/ProfileProvider';
import { ClubStateProvider } from '../ClubProvider';
import { SignInScreen } from '../SignInScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn() }));

async function signInWith(challenge: CodeChallenge) {
  const db = createTestDatabase();
  await migrate(db, migrations);
  const session = fakeSession(false);
  jest.mocked(session.requestCode).mockResolvedValue(challenge);
  const onDone = jest.fn();
  await render(
    <ProfileProvider db={db}>
      <ClubStateProvider
        db={db}
        services={{ session, api: fakeClubApi(), secrets: memorySecureStorage() }}
      >
        <SignInScreen onDone={onDone} />
      </ClubStateProvider>
    </ProfileProvider>,
  );
  await fireEvent.changeText(screen.getByPlaceholderText(signInCopy.email), challenge.email);
  await fireEvent.press(screen.getByRole('button', { name: signInCopy.sendCode }));
  await waitFor(() => expect(session.requestCode).toHaveBeenCalled());
  const field = await screen.findByPlaceholderText(signInCopy.code);
  return { session, onDone, field };
}

describe.each([
  [{ kind: 'signUp', email: 'new@example.com' } as const, SIGN_UP_CODE_LENGTH, '24 hours'],
  [
    { kind: 'signIn', email: 'dale@example.com', session: 's' } as const,
    EMAIL_OTP_CODE_LENGTH,
    '3 minutes',
  ],
])('a %s code', (challenge, length, validFor) => {
  it(`expects ${length} digits, says how long it works, and keeps a long paste whole`, async () => {
    expect(emailCodeRules(challenge.kind)).toEqual({ length, validFor });
    const { session, onDone, field } = await signInWith(challenge);
    expect(screen.getByText(signInCopy.codeHelp(challenge.kind))).toBeTruthy();

    // A paste with spaces and one digit too many: kept whole, then refused on submit.
    const tooLong = '1'.repeat(length + 1);
    await fireEvent.changeText(field, ` ${tooLong.slice(0, 3)} ${tooLong.slice(3)} `);
    expect(field.props.value).toBe(tooLong);
    await fireEvent.press(screen.getByRole('button', { name: signInCopy.confirm }));
    expect(screen.getByText(signInCopy.codeIncomplete(challenge.kind))).toBeTruthy();
    expect(session.confirmCode).not.toHaveBeenCalled();

    const exact = '2'.repeat(length);
    await fireEvent.changeText(field, exact);
    await fireEvent.press(screen.getByRole('button', { name: signInCopy.confirm }));
    await waitFor(() => expect(session.confirmCode).toHaveBeenCalledWith(challenge, exact));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
