import { App, Tags } from 'aws-cdk-lib';
import { PROJECT, type EnvConfig } from '../config';
import { ApiStack } from './stacks/api-stack';
import { AuthStack } from './stacks/auth-stack';
import { DataStack } from './stacks/data-stack';
import { WebStack } from './stacks/web-stack';

/** Builds every stack for one environment. Used by bin/app.ts and by the tests. */
export function buildApp(config: EnvConfig, app = new App()) {
  // Explicit account/region: `cdk synth` needs no AWS credentials and no lookups.
  const env = { account: config.account, region: config.region };
  const prefix = `HuntClub-${config.name}`;

  const web = new WebStack(app, `${prefix}-Web`, { env, config });
  const data = new DataStack(app, `${prefix}-Data`, { env, config });
  const auth = new AuthStack(app, `${prefix}-Auth`, { env, config });
  const api = new ApiStack(app, `${prefix}-Api`, {
    env,
    config,
    table: data.table,
    userPool: auth.userPool,
    clients: [auth.appClient, auth.webClient],
  });

  Tags.of(app).add('Project', PROJECT);
  Tags.of(app).add('Env', config.name);

  return { app, stacks: { web, data, auth, api } };
}
