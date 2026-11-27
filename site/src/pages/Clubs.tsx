import { CLUB_PRICING } from '@huntclub/shared';
import { CLUB_PRICE_LINE, PAGE_PATHS, START_A_CLUB } from '../routes';

const QUESTIONS = [
  'Who is in the north stand?',
  'Who is not back yet?',
  'Where is the club hunting today?',
  'Where is the property line?',
];

const STEPS = [
  {
    title: 'Create the club',
    text: 'Sign in on the web with a code sent to your email, name the club and draw its stands and areas.',
  },
  {
    title: 'Invite by link or QR code',
    text: 'Members open the invite in the app. The app sets up their radio for the club.',
  },
  {
    title: 'Hunt',
    text: 'Members check in at a stand, in an area, at a spot or on the move, and everyone sees the shared map.',
  },
];

const FEATURES = [
  {
    title: 'Clubhouse board',
    text: 'A tablet on the clubhouse wall shows who is in which stand and who is overdue. It replaces the paper sign-in sheet.',
  },
  {
    title: 'Stands and areas',
    text: 'Draw the property line, stands and named areas like "North 40". Stands show open or occupied.',
  },
  {
    title: 'Roster and roles',
    text: 'Admins, members and guests. Guest passes expire on their own.',
  },
  {
    title: 'Offline map pack',
    text: 'A high-resolution offline map of your property, downloaded to every member’s phone.',
  },
  {
    title: 'Safety for the whole club',
    text: 'Ask for a Hand and overdue alerts go to the whole club and the board.',
  },
  {
    title: 'Harvest reports',
    text: 'Season summaries from the harvests members share with the club, with CSV export.',
  },
];

export function Clubs() {
  return (
    <>
      <div className="wrap page-head">
        <h1>Retire the paper sign-in sheet.</h1>
        <p className="lede">
          See who is in which stand, who is overdue and where the club hunts, even with no cell
          service.
        </p>
        <div className="actions">
          <a className="btn go" href={START_A_CLUB.href}>
            {START_A_CLUB.label}
          </a>
          <a className="btn" href={PAGE_PATHS.pricing}>
            See club pricing
          </a>
        </div>
      </div>

      <section className="band">
        <div className="wrap two">
          <h2>The questions every club asks at dawn</h2>
          <div>
            <ul className="rows">
              {QUESTIONS.map((q) => (
                <li key={q}>
                  <h3>{q}</h3>
                </li>
              ))}
            </ul>
            <p className="lede">The app answers them on one shared map, over the radio.</p>
          </div>
        </div>
      </section>

      <section className="band lifted">
        <div className="wrap two">
          <h2>Set up in three steps</h2>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>What a club gets</h2>
          <ul className="rows cols">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="band">
        <div className="wrap narrow">
          <h2>One price for the whole club</h2>
          <p className="lede">
            One price per club: {CLUB_PRICE_LINE}, with a {CLUB_PRICING.trialDays}-day free trial.
            Members join free.
          </p>
          <div className="actions">
            <a className="btn go" href={START_A_CLUB.href}>
              {START_A_CLUB.label}
            </a>
            <a className="btn" href={PAGE_PATHS.pricing}>
              See club pricing
            </a>
          </div>
          <p className="fine">{CLUB_PRICING.terms}</p>
        </div>
      </section>
    </>
  );
}
