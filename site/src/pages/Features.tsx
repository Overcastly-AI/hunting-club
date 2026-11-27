import { APP_NAME } from '@huntclub/shared';
import { FEATURE_GROUPS, type FeatureGroup } from '../features';
import { GET_THE_APP, PAGE_PATHS } from '../routes';

/**
 * Where a real screenshot goes, at its final crop. A labelled frame, never a mock-up:
 * real screenshots replace these (docs/SITE_BRIEF.md: no fake shots).
 */
export function ShotPlaceholder(props: { shot: FeatureGroup['shot'] }) {
  const { label, aspect } = props.shot;
  return (
    <figure className={`shot shot-${aspect.replace(':', 'x')}`}>
      <div className="shot-frame" role="img" aria-label={`Screenshot coming soon: ${label}`}>
        <span>Screenshot coming soon</span>
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function Features() {
  return (
    <>
      <div className="wrap page-head">
        <h1>What {APP_NAME} does</h1>
        <p className="lede">
          Everything that works over the radio is free, always. Clubs add the shared setup and admin
          tools.
        </p>
        <div className="actions">
          <a className="btn go" href={GET_THE_APP.href}>
            {GET_THE_APP.label}
          </a>
          <a className="btn" href={PAGE_PATHS.pricing}>
            Compare Free and Club
          </a>
        </div>
      </div>

      {FEATURE_GROUPS.map((group) => (
        <section key={group.id} id={group.id} className="band">
          <div className="wrap two">
            <div>
              <h2>{group.title}</h2>
              {group.free ? (
                <p>
                  <strong>Free:</strong> {group.free}
                </p>
              ) : (
                <p>
                  <strong>Club only.</strong>
                </p>
              )}
              {group.club ? (
                <p>
                  <strong>Club:</strong> {group.club}
                </p>
              ) : null}
            </div>
            <ShotPlaceholder shot={group.shot} />
          </div>
        </section>
      ))}
    </>
  );
}
