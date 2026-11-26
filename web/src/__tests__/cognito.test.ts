import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { cognitoAuthClient } from '../auth/cognito';
import { AuthError, type AuthErrorCode } from '../auth/types';

const auth = () => cognitoAuthClient({ region: 'us-east-1', clientId: 'client123' });
const send = () => vi.spyOn(CognitoIdentityProviderClient.prototype, 'send');

afterEach(() => vi.restoreAllMocks());

describe('Cognito passwordless sign-in', () => {
  it('asks for an email code with USER_AUTH and answers the EMAIL_OTP challenge', async () => {
    const spy = send()
      .mockResolvedValueOnce({ ChallengeName: 'EMAIL_OTP', Session: 'sess' } as never)
      .mockResolvedValueOnce({ AuthenticationResult: { AccessToken: 'tok' } } as never);

    const challenge = await auth().requestCode('dale@example.com');
    const user = await auth().verifyCode(challenge, '123456');

    const [first, second] = spy.mock.calls.map((c) => c[0]);
    expect(first).toBeInstanceOf(InitiateAuthCommand);
    expect(first!.input).toEqual({
      ClientId: 'client123',
      AuthFlow: 'USER_AUTH',
      AuthParameters: { USERNAME: 'dale@example.com', PREFERRED_CHALLENGE: 'EMAIL_OTP' },
    });
    expect(second).toBeInstanceOf(RespondToAuthChallengeCommand);
    expect(second!.input).toEqual({
      ClientId: 'client123',
      ChallengeName: 'EMAIL_OTP',
      Session: 'sess',
      ChallengeResponses: { USERNAME: 'dale@example.com', EMAIL_OTP_CODE: '123456' },
    });
    expect(user).toEqual({ email: 'dale@example.com', accessToken: 'tok' });
  });

  it.each<[string, AuthErrorCode]>([
    ['CodeMismatchException', 'wrong_code'],
    ['ExpiredCodeException', 'wrong_code'],
    ['UserNotFoundException', 'unknown_user'],
    ['TooManyRequestsException', 'too_many_attempts'],
    ['InternalErrorException', 'unavailable'],
  ])('maps %s to %s', async (name, code) => {
    send().mockRejectedValueOnce(Object.assign(new Error(name), { name }));
    await expect(auth().verifyCode({ email: 'a@b.c', session: 's' }, '000000')).rejects.toEqual(
      new AuthError(code),
    );
  });

  it('treats a missing EMAIL_OTP challenge as unavailable', async () => {
    send().mockResolvedValueOnce({ ChallengeName: 'PASSWORD' } as never);
    await expect(auth().requestCode('a@b.c')).rejects.toEqual(new AuthError('unavailable'));
  });
});
