import { CLOUD_ENVIRONMENTS } from '@huntclub/shared';
import type { CloudEnvironment } from '@huntclub/shared/cloud';
import type { EnvConfig } from '../config';

/** An environment's public cloud identifiers (CLOUD_ENVIRONMENTS, the single source). */
export function cloudFor(config: Pick<EnvConfig, 'name'>): CloudEnvironment {
  const cloud = (CLOUD_ENVIRONMENTS as Record<string, CloudEnvironment>)[config.name];
  if (!cloud) throw new Error(`No CLOUD_ENVIRONMENTS entry for "${config.name}"`);
  return cloud;
}
