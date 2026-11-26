import { App, Tags } from 'aws-cdk-lib';
import { PROJECT, type EnvConfig } from '../config';
import { ApiStack } from './stacks/api-stack';
import { WebStack } from './stacks/web-stack';

/** Builds every stack for one environment. Used by bin/app.ts and by the tests. */
export function buildApp(config: EnvConfig, app = new App()) {
  // Explicit account/region: `cdk synth` needs no AWS credentials and no lookups.
  const env = { account: config.account, region: config.region };
  const prefix = `HuntClub-${config.name}`;

  const web = new WebStack(app, `${prefix}-Web`, { env, config });
  // The club table and user pool are owned by config.dataStackName, not by CDK.
  const api = new ApiStack(app, `${prefix}-Api`, { env, config });

  Tags.of(app).add('Project', PROJECT);
  Tags.of(app).add('Env', config.name);

  return { app, stacks: { web, api } };
}
