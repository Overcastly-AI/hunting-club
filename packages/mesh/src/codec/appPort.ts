/**
 * Hunt Club app messages on Meshtastic private port 314.
 *
 * Wire layout (all payloads ≤ 200 bytes, most far smaller):
 *
 *   byte 0   protocol version (APP_PROTOCOL_VERSION)
 *   byte 1   message type (AppMessageType)
 *   byte 2+  protobuf wire-format fields (table below)
 *
 * The body is plain protobuf wire format written by hand, so receivers skip
 * fields they don't know (forward compatible) without a .proto build step.
 *
 *   field  wire      meaning
 *   1      fixed32   message id (random, de-duplication key with sender)
 *   2      fixed32   sender node id
 *   3      varint    timestamp, unix seconds (omitted when 0/unknown)
 *   4      varint    check-in mode (CheckInMode)
 *   5      varint    stand id (club's short numeric stand id)
 *   6      varint    area id (club's short numeric area id)
 *   7      sfixed32  pin latitude,  1e-7 degrees
 *   8      sfixed32  pin longitude, 1e-7 degrees
 *   9      fixed32   referenced message id (Receipt: message being
 *                    acknowledged; CheckOut/OverdueAlert: the check-in)
 *   10     fixed32   subject node id (OverdueAlert: who is overdue)
 *   11     varint    version number (StandListVersion)
 *   12     string    short note (HelpRequest, HarvestShare)
 *   13     string    species (HarvestShare)
 *   14     varint    sex (HarvestSex)
 *
 * No message body, key or note is ever logged by this package.
 */
import { BinaryReader, BinaryWriter, WireType } from '@bufbuild/protobuf/wire';
import { encodeUtf8 } from '../runtime';

export const HUNTCLUB_PORT = 314;
export const APP_PROTOCOL_VERSION = 1;
/** Hard cap for any app payload (spec). */
export const MAX_APP_PAYLOAD_BYTES = 200;

export enum AppMessageType {
  CheckIn = 1,
  CheckOut = 2,
  HelpRequest = 3,
  Receipt = 4,
  HarvestShare = 5,
  StandListVersion = 6,
  OverdueAlert = 7,
}

export enum CheckInMode {
  Stand = 1,
  Area = 2,
  Spot = 3,
  Moving = 4,
}

export enum HarvestSex {
  Unknown = 0,
  Male = 1,
  Female = 2,
}

/**
 * Size budgets from docs/SPEC.md "Message types": an encoded payload should
 * be strictly smaller than this many bytes. These are design targets checked
 * by tests and by `isWithinBudget` (the UI shortens notes to fit); the
 * encoder only enforces the 200-byte hard cap, so a safety message is never
 * refused over a soft budget.
 */
export const APP_MESSAGE_BUDGETS: Readonly<Record<AppMessageType, number>> = {
  [AppMessageType.CheckIn]: 40,
  [AppMessageType.CheckOut]: 40,
  [AppMessageType.HelpRequest]: 60,
  [AppMessageType.Receipt]: 20,
  [AppMessageType.HarvestShare]: 80,
  // Spec: "version number only".
  [AppMessageType.StandListVersion]: 32,
  [AppMessageType.OverdueAlert]: 40,
};

export interface LatLon {
  /** Degrees, WGS84. Stored on the wire at 1e-7 degree resolution. */
  lat: number;
  lon: number;
}

interface Base {
  /** Random uint32 chosen by the sender; with `sender` it identifies the message. */
  id: number;
  /** Meshtastic node number of the sender. */
  sender: number;
  /** Unix seconds; prefer GPS/radio time. Omit when unknown. */
  time?: number;
}

/** Where a hunter is. Stands are optional: spot and moving use a pin or nothing. */
interface Placement {
  mode?: CheckInMode;
  standId?: number;
  areaId?: number;
  pin?: LatLon;
}

export interface CheckIn extends Base, Placement {
  type: AppMessageType.CheckIn;
  mode: CheckInMode;
}

export interface CheckOut extends Base {
  type: AppMessageType.CheckOut;
  checkInId?: number;
}

export interface HelpRequest extends Base, Placement {
  type: AppMessageType.HelpRequest;
  note?: string;
}

export interface Receipt extends Base {
  type: AppMessageType.Receipt;
  /** The message id being acknowledged. */
  ackedId: number;
}

