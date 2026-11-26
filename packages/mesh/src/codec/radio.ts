import { create, fromBinary, toBinary, type MessageInitShape } from '@bufbuild/protobuf';
import { Admin, Mesh, Portnums } from '../protobufs';

export const BROADCAST_ADDR = 0xffffffff;
/** Meshtastic default; spec says keep it. */
export const DEFAULT_HOP_LIMIT = 3;
/** Firmware DATA_PAYLOAD_LEN is 233; leave room for request_id/reply_id. */
export const MAX_DATA_PAYLOAD_BYTES = 228;
/** want_config_id nonces with special meaning in firmware; never use them for a full dump. */
export const SPECIAL_CONFIG_NONCES: readonly number[] = [69420, 69421];

export type ToRadio = Mesh.ToRadio;
export type FromRadio = Mesh.FromRadio;
export type MeshPacket = Mesh.MeshPacket;

export function encodeToRadio(msg: MessageInitShape<typeof Mesh.ToRadioSchema>): Uint8Array {
  return toBinary(Mesh.ToRadioSchema, create(Mesh.ToRadioSchema, msg));
}

export function decodeToRadio(bytes: Uint8Array): ToRadio {
  return fromBinary(Mesh.ToRadioSchema, bytes);
}

export function encodeFromRadio(msg: MessageInitShape<typeof Mesh.FromRadioSchema>): Uint8Array {
  return toBinary(Mesh.FromRadioSchema, create(Mesh.FromRadioSchema, msg));
}

/**
 * Decodes one FromRadio. Unknown fields and variants added by newer
 * firmware decode to `payloadVariant.case === undefined` (or a case this
 * build ignores) instead of throwing. Returns undefined only for bytes that
 * are not a valid protobuf at all.
 */
export function decodeFromRadio(bytes: Uint8Array): FromRadio | undefined {
  try {
    return fromBinary(Mesh.FromRadioSchema, bytes, { readUnknownFields: false });
  } catch {
    return undefined;
  }
}

export const wantConfig = (nonce: number): Uint8Array =>
  encodeToRadio({ payloadVariant: { case: 'wantConfigId', value: nonce } });

export const heartbeat = (nonce = 0): Uint8Array =>
  encodeToRadio({ payloadVariant: { case: 'heartbeat', value: { nonce } } });

export const disconnectMessage = (): Uint8Array =>
  encodeToRadio({ payloadVariant: { case: 'disconnect', value: true } });

export interface DataPacketInit {
  id: number;
  portnum: Portnums.PortNum | number;
  payload: Uint8Array;
  to?: number;
  channel?: number;
  wantAck?: boolean;
  wantResponse?: boolean;
  hopLimit?: number;
  replyId?: number;
}

/** A phone-originated MeshPacket. `from` is left 0; the radio fills in its own node number. */
export function buildDataPacket(
  init: DataPacketInit,
): MessageInitShape<typeof Mesh.MeshPacketSchema> {
  if (init.payload.length > MAX_DATA_PAYLOAD_BYTES) {
    throw new RangeError(`Payload is ${init.payload.length} bytes; max ${MAX_DATA_PAYLOAD_BYTES}`);
  }
  return {
    id: init.id >>> 0,
    to: (init.to ?? BROADCAST_ADDR) >>> 0,
    channel: init.channel ?? 0,
    wantAck: init.wantAck ?? false,
    hopLimit: init.hopLimit ?? DEFAULT_HOP_LIMIT,
    payloadVariant: {
      case: 'decoded',
      value: {
        portnum: init.portnum,
        payload: init.payload,
        wantResponse: init.wantResponse ?? false,
        replyId: init.replyId ?? 0,
      },
    },
  };
}

export function encodePacket(init: DataPacketInit): Uint8Array {
  return encodeToRadio({ payloadVariant: { case: 'packet', value: buildDataPacket(init) } });
}

export function encodeAdmin(msg: MessageInitShape<typeof Admin.AdminMessageSchema>): Uint8Array {
  return toBinary(Admin.AdminMessageSchema, create(Admin.AdminMessageSchema, msg));
}

export function decodeAdmin(bytes: Uint8Array): Admin.AdminMessage {
  return fromBinary(Admin.AdminMessageSchema, bytes);
}

export function encodeRouting(errorReason: Mesh.Routing_Error): Uint8Array {
  return toBinary(
    Mesh.RoutingSchema,
    create(Mesh.RoutingSchema, { variant: { case: 'errorReason', value: errorReason } }),
  );
}

export { encodeUtf8, decodeUtf8 } from '../runtime';
