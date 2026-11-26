// The app's email-code sign-in: the expected code length comes from the challenge kind,
// and a new code can be sent after RESEND_CODE_COOLDOWN_SECONDS.
import {
  type CodeChallenge,
  emailCodeRules,
  EMAIL_OTP_CODE_LENGTH,
  RESEND_CODE_COOLDOWN_SECONDS,
  SIGN_UP_CODE_LENGTH,
  signInCopy,
} from '@huntclub/shared';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import { sizes } from '../../theme';
import { clubWrapper } from '../../test-utils/clubFixture';
import { fakeClubApi, fakeSession, memorySecureStorage } from '../../test-utils/fakeClubApi';
import { SignInScreen } from '../SignInScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn() }));

async function signInWith(challenge: CodeChallenge) {
  const session = fakeSession(false);
  jest.mocked(session.requestCode).mockResolvedValue(challenge);
  const onDone = jest.fn();
  const { wrap } = await clubWrapper({
    session,
    api: fakeClubApi(),
    secrets: memorySecureStorage(),
  });
  await render(wrap(<SignInScreen onDone={onDone} />));
  await fireEvent.changeText(screen.getByLabelText(signInCopy.email), challenge.email);
  await fireEvent.press(screen.getByRole('button', { name: signInCopy.sendCode }));
  await waitFor(() => expect(session.requestCode).toHaveBeenCalled());
  const field = await screen.findByLabelText(signInCopy.code);
  return { session, onDone, field };
}

describe.each([
  [{ kind: 'signUp', email: 'new@example.com' } as const, SIGN_UP_CODE_LENGTH, '24 hours'],
  [
    { kind: 'signIn', email: 'dale@example.com', session: 's' } as const,
    EMAIL_OTP_CODE_LENGTH,
    '10 minutes',
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

describe('Send a new code', () => {
  const challenge = { kind: 'signIn', email: 'dale@example.com', session: 's' } as const;
  const announced = () =>
    jest
      .mocked(AccessibilityInfo.announceForAccessibility)
      .mock.calls.map(([message]) => message)
      .filter((m) => m === signInCopy.resend || m.startsWith('Send again'));
  const tick = (seconds: number) => act(() => jest.advanceTimersByTime(seconds * 1000));

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('waits the shared cooldown, counting down on a 48 px tertiary button', async () => {
    expect(RESEND_CODE_COOLDOWN_SECONDS).toBe(30);
    await signInWith(challenge);

    const waitingButton = screen.getByRole('button', { name: signInCopy.resendIn(30) });
    expect(waitingButton).toBeDisabled();
    const style = StyleSheet.flatten(waitingButton.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(sizes.minTapTarget);
    expect(style.backgroundColor).toBe('transparent');

    await tick(6);
    expect(screen.getByRole('button', { name: signInCopy.resendIn(24) })).toBeDisabled();

    await tick(RESEND_CODE_COOLDOWN_SECONDS - 6);
    expect(screen.getByRole('button', { name: signInCopy.resend })).toBeEnabled();
    expect(screen.queryByText(/Send again in/)).toBeNull();
  });

  it('announces the wait when it starts and ends, not every second', async () => {
    await signInWith(challenge);
    expect(announced()).toEqual([signInCopy.resendIn(RESEND_CODE_COOLDOWN_SECONDS)]);
    await tick(RESEND_CODE_COOLDOWN_SECONDS - 1);
    expect(announced()).toHaveLength(1);
    await tick(1);
    expect(announced()).toEqual([
      signInCopy.resendIn(RESEND_CODE_COOLDOWN_SECONDS),
      signInCopy.resend,
    ]);
  });

  it('sends a new code to the same address, says so, clears the field and waits again', async () => {
    const { session, field } = await signInWith(challenge);
    await fireEvent.changeText(field, '1234');
    await tick(RESEND_CODE_COOLDOWN_SECONDS);

    await fireEvent.press(screen.getByRole('button', { name: signInCopy.resend }));
    await waitFor(() => expect(session.requestCode).toHaveBeenCalledTimes(2));
    expect(session.requestCode).toHaveBeenLastCalledWith(challenge.email);
    expect(await screen.findByText(signInCopy.resent)).toBeTruthy();
    expect(screen.getByLabelText(signInCopy.code).props.value).toBe('');
    expect(screen.getByRole('button', { name: signInCopy.resendIn(30) })).toBeDisabled();
  });
});