export interface HarvestShare extends Base, Placement {
  type: AppMessageType.HarvestShare;
  species: string;
  sex?: HarvestSex;
  note?: string;
}

export interface StandListVersion extends Base {
  type: AppMessageType.StandListVersion;
  version: number;
}

export interface OverdueAlert extends Base, Placement {
  type: AppMessageType.OverdueAlert;
  /** Node number of the member who is overdue. */
  subject: number;
  checkInId?: number;
}

export type AppMessage =
  CheckIn | CheckOut | HelpRequest | Receipt | HarvestShare | StandListVersion | OverdueAlert;

export type AppCodecErrorCode =
  | 'too-short'
  | 'unsupported-version'
  | 'unknown-type'
  | 'malformed'
  | 'missing-field'
  | 'invalid-field'
  | 'too-large';

export class AppCodecError extends Error {
  constructor(
    readonly code: AppCodecErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppCodecError';
  }
}

const F = {
  id: 1,
  sender: 2,
  time: 3,
  mode: 4,
  standId: 5,
  areaId: 6,
  lat: 7,
  lon: 8,
  ref: 9,
  subject: 10,
  version: 11,
  note: 12,
  species: 13,
  sex: 14,
} as const;

const isUint32 = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffffff;

function requireUint32(name: string, v: unknown, nonZero = false): number {
  if (!isUint32(v) || (nonZero && v === 0)) {
    throw new AppCodecError(
      'invalid-field',
      `${name} must be a${nonZero ? ' non-zero' : ''} uint32`,
    );
  }
  return v;
}

function toE7(name: string, deg: number, limit: number): number {
  if (typeof deg !== 'number' || !Number.isFinite(deg) || Math.abs(deg) > limit) {
    throw new AppCodecError('invalid-field', `${name} out of range`);
  }
  return Math.round(deg * 1e7);
}

function writePlacement(w: BinaryWriter, p: Placement): void {
  if (p.mode !== undefined) {
    if (!(p.mode in CheckInMode))
      throw new AppCodecError('invalid-field', 'mode is not a CheckInMode');
    w.tag(F.mode, WireType.Varint).uint32(p.mode);
  }
  if (p.standId !== undefined)
    w.tag(F.standId, WireType.Varint).uint32(requireUint32('standId', p.standId));
  if (p.areaId !== undefined)
    w.tag(F.areaId, WireType.Varint).uint32(requireUint32('areaId', p.areaId));
  if (p.pin) {
    w.tag(F.lat, WireType.Bit32).sfixed32(toE7('lat', p.pin.lat, 90));
    w.tag(F.lon, WireType.Bit32).sfixed32(toE7('lon', p.pin.lon, 180));
  }
}

function writeString(w: BinaryWriter, field: number, name: string, s: string | undefined): void {
  if (s === undefined || s === '') return;
  if (typeof s !== 'string') throw new AppCodecError('invalid-field', `${name} must be a string`);
  w.tag(field, WireType.LengthDelimited).bytes(encodeUtf8(s));
}

/**
 * Encodes an app message. Throws AppCodecError if a field is invalid or the
 * result is over the 200-byte hard cap. Use `isWithinBudget` to check the
 * spec's per-type budget.
 */
