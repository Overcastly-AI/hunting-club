import type { EnvConfig } from './types';

/**
 * The dev environment. Values from docs/STATUS.md "AWS environment (dev)" (2026-11-26).
 * This is the only place they appear; stacks receive them through EnvConfig.
 */
export const dev: EnvConfig = {
  name: 'dev',
  account: '054825383623',
  region: 'us-east-1',
  domainName: 'huntclub-dev.jaycobjones.com',
  hostedZoneId: 'Z041480814OY68TGPM84F',
  certificateArn:
    'arn:aws:acm:us-east-1:054825383623:certificate/ece3d63e-c299-4106-b448-88b7bb3dcb48',
  appLinks: {
    // Owner to supply: Apple Team ID and the EAS / Play signing SHA-256 fingerprints.
    appleTeamId: undefined,
    androidSha256CertFingerprints: [],
  },
  pointInTimeRecovery: false,
};
