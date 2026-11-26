import { create } from '@bufbuild/protobuf';
import { AppOnly, Config } from '../protobufs';
import {
  ChannelUrlError,
  HUNT_POSITION_PRECISION,
  channelHash,
  decodeChannelSet,
  decodeChannelSetUrl,
  decodeJoinUrl,
  encodeChannelSet,
  encodeChannelSetUrl,
  encodeJoinUrl,
  expandPsk,
  generatePartyChannelSet,
} from '../codec/channelUrl';
import { base64UrlEncode } from '../codec/base64url';
import { seededRandom } from '../testing/seededRandom';

describe('party channel generator', () => {
  it('builds a 256-bit key channel with US / LongFast / hop 3 / precision 32', () => {
    const random = jest.fn(seededRandom(42));
    const cs = generatePartyChannelSet({ random });
    expect(random).toHaveBeenCalledWith(32);
    expect(cs.settings).toHaveLength(1);
    const ch = cs.settings[0]!;
    expect(ch.psk).toHaveLength(32);
    expect(ch.name).toBe('Party');
    expect(ch.moduleSettings?.positionPrecision).toBe(HUNT_POSITION_PRECISION);
    expect(cs.loraConfig).toMatchObject({
      usePreset: true,
      modemPreset: Config.Config_LoRaConfig_ModemPreset.LONG_FAST,
      region: Config.Config_LoRaConfig_RegionCode.US,
      hopLimit: 3,
      txEnabled: true,
      txPower: 0,
      channelNum: 0,
    });
  });

  it('uses the injected random source for the key', () => {
    const a = generatePartyChannelSet({ random: seededRandom(1) });
    const b = generatePartyChannelSet({ random: seededRandom(1) });
    const c = generatePartyChannelSet({ random: seededRandom(2) });
    expect(a.settings[0]!.psk).toEqual(b.settings[0]!.psk);
    expect(a.settings[0]!.psk).not.toEqual(c.settings[0]!.psk);
  });

  it('rejects long names and bad random sources', () => {
    expect(() => generatePartyChannelSet({ random: seededRandom(), name: 'Twelve bytes' })).toThrow(
      ChannelUrlError,
    );
    expect(() => generatePartyChannelSet({ random: () => new Uint8Array(16) })).toThrow();
  });

  it('honours region and preset overrides', () => {
    const cs = generatePartyChannelSet({
      random: seededRandom(),
      region: Config.Config_LoRaConfig_RegionCode.EU_868,
      modemPreset: Config.Config_LoRaConfig_ModemPreset.MEDIUM_FAST,
    });
    expect(cs.loraConfig?.region).toBe(Config.Config_LoRaConfig_RegionCode.EU_868);
    expect(cs.loraConfig?.modemPreset).toBe(Config.Config_LoRaConfig_ModemPreset.MEDIUM_FAST);
  });
});

