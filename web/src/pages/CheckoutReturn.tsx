import { ADMIN_PATH } from '@huntclub/shared/app';
import { useDocumentTitle } from '../title';

/** Where Stripe Checkout sends the admin back to (CHECKOUT_RETURN_PATHS). */
export function CheckoutReturn(props: { outcome: 'done' | 'cancel' }) {
  const done = props.outcome === 'done';
  const title = done ? 'Payment received' : 'Payment cancelled';
  useDocumentTitle(title);
  return (
    <section aria-labelledby="checkout-title">
      <h1 id="checkout-title">{title}</h1>
      <p>
        {done
          ? 'Thank you. Club features turn on as soon as Stripe confirms the payment, usually within a minute.'
          : 'Nothing was charged. You can pay any time from the Billing page.'}
      </p>
      <a className="button primary" href={`${ADMIN_PATH}#/billing`}>
        Back to club admin
      </a>
    </section>
  );
}
