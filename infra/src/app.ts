import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { App, Tags } from 'aws-cdk-lib';
import { PROJECT, type EnvConfig } from '../config';
import { webDistPath as defaultWebDistPath } from './paths';
import { ApiStack } from './stacks/api-stack';
import { WebStack } from './stacks/web-stack';

export interface BuildOptions {
  /** Built web page to deploy; defaults to web/dist. Tests pass a small fixture. */
  readonly webDistPath?: string;
}

/** Builds every stack for one environment. Used by bin/app.ts and by the tests. */
export function buildApp(config: EnvConfig, app = new App(), options: BuildOptions = {}) {
  const webDistPath = options.webDistPath ?? defaultWebDistPath();
  if (!existsSync(join(webDistPath, 'index.html'))) {
    throw new Error(`No web build at ${webDistPath}. Run: npm run build -w @huntclub/web`);
  }
  // Explicit account/region: `cdk synth` needs no AWS credentials and no lookups.
  const env = { account: config.account, region: config.region };
  const prefix = `HuntClub-${config.name}`;

  const web = new WebStack(app, `${prefix}-Web`, { env, config, webDistPath });
  // The club table and user pool are owned by config.dataStackName, not by CDK.
  const api = new ApiStack(app, `${prefix}-Api`, { env, config, packBucket: web.bucket });

  Tags.of(app).add('Project', PROJECT);
  Tags.of(app).add('Env', config.name);

  return { app, stacks: { web, api } };
}
