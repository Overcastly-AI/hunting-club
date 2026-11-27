import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';
import { JOIN_PATH } from '@huntclub/shared/app';
import { MAP_PACK_OBJECT, MAP_PACKS_PREFIX } from '@huntclub/shared/maps';
import { OG_IMAGE } from '@huntclub/site/routes';
import type { EnvConfig } from '../../config';
import { LOG_RETENTION } from '../constructs/node-lambda';
import {
  ADMIN_PREFIX,
  NOINDEX_HEADER,
  NOT_FOUND_OBJECT,
  ROBOTS_FILE,
  robotsTxt,
  WELL_KNOWN_PREFIX,
  webPageRewriteSource,
} from '../web-pages';
import {
  contentSecurityPolicy as webContentSecurityPolicy,
  PERMISSIONS_POLICY,
  REFERRER_POLICY,
} from '../security-headers';
import { wellKnownFiles } from '../well-known';

export interface WebStackProps extends StackProps {
  readonly config: EnvConfig;
  /** Built club admin (`npm run build -w @huntclub/web` → web/dist), served under /app/. */
  readonly webDistPath: string;
  /** Built public site (`npm run build -w @huntclub/site` → site/dist), served at the root. */
  readonly siteDistPath: string;
  /**
   * The sample map pack, committed in the repo (web/sample-pack: the folder holds the archive at
   * its bucket key, packs/sample/<id>.pmtiles). The sign-in page draws it from the same origin.
   */
  readonly samplePackPath: string;
}

/** Vite puts fingerprinted files here; they never change, so they cache for a year. */
const HASHED_ASSETS = 'assets/*';
const WELL_KNOWN = `${WELL_KNOWN_PREFIX}*`;
/** The public site's Open Graph cards (stable URLs, rendered at build time). */
const OG_IMAGES = `${OG_IMAGE.dir}/*`;
/** Club map packs, written by the map-pack builder Lambda (never pruned by web deploys). */
const MAP_PACKS = `${MAP_PACKS_PREFIX}*`;

/**
 * The public site (site/dist, at the root), the club admin (web/dist, under /app/) and the
 * universal-link files: one private S3 bucket behind CloudFront (origin access control,
 * HTTPS only) at the environment's domain.
 */
