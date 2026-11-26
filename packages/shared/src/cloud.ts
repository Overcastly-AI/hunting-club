// The club cloud's public identifiers per environment: the single source for the app,
// the web admin and infra. None of these are secrets (Cognito app clients have no
// secret; the API is public behind token checks).

export interface CloudEnvironment {
  readonly region: string;
  readonly userPoolId: string;
  /** Expo app client (USER_AUTH, email one-time code). */
  readonly appClientId: string;
  /** Web admin client; set once the operator creates it. */
  readonly webClientId?: string;
  /** Club API Function URL (no trailing slash); set once deployed. */
  readonly clubApiUrl?: string;
  /** Web admin page and club map packs (CloudFront), e.g. `huntclub-dev.example.com`. */
}

export const CLOUD_ENVIRONMENTS = {
  dev: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_0W2YbjVht',
    appClientId: '5dn1jcrnef1v6cfv6da0i7qtne',
    webClientId: '6mpfpr6nrdqddim7trfqckegu5',
    // Pending from the operator: the deployed club API URL.
  },
} as const satisfies Record<string, CloudEnvironment>;

export type CloudEnvironmentName = keyof typeof CLOUD_ENVIRONMENTS;
