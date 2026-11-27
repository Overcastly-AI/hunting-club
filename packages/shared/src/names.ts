// A member's name and initials: the one set of rules for the app (onboarding, the name prompt,
// club join), the web admin and the club API. Every name also travels to the radio as its
// Meshtastic owner, so the rules keep it within the radio's limits.
import { z } from 'zod';

/**
 * Radio name limits in UTF-8 bytes, from the Meshtastic protobufs: User.long_name max_size 40
 * and short_name max_size 5, both counting the terminating NUL. @huntclub/mesh writes the owner
 * with these (OWNER_WIRE_LIMITS); they live here, below mesh, so the member rules can hold
 * every name within them.
 */
export const RADIO_NAME_BYTES = { long: 39, short: 4 } as const;

/** UTF-8 length of `text` in bytes (no TextEncoder needed, so any bundle can use it). */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** The longest prefix of `text` (whole characters) that fits in `maxBytes` of UTF-8. */
export function fitUtf8(text: string, maxBytes: number): string {
  let out = '';
  let bytes = 0;
  for (const ch of text) {
    bytes += utf8Length(ch);
    if (bytes > maxBytes) break;
    out += ch;
  }
  return out;
}

// Display name ------------------------------------------------------------------------

/** Longest display name in characters (a plain-letter name is one byte a character). */
export const DISPLAY_NAME_MAX = RADIO_NAME_BYTES.long;

/** What the name is for, said the same way wherever it is asked for. */
export const DISPLAY_NAME_PURPOSE =
  'Other hunters see this name on the map and in chat, with your initials on your marker.';

/** Trimmed, with any run of spaces, tabs or line breaks read as one space. */
export const normalizeDisplayName = (text: string): string => text.trim().replace(/\s+/gu, ' ');

/** Letters (any language, with their accents), numbers, spaces, periods, apostrophes, hyphens. */
const DISPLAY_NAME_CHARS = /^[\p{L}\p{M}\p{N} .'’-]+$/u;
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export type DisplayNameProblem = 'empty' | 'tooLong' | 'characters';

/** What to tell someone whose name breaks a rule. */
export const DISPLAY_NAME_PROBLEMS: Record<DisplayNameProblem, string> = {
  empty: 'Enter your name.',
  tooLong: 'Use a shorter name so it fits on the radio.',
  characters: 'Use letters, numbers, spaces, periods, apostrophes and hyphens.',
};

/** Why `text` (normalized first) can't be a display name, or null when it can. */
export function displayNameProblem(text: string): DisplayNameProblem | null {
  const name = normalizeDisplayName(text);
  if (!HAS_LETTER_OR_DIGIT.test(name)) return name ? 'characters' : 'empty';
  if (!DISPLAY_NAME_CHARS.test(name)) return 'characters';
  if (name.length > DISPLAY_NAME_MAX || utf8Length(name) > RADIO_NAME_BYTES.long) return 'tooLong';
  return null;
}

/** A display name someone enters: normalized, then held to every rule above. */
export const displayNameSchema = z
  .string()
  .transform(normalizeDisplayName)
  .superRefine((name, ctx) => {
    const problem = displayNameProblem(name);
    if (problem) ctx.addIssue({ code: 'custom', message: DISPLAY_NAME_PROBLEMS[problem] });
  });

/**
 * A display name as stored. Read leniently, so a name saved before the rules above (for
 * example a seeded email local part) still loads; every write goes through displayNameSchema.
 */
export const storedDisplayNameSchema = z.string().trim().min(1);

/**
 * The stand-in name a dev seed gives an account from its email ("jane.doe@x" → "jane.doe"),
 * as typed: never split and title-cased, which would invent a name the person never gave.
 * Empty when the local part isn't a valid display name.
 */
export function emailStandInName(email: string): string {
  const local = normalizeDisplayName(email.split('@')[0] ?? '');
  return displayNameProblem(local) ? '' : local;
}

/** Whether `displayName` is only the stand-in from `email`, not a name the person chose. */
export function isEmailStandInName(displayName: string, email: string | undefined): boolean {
  if (!email) return false;
  const standIn = emailStandInName(email);
  return (
    standIn !== '' && normalizeDisplayName(displayName).toLowerCase() === standIn.toLowerCase()
  );
}

// Initials --------------------------------------------------------------------------------

/** Initials shown on map markers, e.g. "JK". */
export const INITIALS_MAX = 3;
export const initialsSchema = z
  .string()
  .regex(new RegExp(`^[\\p{L}\\p{N}]{1,${INITIALS_MAX}}$`, 'u'))
  .refine((initials) => utf8Length(initials) <= RADIO_NAME_BYTES.short, {
    message: 'initials must fit the radio short name',
  });

/** The initials rule in words (under the field, and as its error). */
export const INITIALS_HINT = `Up to ${INITIALS_MAX} letters or numbers, shown on the map`;
export const INITIALS_PROBLEM = `Enter your initials: up to ${INITIALS_MAX} letters or numbers.`;

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * First letter or digit of each word, upper case, at most INITIALS_MAX, cut to fit the radio:
 * "Jake Smith" → "JS". The app suggests these for a new profile; the web admin draws them in
 * avatars.
 */
export function suggestInitials(name: string): string {
  const firsts = name
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word).find((ch) => LETTER_OR_DIGIT.test(ch)) ?? '');
  const initials = Array.from(firsts.join('')).slice(0, INITIALS_MAX).join('');
  return fitUtf8(initials.toLocaleUpperCase(), RADIO_NAME_BYTES.short);
}

/**
 * Initials for a name or an email: an email's local part with its dots, dashes and pluses read
 * as word breaks ("jane.doe@x" → "JD"). Only the initials split it; a name stays as typed.
 */
export const initialsFor = (nameOrEmail: string): string =>
  suggestInitials((nameOrEmail.split('@')[0] ?? '').replace(/[._+-]+/g, ' '));