export class WebStack extends Stack {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);
    const { config } = props;

    this.bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Pay-per-request (no always-on compute): the allowlist and redirects from the site's
    // route registry (see web-pages.ts).
    const webPages = new cloudfront.Function(this, 'WebPageRewrite', {
      comment: 'Site pages, the admin under /app/, and redirects (from the route registry)',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(webPageRewriteSource()),
    });

    // Security headers (security-headers.ts, one source with the smoke check): HSTS,
    // nosniff, no framing, the Content-Security-Policy and Permissions-Policy, plus
    // X-Robots-Tag where search engines must stay out. /join sends no referrer at all: its
    // URL holds an invite (in the fragment, which browsers never send, but no page there
    // should leak even its path).
    const contentSecurityPolicy = webContentSecurityPolicy(config);
    const headersPolicy = (id: string, referrerPolicy: cloudfront.HeadersReferrerPolicy) =>
      new cloudfront.ResponseHeadersPolicy(this, id, {
        comment: `${config.domainName} security headers, referrer ${referrerPolicy}`,
        securityHeadersBehavior: {
          contentSecurityPolicy: { contentSecurityPolicy, override: true },
          contentTypeOptions: { override: true },
          frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
          referrerPolicy: { referrerPolicy, override: true },
          strictTransportSecurity: { accessControlMaxAge: Duration.days(365), override: true },
          xssProtection: { protection: true, modeBlock: true, override: true },
        },
        customHeadersBehavior: {
          customHeaders: [
            { ...PERMISSIONS_POLICY, override: true },
            ...(config.searchIndexing ? [] : [{ ...NOINDEX_HEADER, override: true }]),
          ],
        },
      });
    const headers = headersPolicy('Headers', REFERRER_POLICY.site);
    const joinHeaders = headersPolicy('JoinHeaders', REFERRER_POLICY.join);

    // LIST lets S3 answer a missing file with 404 instead of 403. Listing itself is
    // unreachable: `/` is the default root object and query strings are not forwarded.
    const origin = origins.S3BucketOrigin.withOriginAccessControl(this.bucket, {
      originAccessLevels: [cloudfront.AccessLevel.READ, cloudfront.AccessLevel.LIST],
    });
    const behavior = (responseHeadersPolicy: cloudfront.IResponseHeadersPolicy) => ({
      origin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      responseHeadersPolicy,
      functionAssociations: [
        { function: webPages, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
      ],
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${config.domainName} public site and club admin`,
      domainNames: [config.domainName],
      certificate: acm.Certificate.fromCertificateArn(this, 'Certificate', config.certificateArn),
      defaultRootObject: 'index.html',
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // North America and Europe edges only: the cheapest price class.
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: behavior(headers),
      // The invite page, and its trailing-slash form (which the function redirects).
      additionalBehaviors: Object.fromEntries(
        [JOIN_PATH, `${JOIN_PATH}/*`].map((pattern) => [pattern, behavior(joinHeaders)]),
      ),
      // A missing file (S3 404, or 403 if listing were ever denied) is the branded 404 page,
      // with a real 404 status: no soft 404s.
      errorResponses: [404, 403].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 404,
        responsePagePath: NOT_FOUND_OBJECT,
        ttl: Duration.minutes(1),
      })),
    });

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: config.hostedZoneId,
      zoneName: config.domainName,
    });
    const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution));
    new route53.ARecord(this, 'AliasA', { zone, target });
    new route53.AaaaRecord(this, 'AliasAAAA', { zone, target });

    // One log group for every deployment: the deployment Lambda is a stack singleton.
    const deployLogs = new logs.LogGroup(this, 'DeployLogs', {
      retention: LOG_RETENTION,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const immutable = [
      s3deploy.CacheControl.setPublic(),
      s3deploy.CacheControl.maxAge(Duration.days(365)),
      s3deploy.CacheControl.immutable(),
    ];

    // The public site at the root: fingerprinted files cached for a year, pages never.
    const site = s3deploy.Source.asset(props.siteDistPath);
    new s3deploy.BucketDeployment(this, 'SiteAssets', {
      destinationBucket: this.bucket,
      sources: [site],
      exclude: ['*'],
      include: [HASHED_ASSETS],
      cacheControl: immutable,
      prune: false,
      logGroup: deployLogs,
    });
    new s3deploy.BucketDeployment(this, 'SitePages', {
      destinationBucket: this.bucket,
      sources: [site],
      // Excluded keys are never pruned: hashed assets, Open Graph cards, the admin,
      // universal-link files, robots.txt and map packs stay.
      exclude: [HASHED_ASSETS, OG_IMAGES, `${ADMIN_PREFIX}*`, WELL_KNOWN, ROBOTS_FILE, MAP_PACKS],
      cacheControl: [s3deploy.CacheControl.noCache()],
      prune: true,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      logGroup: deployLogs,
    });

    // Open Graph cards keep stable URLs (shared links point at them): cached for a day.
    new s3deploy.BucketDeployment(this, 'SiteOgImages', {
      destinationBucket: this.bucket,
      sources: [site],
      exclude: ['*'],
      include: [OG_IMAGES],
      cacheControl: [
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(Duration.days(1)),
      ],
      prune: false,
      distribution: this.distribution,
      distributionPaths: [`/${OG_IMAGES}`],
      logGroup: deployLogs,
    });

    // The club admin under /app/: the same split, inside its own prefix.
    const admin = s3deploy.Source.asset(props.webDistPath);
    new s3deploy.BucketDeployment(this, 'AdminAssets', {
      destinationBucket: this.bucket,
      destinationKeyPrefix: ADMIN_PREFIX,
      sources: [admin],
      exclude: ['*'],
      include: [HASHED_ASSETS],
      cacheControl: immutable,
      prune: false,
      logGroup: deployLogs,
    });
    new s3deploy.BucketDeployment(this, 'AdminPages', {
      destinationBucket: this.bucket,
      destinationKeyPrefix: ADMIN_PREFIX,
      sources: [admin],
      exclude: [HASHED_ASSETS],
      cacheControl: [s3deploy.CacheControl.noCache()],
      // Prunes only under app/.
      prune: true,
      distribution: this.distribution,
      distributionPaths: [`/${ADMIN_PREFIX}*`],
      logGroup: deployLogs,
    });

    // The sign-in backdrop's sample aerial, from the repo: no manual upload. Under packs/, so
    // site deploys never prune it; never pruned itself (club packs share the prefix). A new
    // archive gets a new id, so it caches for a year like every pack and needs no invalidation.
    new s3deploy.BucketDeployment(this, 'SamplePack', {
      destinationBucket: this.bucket,
      sources: [s3deploy.Source.asset(props.samplePackPath)],
      contentType: MAP_PACK_OBJECT.contentType,
      cacheControl: [s3deploy.CacheControl.fromString(MAP_PACK_OBJECT.cacheControl)],
      prune: false,
      logGroup: deployLogs,
    });

    // Per environment: dev disallows crawling.
    new s3deploy.BucketDeployment(this, 'Robots', {
      destinationBucket: this.bucket,
      sources: [s3deploy.Source.data(ROBOTS_FILE, robotsTxt(config))],
      contentType: 'text/plain; charset=utf-8',
      cacheControl: [s3deploy.CacheControl.maxAge(Duration.hours(1))],
      prune: false,
      distribution: this.distribution,
      distributionPaths: [`/${ROBOTS_FILE}`],
      logGroup: deployLogs,
    });

    const files = wellKnownFiles(config.appLinks);
    if (files.length > 0) {
      new s3deploy.BucketDeployment(this, 'WellKnown', {
        destinationBucket: this.bucket,
        sources: files.map((f) => s3deploy.Source.jsonData(f.key, f.body)),
        // Both files must be served as JSON (the AASA file has no extension).
        contentType: 'application/json',
        cacheControl: [s3deploy.CacheControl.maxAge(Duration.hours(1))],
        // Leave the web page's own files alone.
        prune: false,
        distribution: this.distribution,
        distributionPaths: [`/${WELL_KNOWN}`],
        logGroup: deployLogs,
      });
    }
  }
}
