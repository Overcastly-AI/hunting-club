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
import type { EnvConfig } from '../../config';
import { LOG_RETENTION } from '../constructs/node-lambda';
import { wellKnownFiles } from '../well-known';

export interface WebStackProps extends StackProps {
  readonly config: EnvConfig;
}

/**
 * The web admin page and universal-link files: a private S3 bucket behind CloudFront
 * (origin access control, HTTPS only) at the environment's domain.
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
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
    });

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: config.hostedZoneId,
      zoneName: config.domainName,
    });
    const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution));
    new route53.ARecord(this, 'AliasA', { zone, target });
    new route53.AaaaRecord(this, 'AliasAAAA', { zone, target });

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
        distributionPaths: ['/.well-known/*'],
        logGroup: new logs.LogGroup(this, 'WellKnownDeployLogs', {
          retention: LOG_RETENTION,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      });
    }
  }
}
