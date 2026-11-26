/**
 * Hunt Club app messages on Meshtastic private port 314.
 *
 * Wire layout (all payloads ≤ 200 bytes, most far smaller):
 *
 *   byte 0   protocol version (APP_PROTOCOL_VERSION)
 *   byte 1   message type (AppMessageType)
 *   byte 2+  protobuf wire-format fields
 *
 * The body is plain protobuf wire format, so receivers skip fields they
 * don't know (forward compatible) without a .proto build step.
 *
 * Everything about the format is data: FIELDS (one entry per field: number,
 * wire kind, validation) and APP_MESSAGE_SCHEMAS (per type: which fields,
 * which are required, size budget). One generic encoder and decoder walk
 * those tables; there is no per-type encode/decode code.
 *
 * No message body, key or note is ever logged by this package.
 */
import { BinaryReader, BinaryWriter, WireType } from '@bufbuild/protobuf/wire';
import { encodeUtf8 } from '../runtime';
import { CheckInMode, HARVEST_SEX_CODES, type HarvestSex, enumValues } from '../domain';

export { CheckInMode, HARVEST_SEX_CODES, type HarvestSex } from '../domain';

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
  /** The stand's `mesh_id` (uint32, unique within the club). */
  standId?: number;
  /** The area's `mesh_id` (uint32, unique within the club). */
  areaId?: number;
  pin?: LatLon;
}

