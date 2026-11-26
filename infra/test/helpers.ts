import { join } from 'node:path';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { dev } from '../config/dev';
import type { EnvConfig } from '../config';
import { buildApp } from '../src/app';
import cdkJson from '../cdk.json';

/** A two-file stand-in for web/dist, so tests don't depend on a web build. */
export const WEB_DIST_FIXTURE = join(__dirname, 'fixtures', 'web-dist');

/** The feature flags `cdk deploy` uses (cdk.json), so tests synthesize what deploys. */
export const CDK_CONTEXT = cdkJson.context;

/** Synthesizes every stack for a config (dev by default) and returns their templates. */
export function synthTemplates(overrides: Partial<EnvConfig> = {}) {
  const { stacks } = buildApp({ ...dev, ...overrides }, new App({ context: CDK_CONTEXT }), {
    webDistPath: WEB_DIST_FIXTURE,
  });
  return {
    web: Template.fromStack(stacks.web),
    api: Template.fromStack(stacks.api),
  };
}

export type Templates = ReturnType<typeof synthTemplates>;
