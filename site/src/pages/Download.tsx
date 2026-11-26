import { APP_NAME } from '@huntclub/shared';
import { PAGE_PATHS } from '../routes';

export function Download() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <h1>Get {APP_NAME}</h1>
          <p className="lead">
            {APP_NAME} is not in the App Store or Google Play yet. It is being tested on iPhone and
            Android before release.
          </p>
          <div className="actions">
            <a className="button" href={PAGE_PATHS.contact}>
              Ask about testing
            </a>
          </div>
        </div>
      </section>

      <section className="band-light">
        <div className="wrap">
          <h2>What you need</h2>
          <ul className="checklist">
            <li>A phone: iPhone or Android, with the same features on both.</li>
            <li>
              A Meshtastic radio with GPS for each hunter, running stock Meshtastic firmware. Sold
              separately.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2>Joining someone?</h2>
          <h3>Hunting with a party</h3>
          <p className="muted">Ask the host for the party QR code and scan it in the app.</p>
          <h3>Joining a club</h3>
          <p className="muted">Your club admin sends you an invite link or QR code.</p>
        </div>
      </section>
    </>
  );
}
