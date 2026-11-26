/**
 * Channel sharing:
 * - the stock Meshtastic channel URL, `https://meshtastic.org/e/#<base64url(ChannelSet)>`
 *   (`/e/?add=true#...` adds the channels as secondaries instead of replacing);
 * - our `huntclub://join?cs=<base64url(ChannelSet)>&party=<id>` (or `club=` + `invite=`)
 *   deep link, which wraps the same ChannelSet;
 * - a generator for a new free-party channel.
 *
 * Channel keys are secrets: never log a ChannelSet, URL or PSK.
 */
import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { CHANNEL_KEY_BYTES } from '@huntclub/shared';
import { AppOnly, Channel, Config } from '../protobufs';
import type { RandomSource } from '../random';
import { base64UrlDecode, base64UrlEncode } from './base64url';
import { encodeUtf8 } from '../runtime';
import { DEFAULT_HOP_LIMIT } from './radio';

export type ChannelSet = AppOnly.ChannelSet;
export type ChannelSettings = Channel.ChannelSettings;
export type LoRaConfig = Config.Config_LoRaConfig;

export const MESHTASTIC_URL_PREFIX = 'https://meshtastic.org/e/';
export const JOIN_URL_PREFIX = 'huntclub://join';
/** Firmware: channel names must be under 12 bytes. */
export const MAX_CHANNEL_NAME_BYTES = 11;
/** A radio holds up to 8 channels (index 0 = PRIMARY, 1-7 = SECONDARY). */
export const MAX_CHANNELS = 8;
/** PSK lengths firmware accepts: none, 1-byte shorthand, AES-128, AES-256. */
export const VALID_PSK_LENGTHS: readonly number[] = [0, 1, 16, 32];
/** We always generate AES-256 keys (same length as club keys). */
export const PARTY_PSK_BYTES = CHANNEL_KEY_BYTES;
export const PARTY_CHANNEL_NAME = 'Party';
/** Name firmware uses for an unnamed channel on the LongFast preset (channel hash, frequency slot). */
export const DEFAULT_CHANNEL_NAME = 'LongFast';
/** Our hunt channel shares full-precision positions. */
export const HUNT_POSITION_PRECISION = 32;

export function encodeChannelSet(cs: ChannelSet): Uint8Array {
  return toBinary(AppOnly.ChannelSetSchema, cs);
}

export function decodeChannelSet(bytes: Uint8Array): ChannelSet {
  return fromBinary(AppOnly.ChannelSetSchema, bytes);
}

export class ChannelUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChannelUrlError';
  }
}

function decodeChannelSetParam(b64: string): ChannelSet {
  let cs: ChannelSet;
  try {
    cs = decodeChannelSet(base64UrlDecode(b64));
  } catch {
    throw new ChannelUrlError('Channel data is not valid');
  }
  if (cs.settings.length === 0) throw new ChannelUrlError('Channel set has no channels');
  if (cs.settings.length > MAX_CHANNELS) {
    throw new ChannelUrlError(`Channel set has more than ${MAX_CHANNELS} channels`);
  }
  for (const s of cs.settings) {
    if (!VALID_PSK_LENGTHS.includes(s.psk.length))
      throw new ChannelUrlError('Channel key has an invalid length');
  }
  return cs;
}

/** `https://meshtastic.org/e/#...`, base64url without padding (same as the official apps). */
export function encodeChannelSetUrl(cs: ChannelSet, opts: { add?: boolean } = {}): string {
  return `${MESHTASTIC_URL_PREFIX}${opts.add ? '?add=true' : ''}#${base64UrlEncode(encodeChannelSet(cs))}`;
}

