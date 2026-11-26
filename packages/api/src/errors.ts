import { ClubDataError } from '@huntclub/club-data';
import type { ApiErrorBody, ClubApiError } from '@huntclub/shared';
import { type FunctionUrlResult, jsonResponse, logLine } from './http';

/** HTTP status for every API error code (exhaustive: adding a code fails the typecheck). */
export const ERROR_STATUS: Record<ClubApiError, number> = {
  not_authenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid: 400,
  conflict: 409,
  last_admin: 409,
  invite_not_found: 404,
  invite_expired: 410,
  invite_used_up: 410,
  club_inactive: 403,
  club_full: 409,
  not_configured: 503,
  internal: 500,
};

export function errorResponse(code: ClubApiError, message: string = code): FunctionUrlResult {
  const body: ApiErrorBody = { error: { code, message } };
  return jsonResponse(ERROR_STATUS[code], body);
}

/** Known errors keep their code; anything else is logged (name only) and becomes 500. */
export function toErrorResponse(error: unknown): FunctionUrlResult {
  if (error instanceof ClubDataError) return errorResponse(error.code, error.message);
  logLine({
    level: 'error',
    msg: 'unhandled',
    error: error instanceof Error ? error.name : 'unknown',
  });
  return errorResponse('internal');
}
