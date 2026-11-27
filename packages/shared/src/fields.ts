// Field-level validation rules reused by the entity schemas in club.ts.
// Each limit is defined once here; the schemas only compose them.
import { z } from 'zod';

/** Largest unsigned 32-bit integer: Meshtastic node numbers and stand/area mesh ids. */
export const UINT32_MAX = 0xffff_ffff;

/** Club and party channel keys are AES-256 Meshtastic PSKs. */
export const CHANNEL_KEY_BYTES = 32;

/** Invite tokens: 256 random bits as lowercase hex (carried in the Club QR code). */
export const INVITE_TOKEN_BYTES = 32;

export const NOTES_MAX = 500;
/** Harvest species, e.g. "Deer" (app form, club data). */
export const SPECIES_MAX = 40;

export const idSchema = z.uuid();
/**
 * A Cognito user's `sub`: 8-4-4-4-12 hex. Not `z.uuid()`, which also requires the RFC 9562
 * variant bits; Cognito subs don't always have them (e.g. `…-fdfc-…`).
 */
export const userIdSchema = z.guid();
export const timestampSchema = z.iso.datetime();

/** Text that must have 1..max characters after trimming (stored trimmed). */
export const trimmedText = (max: number) => z.string().trim().min(1).max(max);

export const notesSchema = z.string().max(NOTES_MAX);
export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);
export const uint32Schema = z.number().int().min(0).max(UINT32_MAX);
/** Stand and area radio ids: assigned by the server, from 1, never reused. */
export const meshIdSchema = z.number().int().min(1).max(UINT32_MAX);

/** A GeoJSON Polygon or MultiPolygon (property lines, areas). */
export const polygonSchema = z.looseObject({
  type: z.enum(['Polygon', 'MultiPolygon']),
  coordinates: z.array(z.unknown()),
});
export type Polygon = z.infer<typeof polygonSchema>;

/** Initials shown on map markers, e.g. "JK". */
export const INITIALS_MAX = 3;
export const initialsSchema = z
  .string()
  .regex(new RegExp(`^[\\p{L}\\p{N}]{1,${INITIALS_MAX}}$`, 'u'));

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * First letter or digit of each word, upper case, at most INITIALS_MAX: "Jake Smith" → "JS".
 * The app suggests these for a new profile; the web admin draws them in avatars.
 */
export function suggestInitials(name: string): string {
  const firsts = name
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word).find((ch) => LETTER_OR_DIGIT.test(ch)) ?? '');
  return Array.from(firsts.join('')).slice(0, INITIALS_MAX).join('').toLocaleUpperCase();
}

/**
 * Initials for a name or an email: an email's local part with its dots, dashes and pluses read
 * as word breaks ("jane.doe@x" → "JD"). Only the initials split it; a name stays as typed.
 */
export const initialsFor = (nameOrEmail: string): string =>
  suggestInitials((nameOrEmail.split('@')[0] ?? '').replace(/[._+-]+/g, ' '));

/** A member's display name, e.g. "Jake Smith". */
export const DISPLAY_NAME_MAX = 40;
/** Meshtastic LoRa region code, e.g. 'US'. */
export const regionSchema = z.string().regex(/^[A-Z0-9_]{2,12}$/);
export const planIdSchema = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/);
export const stripeEventIdSchema = z.string().regex(/^evt_[A-Za-z0-9_]+$/);
export const inviteTokenSchema = z
  .string()
  .regex(new RegExp(`^[0-9a-f]{${INVITE_TOKEN_BYTES * 2}}$`));
export const channelKeySchema = z
  .instanceof(Uint8Array)
  .refine((key) => key.length === CHANNEL_KEY_BYTES, {
    message: `channel key must be ${CHANNEL_KEY_BYTES} bytes`,
  });

/** Both coordinates or neither (refinement for objects with optional lat/lon). */
export function hasLatLonPair(value: { lat?: number | undefined; lon?: number | undefined }) {
  return (value.lat === undefined) === (value.lon === undefined);
}
export const LAT_LON_PAIR_MESSAGE = 'lat and lon must be given together';

/**
 * A quick check before asking for a sign-in code: something@something.something, no
 * spaces. Cognito makes the real decision; this only catches typos early.
 */
export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