export function encodeAppMessage(msg: AppMessage): Uint8Array {
  if (APP_MESSAGE_BUDGETS[msg.type] === undefined)
    throw new AppCodecError('unknown-type', 'Unknown app message type');

  const w = new BinaryWriter();
  w.tag(F.id, WireType.Bit32).fixed32(requireUint32('id', msg.id, true));
  w.tag(F.sender, WireType.Bit32).fixed32(requireUint32('sender', msg.sender, true));
  if (msg.time !== undefined && msg.time !== 0)
    w.tag(F.time, WireType.Varint).uint32(requireUint32('time', msg.time));

  switch (msg.type) {
    case AppMessageType.CheckIn:
      if (msg.mode === undefined) throw new AppCodecError('missing-field', 'CheckIn needs a mode');
      writePlacement(w, msg);
      break;
    case AppMessageType.CheckOut:
      if (msg.checkInId !== undefined)
        w.tag(F.ref, WireType.Bit32).fixed32(requireUint32('checkInId', msg.checkInId));
      break;
    case AppMessageType.HelpRequest:
      writePlacement(w, msg);
      writeString(w, F.note, 'note', msg.note);
      break;
    case AppMessageType.Receipt:
      w.tag(F.ref, WireType.Bit32).fixed32(requireUint32('ackedId', msg.ackedId, true));
      break;
    case AppMessageType.HarvestShare:
      if (!msg.species) throw new AppCodecError('missing-field', 'HarvestShare needs a species');
      writePlacement(w, msg);
      writeString(w, F.species, 'species', msg.species);
      if (msg.sex !== undefined && msg.sex !== HarvestSex.Unknown) {
        if (!(msg.sex in HarvestSex))
          throw new AppCodecError('invalid-field', 'sex is not a HarvestSex');
        w.tag(F.sex, WireType.Varint).uint32(msg.sex);
      }
      writeString(w, F.note, 'note', msg.note);
      break;
    case AppMessageType.StandListVersion:
      w.tag(F.version, WireType.Varint).uint32(requireUint32('version', msg.version));
      break;
    case AppMessageType.OverdueAlert:
      w.tag(F.subject, WireType.Bit32).fixed32(requireUint32('subject', msg.subject, true));
      if (msg.checkInId !== undefined)
        w.tag(F.ref, WireType.Bit32).fixed32(requireUint32('checkInId', msg.checkInId));
      writePlacement(w, msg);
      break;
    default:
      throw new AppCodecError('unknown-type', 'Unknown app message type');
  }

  const body = w.finish();
  const out = new Uint8Array(2 + body.length);
  out[0] = APP_PROTOCOL_VERSION;
  out[1] = msg.type;
  out.set(body, 2);
  if (out.length > MAX_APP_PAYLOAD_BYTES) {
    throw new AppCodecError(
      'too-large',
      `Encoded ${out.length} bytes; max ${MAX_APP_PAYLOAD_BYTES}`,
    );
  }
  return out;
}

/** True if an encoded payload of this type is under the spec's size budget. */
export function isWithinBudget(type: AppMessageType, encoded: Uint8Array): boolean {
  const budget = APP_MESSAGE_BUDGETS[type];
  return budget !== undefined && encoded.length < budget;
}

interface RawFields {
  id?: number;
  sender?: number;
  time?: number;
  mode?: number;
  standId?: number;
  areaId?: number;
  lat?: number;
  lon?: number;
  ref?: number;
  subject?: number;
  version?: number;
  note?: string;
  species?: string;
  sex?: number;
}

function readFields(body: Uint8Array): RawFields {
  const r = new BinaryReader(body);
  const f: RawFields = {};
  while (r.pos < r.len) {
    const [no, wt] = r.tag();
    const expect = (want: WireType): void => {
      if (wt !== want) throw new AppCodecError('malformed', `Field ${no} has wrong wire type`);
    };
    switch (no) {
      case F.id:
        expect(WireType.Bit32);
        f.id = r.fixed32();
        break;
      case F.sender:
        expect(WireType.Bit32);
        f.sender = r.fixed32();
        break;
      case F.time:
        expect(WireType.Varint);
        f.time = r.uint32();
        break;
      case F.mode:
        expect(WireType.Varint);
        f.mode = r.uint32();
        break;
      case F.standId:
        expect(WireType.Varint);
        f.standId = r.uint32();
        break;
      case F.areaId:
        expect(WireType.Varint);
        f.areaId = r.uint32();
        break;
      case F.lat:
        expect(WireType.Bit32);
        f.lat = r.sfixed32();
        break;
      case F.lon:
        expect(WireType.Bit32);
        f.lon = r.sfixed32();
        break;
      case F.ref:
        expect(WireType.Bit32);
        f.ref = r.fixed32();
        break;
      case F.subject:
        expect(WireType.Bit32);
        f.subject = r.fixed32();
        break;
      case F.version:
        expect(WireType.Varint);
        f.version = r.uint32();
        break;
      case F.note:
        expect(WireType.LengthDelimited);
        f.note = r.string();
        break;
      case F.species:
        expect(WireType.LengthDelimited);
        f.species = r.string();
        break;
      case F.sex:
        expect(WireType.Varint);
        f.sex = r.uint32();
        break;
      default:
        // Field from a newer version of the app: skip it.
        r.skip(wt, no);
    }
  }
  return f;
}

