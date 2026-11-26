// Length limits that light code outside the schemas needs too (the public site's /join
// script reads the club name from an invite link). No dependencies, so any bundle can import it.

/** Longest club name, in characters (the club schema and the invite link's club name). */
export const CLUB_NAME_MAX = 80;
