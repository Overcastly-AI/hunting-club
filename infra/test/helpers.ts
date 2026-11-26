import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { dev } from '../config/dev';
import type { EnvConfig } from '../config';
import { buildApp } from '../src/app';

/** Synthesizes every stack for a config (dev by default) and returns their templates. */
export function synthTemplates(overrides: Partial<EnvConfig> = {}) {
  const { stacks } = buildApp({ ...dev, ...overrides }, new App());
  return {
    web: Template.fromStack(stacks.web),
    api: Template.fromStack(stacks.api),
    ops: Template.fromStack(stacks.ops),
  };
}

export type Templates = ReturnType<typeof synthTemplates>;
