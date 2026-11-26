import { APP_ID, APP_LINK_PATHS } from '@huntclub/shared';
import type { EnvConfig } from '../config';

/** A file published under https://<domain>/.well-known/. */
export interface WellKnownFile {
  readonly key: string;
  readonly body: unknown;
}

/** iOS universal links: /.well-known/apple-app-site-association (modern `components` format). */
export function appleAppSiteAssociation(teamId: string) {
  return {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${APP_ID}`],
          components: APP_LINK_PATHS.map((p) => ({ '/': `${p}*` })),
        },
      ],
    },
  };
}

/** Android app links: /.well-known/assetlinks.json. */
export function assetLinks(sha256CertFingerprints: readonly string[]) {
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: APP_ID,
        sha256_cert_fingerprints: [...sha256CertFingerprints],
      },
    },
  ];
}

/**
 * The verification files to publish for an environment. A file is published only once
 * its inputs are known: a file with a placeholder team ID or no fingerprints would make
 * iOS / Android cache a failed verification.
 */
export function wellKnownFiles(appLinks: EnvConfig['appLinks']): WellKnownFile[] {
  const files: WellKnownFile[] = [];
  if (appLinks.appleTeamId) {
    files.push({
      key: '.well-known/apple-app-site-association',
      body: appleAppSiteAssociation(appLinks.appleTeamId),
    });
  }
  if (appLinks.androidSha256CertFingerprints.length > 0) {
    files.push({
      key: '.well-known/assetlinks.json',
      body: assetLinks(appLinks.androidSha256CertFingerprints),
    });
  }
  return files;
}
