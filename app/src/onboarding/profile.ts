import { INITIALS_MAX, MemberJoinSchema } from '@huntclub/shared';

import type { MyProfile } from '../db/appState';

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/** First letter of each word, upper case, e.g. "Jake Smith" → "JS". */
export function suggestInitials(name: string): string {
  const firsts = name
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word).find((ch) => LETTER_OR_DIGIT.test(ch)) ?? '');
  return Array.from(firsts.join('')).slice(0, INITIALS_MAX).join('').toLocaleUpperCase();
}

/** The trimmed profile if it passes the shared member rules, else null. */
export function parseProfile(input: MyProfile): MyProfile | null {
  const result = MemberJoinSchema.safeParse(input);
  return result.success ? result.data : null;
}
