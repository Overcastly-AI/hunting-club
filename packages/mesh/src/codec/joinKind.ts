/**
 * Join link kind detection without the codec: no protobuf decode, no
 * @huntclub/shared, and no key handling beyond checking the channel data is
 * present. Published as `@huntclub/mesh/join-kind` so the web and the public
 * site's /join page can tell a club invite from a party link without pulling
 * in the protobuf runtime. decodeJoinUrl (the full parser the app uses) uses
 * the same joinKindOf, so the two can never disagree.
 *
 * The fragment holds the channel key: never log it.
 */
import { ChannelUrlError } from './channelUrlError';
import { parseQuery } from './query';

/** Join link parameter names (query or fragment). */
export const JOIN_PARAMS = {
  channelSet: 'cs',
  party: 'party',
  club: 'club',
  invite: 'invite',
} as const;

export type JoinKind = 'club' | 'party';

/** The kind of join link these parameters describe, or null when incomplete. */
export function joinKindOf(params: ReadonlyMap<string, string>): JoinKind | null {
  if (!params.get(JOIN_PARAMS.channelSet)) return null;
  if (params.get(JOIN_PARAMS.party)) return 'party';
  if (params.get(JOIN_PARAMS.club) && params.get(JOIN_PARAMS.invite)) return 'club';
  return null;
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
