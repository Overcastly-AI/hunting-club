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

export async function applyChannelSet(client: MeshClient, channelSet: ChannelSet): Promise<void> {
  if (!client.isReady) {
    throw new ChannelApplyError('radio-not-connected', 'Connect your radio first');
  }
  const results = await Promise.all(
    client.provision(planFromChannelSet(channelSet)).map((h) => h.result),
  );
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
