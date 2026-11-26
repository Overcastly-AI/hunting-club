/** Where Stripe Checkout sends the admin back to (CHECKOUT_RETURN_PATHS). */
export function CheckoutReturn(props: { outcome: 'done' | 'cancel' }) {
  const done = props.outcome === 'done';
  return (
    <section aria-labelledby="checkout-title">
      <h1 id="checkout-title">{done ? 'Payment received' : 'Payment cancelled'}</h1>
      <p>
        {done
          ? 'Thank you. Club features turn on as soon as Stripe confirms the payment, usually within a minute.'
          : 'Nothing was charged. You can pay any time from the Billing page.'}
      </p>
      <a className="button primary" href="/#/billing">
        Back to club admin
      </a>
    </section>
  );
}
