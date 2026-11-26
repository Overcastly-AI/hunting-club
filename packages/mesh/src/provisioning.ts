/**
 * Builds the AdminMessage sequence that applies a hunt channel set to the
 * phone's own radio over BLE (no session passkey needed for the local node):
 *
 *   begin_edit_settings
 *   set_channel × 8 (0 = PRIMARY, then SECONDARY, the rest DISABLED)
 *   set_config lora
 *   set_config position
 *   set_config device (role CLIENT, rebroadcast_mode ALL)
 *   commit_edit_settings
 *
 * The radio may reboot after commit; MeshClient re-runs the handshake when
 * the link comes back.
 *
 * Settings are always written explicitly (firmware 2.7+ "fails closed" on
 * missing position_precision and drops private ports under
 * CORE_PORTNUMS_ONLY). Config sections replace the whole section on the
 * radio, so pass the radio's current sections (MeshClient.config) to keep
 * board-specific values such as GPS pins.
 */
import {
  clone,
  create,
  type DescMessage,
  type MessageInitShape,
  type MessageShape,
} from '@bufbuild/protobuf';
import { Admin, Channel, Config } from './protobufs';
import type { ChannelSet, ChannelSettings } from './codec/channelUrl';
import { HUNT_POSITION_PRECISION, MAX_CHANNELS } from './codec/channelUrl';

export type AdminMessage = Admin.AdminMessage;

/** Spec: one setting for now (120 s + smart position) until real-radio testing. */
export const RECOMMENDED_POSITION_CONFIG: Readonly<
  MessageInitShape<typeof Config.Config_PositionConfigSchema>
> = {
  gpsMode: Config.Config_PositionConfig_GpsMode.ENABLED,
  gpsUpdateInterval: 30,
  positionBroadcastSecs: 120,
  positionBroadcastSmartEnabled: true,
  broadcastSmartMinimumDistance: 30,
  broadcastSmartMinimumIntervalSecs: 60,
  fixedPosition: false,
  positionFlags:
    Config.Config_PositionConfig_PositionFlags.ALTITUDE |
    Config.Config_PositionConfig_PositionFlags.TIMESTAMP,
};

export interface CurrentRadioConfig {
  device?: Config.Config_DeviceConfig;
  position?: Config.Config_PositionConfig;
  lora?: Config.Config_LoRaConfig;
}

export interface ProvisioningPlan {
  /** Channels in order: first is PRIMARY, the rest SECONDARY. Usually from a ChannelSet. */
  channels: ChannelSettings[];
  /** Radio settings to apply (from the ChannelSet). Required: we always write explicit settings. */
  lora: Config.Config_LoRaConfig;
  /** Index of the channel that carries positions (precision 32); all others get 0. Default 0. */
  huntChannelIndex?: number;
  /** Overrides on top of RECOMMENDED_POSITION_CONFIG. */
  position?: Partial<MessageInitShape<typeof Config.Config_PositionConfigSchema>>;
  /** The radio's current config, merged under our settings so unrelated fields survive. */
  current?: CurrentRadioConfig;
}

export function planFromChannelSet(cs: ChannelSet, current?: CurrentRadioConfig): ProvisioningPlan {
  if (!cs.loraConfig) throw new Error('Channel set has no radio settings');
  const plan: ProvisioningPlan = { channels: cs.settings, lora: cs.loraConfig };
  if (current) plan.current = current;
  return plan;
}

/** Returns the AdminMessages in the order they must be sent. */
export function buildProvisioningMessages(plan: ProvisioningPlan): AdminMessage[] {
  const { channels } = plan;
  if (channels.length === 0 || channels.length > MAX_CHANNELS) {
    throw new RangeError(`Need 1 to ${MAX_CHANNELS} channels`);
  }
  const hunt = plan.huntChannelIndex ?? 0;
  if (hunt < 0 || hunt >= channels.length) throw new RangeError('huntChannelIndex is out of range');

  const msgs: AdminMessage[] = [];
  const admin = (v: MessageInitShape<typeof Admin.AdminMessageSchema>['payloadVariant']) =>
    msgs.push(create(Admin.AdminMessageSchema, { payloadVariant: v }));

  admin({ case: 'beginEditSettings', value: true });

  for (let index = 0; index < MAX_CHANNELS; index++) {
    const s = channels[index];
    if (!s) {
      admin({ case: 'setChannel', value: { index, role: Channel.Channel_Role.DISABLED } });
      continue;
    }
    const settings = clone(Channel.ChannelSettingsSchema, s);
    settings.moduleSettings = create(Channel.ModuleSettingsSchema, {
      isMuted: s.moduleSettings?.isMuted ?? false,
      positionPrecision: index === hunt ? HUNT_POSITION_PRECISION : 0,
    });
    admin({
      case: 'setChannel',
      value: {
        index,
        role: index === 0 ? Channel.Channel_Role.PRIMARY : Channel.Channel_Role.SECONDARY,
        settings,
      },
    });
  }

  const cur = plan.current ?? {};
  const lora = merged(Config.Config_LoRaConfigSchema, cur.lora, plan.lora);
  const position = merged(
    Config.Config_PositionConfigSchema,
    cur.position,
    RECOMMENDED_POSITION_CONFIG,
    plan.position,
  );
  const device = merged(Config.Config_DeviceConfigSchema, cur.device, {
    role: Config.Config_DeviceConfig_Role.CLIENT,
    rebroadcastMode: Config.Config_DeviceConfig_RebroadcastMode.ALL,
  });
  admin({ case: 'setConfig', value: { payloadVariant: { case: 'lora', value: lora } } });
  admin({ case: 'setConfig', value: { payloadVariant: { case: 'position', value: position } } });
  admin({ case: 'setConfig', value: { payloadVariant: { case: 'device', value: device } } });

  admin({ case: 'commitEditSettings', value: true });
  return msgs;
}

/** Starts from a copy of `base` (or defaults) and overlays each patch's own fields. */
function merged<D extends DescMessage>(
  schema: D,
  base: MessageShape<D> | undefined,
  ...patches: (object | undefined)[]
): MessageShape<D> {
  const out = base ? clone(schema, base) : create(schema);
  for (const patch of patches) {
    if (!patch) continue;
    for (const [k, v] of Object.entries(patch)) {
      if (k === '$typeName' || k === '$unknown' || v === undefined) continue;
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
