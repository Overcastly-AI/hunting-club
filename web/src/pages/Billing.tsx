import { ICON_SIZE } from '@huntclub/design';
import {
  BILLING_INTERVALS,
  type BillingInterval,
  CLUB_PRICING,
  ClubApiRequestError,
  ENTITLEMENT_GRACE_DAYS,
  entitlementFor,
  inDays,
  isEntitledStatus,
  SUBSCRIPTION_STATUS_LABELS,
  type Plan,
  type Subscription,
} from '@huntclub/shared';
import { CreditCard, ExternalLink, Radio } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ClubApi } from '../api/types';
import { billingAlert, clubStatus } from '../billingStatus';
import { Loadable } from '../components/Loadable';
import { Page } from '../components/Page';
import { useAsync } from '../components/useAsync';
import {
  Banner,
  Button,
  ButtonLink,
  RadioGroup,
  StatGrid,
  StatTile,
  StatusPill,
} from '../components/ui';
import { formatDate } from '../format';
import { navigateTo } from '../navigate';
import { pageHref } from '../shell/routes';

/** Billing never touches the mesh: said on every state of the page. */
export const MESH_STAYS_FREE =
  'The radio, chat and Ask for a Hand keep working whatever the billing status.';

/** Subscription status, and Stripe Checkout (free trial first) when the club needs to pay. */
export function Billing(props: { api: ClubApi }) {
  const billing = useAsync(
    () => Promise.all([props.api.getSubscription(), props.api.listPlans()]),
    [props.api],
  );
  const subscription = billing.status === 'ready' ? billing.value[0] : null;

  return (
    <Page
      title="Billing"
      description="Your club's plan, payment and invoices."
      actions={subscription ? <ManageSubscription api={props.api} /> : null}
    >
      <Loadable state={billing} noClub={<PlansBeforeClub />}>
        {([sub, plans]) => (
          <div className="billing">
            <Status subscription={sub} />
            {sub && isEntitledStatus(sub.status) ? null : <Pay api={props.api} plans={plans} />}
          </div>
        )}
      </Loadable>
      <p className="billing__free">
        <Radio size={ICON_SIZE.md} aria-hidden />
        {MESH_STAYS_FREE}
      </p>
    </Page>
  );
}

/** "Yearly: $100/year · 2 months free", from CLUB_PRICING. */
const priceLabel = (interval: BillingInterval) => {
  const pricing = CLUB_PRICING.intervals[interval];
  return `${pricing.label}: ${pricing.price}${pricing.badge ? ` · ${pricing.badge}` : ''}`;
};

/** Prices for an admin who has not created the club yet. */
function PlansBeforeClub() {
  return (
    <div className="billing">
      <StatGrid aria-label="Prices">
        {BILLING_INTERVALS.map((interval) => {
          const pricing = CLUB_PRICING.intervals[interval];
          return (
            <StatTile
              key={interval}
              label={pricing.label}
              value={pricing.price}
              hint={pricing.badge}
            />
          );
        })}
      </StatGrid>
      <p className="form-note">{CLUB_PRICING.terms}</p>
      <div>
        <ButtonLink variant="primary" href={pageHref('club')}>
          Create your club
        </ButtonLink>
      </div>
      <p className="form-note">Create your club first, then start the free trial here.</p>
    </div>
  );
}

/** What the date means: the trial's end, the last paid day of an ending plan, or renewal. */
function dateLabel(sub: Subscription): string {
  if (sub.status === 'trialing') return 'Free trial ends';
  return sub.cancelAtPeriodEnd || sub.status === 'canceled' ? 'Ends on' : 'Renews on';
}

