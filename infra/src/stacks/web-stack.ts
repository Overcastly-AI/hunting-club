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
import { MAP_PACKS_PREFIX } from '@huntclub/shared/maps';
import type { EnvConfig } from '../../config';
import { LOG_RETENTION } from '../constructs/node-lambda';
import { ROBOTS_FILE, robotsTxt, WELL_KNOWN_PREFIX, webPageRewriteSource } from '../web-pages';
import { wellKnownFiles } from '../well-known';

export interface WebStackProps extends StackProps {
  readonly config: EnvConfig;
  /** Built web admin page (`npm run build -w @huntclub/web` → web/dist). */
  readonly webDistPath: string;
}

/** Vite puts fingerprinted files here; they never change, so they cache for a year. */
const HASHED_ASSETS = 'assets/*';
const WELL_KNOWN = `${WELL_KNOWN_PREFIX}*`;
/** Club map packs, written by the map-pack builder Lambda (never pruned by web deploys). */
const MAP_PACKS = `${MAP_PACKS_PREFIX}*`;

/**
 * The web admin page (web/dist) and universal-link files: a private S3 bucket behind
 * CloudFront (origin access control, HTTPS only) at the environment's domain.
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

    // Pay-per-request (no always-on compute): index.html for every page path (SPA fallback).
    const webPages = new cloudfront.Function(this, 'WebPageRewrite', {
      comment: 'Serve index.html for every path without a file extension',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(webPageRewriteSource()),
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `${config.domainName} web admin page`,
      domainNames: [config.domainName],
      certificate: acm.Certificate.fromCertificateArn(this, 'Certificate', config.certificateArn),
      defaultRootObject: 'index.html',
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // North America and Europe edges only: the cheapest price class.
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        // LIST lets S3 answer a missing file with 404 instead of 403. Listing itself is
        // unreachable: `/` is the default root object and query strings are not forwarded.
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket, {
          originAccessLevels: [cloudfront.AccessLevel.READ, cloudfront.AccessLevel.LIST],
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [
          { function: webPages, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
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
    const site = s3deploy.Source.asset(props.webDistPath);

    new s3deploy.BucketDeployment(this, 'SiteAssets', {
      destinationBucket: this.bucket,
      sources: [site],
      exclude: ['*'],
      include: [HASHED_ASSETS],
      cacheControl: [
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(Duration.days(365)),
        s3deploy.CacheControl.immutable(),
      ],
      prune: false,
      logGroup: deployLogs,
    });

    new s3deploy.BucketDeployment(this, 'SitePages', {
      destinationBucket: this.bucket,
      sources: [site],
      // Excluded keys are never pruned: hashed assets, universal-link files, robots.txt and
      // map packs stay.
      exclude: [HASHED_ASSETS, WELL_KNOWN, ROBOTS_FILE, MAP_PACKS],
      cacheControl: [s3deploy.CacheControl.noCache()],
      prune: true,
      distribution: this.distribution,
      distributionPaths: ['/*'],
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