export interface CheckIn extends Base, Placement {
  type: AppMessageType.CheckIn;
  mode: CheckInMode;
  /**
   * Unix seconds the hunter expects to be out until, when they extended past
   * sunset + grace ("Still out? Extend 30 min"). Overdue is not raised
   * before this time.
   */
  until?: number;
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

/** Every property any app message can carry (except `type`). */
type FieldName = Exclude<{ [M in AppMessage as string]: keyof M }[string] & string, 'type'>;

// ---- Field table ----

type FieldSpec =
  /** uint32 sent as fixed32 (ids, node numbers). `nonZero`: 0 is invalid on encode and absent on decode. */
  | { kind: 'fixed32'; no: number; nonZero?: boolean }
  /** uint32 sent as varint. `omitZero`: 0 is not written and decodes as absent. */
  | { kind: 'varint'; no: number; omitZero?: boolean }
  /** numeric enum sent as varint; `omitValue` (the enum's default) is not written. */
  | { kind: 'enum'; no: number; values: readonly number[]; omitValue?: number }
  /** UTF-8 string; empty is not written. */
  | { kind: 'string'; no: number }
  /** LatLon as two sfixed32 fields in 1e-7 degrees. */
  | { kind: 'latlon'; latNo: number; lonNo: number };

/**
 * Field numbers are part of the wire format: never renumber or reuse one.
 * `checkInId` and `ackedId` share number 9 ("referenced message id"); no
 * message type carries both.
 */
export const FIELDS: Readonly<Record<FieldName, FieldSpec>> = {
  id: { kind: 'fixed32', no: 1, nonZero: true },
  sender: { kind: 'fixed32', no: 2, nonZero: true },
  time: { kind: 'varint', no: 3, omitZero: true },
  mode: { kind: 'enum', no: 4, values: enumValues(CheckInMode) },
  standId: { kind: 'varint', no: 5 },
  areaId: { kind: 'varint', no: 6 },
  pin: { kind: 'latlon', latNo: 7, lonNo: 8 },
  checkInId: { kind: 'fixed32', no: 9, nonZero: true },
  ackedId: { kind: 'fixed32', no: 9, nonZero: true },
  subject: { kind: 'fixed32', no: 10, nonZero: true },
  version: { kind: 'varint', no: 11 },
  note: { kind: 'string', no: 12 },
  species: { kind: 'string', no: 13 },
  sex: {
    kind: 'enum',
    no: 14,
    values: Object.values(HARVEST_SEX_CODES),
    omitValue: HARVEST_SEX_CODES.unknown,
  },
  until: { kind: 'varint', no: 15, omitZero: true },
};

// ---- Per-type schemas ----

export interface AppMessageSchema {
  /** Fields besides the common id/sender/time, in wire order. */
  fields: readonly FieldName[];
  required: readonly FieldName[];
  /**
   * Size budget from docs/SPEC.md "Message types": an encoded payload should
   * be strictly smaller. A design target checked by tests and by
   * `isWithinBudget` (the UI shortens notes to fit); the encoder only
   * enforces the 200-byte hard cap, so a safety message is never refused
   * over a soft budget.
   */
  budget: number;
}

const COMMON_FIELDS: readonly FieldName[] = ['id', 'sender', 'time'];
const COMMON_REQUIRED: readonly FieldName[] = ['id', 'sender'];
const PLACEMENT_FIELDS: readonly FieldName[] = ['mode', 'standId', 'areaId', 'pin'];

export const APP_MESSAGE_SCHEMAS: Readonly<Record<AppMessageType, AppMessageSchema>> = {
  [AppMessageType.CheckIn]: {
    fields: [...PLACEMENT_FIELDS, 'until'],
    required: ['mode'],
    budget: 40,
  },
  [AppMessageType.CheckOut]: { fields: ['checkInId'], required: [], budget: 40 },
  [AppMessageType.HelpRequest]: { fields: [...PLACEMENT_FIELDS, 'note'], required: [], budget: 60 },
  [AppMessageType.Receipt]: { fields: ['ackedId'], required: ['ackedId'], budget: 20 },
  [AppMessageType.HarvestShare]: {
    fields: [...PLACEMENT_FIELDS, 'species', 'sex', 'note'],
    required: ['species'],
    budget: 80,
  },
  // Spec: "version number only" (no byte figure given).
  [AppMessageType.StandListVersion]: { fields: ['version'], required: ['version'], budget: 32 },
  [AppMessageType.OverdueAlert]: {
    fields: ['subject', 'checkInId', ...PLACEMENT_FIELDS],
    required: ['subject'],
    budget: 40,
  },
};

/** Size budgets by type (derived from APP_MESSAGE_SCHEMAS). */
export const APP_MESSAGE_BUDGETS = Object.fromEntries(
  Object.entries(APP_MESSAGE_SCHEMAS).map(([t, s]) => [t, s.budget]),
) as Readonly<Record<AppMessageType, number>>;

// ---- Errors ----

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

function schemaFor(type: number): AppMessageSchema {
  const schema = APP_MESSAGE_SCHEMAS[type as AppMessageType];
  if (!schema) throw new AppCodecError('unknown-type', 'Unknown app message type');
  return schema;
}

const isUint32 = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffffff;

function invalid(name: string, why: string): never {
  throw new AppCodecError('invalid-field', `${name} ${why}`);
}

function toE7(name: string, deg: unknown, limit: number): number {
  if (typeof deg !== 'number' || !Number.isFinite(deg) || Math.abs(deg) > limit) {
    invalid(name, 'is out of range');
  }
  return Math.round(deg * 1e7);
}

// ---- Generic encoder ----

/** Writes one field; returns false when the value is "absent" (nothing written). */
function writeField(w: BinaryWriter, name: FieldName, spec: FieldSpec, value: unknown): boolean {
  if (value === undefined) return false;
  switch (spec.kind) {
    case 'fixed32':
      if (!isUint32(value) || (spec.nonZero && value === 0))
        invalid(name, 'must be a non-zero uint32');
      w.tag(spec.no, WireType.Bit32).fixed32(value);
      return true;
    case 'varint':
      if (!isUint32(value)) invalid(name, 'must be a uint32');
      if (spec.omitZero && value === 0) return false;
      w.tag(spec.no, WireType.Varint).uint32(value);
      return true;
    case 'enum':
      if (typeof value !== 'number' || !spec.values.includes(value))
        invalid(name, 'is not a known value');
      if (value === spec.omitValue) return false;
      w.tag(spec.no, WireType.Varint).uint32(value);
      return true;
    case 'string':
      if (typeof value !== 'string') invalid(name, 'must be a string');
      if (value === '') return false;
      w.tag(spec.no, WireType.LengthDelimited).bytes(encodeUtf8(value));
      return true;
    case 'latlon': {
      const p = value as LatLon;
      w.tag(spec.latNo, WireType.Bit32).sfixed32(toE7(`${name}.lat`, p?.lat, 90));
      w.tag(spec.lonNo, WireType.Bit32).sfixed32(toE7(`${name}.lon`, p?.lon, 180));
      return true;
    }
  }
}

/**
 * Encodes an app message. Throws AppCodecError if a field is invalid or
 * missing, or the result is over the 200-byte hard cap. Use
 * `isWithinBudget` to check the spec's per-type budget.
 */
export function encodeAppMessage(msg: AppMessage): Uint8Array {
  const schema = schemaFor(msg.type);
  const required = new Set([...COMMON_REQUIRED, ...schema.required]);
  const values = msg as unknown as Record<FieldName, unknown>;
  const w = new BinaryWriter();
  for (const name of [...COMMON_FIELDS, ...schema.fields]) {
    const written = writeField(w, name, FIELDS[name], values[name]);
    if (!written && required.has(name)) {
      throw new AppCodecError('missing-field', `${AppMessageType[msg.type]} needs ${name}`);
    }
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
  const schema = APP_MESSAGE_SCHEMAS[type];
  return schema !== undefined && encoded.length < schema.budget;
}

// ---- Generic decoder ----

type Reader = {
  wire: WireType;
  name: FieldName;
  read: (r: BinaryReader, out: Record<string, unknown>) => void;
};

/** Field-number → reader for one message type, built from the tables. */
function readersFor(schema: AppMessageSchema): Map<number, Reader> {
  const readers = new Map<number, Reader>();
  for (const name of [...COMMON_FIELDS, ...schema.fields]) {
    const spec = FIELDS[name];
    switch (spec.kind) {
      case 'fixed32':
        readers.set(spec.no, {
          wire: WireType.Bit32,
          name,
          read: (r, out) => {
            const v = r.fixed32();
            if (v !== 0 || !spec.nonZero) out[name] = v;
          },
        });
        break;
      case 'varint':
        readers.set(spec.no, {
          wire: WireType.Varint,
          name,
          read: (r, out) => {
            const v = r.uint32();
            if (v !== 0 || !spec.omitZero) out[name] = v;
          },
        });
        break;
      case 'enum':
        readers.set(spec.no, {
          wire: WireType.Varint,
          name,
          read: (r, out) => {
            const v = r.uint32();
            if (!spec.values.includes(v)) invalid(name, 'is not a known value');
            if (v !== spec.omitValue) out[name] = v;
          },
        });
        break;
      case 'string':
        readers.set(spec.no, {
          wire: WireType.LengthDelimited,
          name,
          read: (r, out) => {
            const v = r.string();
            if (v !== '') out[name] = v;
          },
        });
        break;
      case 'latlon': {
        const part =
          (key: 'lat' | 'lon'): Reader['read'] =>
          (r, out) => {
            const pin = (out[name] ??= {}) as Partial<LatLon>;
            pin[key] = r.sfixed32() / 1e7;
          };
        readers.set(spec.latNo, { wire: WireType.Bit32, name, read: part('lat') });
        readers.set(spec.lonNo, { wire: WireType.Bit32, name, read: part('lon') });
        break;
      }
    }
  }
  return readers;
}

const READERS = new Map(
  Object.entries(APP_MESSAGE_SCHEMAS).map(([t, s]) => [Number(t), readersFor(s)]),
);

/** Decodes an app-port payload. Throws AppCodecError on anything invalid. */
export function decodeAppMessage(bytes: Uint8Array): AppMessage {
  if (bytes.length < 2) throw new AppCodecError('too-short', 'Payload too short');
  if (bytes.length > MAX_APP_PAYLOAD_BYTES) {
    throw new AppCodecError('too-large', `Payload over ${MAX_APP_PAYLOAD_BYTES} bytes`);
  }
  if (bytes[0] !== APP_PROTOCOL_VERSION) {
    throw new AppCodecError('unsupported-version', 'Unsupported app protocol version');
  }
  const type = bytes[1]!;
  const schema = schemaFor(type);
  const readers = READERS.get(type)!;

  const out: Record<string, unknown> = { type };
  const r = new BinaryReader(bytes.subarray(2));
  try {
    while (r.pos < r.len) {
      const [no, wire] = r.tag();
      const reader = readers.get(no);
      if (!reader) {
        r.skip(wire, no); // From a newer app version, or not used by this type.
        continue;
      }
      if (wire !== reader.wire)
        throw new AppCodecError('malformed', `Field ${no} has wrong wire type`);
      reader.read(r, out);
    }
  } catch (e) {
    if (e instanceof AppCodecError) throw e;
    throw new AppCodecError('malformed', 'Malformed app message body');
  }

  const pin = out.pin as Partial<LatLon> | undefined;
  if (pin && (pin.lat === undefined || pin.lon === undefined)) delete out.pin;
  for (const name of [...COMMON_REQUIRED, ...schema.required]) {
    if (out[name] === undefined) {
      throw new AppCodecError('missing-field', `${AppMessageType[type]} needs ${name}`);
    }
  }
  return out as unknown as AppMessage;
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
