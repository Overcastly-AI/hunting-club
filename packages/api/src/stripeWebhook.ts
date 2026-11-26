/**
 * Stripe webhook (Lambda Function URL, thin events). Order of work:
 * 1. Verify the signature over the exact raw body; reject before any other work.
 * 2. Ignore event types we don't handle (200, so Stripe stops sending them).
 * 3. Re-fetch the subscription from Stripe (event order isn't guaranteed) and apply
 *    its current state with club-data's applyStripeEvent, idempotent on the event id.
 * A Stripe or database failure answers 500 so Stripe retries (for up to 3 days).
 * A permanent data problem (e.g. the subscription belongs to another club) is logged
 * and acknowledged, because retrying can't fix it. Never logs bodies or secrets.
 */
import { type ClubData, ClubDataError, SERVICE } from '@huntclub/club-data';
import { subscriptionIdForEvent, subscriptionState, type StripeApi } from './billing';
import { errorResponse } from './errors';
import { type Handler, headerOf, jsonResponse, logLine, methodOf, rawBody } from './http';

/** A verified thin event (what Stripe's parseEventNotification returns). */
export interface ThinEvent {
  id: string;
  type: string;
  /** Singleton objects (no id) are never ones we act on. */
  related_object?: { id?: string; type: string } | null;
}

export interface StripeWebhookDeps {
  data: ClubData;
  /** Verifies the `stripe-signature` header over the raw body; throws if invalid. */
  verify: (payload: Buffer, signature: string) => ThinEvent;
  stripe: StripeApi;
}

export function createStripeWebhook(deps: StripeWebhookDeps): Handler {
  return async (event) => {
    if (methodOf(event) !== 'POST') return { ...errorResponse('not_found'), statusCode: 405 };
    let thin: ThinEvent;
    try {
      thin = deps.verify(rawBody(event), headerOf(event, 'stripe-signature') ?? '');
    } catch {
      logLine({ msg: 'stripe-webhook', outcome: 'bad_signature' });
      return errorResponse('invalid', 'invalid signature');
    }
    const log = (outcome: string, extra: Record<string, unknown> = {}) =>
      logLine({ msg: 'stripe-webhook', eventId: thin.id, type: thin.type, outcome, ...extra });

    try {
      const subscriptionId = await subscriptionIdForEvent(deps.stripe, thin);
      if (!subscriptionId) {
        log('ignored');
        return jsonResponse(200, { received: true, outcome: 'ignored' });
      }
      const state = subscriptionState(await deps.stripe.retrieveSubscription(subscriptionId));
      if (!state) {
        log('not_ours');
        return jsonResponse(200, { received: true, outcome: 'ignored' });
      }
      const outcome = await deps.data.applyStripeEvent(SERVICE, { eventId: thin.id, ...state });
      log(outcome, { status: state.status });
      return jsonResponse(200, { received: true, outcome });
    } catch (error) {
      if (error instanceof ClubDataError) {
        log('rejected', { code: error.code });
        return jsonResponse(200, { received: true, outcome: 'rejected', code: error.code });
      }
      log('retry', { error: error instanceof Error ? error.name : 'unknown' });
      return errorResponse('internal');
    }
  };
}
