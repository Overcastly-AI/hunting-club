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
  // Built by the owner's operator as CloudFormation stack HuntClubMeshDataDev (Retain).
  dataStackName: 'HuntClubMeshDataDev',
  clubTableName: 'hunt-club-mesh-dev',
  // Test-mode Price ids, per plan. Pending: the owner/operator creates the Stripe product.
  stripe: { prices: {} },
  cognito: {
    userPoolId: 'us-east-1_0W2YbjVht',
    appClientId: '5dn1jcrnef1v6cfv6da0i7qtne',
    webClientId: '6mpfpr6nrdqddim7trfqckegu5',
  },
};
