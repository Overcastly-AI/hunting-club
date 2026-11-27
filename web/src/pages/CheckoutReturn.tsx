import { ADMIN_PATH } from '@huntclub/shared/app';
import { Page } from '../components/Page';
import { ButtonLink } from '../components/ui';
import { useDocumentTitle } from '../title';

/** Where Stripe Checkout sends the admin back to (CHECKOUT_RETURN_PATHS). */
export function CheckoutReturn(props: { outcome: 'done' | 'cancel' }) {
  const done = props.outcome === 'done';
  const title = done ? 'Payment received' : 'Payment cancelled';
  useDocumentTitle(title);
  return (
    <Page
      title={title}
      description={
        done
          ? 'Thank you. Club features turn on as soon as Stripe confirms the payment, usually within a minute.'
          : 'Nothing was charged. You can pay any time from the Billing page.'
      }
      actions={
        <ButtonLink variant="primary" href={`${ADMIN_PATH}#/billing`}>
          Back to club admin
        </ButtonLink>
      }
    />
  );
}
