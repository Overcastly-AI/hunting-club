import { APP_ID } from '@huntclub/shared';
import { appleAppSiteAssociation, assetLinks, wellKnownFiles } from '../src/well-known';

describe('universal-link files', () => {
  it('builds the AASA file from the team ID and the shared app ID', () => {
    expect(appleAppSiteAssociation('ABCDE12345')).toEqual({
      applinks: {
        details: [{ appIDs: [`ABCDE12345.${APP_ID}`], components: [{ '/': '/join*' }] }],
      },
    });
  });

  it('builds assetlinks.json for the shared Android package', () => {
    expect(assetLinks(['AA:BB'])).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: APP_ID,
          sha256_cert_fingerprints: ['AA:BB'],
        },
      },
    ]);
  });

  it('publishes each file only when its inputs are known', () => {
    expect(wellKnownFiles({ androidSha256CertFingerprints: [] })).toEqual([]);
    expect(
      wellKnownFiles({ appleTeamId: 'T', androidSha256CertFingerprints: [] }).map((f) => f.key),
    ).toEqual(['.well-known/apple-app-site-association']);
    expect(wellKnownFiles({ androidSha256CertFingerprints: ['AA'] }).map((f) => f.key)).toEqual([
      '.well-known/assetlinks.json',
    ]);
  });
});
