import { SUPPORT_EMAIL } from '@huntclub/shared/app';
import { PAGE_PATHS } from '../routes';

export function Contact() {
  return (
    <div className="wrap page-head narrow">
      <h1>Contact us</h1>
      {SUPPORT_EMAIL ? (
        <p className="lede">
          Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with questions about the
          app, radios, or club plans and billing.
        </p>
      ) : (
        <p className="lede">A support email address is coming soon. It will be listed here.</p>
      )}
      <p>Club members: your club admin can help with invites, stands and the roster.</p>
      <p>
        Prices and billing questions are on the <a href={PAGE_PATHS.pricing}>pricing page</a>.
      </p>
    </div>
  );
}
