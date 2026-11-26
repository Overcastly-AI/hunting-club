import { DAWN_PAUSE_BUTTON_CLASS } from '@huntclub/design/dawnControl';
import { dawnSceneSvg } from '@huntclub/design/dawnScene';
import { APP_NAME, dawnPauseCopy, FREE_PARTY_MAX_MEMBERS } from '@huntclub/shared';
import { FAQ_PREVIEW } from '../faq';
import { FEATURE_GROUPS } from '../features';
import { GET_THE_APP, HOME_SECTIONS, PAGE_PATHS } from '../routes';

const STEPS = [
  {
    title: 'Get a Meshtastic radio',
    text: 'Any radio that runs stock Meshtastic firmware. No custom firmware.',
  },
  {
    title: 'Pair it with the app',
    text: 'The app connects over Bluetooth and sets the radio up for you.',
  },
  {
    title: 'Start or join a party',
    text: `Scan a Party QR code. A free party has up to ${FREE_PARTY_MAX_MEMBERS} people.`,
  },
] as const;

/**
 * The decorative layer behind the hero's content: the dawn scene (@huntclub/design/dawnScene),
 * inlined at build time. Its CSS is in the home page's own hashed stylesheet; the pause button
 * starts hidden and the home page's small script shows and wires it. Anything placed here must
 * stay aria-hidden and keep the hero text's contrast. Home page only.
 */
export const HERO_ART_SLOT = 'hero-art';

export function Home() {
  return (
    <>
      <section className="hero">
        {/* Static markup from our own package (no user input), so inlining it is safe. */}
        <div
          className={HERO_ART_SLOT}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: dawnSceneSvg() }}
        />
        <div className="wrap">
          <h1>Keep track of your hunting party with no cell service</h1>
          <p className="lead">
            {APP_NAME} pairs your phone with a Meshtastic radio. Your party shares a live map, chat
            and check-ins over the radio mesh. Free for hunting parties of up to{' '}
            {FREE_PARTY_MAX_MEMBERS}, with no account.
          </p>
          <div className="actions">
            <a className="button primary" href={GET_THE_APP.href}>
              {GET_THE_APP.label}
            </a>
            <a className="button" href={PAGE_PATHS.clubs}>
              For hunting clubs
            </a>
          </div>
        </div>
        <button
          className={`button ${DAWN_PAUSE_BUTTON_CLASS}`}
          type="button"
          aria-pressed="false"
          hidden
        >
          {dawnPauseCopy.pause}
        </button>
      </section>

      <section className="band-light">
        <div className="wrap">
          <h2>What it does</h2>
          <div className="grid">
            {FEATURE_GROUPS.filter((f) => f.free).map((f) => (
              <div key={f.id}>
                <h3>{f.title}</h3>
                <p className="muted">{f.summary}</p>
                <a className="tap" href={`${PAGE_PATHS.features}#${f.id}`}>
                  More about {f.title.toLowerCase()}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2>How it works</h2>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.title}>
                <h3>{s.title}</h3>
                <p className="muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id={HOME_SECTIONS.forClubs} className="band-light">
        <div className="wrap">
          <h2>For hunting clubs</h2>
          <p className="lead">
            A club subscription adds the property line, shared stands and areas, a roster with
            invites and guest passes, a clubhouse board that replaces the paper sign-in sheet, a
            detailed offline map of the property and harvest reports.
          </p>
          <p>
            Club admins set it up on the web. Everything that works over the radio mesh stays free.
          </p>
          <div className="actions">
            <a className="button" href={PAGE_PATHS.clubs}>
              See how clubs use it
            </a>
            <a className="button" href={PAGE_PATHS.pricing}>
              See club pricing
            </a>
          </div>
        </div>
      </section>

      <section className="band-light faq">
        <div className="wrap">
          <h2>Questions</h2>
          {FAQ_PREVIEW.map((item) => (
            <div key={item.q}>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}
          <a className="tap" href={PAGE_PATHS.faq}>
            All questions
          </a>
        </div>
      </section>
    </>
  );
}
