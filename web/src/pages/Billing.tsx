import { isEntitledStatus, type Plan, type Subscription } from '@huntclub/shared';
import { useState } from 'react';
import type { ClubApi } from '../api/types';
import { Loadable } from '../components/Loadable';
import { useAsync } from '../components/useAsync';
import { SUBSCRIPTION_STATUS_LABELS, formatDate } from '../format';
import { navigateTo } from '../navigate';

/** Subscription status, and Stripe Checkout when the club needs to pay. */
export function Billing(props: { api: ClubApi }) {
  const billing = useAsync(
    () => Promise.all([props.api.getSubscription(), props.api.listPlans()]),
    [props.api],
  );

  return (
    <section aria-labelledby="billing-title">
      <h1 id="billing-title">Billing</h1>
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
  return (
    <dl className="panel">
      <dt className="muted">Status</dt>
      <dd>{SUBSCRIPTION_STATUS_LABELS[subscription.status]}</dd>
      <dt className="muted">Paid through</dt>
      <dd>{subscription.paidThrough ? formatDate(subscription.paidThrough) : 'Not paid yet'}</dd>
    </dl>
  );
}

function Pay(props: { api: ClubApi; plans: readonly Plan[] }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const pay = async (planId: string) => {
    setBusy(true);
    setFailed(false);
    try {
      navigateTo(await props.api.startCheckout(planId));
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  if (props.plans.length === 0) return <p>Payments are not open yet. Check back soon.</p>;
  return (
    <div>
      <h2>Pay for the club</h2>
      <p>Payment is handled by Stripe. You come back here when it is done.</p>
      {props.plans.map((plan) => (
        <button
          key={plan.id}
          className="button primary"
          type="button"
          disabled={busy}
          onClick={() => void pay(plan.id)}
        >
          Continue to payment: {plan.name}
        </button>
      ))}
      {failed ? (
        <p className="error" role="alert">
          Could not open the payment page. Try again.
        </p>
      ) : null}
    </div>
  );
}
