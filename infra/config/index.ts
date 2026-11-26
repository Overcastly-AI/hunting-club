import { dev } from './dev';
import type { EnvConfig } from './types';

export * from './types';

const ENVIRONMENTS: Readonly<Record<string, EnvConfig>> = { dev };

/** Looks up an environment by name (`cdk synth -c env=dev`); dev is the default. */
export function getEnvConfig(name = 'dev'): EnvConfig {
  const config = ENVIRONMENTS[name];
  if (!config) {
    throw new Error(
      `Unknown environment "${name}". Known: ${Object.keys(ENVIRONMENTS).join(', ')}`,
    );
  }
  return config;
}