describe('Meshtastic channel URL', () => {
  const cs = generatePartyChannelSet({ random: seededRandom(7) });

  it('stays small enough for a QR code (research prototype: 57 bytes, 102 chars)', () => {
    expect(encodeChannelSet(cs).length).toBeLessThanOrEqual(60);
    const url = encodeChannelSetUrl(cs);
    expect(url.startsWith('https://meshtastic.org/e/#')).toBe(true);
    expect(url.length).toBeLessThanOrEqual(110);
  });

  it('round-trips without padding', () => {
    const url = encodeChannelSetUrl(cs);
    expect(url).not.toContain('=');
    const { channelSet, add } = decodeChannelSetUrl(url);
    expect(add).toBe(false);
    expect(channelSet).toEqual(cs);
  });

  it('round-trips the add=true form', () => {
    const url = encodeChannelSetUrl(cs, { add: true });
    expect(url).toMatch(/^https:\/\/meshtastic\.org\/e\/\?add=true#/);
    expect(decodeChannelSetUrl(url)).toEqual({ channelSet: cs, add: true });
  });

  it('accepts padded base64 and http', () => {
    const b64 = base64UrlEncode(encodeChannelSet(cs));
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    expect(decodeChannelSetUrl(`http://meshtastic.org/e/#${padded}`).channelSet).toEqual(cs);
  });

  it('round-trips multiple channels', () => {
    const multi = create(AppOnly.ChannelSetSchema, {
      settings: [
        { name: 'Club', psk: new Uint8Array(32).fill(1) },
        {
          name: 'Party',
          psk: new Uint8Array(16).fill(2),
          moduleSettings: { positionPrecision: 32 },
        },
      ],
      loraConfig: cs.loraConfig!,
    });
    expect(decodeChannelSetUrl(encodeChannelSetUrl(multi)).channelSet).toEqual(multi);
  });

  it('rejects foreign or broken links', () => {
    expect(() => decodeChannelSetUrl('https://example.com/e/#CgA')).toThrow(ChannelUrlError);
    expect(() => decodeChannelSetUrl('https://meshtastic.org/e/')).toThrow(ChannelUrlError);
    expect(() => decodeChannelSetUrl('https://meshtastic.org/e/#!!!')).toThrow(ChannelUrlError);
    // Empty ChannelSet
    expect(() => decodeChannelSetUrl('https://meshtastic.org/e/#')).toThrow(ChannelUrlError);
    // A key of invalid length (5 bytes)
    const bad = create(AppOnly.ChannelSetSchema, {
      settings: [{ name: 'x', psk: new Uint8Array(5) }],
    });
    expect(() => decodeChannelSetUrl(encodeChannelSetUrl(bad))).toThrow(ChannelUrlError);
  });

  it('encodes ChannelSet bytes identically to the protobufs package', () => {
    expect(decodeChannelSet(encodeChannelSet(cs))).toEqual(cs);
  });
});

describe('huntclub://join wrapper', () => {
  const cs = generatePartyChannelSet({ random: seededRandom(9) });

  it('round-trips a party link', () => {
    const url = encodeJoinUrl({ channelSet: cs, target: { kind: 'party', partyId: 'p-3f9a' } });
    expect(url).toMatch(/^huntclub:\/\/join\?cs=[A-Za-z0-9_-]+&party=p-3f9a$/);
    expect(decodeJoinUrl(url)).toEqual({
      channelSet: cs,
      target: { kind: 'party', partyId: 'p-3f9a' },
    });
  });

  it('round-trips a club link with an invite token needing escaping', () => {
    const target = {
      kind: 'club',
      clubId: '0b6f2c7e-1d2a-4c55-9f1e-6a7b8c9d0e1f',
      inviteToken: 'a+b/c=d&e',
    } as const;
    const url = encodeJoinUrl({ channelSet: cs, target });
    expect(decodeJoinUrl(url)).toEqual({ channelSet: cs, target });
  });

  it('wraps the same ChannelSet bytes as the Meshtastic URL', () => {
    const join = encodeJoinUrl({ channelSet: cs, target: { kind: 'party', partyId: 'x' } });
    const mesh = encodeChannelSetUrl(cs);
    expect(join).toContain(`cs=${mesh.split('#')[1]}`);
  });

  it('tolerates parameter order, a trailing slash and whitespace', () => {
    const csParam = base64UrlEncode(encodeChannelSet(cs));
    const parsed = decodeJoinUrl(`  HUNTCLUB://join/?party=abc&cs=${csParam}  `);
    expect(parsed.target).toEqual({ kind: 'party', partyId: 'abc' });
  });

  it('rejects other schemes and incomplete links', () => {
    const csParam = base64UrlEncode(encodeChannelSet(cs));
    expect(() => decodeJoinUrl(`https://meshtastic.org/e/#${csParam}`)).toThrow(ChannelUrlError);
    expect(() => decodeJoinUrl('huntclub://join')).toThrow(ChannelUrlError);
    expect(() => decodeJoinUrl('huntclub://join?party=abc')).toThrow(ChannelUrlError);
    expect(() => decodeJoinUrl(`huntclub://join?cs=${csParam}`)).toThrow(ChannelUrlError);
    expect(() => decodeJoinUrl(`huntclub://join?cs=${csParam}&club=abc`)).toThrow(ChannelUrlError);
    expect(() => decodeJoinUrl(`huntclub://join?cs=${csParam}&party=%E0%A4%A`)).toThrow(
      ChannelUrlError,
    );
    expect(() => encodeJoinUrl({ channelSet: cs, target: { kind: 'party', partyId: '' } })).toThrow(
      ChannelUrlError,
    );
    expect(() =>
      encodeJoinUrl({ channelSet: cs, target: { kind: 'club', clubId: 'c', inviteToken: '' } }),
    ).toThrow(ChannelUrlError);
  });
});

describe('channel hash', () => {
  it('matches firmware for the default LongFast channel (0x08)', () => {
    expect(channelHash({ name: '', psk: Uint8Array.of(1) })).toBe(0x08);
    expect(channelHash({ name: 'LongFast', psk: Uint8Array.of(1) })).toBe(0x08);
  });

  it('expands the 1-byte key shorthand', () => {
    expect(expandPsk(Uint8Array.of(0))).toHaveLength(0);
    expect(expandPsk(Uint8Array.of(1))[15]).toBe(0x01);
    expect(expandPsk(Uint8Array.of(2))[15]).toBe(0x02);
    const k = new Uint8Array(32).fill(9);
    expect(expandPsk(k)).toBe(k);
  });
});
