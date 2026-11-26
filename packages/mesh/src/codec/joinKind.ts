/**
 * Join link kind detection without the codec: no protobuf decode, nothing from
 * @huntclub/shared but its dependency-free limits, and no key handling beyond checking
 * the channel data is present. Published as `@huntclub/mesh/join-kind` so the web and the public
 * site's /join page can tell a club invite from a party link without pulling
 * in the protobuf runtime. decodeJoinUrl (the full parser the app uses) uses
 * the same joinKindOf, so the two can never disagree.
 *
 * The fragment holds the channel key: never log it.
 */
import { CLUB_NAME_MAX } from '@huntclub/shared/limits';
import { ChannelUrlError } from './channelUrlError';
import { parseQuery } from './query';

/** Join link parameter names (query or fragment). */
export const JOIN_PARAMS = {
  channelSet: 'cs',
  party: 'party',
  club: 'club',
  invite: 'invite',
  /** Club invites only, optional: the club's name, for the invite page's heading. */
  clubName: 'name',
} as const;

export type JoinKind = 'club' | 'party';

/** The app's own join link (its URL scheme); the web link carries the same parameters. */
export const JOIN_URL_PREFIX = 'huntclub://join';

/** The kind of join link these parameters describe, or null when incomplete. */
export function joinKindOf(params: ReadonlyMap<string, string>): JoinKind | null {
  if (!params.get(JOIN_PARAMS.channelSet)) return null;
  if (params.get(JOIN_PARAMS.party)) return 'party';
  if (params.get(JOIN_PARAMS.club) && params.get(JOIN_PARAMS.invite)) return 'club';
  return null;
}

/**
 * A club name from a join link as plain, safe display text: control and formatting
 * characters (including bidi overrides) become spaces, runs of space collapse, and the
 * ends are trimmed. Null when nothing is left or it is longer than a club name can be
 * (CLUB_NAME_MAX), so callers fall back to a generic heading. Always show the result as
 * text (textContent), never as HTML.
 */
export function cleanClubName(raw: string | undefined): string | null {
  const text = (raw ?? '')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || [...text].length > CLUB_NAME_MAX) return null;
  return text;
}

/**
 * The club name a web join link's fragment carries, for a complete club invite only.
 * Null for party links, incomplete links, old links without a name, and unusable names.
 */
export function joinClubName(hash: string): string | null {
  let params: Map<string, string>;
  try {
    params = parseQuery(hash.replace(/^#/, ''));
  } catch (error) {
    if (error instanceof ChannelUrlError) return null;
    throw error;
  }
  return joinKindOf(params) === 'club' ? cleanClubName(params.get(JOIN_PARAMS.clubName)) : null;
}

/**
 * Classifies a web join link's fragment (`location.hash`, with or without
 * the leading `#`). Null when it is not a complete, well-encoded join link.
 */
export function classifyJoinFragment(hash: string): { kind: JoinKind } | null {
  let params: Map<string, string>;
  try {
    params = parseQuery(hash.replace(/^#/, ''));
  } catch (error) {
    if (error instanceof ChannelUrlError) return null;
    throw error;
  }
  const kind = joinKindOf(params);
  return kind ? { kind } : null;
}

/**
 * The app link for a web join link's fragment: the same parameters under the app's
 * scheme, which decodeJoinUrl reads the same way. Null when the fragment is not a
 * complete join link. The result holds the channel key: never log or send it.
 */
export function appJoinUrl(hash: string): string | null {
  const fragment = hash.replace(/^#/, '');
  return classifyJoinFragment(fragment) ? `${JOIN_URL_PREFIX}?${fragment}` : null;
}
