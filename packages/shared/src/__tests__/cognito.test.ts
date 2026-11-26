import { CognitoAuthError, createCognitoAuth } from '../cognito';
import { scriptedFetch } from './fakeFetch';

const NOW = 1_000_000;
const result = { AccessToken: 'access', RefreshToken: 'refresh', ExpiresIn: 3600 };
const auth = (responses: { status: number; body?: unknown }[]) => {
  const f = scriptedFetch(responses);
  return {
    ...f,
    auth: createCognitoAuth({
      region: 'us-east-1',
      clientId: 'app',
      fetch: f.fetch,
      now: () => NOW,
    }),
  };
};
const target = (c: { headers: Record<string, string> }) => c.headers['x-amz-target']?.split('.')[1];

it('signs in an existing user with an emailed code (USER_AUTH, EMAIL_OTP)', async () => {
  const { auth: a, calls } = auth([
    { status: 400, body: { __type: 'UsernameExistsException' } },
    { status: 200, body: { ChallengeName: 'EMAIL_OTP', Session: 's1' } },
    { status: 200, body: { AuthenticationResult: result } },
  ]);
  const challenge = await a.requestCode('max@example.com');
  expect(challenge).toEqual({ kind: 'signIn', email: 'max@example.com', session: 's1' });
  expect(await a.confirmCode(challenge, '123456')).toEqual({
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: NOW + 3_600_000,
  });
  expect(calls.map(target)).toEqual(['SignUp', 'InitiateAuth', 'RespondToAuthChallenge']);
  expect(calls[1]).toMatchObject({
    url: 'https://cognito-idp.us-east-1.amazonaws.com/',
    body: {
      ClientId: 'app',
      AuthFlow: 'USER_AUTH',
      AuthParameters: { USERNAME: 'max@example.com', PREFERRED_CHALLENGE: 'EMAIL_OTP' },
    },
  });
  expect(calls[2]!.body).toMatchObject({
    ChallengeName: 'EMAIL_OTP',
    Session: 's1',
    ChallengeResponses: { EMAIL_OTP_CODE: '123456' },
  });
});

it('signs up a new email, then signs in with the confirmation session', async () => {
  // The pools hide unknown users (PreventUserExistenceErrors), so SignUp goes first.
  const { auth: a, calls } = auth([
    { status: 200, body: { UserSub: 'u1' } },
    { status: 200, body: { Session: 'confirmed' } },
    { status: 200, body: { AuthenticationResult: result } },
  ]);
  const challenge = await a.requestCode('new@example.com');
  expect(challenge).toEqual({ kind: 'signUp', email: 'new@example.com' });
  await a.confirmCode(challenge, '654321');
  expect(calls.map(target)).toEqual(['SignUp', 'ConfirmSignUp', 'InitiateAuth']);
  expect(calls[0]!.body).toMatchObject({
    Username: 'new@example.com',
    UserAttributes: [{ Name: 'email', Value: 'new@example.com' }],
  });
  expect(calls[2]!.body).toMatchObject({ Session: 'confirmed', AuthFlow: 'USER_AUTH' });
});

it('resends the confirmation code to a user who signed up but never confirmed', async () => {
  const { auth: a, calls } = auth([
    { status: 400, body: { __type: 'UsernameExistsException' } },
    { status: 400, body: { __type: 'UserNotConfirmedException' } },
    { status: 200, body: {} },
  ]);
  expect(await a.requestCode('half@example.com')).toEqual({
    kind: 'signUp',
    email: 'half@example.com',
  });
  expect(calls.map(target)).toEqual(['SignUp', 'InitiateAuth', 'ResendConfirmationCode']);
});

it('maps Cognito errors to what the screen says', async () => {
  const { auth: a } = auth([
    { status: 400, body: { __type: 'com.amazonaws#CodeMismatchException' } },
  ]);
  await expect(
    a.confirmCode({ kind: 'signIn', email: 'x@y.z', session: 's' }, '000000'),
  ).rejects.toEqual(new CognitoAuthError('wrong_code', 'CodeMismatchException'));
  await expect(auth([]).auth.requestCode('x@y.z')).rejects.toMatchObject({ code: 'network' });
});

it('refreshes keeping the same refresh token', async () => {
  const { auth: a, calls } = auth([
    { status: 200, body: { AuthenticationResult: { AccessToken: 'new', ExpiresIn: 60 } } },
  ]);
  expect(await a.refresh('refresh')).toEqual({
    accessToken: 'new',
    refreshToken: 'refresh',
    expiresAt: NOW + 60_000,
  });
  expect(calls[0]!.body).toMatchObject({
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    AuthParameters: { REFRESH_TOKEN: 'refresh' },
  });
});