/** Parses a Meshtastic channel URL. Accepts padded or unpadded base64/base64url. */
export function decodeChannelSetUrl(url: string): { channelSet: ChannelSet; add: boolean } {
  const trimmed = url.trim();
  const hash = trimmed.indexOf('#');
  if (hash < 0) throw new ChannelUrlError('Not a Meshtastic channel link');
  const base = trimmed.slice(0, hash).replace(/^http:\/\//i, 'https://');
  if (!base.toLowerCase().startsWith(MESHTASTIC_URL_PREFIX)) {
    throw new ChannelUrlError('Not a Meshtastic channel link');
  }
  const query = base.slice(MESHTASTIC_URL_PREFIX.length).replace(/^\?/, '');
  const add = parseQuery(query).get('add') === 'true';
  return { channelSet: decodeChannelSetParam(trimmed.slice(hash + 1)), add };
}

/** What a Hunt Club join QR code carries besides the channels. */
export type JoinTarget =
  { kind: 'party'; partyId: string } | { kind: 'club'; clubId: string; inviteToken: string };

export interface JoinLink {
  channelSet: ChannelSet;
  target: JoinTarget;
}

/**
 * Hosts that serve the web join page (and, later, the iOS/Android universal
 * link) at JOIN_WEB_PATH. First entry is the default for new links.
 * TODO(backlog): the production host is not decided yet. Add it here (as
 * the first entry) once chosen; until then QR codes default to the app
 * form, and the web form only works on the dev domain.
 */
export const JOIN_WEB_HOSTS: readonly string[] = ['huntclub-dev.jaycobjones.com'];
export const JOIN_WEB_PATH = '/join';

/**
 * - `app`: `huntclub://join?cs=…&party=…` (opens the app directly).
 * - `web`: `https://<host>/join#cs=…&party=…` (works in any camera app; the
 *   web page hands over to the app or the store). The parameters go in the
 *   URL fragment, which browsers never send to the server, so the channel
 *   key stays out of server and CDN logs.
 */
export type JoinLinkForm = 'app' | 'web';

/**
 * Builds the join link a QR code carries. The single builder for the app
 * and the web admin. The link contains the channel key: never log it.
 */
export function encodeJoinUrl(
  link: JoinLink,
  opts: { form?: JoinLinkForm; host?: string } = {},
): string {
  const params: [string, string][] = [['cs', base64UrlEncode(encodeChannelSet(link.channelSet))]];
  if (link.target.kind === 'party') {
    if (!link.target.partyId) throw new ChannelUrlError('Party id is required');
    params.push(['party', link.target.partyId]);
  } else {
    if (!link.target.clubId || !link.target.inviteToken)
      throw new ChannelUrlError('Club id and invite are required');
    params.push(['club', link.target.clubId], ['invite', link.target.inviteToken]);
  }
  const encoded = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  if ((opts.form ?? 'app') === 'app') return `${JOIN_URL_PREFIX}?${encoded}`;
  const host = (opts.host ?? JOIN_WEB_HOSTS[0]!).toLowerCase();
  if (!JOIN_WEB_HOSTS.includes(host)) throw new ChannelUrlError('Unknown join link host');
  return `https://${host}${JOIN_WEB_PATH}#${encoded}`;
}

/**
 * Parses a join link in either form (app scheme or https web link), with
 * the parameters in the query or the fragment. The single parser for the
 * app, the web page and tests.
 */
export function decodeJoinUrl(url: string): JoinLink {
  const trimmed = url.trim();
  const hashAt = trimmed.indexOf('#');
  const beforeHash = hashAt < 0 ? trimmed : trimmed.slice(0, hashAt);
  const fragment = hashAt < 0 ? '' : trimmed.slice(hashAt + 1);
  const q = beforeHash.indexOf('?');
  const base = (q < 0 ? beforeHash : beforeHash.slice(0, q)).replace(/\/+$/, '');
  const query = q < 0 ? '' : beforeHash.slice(q + 1);
  if (!isJoinBase(base)) throw new ChannelUrlError('Not a Hunt Club join link');

  const params = parseQuery(query);
  for (const [k, v] of parseQuery(fragment)) params.set(k, v);
  const cs = params.get('cs');
  if (!cs) throw new ChannelUrlError('Join link has no channel data');
  const channelSet = decodeChannelSetParam(cs);
  const party = params.get('party');
  const club = params.get('club');
  const invite = params.get('invite');
  if (party) return { channelSet, target: { kind: 'party', partyId: party } };
  if (club && invite)
    return { channelSet, target: { kind: 'club', clubId: club, inviteToken: invite } };
  throw new ChannelUrlError('Join link has no party or club');
}

function isJoinBase(base: string): boolean {
  const lower = base.toLowerCase();
  if (lower === JOIN_URL_PREFIX) return true;
  const m = /^https:\/\/([^/:?#]+)(\/.*)?$/.exec(lower);
  return !!m && JOIN_WEB_HOSTS.includes(m[1]!) && (m[2] ?? '') === JOIN_WEB_PATH;
}

/** Tiny query parser (React Native's URL/URLSearchParams support is incomplete). */
function parseQuery(query: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of query.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const k = eq < 0 ? part : part.slice(0, eq);
    const v = eq < 0 ? '' : part.slice(eq + 1);
    try {
      out.set(decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, ' ')));
    } catch {
      throw new ChannelUrlError('Link is not correctly encoded');
    }
  }
  return out;
}

