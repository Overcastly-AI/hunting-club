import { CLUB_PRICING, FREE_PARTY_MAX_MEMBERS } from '@huntclub/shared';
import { GET_THE_APP, START_A_CLUB } from '../routes';

const { intervals } = CLUB_PRICING;

/** Free and Club, from docs/SPEC.md "Free vs Club" (real rows only). */
export const COMPARISON: readonly { feature: string; free: string; club: string }[] = [
  { feature: 'Pair a radio and see mesh status', free: 'Yes', club: 'Yes' },
  { feature: 'Live map with free USGS topo and aerial, on your phone', free: 'Yes', club: 'Yes' },
  { feature: 'Wind, sunrise and sunset, scent cone', free: 'Yes', club: 'Yes' },
  {
    feature: 'Map, chat, quick replies and direct messages',
    free: `Your party, up to ${FREE_PARTY_MAX_MEMBERS} people`,
    club: 'The whole club, plus parties',
  },
  {
    feature: 'Check in',
    free: 'At a spot or on the move',
    club: 'Also at a club stand or in a club area',
  },
  { feature: 'Ask for a Hand', free: 'To your party', club: 'To the whole club' },
  {
    feature: 'Overdue alert',
    free: 'To your party',
    club: 'To the whole club and the clubhouse board',
  },
  { feature: 'Log a harvest (private unless you share it)', free: 'Yes', club: 'Yes' },
  { feature: 'Club property line, shared stands and areas', free: 'No', club: 'Yes' },
  { feature: 'Roster, roles, invites and guest passes', free: 'No', club: 'Yes' },
  { feature: 'Clubhouse board', free: 'No', club: 'Yes' },
  { feature: 'High-resolution offline map pack of the property', free: 'No', club: 'Yes' },
  { feature: 'Harvest reports and season summaries', free: 'No', club: 'Yes' },
];

const FREE_LIST = [
  'Live map with free USGS topo and aerial',
  'Wind, sunrise and sunset, scent cone',
  'Party map, chat and quick replies',
  'Check in at a spot or on the move',
  'Ask for a Hand and overdue alerts to your party',
  'Private harvest log',
];

const CLUB_LIST = [
  'Everything in Free',
  'Whole-club map and chat',
  'Club property line, stands and areas',
  'Roster, roles, invites and guest passes',
  'Check in at a stand or in an area',
  'Clubhouse board',
  'High-resolution offline map pack',
  'Harvest reports',
  'Ask for a Hand and overdue alerts to the whole club',
];

const BILLING_FAQ = [
  {
    q: 'Who pays?',
    a: 'The club pays once for everyone. Members join free.',
  },
  {
    q: 'How is it billed?',
    a: `${intervals.year.price} or ${intervals.month.price}, by card through Stripe, after a ${CLUB_PRICING.trialDays}-day free trial.`,
  },
  {
    q: 'Can I cancel?',
    a: `Yes. Cancel anytime before day ${CLUB_PRICING.trialDays} and you won't be charged.`,
  },
  {
    q: 'What happens if we stop paying?',
    a: 'The radio, chat, Ask for a Hand and overdue alerts keep working. Only the shared setup and admin tools pause.',
  },
  {
    q: 'Do members need accounts?',
    a: 'Club members sign in once with a code sent to their email. There is no password.',
  },
  {
    q: 'Is the radio included?',
    a: 'No. Each hunter needs a Meshtastic radio with GPS, sold separately.',
  },
];

export function Pricing() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <h1>Free for hunters. One plan for your club.</h1>
          <p className="lead">
            Everything that works over the radio is free, always. Clubs pay for the shared setup and
            admin tools.
          </p>
        </div>
      </section>

      <section className="plans">
        <div className="wrap grid">
          <div className="card">
            <h2>Free</h2>
            <p className="price">$0</p>
            <p>For you and your party of up to {FREE_PARTY_MAX_MEMBERS}. No account.</p>
            <ul className="checklist">
              {FREE_LIST.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <a className="button" href={GET_THE_APP.href}>
              {GET_THE_APP.label}
            </a>
          </div>
          <div className="card">
            <h2>Club</h2>
            <p className="price">
              {intervals.year.price}
              {intervals.year.badge ? (
                <span className="price-note"> ({intervals.year.badge})</span>
              ) : null}
            </p>
            <p className="muted">or {intervals.month.price}</p>
            <p>For hunting clubs and leases. Members join free.</p>
            <ul className="checklist">
              {CLUB_LIST.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <a className="button primary" href={START_A_CLUB.href}>
              {START_A_CLUB.label}
            </a>
            <p className="muted fine-print">{CLUB_PRICING.terms}</p>
          </div>
        </div>
      </section>

      <section className="band-light">
        <div className="wrap">
          <h2>Free and Club, side by side</h2>
          <table className="compare">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Free</th>
                <th scope="col">Club</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature}>
                  <th scope="row">{row.feature}</th>
                  <td data-label="Free">{row.free}</td>
                  <td data-label="Club">{row.club}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2>Safety is never behind a paywall</h2>
          <p className="lead">
            If a club&apos;s subscription ends, the radio, chat, Ask for a Hand and overdue alerts
            keep working. Only the shared setup and admin tools pause.
          </p>
          <h2>What you need</h2>
          <ul className="checklist">
            <li>A phone: iPhone or Android.</li>
            <li>A Meshtastic radio with GPS for each hunter, sold separately.</li>
          </ul>
        </div>
      </section>

      <section className="band-light faq">
        <div className="wrap">
          <h2>Billing questions</h2>
          {BILLING_FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
          <div className="actions">
            <a className="button primary" href={START_A_CLUB.href}>
              {START_A_CLUB.label}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
