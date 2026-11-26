import { WEB_DOMAINS } from '@huntclub/shared/app';
import { CLOUD_ENVIRONMENTS } from '@huntclub/shared/cloud';
import type { EnvConfig } from './types';

/**
 * The dev environment. Values from docs/STATUS.md "AWS environment (dev)" (2026-11-26).
 * This is the only place they appear; stacks receive them through EnvConfig.
 */
export const dev: EnvConfig = {
  name: 'dev',
  account: '054825383623',
  region: 'us-east-1',
  domainName: WEB_DOMAINS.dev,
  searchIndexing: false,
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
  // Public ids shared with the app and web admin (one source: @huntclub/shared/cloud).
  cognito: {
    userPoolId: CLOUD_ENVIRONMENTS.dev.userPoolId,
    appClientId: CLOUD_ENVIRONMENTS.dev.appClientId,
    webClientId: CLOUD_ENVIRONMENTS.dev.webClientId,
  },
};
