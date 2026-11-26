import { create } from '@bufbuild/protobuf';
import { AppOnly, Channel, Config, Mesh, Portnums } from '../protobufs';
import {
  MAX_CHANNELS,
  RECOMMENDED_POSITION_CONFIG,
  buildProvisioningMessages,
  planFromChannelSet,
  type AdminMessage,
} from '../provisioning';
import { generatePartyChannelSet, decodeJoinUrl, encodeJoinUrl } from '../codec/channelUrl';
import { decodeAdmin } from '../codec/radio';
import { MeshClient } from '../MeshClient';
import { FakeRadio } from '../transports/FakeTransport';
import { seededRandom } from '../testing/seededRandom';

const cases = (msgs: AdminMessage[]) =>
  msgs.map((m) =>
    m.payloadVariant.case === 'setConfig'
      ? `setConfig:${m.payloadVariant.value.payloadVariant.case}`
      : m.payloadVariant.case,
  );

const party = generatePartyChannelSet({ random: seededRandom(3) });

describe('buildProvisioningMessages', () => {
  it('emits begin, 8 channels, lora, position, device, commit in order', () => {
    const msgs = buildProvisioningMessages(planFromChannelSet(party));
    expect(cases(msgs)).toEqual([
      'beginEditSettings',
      ...Array(MAX_CHANNELS).fill('setChannel'),
      'setConfig:lora',
      'setConfig:position',
      'setConfig:device',
      'commitEditSettings',
    ]);
  });

  it('writes the party channel as PRIMARY with precision 32 and disables the rest', () => {
    const msgs = buildProvisioningMessages(planFromChannelSet(party));
    const chans = msgs
      .filter((m) => m.payloadVariant.case === 'setChannel')
      .map((m) => m.payloadVariant.value as Channel.Channel);
    expect(chans.map((c) => c.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(chans[0]!.role).toBe(Channel.Channel_Role.PRIMARY);
    expect(chans[0]!.settings?.psk).toEqual(party.settings[0]!.psk);
    expect(chans[0]!.settings?.name).toBe('Party');
    expect(chans[0]!.settings?.moduleSettings?.positionPrecision).toBe(32);
    for (const c of chans.slice(1)) expect(c.role).toBe(Channel.Channel_Role.DISABLED);
  });

  it('club + party: secondaries get precision 0 except the hunt channel', () => {
    const club = {
      name: 'Club',
      psk: new Uint8Array(32).fill(1),
      moduleSettings: { positionPrecision: 32 },
    };
    const p = { name: 'Party', psk: new Uint8Array(32).fill(2) };
    const msgs = buildProvisioningMessages({
      channels: [
        create(Channel.ChannelSettingsSchema, club),
        create(Channel.ChannelSettingsSchema, p),
      ],
      lora: party.loraConfig!,
      huntChannelIndex: 1,
    });
    const chans = msgs
      .filter((m) => m.payloadVariant.case === 'setChannel')
      .map((m) => m.payloadVariant.value as Channel.Channel);
    expect(chans[0]!.settings?.moduleSettings?.positionPrecision).toBe(0);
    expect(chans[1]!.role).toBe(Channel.Channel_Role.SECONDARY);
    expect(chans[1]!.settings?.moduleSettings?.positionPrecision).toBe(32);
  });

  it('sets role CLIENT and rebroadcast ALL, and the recommended position settings', () => {
    const msgs = buildProvisioningMessages(planFromChannelSet(party));
    const cfg = (name: string) =>
      msgs.find(
        (m) =>
          m.payloadVariant.case === 'setConfig' &&
          m.payloadVariant.value.payloadVariant.case === name,
      )!.payloadVariant.value as Config.Config;
    const device = cfg('device').payloadVariant.value as Config.Config_DeviceConfig;
    expect(device.role).toBe(Config.Config_DeviceConfig_Role.CLIENT);
    expect(device.rebroadcastMode).toBe(Config.Config_DeviceConfig_RebroadcastMode.ALL);
    const pos = cfg('position').payloadVariant.value as Config.Config_PositionConfig;
    expect(pos).toMatchObject(RECOMMENDED_POSITION_CONFIG);
    expect(pos.positionBroadcastSecs).toBe(120);
    expect(pos.positionBroadcastSmartEnabled).toBe(true);
    const lora = cfg('lora').payloadVariant.value as Config.Config_LoRaConfig;
    expect(lora).toMatchObject({
      region: Config.Config_LoRaConfig_RegionCode.US,
      modemPreset: Config.Config_LoRaConfig_ModemPreset.LONG_FAST,
      hopLimit: 3,
      usePreset: true,
      txEnabled: true,
    });
  });

  it('keeps unrelated current settings (GPS pins, node info interval) and overrides the rest', () => {
    const msgs = buildProvisioningMessages({
      ...planFromChannelSet(party),
      current: {
        device: create(Config.Config_DeviceConfigSchema, {
          role: Config.Config_DeviceConfig_Role.ROUTER,
          rebroadcastMode: Config.Config_DeviceConfig_RebroadcastMode.CORE_PORTNUMS_ONLY,
          nodeInfoBroadcastSecs: 10800,
        }),
        position: create(Config.Config_PositionConfigSchema, {
          rxGpio: 34,
          txGpio: 12,
          positionBroadcastSecs: 3600,
        }),
        lora: create(Config.Config_LoRaConfigSchema, {
          region: Config.Config_LoRaConfig_RegionCode.EU_868,
          txPower: 20,
          sx126xRxBoostedGain: true,
        }),
      },
      position: { positionBroadcastSecs: 300 },
    });
    const byCase = Object.fromEntries(
      msgs
        .filter((m) => m.payloadVariant.case === 'setConfig')
        .map((m) => {
          const c = (m.payloadVariant.value as Config.Config).payloadVariant;
          return [c.case, c.value];
        }),
    );
    expect(byCase.device).toMatchObject({
      role: Config.Config_DeviceConfig_Role.CLIENT,
      rebroadcastMode: Config.Config_DeviceConfig_RebroadcastMode.ALL,
      nodeInfoBroadcastSecs: 10800,
    });
    expect(byCase.position).toMatchObject({ rxGpio: 34, txGpio: 12, positionBroadcastSecs: 300 });
    // ChannelSet radio settings win; values the ChannelSet leaves at default come from it too.
    expect(byCase.lora).toMatchObject({
      region: Config.Config_LoRaConfig_RegionCode.US,
      sx126xRxBoostedGain: false,
    });
  });

  it('rejects bad plans', () => {
    expect(() => buildProvisioningMessages({ channels: [], lora: party.loraConfig! })).toThrow(
      RangeError,
    );
    expect(() =>
      buildProvisioningMessages({
        channels: Array(9).fill(party.settings[0]),
        lora: party.loraConfig!,
      }),
    ).toThrow(RangeError);
    expect(() =>
      buildProvisioningMessages({ ...planFromChannelSet(party), huntChannelIndex: 1 }),
    ).toThrow(RangeError);
    expect(() =>
      planFromChannelSet(create(AppOnly.ChannelSetSchema, { settings: party.settings })),
    ).toThrow();
  });

  it('does not mutate the input channel settings', () => {
    const before = party.settings[0]!.moduleSettings?.positionPrecision;
    buildProvisioningMessages({ ...planFromChannelSet(party), huntChannelIndex: 0 });
    expect(party.settings[0]!.moduleSettings?.positionPrecision).toBe(before);
  });
});

describe('MeshClient.provision over the fake radio', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('scan a join QR, provision the radio, and the radio holds the new channel', async () => {
    const radio = new FakeRadio({ nodeNum: 0x1234 });
    const client = new MeshClient({ transport: radio, random: seededRandom(5) });
    await client.connect();
    await jest.advanceTimersByTimeAsync(0);

    const qr = encodeJoinUrl({ channelSet: party, target: { kind: 'party', partyId: 'p1' } });
    const { channelSet } = decodeJoinUrl(qr);
    const handles = client.provision(planFromChannelSet(channelSet));
    expect(handles).toHaveLength(13);
    await jest.advanceTimersByTimeAsync(13 * 250);

    // Admin packets go to our own node on ADMIN_APP, in order.
    const packets = radio.writes
      .filter((w) => w.payloadVariant.case === 'packet')
      .map((w) => w.payloadVariant.value as Mesh.MeshPacket);
    expect(packets).toHaveLength(13);
    for (const p of packets) {
      expect(p.to).toBe(0x1234);
      expect((p.payloadVariant.value as Mesh.Data).portnum).toBe(Portnums.PortNum.ADMIN_APP);
    }
    expect(
      cases(packets.map((p) => decodeAdmin((p.payloadVariant.value as Mesh.Data).payload))),
    ).toEqual(cases(radio.adminLog));

    expect(radio.editing).toBe(false);
    expect(radio.channels[0]?.settings?.psk).toEqual(party.settings[0]!.psk);
    expect(radio.channels[1]?.role).toBe(Channel.Channel_Role.DISABLED);
    // Board GPS pins from the radio's current config survived.
    expect((radio.config.position as Config.Config_PositionConfig).rxGpio).toBe(34);
    expect((radio.config.device as Config.Config_DeviceConfig).nodeInfoBroadcastSecs).toBe(10800);
    expect((radio.config.device as Config.Config_DeviceConfig).rebroadcastMode).toBe(
      Config.Config_DeviceConfig_RebroadcastMode.ALL,
    );
    const results = await Promise.all(handles.map((h) => h.result));
    expect(results.every((r) => r.status === 'acked')).toBe(true);

    // After the radio reboots, the handshake shows the new channel.
    radio.dropLink();
    radio.restoreLink();
    await jest.advanceTimersByTimeAsync(0);
    expect(client.channels.get(0)?.settings?.name).toBe('Party');
  });
});