/** The banner for a subscription that needs attention, if it does. */
function attention(sub: Subscription, featuresUntil: string | undefined): ReactNode {
  const now = Date.now();
  switch (billingAlert(sub, now)) {
    case 'pastDue':
      return (
        <Banner tone="danger" title={SUBSCRIPTION_STATUS_LABELS[sub.status]}>
          {featuresUntil && Date.parse(featuresUntil) > now
            ? `Club features stay on until ${formatDate(featuresUntil)}. Update the card under Manage subscription.`
            : 'Club features are off until a payment goes through. Update the card under Manage subscription.'}
        </Banner>
      );
    case 'trialEnding':
      return (
        <Banner
          tone="warning"
          title={`The free trial ends ${inDays(Date.parse(sub.paidThrough!), now)}`}
        >
          Billing starts then. Change the plan or card under Manage subscription.
        </Banner>
      );
  }
  if (sub.cancelAtPeriodEnd && sub.paidThrough)
    return (
      <Banner tone="info" title="Set not to renew">
        The subscription ends on {formatDate(sub.paidThrough)}. Turn renewal back on under Manage
        subscription.
      </Banner>
    );
  if (!isEntitledStatus(sub.status))
    return (
      <Banner tone="warning" title={SUBSCRIPTION_STATUS_LABELS[sub.status]}>
        Club features need a subscription. Start one below.
      </Banner>
    );
  return null;
}

function Status({ subscription }: { subscription: Subscription | null }) {
  if (!subscription)
    return (
      <Banner tone="info" title="No subscription yet.">
        Start the free trial below. Club stands, areas and the property line reach members once the
        club is paid for.
      </Banner>
    );
  // While trialing, paidThrough is the trial's end.
  const pricing = subscription.interval ? CLUB_PRICING.intervals[subscription.interval] : undefined;
  const { featuresUntil } = entitlementFor(subscription.clubId, subscription);
  const pill = clubStatus(subscription);
  return (
    <>
      {attention(subscription, featuresUntil)}
      <StatGrid aria-label="Subscription">
        <StatTile
          label="Status"
          value={
            pill ? <StatusPill status={pill} /> : SUBSCRIPTION_STATUS_LABELS[subscription.status]
          }
        />
        {pricing ? <StatTile label="Plan" value={`${pricing.label} · ${pricing.price}`} /> : null}
        <StatTile
          label={dateLabel(subscription)}
          value={subscription.paidThrough ? formatDate(subscription.paidThrough) : 'Not paid yet'}
        />
        {featuresUntil ? (
          <StatTile label="Club features until" value={formatDate(featuresUntil)} />
        ) : null}
      </StatGrid>
      {subscription.paidThrough && featuresUntil ? (
        <p className="form-note">
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
    <p className="form-error" role="alert">
      {REDIRECT_ERRORS[error]}
    </p>
  ) : null;
  return { busy, go, alert };
}

/** Change the plan or card, or cancel: Stripe's customer portal. */
function ManageSubscription(props: { api: ClubApi }) {
  const portal = useStripeRedirect();
  return (
    <div className="stack-action">
      <Button
        icon={ExternalLink}
        loading={portal.busy}
        onClick={() => void portal.go(() => props.api.openBillingPortal())}
      >
        Manage subscription
      </Button>
      {portal.alert}
    </div>
  );
}

function Pay(props: { api: ClubApi; plans: readonly Plan[] }) {
  const [interval, setChosenInterval] = useState<BillingInterval>(CLUB_PRICING.defaultInterval);
  const checkout = useStripeRedirect();
  const plan = props.plans[0];

  if (!plan)
    return (
      <Banner tone="info" title="Payments are not open yet.">
        Check back soon.
      </Banner>
    );

  return (
    <section className="form-plate" aria-labelledby="subscribe">
      <h2 id="subscribe" className="section-title">
        Subscribe the club
      </h2>
      <RadioGroup
        legend="Billing"
        options={BILLING_INTERVALS.map((option) => ({
          value: option,
          label: priceLabel(option),
          hint: CLUB_PRICING.intervals[option].trial,
        }))}
        value={interval}
        onChange={setChosenInterval}
      />
      <div className="form-plate__actions">
        <Button
          variant="primary"
          icon={CreditCard}
          loading={checkout.busy}
          onClick={() => void checkout.go(() => props.api.startCheckout(plan.id, interval))}
        >
          {CLUB_PRICING.cta}
        </Button>
      </div>
      <p className="form-note">{CLUB_PRICING.terms}</p>
      <p className="form-note">Payment is handled by Stripe. You come back here when it is done.</p>
      {checkout.alert}
    </section>
  );
}
