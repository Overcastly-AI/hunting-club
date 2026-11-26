import { create, toBinary } from '@bufbuild/protobuf';
import { Mesh, Portnums } from '../protobufs';
import {
  BROADCAST_ADDR,
  MAX_DATA_PAYLOAD_BYTES,
  decodeFromRadio,
  decodeToRadio,
  encodeFromRadio,
  encodePacket,
  heartbeat,
  wantConfig,
  disconnectMessage,
} from '../codec/radio';

describe('ToRadio / FromRadio codec', () => {
  it('encodes want_config_id, heartbeat and disconnect', () => {
    expect(decodeToRadio(wantConfig(1234)).payloadVariant).toEqual({
      case: 'wantConfigId',
      value: 1234,
    });
    expect(decodeToRadio(heartbeat(7)).payloadVariant.case).toBe('heartbeat');
    expect(decodeToRadio(disconnectMessage()).payloadVariant).toEqual({
      case: 'disconnect',
      value: true,
    });
  });

  it('builds a broadcast data packet with defaults', () => {
    const msg = decodeToRadio(
      encodePacket({
        id: 99,
        portnum: Portnums.PortNum.TEXT_MESSAGE_APP,
        payload: Uint8Array.of(1, 2),
      }),
    );
    expect(msg.payloadVariant.case).toBe('packet');
    const p = msg.payloadVariant.value as Mesh.MeshPacket;
    expect(p.id).toBe(99);
    expect(p.to).toBe(BROADCAST_ADDR);
    expect(p.hopLimit).toBe(3);
    expect(p.wantAck).toBe(false);
    expect(p.payloadVariant.case).toBe('decoded');
    expect([...(p.payloadVariant.value as Mesh.Data).payload]).toEqual([1, 2]);
  });

  it('builds a direct packet on port 314 with want_ack', () => {
    const p = decodeToRadio(
      encodePacket({
        id: 0xfffffffe,
        portnum: 314,
        payload: Uint8Array.of(1),
        to: 0x1234,
        channel: 1,
        wantAck: true,
      }),
    ).payloadVariant.value as Mesh.MeshPacket;
    expect(p.id).toBe(0xfffffffe);
    expect(p.to).toBe(0x1234);
    expect(p.channel).toBe(1);
    expect(p.wantAck).toBe(true);
    expect((p.payloadVariant.value as Mesh.Data).portnum).toBe(314);
  });

  it('refuses payloads over the LoRa data limit', () => {
    const big = new Uint8Array(MAX_DATA_PAYLOAD_BYTES + 1);
    expect(() => encodePacket({ id: 1, portnum: 1, payload: big })).toThrow(RangeError);
    expect(() => encodePacket({ id: 1, portnum: 1, payload: big.subarray(1) })).not.toThrow();
  });

  it('round-trips FromRadio variants', () => {
    const fr = decodeFromRadio(
      encodeFromRadio({ id: 5, payloadVariant: { case: 'configCompleteId', value: 42 } }),
    );
    expect(fr?.payloadVariant).toEqual({ case: 'configCompleteId', value: 42 });
    const q = decodeFromRadio(
      encodeFromRadio({
        payloadVariant: { case: 'queueStatus', value: { free: 3, maxlen: 16, meshPacketId: 9 } },
      }),
    );
    expect(q?.payloadVariant.case).toBe('queueStatus');
  });

  it('parses unknown FromRadio variants leniently', () => {
    // Field 99, length-delimited (tag varint 0x9a 0x06): a variant from newer firmware.
    const unknown = Uint8Array.of(0x9a, 0x06, 0x02, 0x01, 0x02);
    const a = decodeFromRadio(unknown);
    expect(a).toBeDefined();
    expect(a?.payloadVariant.case).toBeUndefined();
    // A known field next to it still decodes.
    const b = decodeFromRadio(Uint8Array.of(0x08, 0x07, ...unknown));
    expect(b?.id).toBe(7);
  });

  it('returns undefined for bytes that are not protobuf', () => {
    expect(
      decodeFromRadio(
        Uint8Array.of(0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff),
      ),
    ).toBeUndefined();
    expect(decodeFromRadio(Uint8Array.of(0x12, 0x10, 0x01))).toBeUndefined(); // packet length past end
  });

  it('decodes an empty FromRadio as no variant', () => {
    expect(decodeFromRadio(new Uint8Array(0))?.payloadVariant.case).toBeUndefined();
  });

  it('matches the protobufs package wire format', () => {
    const direct = toBinary(
      Mesh.ToRadioSchema,
      create(Mesh.ToRadioSchema, { payloadVariant: { case: 'wantConfigId', value: 69 } }),
    );
    expect(wantConfig(69)).toEqual(direct);
  });
});
