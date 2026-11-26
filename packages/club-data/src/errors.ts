import type { ClubApiError } from '@huntclub/shared';

/**
 * The only error type club-data throws on purpose. `code` is one of CLUB_API_ERRORS
 * from @huntclub/shared; the Lambda API maps it to an HTTP status. Messages never
 * contain channel keys, invite tokens or free-text fields.
 */
export class ClubDataError extends Error {
  constructor(
    readonly code: ClubApiError,
    message: string = code,
  ) {
    super(message);
    this.name = 'ClubDataError';
  }
}

export const isClubDataError = (error: unknown, code?: ClubApiError): error is ClubDataError =>
  error instanceof ClubDataError && (code === undefined || error.code === code);
