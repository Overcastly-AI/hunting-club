import {
  APP_MESSAGE_BUDGETS,
  APP_MESSAGE_SCHEMAS,
  FIELDS,
  APP_PROTOCOL_VERSION,
  AppCodecError,
  AppMessageType,
  CheckInMode,
  HarvestSex,
  MAX_APP_PAYLOAD_BYTES,
  appMessageKey,
  decodeAppMessage,
  encodeAppMessage,
  isWithinBudget,
  tryDecodeAppMessage,
  type AppMessage,
} from '../codec/appPort';
import { seededRandom } from '../testing/seededRandom';

const MAX_U32 = 0xffffffff;
// Worst-case header values: biggest varint timestamp, all-ones ids.
const base = { id: MAX_U32, sender: MAX_U32, time: MAX_U32 };
const pin = { lat: -89.9999999, lon: -179.9999999 };

/** Realistic worst cases for each type, used for round-trip and budget checks. */
const worstCases: AppMessage[] = [
  {
    ...base,
    type: AppMessageType.CheckIn,
    mode: CheckInMode.Stand,
    standId: MAX_U32,
    areaId: MAX_U32,
  },
  { ...base, type: AppMessageType.CheckIn, mode: CheckInMode.Spot, pin },
  { ...base, type: AppMessageType.CheckIn, mode: CheckInMode.Area, areaId: MAX_U32 },
  { ...base, type: AppMessageType.CheckIn, mode: CheckInMode.Moving, pin },
  { ...base, type: AppMessageType.CheckOut, checkInId: MAX_U32 },
  {
    ...base,
    type: AppMessageType.HelpRequest,
    mode: CheckInMode.Stand,
    standId: MAX_U32,
    pin,
    note: 'Hurt ankle at creek',
  },
  { ...base, type: AppMessageType.Receipt, ackedId: MAX_U32, time: undefined },
  {
    ...base,
    type: AppMessageType.HarvestShare,
    species: 'White-tailed deer',
    sex: HarvestSex.Male,
    mode: CheckInMode.Stand,
    standId: 1000,
    pin,
    note: '8 point, need a drag',
  },
  { ...base, type: AppMessageType.StandListVersion, version: MAX_U32 },
  {
    ...base,
    type: AppMessageType.OverdueAlert,
    subject: MAX_U32,
    checkInId: MAX_U32,
    pin,
  },
  {
    ...base,
    type: AppMessageType.OverdueAlert,
    subject: MAX_U32,
    mode: CheckInMode.Stand,
    standId: MAX_U32,
    areaId: 70000,
  },
];

function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

