import { APP_NAME } from '@huntclub/shared';
import { PAGE_PATHS } from '../routes';

/** What "beta" means here, in plain words. No store badges or links until the listings exist. */
export const BETA_POINTS = [
  'The app is still being tested on iPhone and Android, with the same features on both.',
  'It is not in the App Store or Google Play yet, so there is nothing to download here today.',
  'Features may still change before release.',
] as const;

export function Download() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <h1>Get {APP_NAME}</h1>
          <p className="lead">
            {APP_NAME} is in beta. It is not in the App Store or Google Play yet.
          </p>
          <h2>What beta means</h2>
          <ul className="checklist">
            {BETA_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <h2>What to do now</h2>
          <p>
            Want to help test it? Ask on the contact page. When the app is in the stores, this page
            will link to it.
          </p>
          <div className="actions">
            <a className="button primary" href={PAGE_PATHS.contact}>
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
