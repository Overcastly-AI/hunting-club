import {
  BILLING_INTERVALS,
  type BillingInterval,
  CLUB_PRICING,
  ClubApiRequestError,
  ENTITLEMENT_GRACE_DAYS,
  entitlementFor,
  isEntitledStatus,
  type Plan,
  type Subscription,
} from '@huntclub/shared';
import { useState } from 'react';
import type { ClubApi } from '../api/types';
import { Loadable } from '../components/Loadable';
import { PageHeading } from '../components/PageHeading';
import { useAsync } from '../components/useAsync';
import { SUBSCRIPTION_STATUS_LABELS, formatDate } from '../format';
import { navigateTo } from '../navigate';

/** Subscription status, and Stripe Checkout (free trial first) when the club needs to pay. */
export function Billing(props: { api: ClubApi }) {
  const billing = useAsync(
    () => Promise.all([props.api.getSubscription(), props.api.listPlans()]),
    [props.api],
  );

  return (
    <section aria-labelledby="billing-title">
      <PageHeading id="billing-title">Billing</PageHeading>
      <Loadable state={billing} noClub={<PlansBeforeClub />}>
        {([subscription, plans]) => (
          <>
            <Status subscription={subscription} />
            {subscription ? <ManageSubscription api={props.api} /> : null}
            {subscription && isEntitledStatus(subscription.status) ? null : (
              <Pay api={props.api} plans={plans} />
            )}
          </>
        )}
      </Loadable>
      <p className="muted">
        The radio, chat and Ask for a Hand keep working whatever the billing status.
      </p>
    </section>
  );
}

/** Prices for an admin who has not created the club yet. */
function PlansBeforeClub() {
  return (
    <div>
      <ul className="panel">
        {BILLING_INTERVALS.map((option) => (
          <li key={option}>
            <PriceLabel interval={option} />
          </li>
        ))}
      </ul>
      <p className="muted">{CLUB_PRICING.terms}</p>
      <p>
        <a href="#/club">Create your club</a> to start your free trial.
      </p>
    </div>
  );
}

/** "Yearly: $100/year · 2 months free", from CLUB_PRICING. */
function PriceLabel({ interval }: { interval: BillingInterval }) {
  const pricing = CLUB_PRICING.intervals[interval];
  return (
    <span>
      {pricing.label}: {pricing.price}
      {pricing.badge ? <strong> · {pricing.badge}</strong> : null}
    </span>
  );
}

/** What the date means: the trial's end, the last paid day of an ending plan, or renewal. */
function dateLabel(sub: Subscription): string {
  if (sub.status === 'trialing') return 'Free trial ends';
  return sub.cancelAtPeriodEnd || sub.status === 'canceled' ? 'Ends on' : 'Renews on';
}

function Status({ subscription }: { subscription: Subscription | null }) {
  if (!subscription) return <p>No subscription yet.</p>;
  // While trialing, paidThrough is the trial's end.
  const pricing = subscription.interval ? CLUB_PRICING.intervals[subscription.interval] : undefined;
  const { featuresUntil } = entitlementFor(subscription.clubId, subscription);
  return (
    <>
      <dl className="panel">
        {pricing ? (
          <>
            <dt className="muted">Plan</dt>
            <dd>
              {pricing.label} · {pricing.price}
            </dd>
          </>
        ) : null}
        <dt className="muted">Status</dt>
        <dd>{SUBSCRIPTION_STATUS_LABELS[subscription.status]}</dd>
        <dt className="muted">{dateLabel(subscription)}</dt>
        <dd>{subscription.paidThrough ? formatDate(subscription.paidThrough) : 'Not paid yet'}</dd>
      </dl>
      {subscription.paidThrough && featuresUntil ? (
        <p className="muted">
          If a payment fails or the plan ends, club features stay on for {ENTITLEMENT_GRACE_DAYS}{' '}
          days after {formatDate(subscription.paidThrough)}, until {formatDate(featuresUntil)}.
        </p>
      ) : null}
    </>
  );
}

type RedirectError = 'not_configured' | 'failed';

const REDIRECT_ERRORS: Record<RedirectError, string> = {
  not_configured: "Payments aren't set up yet. Check back soon.",
  failed: 'Could not open the payment page. Try again.',
};

/** Sends the browser to a Stripe page (Checkout or the portal), with the shared error copy. */
function useStripeRedirect() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RedirectError | null>(null);
  const go = async (open: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      navigateTo(await open());
    } catch (e) {
      setError(
        e instanceof ClubApiRequestError && e.code === 'not_configured'
          ? 'not_configured'
          : 'failed',
      );
      setBusy(false);
    }
  };
  const alert = error ? (
    <p className="error" role="alert">
      {REDIRECT_ERRORS[error]}
    </p>
  ) : null;
  return { busy, go, alert };
}

/** Change the plan or card, or cancel: Stripe's customer portal. */
function ManageSubscription(props: { api: ClubApi }) {
  const portal = useStripeRedirect();
  return (
    <div>
      <button
        className="button"
        type="button"
        disabled={portal.busy}
        onClick={() => void portal.go(() => props.api.openBillingPortal())}
      >
        Manage subscription
      </button>
      {portal.alert}
    </div>
  );
}

function Pay(props: { api: ClubApi; plans: readonly Plan[] }) {
  const [interval, setChosenInterval] = useState<BillingInterval>(CLUB_PRICING.defaultInterval);
  const checkout = useStripeRedirect();
  const plan = props.plans[0];

  if (!plan) return <p>Payments are not open yet. Check back soon.</p>;

  return (
    <div>
      <h2>Subscribe the club</h2>
      <fieldset className="panel">
        <legend>Billing</legend>
        {BILLING_INTERVALS.map((option) => (
          <label key={option} className="row">
            <input
              type="radio"
              name="interval"
              value={option}
              checked={interval === option}
              onChange={() => setChosenInterval(option)}
            />
            <PriceLabel interval={option} />
          </label>
        ))}
      </fieldset>
      <button
        className="button primary"
        type="button"
        disabled={checkout.busy}
        onClick={() => void checkout.go(() => props.api.startCheckout(plan.id, interval))}
      >
        {CLUB_PRICING.cta}
      </button>
      <p className="muted">{CLUB_PRICING.terms}</p>
      <p className="muted">Payment is handled by Stripe. You come back here when it is done.</p>
      {checkout.alert}
    </div>
  );
}
