/**
 * Stripe, behind two narrow interfaces so handlers are testable without network:
 * - `StripeApi`: the four Stripe calls we make (production: `stripeApi(new Stripe(key))`).
 * - mapping from a Stripe subscription to `StripeEventApply` (club-data's input).
 * Research and event choices: docs/research/stripe-and-auth.md §2–§4.
 */
import type Stripe from 'stripe';
import type { ThinEvent } from './stripeWebhook';
import {
  BILLING_INTERVALS,
  type BillingInterval,
  CLUB_PRICING,
  SubscriptionStatusSchema,
  type StripeEventApply,
  type StripePrices,
} from '@huntclub/shared';

/** Metadata keys we put on Checkout Sessions and Subscriptions (read back by the webhook). */
export const STRIPE_METADATA = { clubId: 'club_id', planId: 'plan_id' } as const;

export interface StripeApi {
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  retrieveCheckoutSession(id: string): Promise<Stripe.Checkout.Session>;
  retrieveInvoice(id: string): Promise<Stripe.Invoice>;
  createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
  ): Promise<Stripe.Checkout.Session>;
  createPortalSession(
    params: Stripe.BillingPortal.SessionCreateParams,
  ): Promise<Stripe.BillingPortal.Session>;
}

export function stripeApi(stripe: Stripe): StripeApi {
  return {
    retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
    retrieveCheckoutSession: (id) => stripe.checkout.sessions.retrieve(id),
    retrieveInvoice: (id) => stripe.invoices.retrieve(id),
    createCheckoutSession: (params) => stripe.checkout.sessions.create(params),
    createPortalSession: (params) => stripe.billingPortal.sessions.create(params),
  };
}

const idOf = (ref: string | { id: string } | null | undefined) =>
  ref == null ? undefined : typeof ref === 'string' ? ref : ref.id;

/** Thin event types we act on, and how each leads to a subscription id. */
const SUBSCRIPTION_EVENTS: Record<
  string,
  (api: StripeApi, objectId: string) => Promise<string | undefined>
> = {
  'v1.checkout.session.completed': async (api, id) =>
    idOf((await api.retrieveCheckoutSession(id)).subscription),
  'v1.customer.subscription.created': async (_api, id) => id,
  'v1.customer.subscription.updated': async (_api, id) => id,
  'v1.customer.subscription.deleted': async (_api, id) => id,
  'v1.customer.subscription.paused': async (_api, id) => id,
  'v1.customer.subscription.resumed': async (_api, id) => id,
  'v1.invoice.paid': async (api, id) =>
    idOf((await api.retrieveInvoice(id)).parent?.subscription_details?.subscription),
  'v1.invoice.payment_failed': async (api, id) =>
    idOf((await api.retrieveInvoice(id)).parent?.subscription_details?.subscription),
};
export const HANDLED_EVENT_TYPES = Object.keys(SUBSCRIPTION_EVENTS);

/** The subscription a thin event is about, or undefined for events we ignore. */
export async function subscriptionIdForEvent(
  api: StripeApi,
  event: Pick<ThinEvent, 'type' | 'related_object'>,
): Promise<string | undefined> {
  const resolve = SUBSCRIPTION_EVENTS[event.type];
  const objectId = event.related_object?.id;
  return resolve && objectId ? resolve(api, objectId) : undefined;
}

/**
 * The subscription's current state as club-data input (minus the event id), or
 * undefined if it isn't one of ours (no club metadata). "Paid through" is the latest
 * item period end (since API 2025-03-31.basil), or the trial end while trialing.
 */
export function subscriptionState(
  sub: Stripe.Subscription,
): Omit<StripeEventApply, 'eventId'> | undefined {
  const clubId = sub.metadata[STRIPE_METADATA.clubId];
  const planId = sub.metadata[STRIPE_METADATA.planId];
  const customer = idOf(sub.customer);
  if (!clubId || !planId || !customer) return undefined;
  const periodEnds = sub.items.data.map((item) => item.current_period_end);
  const paidThrough =
    sub.status === 'trialing' && sub.trial_end ? sub.trial_end : Math.max(0, ...periodEnds);
  const interval = sub.items.data[0]?.price?.recurring?.interval;
  return {
    clubId,
    planId,
    stripeCustomerId: customer,
    stripeSubscriptionId: sub.id,
    status: SubscriptionStatusSchema.parse(sub.status),
    ...(paidThrough > 0 ? { paidThrough: new Date(paidThrough * 1000).toISOString() } : {}),
    ...(isBillingInterval(interval) ? { interval } : {}),
    // The portal cancels at period end with cancel_at (API 2025+) or the older flag.
    cancelAtPeriodEnd: sub.cancel_at_period_end === true || sub.cancel_at != null,
  };
}

const isBillingInterval = (value: string | undefined): value is BillingInterval =>
  (BILLING_INTERVALS as readonly (string | undefined)[]).includes(value);

export interface CheckoutConfig {
  /** Stripe Price id per plan and billing interval (test mode in dev). */
  prices: StripePrices;
  successUrl: string;
  cancelUrl: string;
  /** Where Stripe's customer portal sends the admin back to (the Billing page). */
  portalReturnUrl: string;
}

/** Stripe's customer portal for a club's Stripe customer (change plan, card, or cancel). */
export async function createBillingPortal(
  api: StripeApi,
  input: { customerId: string; returnUrl: string },
): Promise<string> {
  const session = await api.createPortalSession({
    customer: input.customerId,
    return_url: input.returnUrl,
  });
  return session.url;
}

/**
 * Hosted Checkout for a club's subscription, starting with the free trial
 * (CLUB_PRICING.trialDays) on either interval; the club id rides along as metadata.
 */
export async function createCheckout(
  api: StripeApi,
  input: { clubId: string; planId: string; priceId: string; config: CheckoutConfig },
): Promise<string> {
  const metadata = {
    [STRIPE_METADATA.clubId]: input.clubId,
    [STRIPE_METADATA.planId]: input.planId,
  };
  const session = await api.createCheckoutSession({
    mode: 'subscription',
    line_items: [{ price: input.priceId, quantity: 1 }],
    client_reference_id: input.clubId,
    metadata,
    subscription_data: { metadata, trial_period_days: CLUB_PRICING.trialDays },
    success_url: input.config.successUrl,
    cancel_url: input.config.cancelUrl,
  });
  if (!session.url) throw new Error('Stripe returned a Checkout Session without a url');
  return session.url;
}
