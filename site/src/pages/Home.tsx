import { APP_NAME } from '@huntclub/shared';
import { ADMIN_PATH, GET_THE_APP, HOME_SECTIONS } from '../routes';

const FEATURES = [
  {
    title: 'A live map of your party',
    text: 'Topo and aerial maps from public USGS servers, downloaded to your phone before you go.',
  },
  {
    title: 'Check in your way',
    text: 'At a stand, at a spot or on the move. Your location is shared only while you are checked in.',
  },
  {
    title: 'Chat over the radio',
    text: 'Party chat, quick replies and direct messages travel over the radio mesh.',
  },
  {
    title: 'Ask for a Hand',
    text: 'Pings your party with where you are, and keeps trying until someone sees it.',
  },
  {
    title: 'Overdue alert',
    text: 'If you are still out after sunset plus your grace time, your party is told.',
  },
  {
    title: 'Wind, sunrise and sunset',
    text: 'Wind, a scent cone, sunrise and sunset on the map.',
  },
] as const;

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
    text: 'Scan a Party QR code. A free party has up to 3 people.',
  },
] as const;

const FAQ = [
  {
    q: 'Do I need cell service?',
    a: 'No. Download your maps before you go. Positions, chat and check-ins travel over the radio mesh.',
  },
  {
    q: 'Which radios work?',
    a: 'Meshtastic LoRa radios running stock Meshtastic firmware. The app pairs with one over Bluetooth.',
  },
  {
    q: 'Do I need an account?',
    a: `Not to hunt with a party. Free users have no account, and ${APP_NAME} never contacts our servers for them. Club members sign in with an emailed code.`,
  },
  {
    q: 'Who can see where I am?',
    a: 'Only your party or club, and only while you are checked in.',
  },
  {
    q: 'What does a club pay for?',
    a: 'The club setup and admin tools. Everything that works over the radio mesh, including Ask for a Hand, stays free whatever a club pays.',
  },
] as const;

export function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <h1>Keep track of your hunting party with no cell service</h1>
          <p className="lead">
            {APP_NAME} pairs your phone with a Meshtastic radio. Your party shares a live map, chat
            and check-ins over the radio mesh. Free for hunting parties of up to 3, with no account.
          </p>
          <div className="actions">
            <a className="button primary" href={GET_THE_APP.href}>
              {GET_THE_APP.label}
            </a>
            <a className="button" href={`#${HOME_SECTIONS.forClubs}`}>
              For hunting clubs
            </a>
          </div>
        </div>
      </section>

      <section id={HOME_SECTIONS.features} className="band-light">
        <div className="wrap">
          <h2>What it does</h2>
          <div className="grid">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h3>{f.title}</h3>
                <p className="muted">{f.text}</p>
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
            <a className="button" href={ADMIN_PATH}>
              Sign in to the club admin
            </a>
          </div>
        </div>
      </section>

      <section id={HOME_SECTIONS.getTheApp}>
        <div className="wrap">
          <h2>Get the app</h2>
          <p className="lead">
            {APP_NAME} is not in the App Store or Google Play yet. It is being tested on iPhone and
            Android before release.
          </p>
        </div>
      </section>

      <section id={HOME_SECTIONS.faq} className="band-light faq">
        <div className="wrap">
          <h2>Questions</h2>
          {FAQ.map((item) => (
            <div key={item.q}>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