function placement(f: RawFields): Placement {
  const p: Placement = {};
  if (f.mode !== undefined) {
    if (!(f.mode in CheckInMode)) throw new AppCodecError('invalid-field', 'Unknown check-in mode');
    p.mode = f.mode as CheckInMode;
  }
  if (f.standId !== undefined) p.standId = f.standId;
  if (f.areaId !== undefined) p.areaId = f.areaId;
  if (f.lat !== undefined && f.lon !== undefined) p.pin = { lat: f.lat / 1e7, lon: f.lon / 1e7 };
  return p;
}

/** Decodes an app-port payload. Throws AppCodecError on anything invalid. */
export function decodeAppMessage(bytes: Uint8Array): AppMessage {
  if (bytes.length < 2) throw new AppCodecError('too-short', 'Payload too short');
  if (bytes.length > MAX_APP_PAYLOAD_BYTES)
    throw new AppCodecError('too-large', 'Payload over 200 bytes');
  if (bytes[0] !== APP_PROTOCOL_VERSION) {
    throw new AppCodecError('unsupported-version', 'Unsupported app protocol version');
  }
  const type = bytes[1]!;
  if (!(type in AppMessageType))
    throw new AppCodecError('unknown-type', 'Unknown app message type');

  let f: RawFields;
  try {
    f = readFields(bytes.subarray(2));
  } catch (e) {
    if (e instanceof AppCodecError) throw e;
    throw new AppCodecError('malformed', 'Malformed app message body');
  }
  if (!f.id || !f.sender)
    throw new AppCodecError('missing-field', 'Message id and sender are required');
  const base: Base = { id: f.id, sender: f.sender };
  if (f.time) base.time = f.time;

  switch (type as AppMessageType) {
    case AppMessageType.CheckIn: {
      const p = placement(f);
      if (p.mode === undefined) throw new AppCodecError('missing-field', 'CheckIn needs a mode');
      return { ...base, ...p, type: AppMessageType.CheckIn, mode: p.mode };
    }
    case AppMessageType.CheckOut: {
      const m: CheckOut = { ...base, type: AppMessageType.CheckOut };
      if (f.ref) m.checkInId = f.ref;
      return m;
    }
    case AppMessageType.HelpRequest: {
      const m: HelpRequest = { ...base, ...placement(f), type: AppMessageType.HelpRequest };
      if (f.note) m.note = f.note;
      return m;
    }
    case AppMessageType.Receipt:
      if (!f.ref) throw new AppCodecError('missing-field', 'Receipt needs ackedId');
      return { ...base, type: AppMessageType.Receipt, ackedId: f.ref };
    case AppMessageType.HarvestShare: {
      if (!f.species) throw new AppCodecError('missing-field', 'HarvestShare needs a species');
      const m: HarvestShare = {
        ...base,
        ...placement(f),
        type: AppMessageType.HarvestShare,
        species: f.species,
      };
      if (f.sex !== undefined && f.sex in HarvestSex) m.sex = f.sex as HarvestSex;
      if (f.note) m.note = f.note;
      return m;
    }
    case AppMessageType.StandListVersion:
      if (f.version === undefined)
        throw new AppCodecError('missing-field', 'StandListVersion needs a version');
      return { ...base, type: AppMessageType.StandListVersion, version: f.version };
    case AppMessageType.OverdueAlert: {
      if (!f.subject) throw new AppCodecError('missing-field', 'OverdueAlert needs a subject');
      const m: OverdueAlert = {
        ...base,
        ...placement(f),
        type: AppMessageType.OverdueAlert,
        subject: f.subject,
      };
      if (f.ref) m.checkInId = f.ref;
      return m;
    }
  }
}

/** Like decodeAppMessage but returns undefined instead of throwing. */
export function tryDecodeAppMessage(bytes: Uint8Array): AppMessage | undefined {
  try {
    return decodeAppMessage(bytes);
  } catch {
    return undefined;
  }
}

/** De-duplication key for an app message: sender plus message id. */
export const appMessageKey = (m: Pick<AppMessage, 'sender' | 'id'>): string =>
  `${m.sender >>> 0}:${m.id >>> 0}`;
