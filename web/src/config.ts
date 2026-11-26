/**
 * Build-time configuration, injected by vite.config.ts from infra/config/<env>.ts
 * (the single source of environment identifiers).
 */
export interface WebConfig {
  readonly envName: string;
  readonly region: string;
  readonly userPoolId: string;
  /** Null until the operator creates the web app client; sign-in then runs in demo mode. */
  readonly webClientId: string | null;
}

declare const __WEB_CONFIG__: WebConfig;

export const webConfig: WebConfig = __WEB_CONFIG__;
