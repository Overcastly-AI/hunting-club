import type { ClubApi } from '../api/types';
import { Loadable } from '../components/Loadable';
import { useAsync } from '../components/useAsync';
import { SUBSCRIPTION_STATUS_LABELS, formatDate } from '../format';

/** Subscription status. Managing the card (Stripe customer portal) arrives in Milestone 9. */
export function Billing(props: { api: ClubApi }) {
  const billing = useAsync(() => props.api.getSubscription(), [props.api]);

  return (
    <section aria-labelledby="billing-title">
      <h1 id="billing-title">Billing</h1>
      <Loadable state={billing}>
        {(b) =>
          b ? (
            <dl className="panel">
              <dt className="muted">Status</dt>
              <dd>{SUBSCRIPTION_STATUS_LABELS[b.status]}</dd>
              <dt className="muted">Paid through</dt>
              <dd>{b.paidThrough ? formatDate(b.paidThrough) : 'Not paid yet'}</dd>
            </dl>
          ) : (
            <p>No subscription yet.</p>
          )
        }
      </Loadable>
      <p className="muted">
        The radio, chat and Ask for a Hand keep working whatever the billing status.
      </p>
      <button className="button" type="button" disabled>
        Manage payment
      </button>
    </section>
  );
}
