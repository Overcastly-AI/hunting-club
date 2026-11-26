/** Production clients, built once per container by the Lambda entry points in infra/. */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { type ClubData, createClubData, DOCUMENT_CLIENT_OPTIONS } from '@huntclub/club-data';
import Stripe from 'stripe';
import type { MapPackBuild } from '@huntclub/shared';
import { stripeApi, type StripeApi } from './billing';
import type { ThinEvent } from './stripeWebhook';

export function clubDataForTable(tableName: string): ClubData {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), DOCUMENT_CLIENT_OPTIONS);
  return createClubData({ client, tableName });
}

/** Stripe pinned to the SDK's API version (2026-11-18.endive for stripe-node 23). */
export function connectStripe(apiKey: string): {
  api: StripeApi;
  /** Signature verification for thin events with this endpoint's signing secret. */
  verifier: (webhookSecret: string) => (payload: Buffer, signature: string) => ThinEvent;
} {
  const stripe = new Stripe(apiKey);
  return {
    api: stripeApi(stripe),
    verifier: (secret) => (payload, signature) =>
      stripe.parseEventNotification(payload, signature, secret),
  };
}

/** Starts the map-pack builder without waiting for it (async invoke). */
export function mapPackStarter(functionName: string): (build: MapPackBuild) => Promise<void> {
  const lambda = new LambdaClient({});
  return async (build) => {
    await lambda.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify(build)),
      }),
    );
  };
}

/** Writes a finished map pack archive (unique key: cached for a year at the edge). */
export function mapPackUploader(bucket: string): (key: string, body: Buffer) => Promise<void> {
  const s3 = new S3Client({});
  return async (key, body) => {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'application/vnd.pmtiles',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  };
}