describe('app-port codec', () => {
  it.each(worstCases.map((m) => [AppMessageType[m.type], m] as const))(
    'round-trips %s',
    (_name, msg) => {
      const bytes = encodeAppMessage(msg);
      expect(bytes[0]).toBe(APP_PROTOCOL_VERSION);
      expect(bytes[1]).toBe(msg.type);
      const back = decodeAppMessage(bytes);
      const expected = stripUndefined(msg) as AppMessage & { pin?: { lat: number; lon: number } };
      if (expected.pin) {
        const got = back as typeof expected;
        expect(got.pin!.lat).toBeCloseTo(expected.pin.lat, 7);
        expect(got.pin!.lon).toBeCloseTo(expected.pin.lon, 7);
        expect({ ...got, pin: undefined }).toEqual({ ...expected, pin: undefined });
      } else {
        expect(back).toEqual(expected);
      }
    },
  );

  it.each(worstCases.map((m) => [AppMessageType[m.type], m] as const))(
    '%s worst case fits the spec budget',
    (_name, msg) => {
      const size = encodeAppMessage(msg).length;
      expect(size).toBeLessThan(APP_MESSAGE_BUDGETS[msg.type]);
      expect(isWithinBudget(msg.type, encodeAppMessage(msg))).toBe(true);
      expect(size).toBeLessThanOrEqual(MAX_APP_PAYLOAD_BYTES);
    },
  );

  it('budgets match the spec table', () => {
    expect(APP_MESSAGE_BUDGETS).toEqual({
      [AppMessageType.CheckIn]: 40,
      [AppMessageType.CheckOut]: 40,
      [AppMessageType.HelpRequest]: 60,
      [AppMessageType.Receipt]: 20,
      [AppMessageType.HarvestShare]: 80,
      [AppMessageType.StandListVersion]: 32,
      [AppMessageType.OverdueAlert]: 40,
    });
  });

  it('keeps typical messages small', () => {
    const sizes = {
      checkInSpot: encodeAppMessage({
        type: AppMessageType.CheckIn,
        id: 0x12345678,
        sender: 0xa1b2c3d4,
        time: 1_764_150_000,
        mode: CheckInMode.Spot,
        pin: { lat: 44.123456, lon: -93.654321 },
      }).length,
      receipt: encodeAppMessage({
        type: AppMessageType.Receipt,
        id: 7,
        sender: 9,
        ackedId: 0x12345678,
      }).length,
    };
    expect(sizes.checkInSpot).toBe(30);
    expect(sizes.receipt).toBe(17);
  });

  it('stores coordinates at 1e-7 degree resolution', () => {
    const m = decodeAppMessage(
      encodeAppMessage({
        type: AppMessageType.CheckIn,
        id: 1,
        sender: 2,
        mode: CheckInMode.Spot,
        pin: { lat: 44.12345678, lon: -93.98765432 },
      }),
    ) as { pin: { lat: number; lon: number } };
    expect(m.pin.lat).toBeCloseTo(44.1234568, 7);
    expect(m.pin.lon).toBeCloseTo(-93.9876543, 7);
  });

  it('omits a zero/absent timestamp', () => {
    const withTime = encodeAppMessage({
      type: AppMessageType.CheckOut,
      id: 1,
      sender: 2,
      time: 100,
    });
    const without = encodeAppMessage({ type: AppMessageType.CheckOut, id: 1, sender: 2 });
    const zero = encodeAppMessage({ type: AppMessageType.CheckOut, id: 1, sender: 2, time: 0 });
    expect(without.length).toBeLessThan(withTime.length);
    expect(zero).toEqual(without);
    expect(decodeAppMessage(without).time).toBeUndefined();
  });

  it('carries UTF-8 notes', () => {
    const m = decodeAppMessage(
      encodeAppMessage({ type: AppMessageType.HelpRequest, id: 1, sender: 2, note: 'Café 🦌' }),
    ) as { note: string };
    expect(m.note).toBe('Café 🦌');
  });

  it('works without a stand: spot, on the move, or no location at all', () => {
    for (const msg of [
      { type: AppMessageType.CheckIn, id: 1, sender: 2, mode: CheckInMode.Moving } as const,
      { type: AppMessageType.HelpRequest, id: 1, sender: 2 } as const,
      { type: AppMessageType.OverdueAlert, id: 1, sender: 2, subject: 3 } as const,
    ]) {
      expect(decodeAppMessage(encodeAppMessage(msg))).toEqual(msg);
    }
  });

  describe('encoder validation', () => {
    const ok = { type: AppMessageType.CheckOut, id: 1, sender: 2 } as const;

    it.each([
      ['zero id', { ...ok, id: 0 }],
      ['negative id', { ...ok, id: -1 }],
      ['fractional id', { ...ok, id: 1.5 }],
      ['id over 32 bits', { ...ok, id: 2 ** 32 }],
      ['zero sender', { ...ok, sender: 0 }],
      ['negative time', { ...ok, time: -5 }],
    ])('rejects %s', (_n, msg) => {
      expect(() => encodeAppMessage(msg as AppMessage)).toThrow(AppCodecError);
    });

    it('rejects out-of-range coordinates', () => {
      for (const p of [
        { lat: 91, lon: 0 },
        { lat: 0, lon: -181 },
        { lat: NaN, lon: 0 },
      ]) {
        expect(() =>
          encodeAppMessage({
            type: AppMessageType.CheckIn,
            id: 1,
            sender: 2,
            mode: CheckInMode.Spot,
            pin: p,
          }),
        ).toThrow(AppCodecError);
      }
    });

    it('rejects a bad mode, missing species, zero receipt target and zero overdue subject', () => {
      expect(() =>
        encodeAppMessage({
          type: AppMessageType.CheckIn,
          id: 1,
          sender: 2,
          mode: 9 as CheckInMode,
        }),
      ).toThrow(AppCodecError);
      expect(() =>
        encodeAppMessage({ type: AppMessageType.HarvestShare, id: 1, sender: 2, species: '' }),
      ).toThrow(AppCodecError);
      expect(() =>
        encodeAppMessage({ type: AppMessageType.Receipt, id: 1, sender: 2, ackedId: 0 }),
      ).toThrow(AppCodecError);
      expect(() =>
        encodeAppMessage({ type: AppMessageType.OverdueAlert, id: 1, sender: 2, subject: 0 }),
      ).toThrow(AppCodecError);
      expect(() =>
        encodeAppMessage({ type: 42 as AppMessageType.CheckOut, id: 1, sender: 2 }),
      ).toThrow(AppCodecError);
    });

    it('flags messages over the type budget but still encodes them', () => {
      const long = {
        type: AppMessageType.HelpRequest,
        id: 1,
        sender: 2,
        note: 'x'.repeat(60),
      } as const;
      const bytes = encodeAppMessage(long);
      expect(isWithinBudget(AppMessageType.HelpRequest, bytes)).toBe(false);
      expect(decodeAppMessage(bytes)).toEqual(long);
    });

    it('rejects messages over the 200-byte hard cap', () => {
      try {
        encodeAppMessage({
          type: AppMessageType.HelpRequest,
          id: 1,
          sender: 2,
          note: 'x'.repeat(190),
        });
        throw new Error('expected a throw');
      } catch (e) {
        expect(e).toBeInstanceOf(AppCodecError);
        expect((e as AppCodecError).code).toBe('too-large');
      }
    });
  });

  describe('decoder', () => {
    const valid = encodeAppMessage({ type: AppMessageType.Receipt, id: 5, sender: 6, ackedId: 7 });
    const code = (bytes: Uint8Array) => {
      try {
        decodeAppMessage(bytes);
        return 'ok';
      } catch (e) {
        return (e as AppCodecError).code;
      }
    };

    it('rejects short, oversized, other-version and unknown-type payloads', () => {
      expect(code(new Uint8Array(0))).toBe('too-short');
      expect(code(Uint8Array.of(1))).toBe('too-short');
      expect(code(new Uint8Array(201).fill(1))).toBe('too-large');
      expect(code(Uint8Array.of(2, ...valid.subarray(1)))).toBe('unsupported-version');
      expect(code(Uint8Array.of(1, 99, ...valid.subarray(2)))).toBe('unknown-type');
    });

    it('requires message id and sender', () => {
      expect(code(Uint8Array.of(1, AppMessageType.CheckOut))).toBe('missing-field');
    });

    it('requires type-specific fields', () => {
      const header = valid.subarray(0, 12); // version, type, id, sender
      expect(code(Uint8Array.of(header[0]!, AppMessageType.CheckIn, ...header.subarray(2)))).toBe(
        'missing-field',
      );
      expect(code(Uint8Array.of(header[0]!, AppMessageType.Receipt, ...header.subarray(2)))).toBe(
        'missing-field',
      );
      expect(
        code(Uint8Array.of(header[0]!, AppMessageType.HarvestShare, ...header.subarray(2))),
      ).toBe('missing-field');
      expect(
        code(Uint8Array.of(header[0]!, AppMessageType.StandListVersion, ...header.subarray(2))),
      ).toBe('missing-field');
      expect(
        code(Uint8Array.of(header[0]!, AppMessageType.OverdueAlert, ...header.subarray(2))),
      ).toBe('missing-field');
    });

    it('skips unknown fields from newer app versions', () => {
      // field 30 varint (tag 0xf0 0x01) = 5, field 31 length-delimited "hi"
      const extra = Uint8Array.of(0xf0, 0x01, 0x05, 0xfa, 0x01, 0x02, 0x68, 0x69);
      expect(decodeAppMessage(Uint8Array.of(...valid, ...extra))).toEqual(decodeAppMessage(valid));
    });

    it('rejects a known field with the wrong wire type', () => {
      // field 1 (id) as varint instead of fixed32
      expect(code(Uint8Array.of(1, AppMessageType.CheckOut, 0x08, 0x05))).toBe('malformed');
    });

    it('rejects truncated bodies', () => {
      for (let cut = 3; cut < valid.length; cut++) {
        expect(code(valid.subarray(0, cut))).not.toBe('ok');
      }
    });

    it('rejects an unknown check-in mode on the wire', () => {
      const bytes = encodeAppMessage({
        type: AppMessageType.CheckIn,
        id: 1,
        sender: 2,
        mode: CheckInMode.Stand,
      });
      const patched = bytes.slice();
      patched[patched.length - 1] = 77; // mode value
      expect(code(patched)).toBe('invalid-field');
    });

    it('never throws from tryDecodeAppMessage on random bytes', () => {
      const random = seededRandom(1234);
      for (let i = 0; i < 2000; i++) {
        const len = random(1)[0]! % 64;
        const bytes = random(len);
        if (len > 0 && i % 2 === 0) bytes[0] = APP_PROTOCOL_VERSION;
        if (len > 1 && i % 2 === 0) bytes[1] = (bytes[1]! % 7) + 1;
        expect(() => tryDecodeAppMessage(bytes)).not.toThrow();
      }
    });
  });

  it('schemas never use a field number twice within one message type', () => {
    for (const [type, schema] of Object.entries(APP_MESSAGE_SCHEMAS)) {
      const numbers = ['id', 'sender', 'time', ...schema.fields].flatMap((name) => {
        const spec = FIELDS[name as keyof typeof FIELDS];
        return spec.kind === 'latlon' ? [spec.latNo, spec.lonNo] : [spec.no];
      });
      expect({ type, numbers: new Set(numbers).size }).toEqual({ type, numbers: numbers.length });
      for (const req of schema.required) expect(schema.fields).toContain(req);
    }
  });

  it('de-duplication key is sender + message id', () => {
    expect(appMessageKey({ sender: 1, id: 2 })).toBe('1:2');
    expect(appMessageKey({ sender: 1, id: 2 })).not.toBe(appMessageKey({ sender: 2, id: 2 }));
  });
});
