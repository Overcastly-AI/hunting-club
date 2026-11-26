import {
  BILLING_INTERVALS,
  type BillingInterval,
  CLUB_PRICING,
  ClubApiRequestError,
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
      <Loadable state={billing}>
        {([subscription, plans]) => (
          <>
            <Status subscription={subscription} />
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

function Status({ subscription }: { subscription: Subscription | null }) {
  if (!subscription) return <p>No subscription yet.</p>;
  // While trialing, the subscription is paid through the trial's end.
  const trial = subscription.status === 'trialing';
  return (
    <dl className="panel">
      <dt className="muted">Status</dt>
      <dd>{SUBSCRIPTION_STATUS_LABELS[subscription.status]}</dd>
      <dt className="muted">{trial ? 'Trial ends' : 'Paid through'}</dt>
      <dd>{subscription.paidThrough ? formatDate(subscription.paidThrough) : 'Not paid yet'}</dd>
    </dl>
  );
}

type PayError = 'not_configured' | 'failed';

const PAY_ERRORS: Record<PayError, string> = {
  not_configured: "Payments aren't set up yet. Check back soon.",
  failed: 'Could not open the payment page. Try again.',
};

function Pay(props: { api: ClubApi; plans: readonly Plan[] }) {
  const [interval, setChosenInterval] = useState<BillingInterval>(CLUB_PRICING.defaultInterval);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PayError | null>(null);
  const plan = props.plans[0];

  if (!plan) return <p>Payments are not open yet. Check back soon.</p>;

  const startTrial = async () => {
    setBusy(true);
    setError(null);
    try {
      navigateTo(await props.api.startCheckout(plan.id, interval));
    } catch (e) {
      setError(
        e instanceof ClubApiRequestError && e.code === 'not_configured'
          ? 'not_configured'
          : 'failed',
      );
      setBusy(false);
    }
  };

  return (
    <div>
      <h2>Subscribe the club</h2>
      <fieldset className="panel">
        <legend>Billing</legend>
        {BILLING_INTERVALS.map((option) => {
          const pricing = CLUB_PRICING.intervals[option];
          return (
            <label key={option} className="row">
              <input
                type="radio"
                name="interval"
                value={option}
                checked={interval === option}
                onChange={() => setChosenInterval(option)}
              />
              <span>
                {pricing.label}: {pricing.price}
                {pricing.badge ? <strong> · {pricing.badge}</strong> : null}
              </span>
            </label>
          );
        })}
      </fieldset>
      <button
        className="button primary"
        type="button"
        disabled={busy}
        onClick={() => void startTrial()}
      >
        {CLUB_PRICING.cta}
      </button>
      <p className="muted">{CLUB_PRICING.terms}</p>
      <p className="muted">Payment is handled by Stripe. You come back here when it is done.</p>
      {error ? (
        <p className="error" role="alert">
          {PAY_ERRORS[error]}
        </p>
      ) : null}
    </div>
  );
}
