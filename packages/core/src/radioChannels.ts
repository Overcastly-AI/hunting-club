/**
 * Putting a party's or club's channels on our radio: the one implementation, used
 * by PartyService and by the app's club layer. Writes explicit settings with
 * mesh's provisioning plan, then waits for the radio to come back (it may reboot).
 * The channel set holds the channel key: never log it.
 */
import { type ChannelSet, type MeshClient, planFromChannelSet } from '@huntclub/mesh';

export type ChannelApplyErrorCode = 'radio-not-connected' | 'radio-rejected';

export class ChannelApplyError extends Error {
  constructor(
    readonly code: ChannelApplyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ChannelApplyError';
  }
}

/**
 * Writes `channelSet` to our radio. With `under`, that set's primary channel stays
 * first (index 0, e.g. the club's) and `channelSet`'s channels follow it as
 * secondaries (e.g. a party inside the club); radio settings come from `under`.
 */
export async function applyChannelSet(
  client: MeshClient,
  channelSet: ChannelSet,
  opts: { under?: ChannelSet } = {},
): Promise<void> {
  if (!client.isReady) {
    throw new ChannelApplyError('radio-not-connected', 'Connect your radio first');
  }
  const plan = opts.under
    ? {
        ...planFromChannelSet(opts.under),
        channels: [...opts.under.settings.slice(0, 1), ...channelSet.settings],
      }
    : planFromChannelSet(channelSet);
  const results = await Promise.all(client.provision(plan).map((h) => h.result));
  const failed = results.find((r) => r.status !== 'acked' && r.status !== 'sent');
  if (failed) {
    throw new ChannelApplyError(
      'radio-rejected',
      `The radio did not accept the settings (${failed.status})`,
    );
  }
  await client.waitUntilReady();
}

/** True when our radio's primary channel already has this set's key (nothing to write). */
export function radioHasChannelSet(client: MeshClient, channelSet: ChannelSet): boolean {
  const want = channelSet.settings[0]?.psk;
  const have = client.channels.get(0)?.settings?.psk;
  return !!want && !!have && want.length === have.length && want.every((b, i) => b === have[i]);
}
