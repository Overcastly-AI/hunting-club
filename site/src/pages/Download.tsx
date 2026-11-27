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
      <div className="wrap page-head">
        <h1>Get {APP_NAME}</h1>
        <p className="lede">
          {APP_NAME} is in beta. It is not in the App Store or Google Play yet.
        </p>
      </div>
      <section className="band">
        <div className="wrap two">
          <h2>What beta means</h2>
          <div>
            <ul className="rows">
              {BETA_POINTS.map((point) => (
                <li key={point}>
                  <p>{point}</p>
                </li>
              ))}
            </ul>
            <h3>What to do now</h3>
            <p className="quiet">
              Want to help test it? Ask on the contact page. When the app is in the stores, this
              page will link to it.
            </p>
            <div className="actions">
              <a className="btn go" href={PAGE_PATHS.contact}>
                Ask about testing
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap two">
          <h2>What you need</h2>
          <ul className="rows">
            <li>
              <h3>A phone</h3>
              <p>iPhone or Android, with the same features on both.</p>
            </li>
            <li>
              <h3>A radio for each hunter</h3>
              <p>
                A Meshtastic radio with GPS, running stock Meshtastic firmware. Sold separately.
              </p>
            </li>
          </ul>
        </div>
      </section>

      <section className="band">
        <div className="wrap two">
          <h2>Joining someone?</h2>
          <ul className="rows">
            <li>
              <h3>Hunting with a party</h3>
              <p>Ask the host for the party QR code and scan it in the app.</p>
            </li>
            <li>
              <h3>Joining a club</h3>
              <p>Your club admin sends you an invite link or QR code.</p>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
