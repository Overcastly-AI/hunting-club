import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { App, Tags } from 'aws-cdk-lib';
import { PROJECT, type EnvConfig } from '../config';
import { siteDistPath as defaultSiteDistPath, webDistPath as defaultWebDistPath } from './paths';
import { ApiStack } from './stacks/api-stack';
import { WebStack } from './stacks/web-stack';

export interface BuildOptions {
  /** Built club admin to deploy (under /app/); defaults to web/dist. Tests pass a small fixture. */
  readonly webDistPath?: string;
  /** Built public site to deploy (at the root); defaults to site/dist. */
  readonly siteDistPath?: string;
}

/** Builds every stack for one environment. Used by bin/app.ts and by the tests. */
export function buildApp(config: EnvConfig, app = new App(), options: BuildOptions = {}) {
  const webDistPath = options.webDistPath ?? defaultWebDistPath();
  if (!existsSync(join(webDistPath, 'index.html'))) {
    throw new Error(`No web build at ${webDistPath}. Run: npm run build -w @huntclub/web`);
  }
  const siteDistPath = options.siteDistPath ?? defaultSiteDistPath();
  if (!existsSync(join(siteDistPath, 'index.html'))) {
    throw new Error(`No site build at ${siteDistPath}. Run: npm run build -w @huntclub/site`);
  }
  // Explicit account/region: `cdk synth` needs no AWS credentials and no lookups.
  const env = { account: config.account, region: config.region };
  const prefix = `HuntClub-${config.name}`;

  const web = new WebStack(app, `${prefix}-Web`, { env, config, webDistPath, siteDistPath });
  // The club table and user pool are owned by config.dataStackName, not by CDK.
  const api = new ApiStack(app, `${prefix}-Api`, { env, config, packBucket: web.bucket });

  Tags.of(app).add('Project', PROJECT);
  Tags.of(app).add('Env', config.name);

  return { app, stacks: { web, api } };
}
