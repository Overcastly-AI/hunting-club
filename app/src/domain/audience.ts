/** Who hears your check-ins, Ask for a Hand and overdue alerts: your free party or your club. */
export const AUDIENCES = ['party', 'club'] as const;
export type Audience = (typeof AUDIENCES)[number];

/** Ask for a Hand's reach. Never worded or styled like an emergency call. */
export const HELP_AUDIENCE_TEXT: Record<Audience, string> = {
  party: 'Pings your party',
  club: 'Pings club members',
};

/** Who gets an overdue alert, as the start of a sentence's predicate. */
export const OVERDUE_ALERT_TEXT: Record<Audience, string> = {
  party: 'your party gets an overdue alert',
  club: 'club members get an overdue alert',
};
