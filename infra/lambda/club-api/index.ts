// Club API (Lambda Function URL). STUB until Milestone 9: it enforces that every request
// carries a bearer token and that the deployment wired its configuration, then answers
// 501. Milestone 9 verifies the Cognito JWT (signature, issuer = the user pool, client id
// in USER_POOL_CLIENT_IDS, token_use = access) before any table access.
import { API_ENV } from '../../config/types';
import { jsonResponse, missingEnv, type FunctionUrlEvent, type FunctionUrlResult } from '../http';

const REQUIRED_ENV = [
  API_ENV.envName,
  API_ENV.tableName,
  API_ENV.userPoolId,
  API_ENV.userPoolClientIds,
];

export const handler = async (event: FunctionUrlEvent): Promise<FunctionUrlResult> => {
  const missing = missingEnv(REQUIRED_ENV);
  if (missing.length > 0) return jsonResponse(500, { error: 'misconfigured', missing });

  const auth = event.headers?.authorization ?? '';
  if (!/^Bearer \S+$/.test(auth)) return jsonResponse(401, { error: 'unauthorized' });

  return jsonResponse(501, { error: 'not_implemented', detail: 'Club API arrives in Milestone 9' });
};
