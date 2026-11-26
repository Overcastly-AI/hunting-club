/** Production clients, built once per container by the Lambda entry points in infra/. */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { type ClubData, createClubData, DOCUMENT_CLIENT_OPTIONS } from '@huntclub/club-data';
import Stripe from 'stripe';
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