export interface PartyChannelOptions {
  random: RandomSource;
  /** Shown only in Advanced settings / other Meshtastic apps. Under 12 bytes. */
  name?: string;
  region?: Config.Config_LoRaConfig_RegionCode;
  modemPreset?: Config.Config_LoRaConfig_ModemPreset;
}

/**
 * A new free-party primary channel: random 256-bit key, US region, LongFast,
 * hop limit 3 and full-precision positions on this channel.
 */
export function generatePartyChannelSet(opts: PartyChannelOptions): ChannelSet {
  const name = opts.name ?? PARTY_CHANNEL_NAME;
  if (encodeUtf8(name).length > MAX_CHANNEL_NAME_BYTES) {
    throw new ChannelUrlError(`Channel name must be at most ${MAX_CHANNEL_NAME_BYTES} bytes`);
  }
  const psk = opts.random(PARTY_PSK_BYTES);
  if (psk.length !== PARTY_PSK_BYTES)
    throw new Error('Random source returned the wrong number of bytes');
  return create(AppOnly.ChannelSetSchema, {
    settings: [
      {
        psk,
        name,
        moduleSettings: { positionPrecision: HUNT_POSITION_PRECISION },
      },
    ],
    loraConfig: defaultLoRaConfig(opts.region, opts.modemPreset),
  });
}

export function defaultLoRaConfig(
  region: Config.Config_LoRaConfig_RegionCode = Config.Config_LoRaConfig_RegionCode.US,
  modemPreset: Config.Config_LoRaConfig_ModemPreset = Config.Config_LoRaConfig_ModemPreset
    .LONG_FAST,
): LoRaConfig {
  return create(Config.Config_LoRaConfigSchema, {
    usePreset: true,
    modemPreset,
    region,
    hopLimit: DEFAULT_HOP_LIMIT,
    txEnabled: true,
    txPower: 0,
    channelNum: 0,
  });
}

/**
 * The 1-byte channel hash in the packet header: xor of the name bytes xor
 * xor of the expanded key bytes. An empty name means the preset name.
 */
export function channelHash(
  settings: Pick<ChannelSettings, 'name' | 'psk'>,
  presetName = DEFAULT_CHANNEL_NAME,
): number {
  const name = settings.name || presetName;
  let h = 0;
  for (const b of encodeUtf8(name)) h ^= b;
  for (const b of expandPsk(settings.psk)) h ^= b;
  return h & 0xff;
}

const DEFAULT_PSK = Uint8Array.from([
  0xd4, 0xf1, 0xbb, 0x3a, 0x20, 0x29, 0x07, 0x59, 0xf0, 0xbc, 0xff, 0xab, 0xcf, 0x4e, 0x69, 0x01,
]);

/** Expands the 1-byte PSK shorthand the way firmware does. */
export function expandPsk(psk: Uint8Array): Uint8Array {
  if (psk.length !== 1) return psk;
  const n = psk[0]!;
  if (n === 0) return new Uint8Array(0);
  const out = DEFAULT_PSK.slice();
  out[15] = (out[15]! + n - 1) & 0xff;
  return out;
}
