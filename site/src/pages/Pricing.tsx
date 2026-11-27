import { CLUB_PRICING, formatUsd, FREE_PARTY_MAX_MEMBERS } from '@huntclub/shared';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { CONDITIONS } from '../features';
import { GET_THE_APP, START_A_CLUB } from '../routes';

const { intervals, defaultInterval } = CLUB_PRICING;
const shown = intervals[defaultInterval];
const other = intervals[defaultInterval === 'year' ? 'month' : 'year'];

/** "$100" and "/year": the shown interval's price, its figure set large. */
export const CLUB_AMOUNT = formatUsd(shown.amountCents);
export const CLUB_UNIT = `${shown.price.slice(CLUB_AMOUNT.length)} per club`;
/** "2 months free, or $10/month." */
export const CLUB_ALTERNATIVE = `${shown.badge ? `${shown.badge}, or ` : 'Or '}${other.price}.`;

/** A cell of the plan table: a tick and "Yes", a dash and "No", or a few words. */
export type PlanValue = 'yes' | 'no' | string;

export interface ComparisonRow {
  readonly feature: string;
  readonly free: PlanValue;
  readonly club: PlanValue;
}

const party = `Party of ${FREE_PARTY_MAX_MEMBERS}`;
const wholeClub = 'Whole club';

/** Free and Club, from docs/SPEC.md "Free vs Club" (real rows only), in two groups. */
export const COMPARISON: readonly { group: string; rows: readonly ComparisonRow[] }[] = [
  {
    group: 'Over the radios',
    rows: [
      { feature: 'Pair a radio and see mesh status', free: 'yes', club: 'yes' },
      {
        feature: 'Live map with free USGS topo and aerial, on your phone',
        free: 'yes',
        club: 'yes',
      },
      { feature: CONDITIONS, free: 'yes', club: 'yes' },
      { feature: 'Map, chat, quick replies and direct messages', free: party, club: wholeClub },
      { feature: 'Check in at a spot or on the move', free: 'yes', club: 'yes' },
      { feature: 'Ask for a Hand', free: 'Your party', club: wholeClub },
      { feature: 'Overdue alert after sunset', free: 'Your party', club: wholeClub },
      { feature: 'Log a harvest (private unless you share it)', free: 'yes', club: 'yes' },
    ],
  },
  {
    group: 'For the club',
    rows: [
      { feature: 'Club property line, shared stands and areas', free: 'no', club: 'yes' },
      { feature: 'Check in at a club stand or in a club area', free: 'no', club: 'yes' },
      { feature: 'Roster, roles, invites and guest passes', free: 'no', club: 'yes' },
      { feature: 'Clubhouse board on a wall tablet', free: 'no', club: 'yes' },
      { feature: 'High-resolution offline map pack of the property', free: 'no', club: 'yes' },
      { feature: 'Harvest reports and season summaries', free: 'no', club: 'yes' },
    ],
  },
];

const BILLING_FAQ = [
  {
    q: 'Who pays?',
    a: 'The club pays once for everyone. Members join free.',
  },
  {
    q: 'How is it billed?',
    a: `${intervals.year.price} or ${intervals.month.price} per club, by card through Stripe, after a ${CLUB_PRICING.trialDays}-day free trial.`,
  },
  {
    q: 'Can I cancel?',
    a: `Yes. Cancel anytime before day ${CLUB_PRICING.trialDays} and you won't be charged.`,
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

function Value(props: { value: PlanValue }) {
  if (props.value === 'yes') {
    return (
      <span className="yes">
        <Check className="ic" aria-hidden="true" size={20} />
        Yes
      </span>
    );
  }
  if (props.value === 'no') {
    return (
      <span className="no">
        <Minus className="ic" aria-hidden="true" size={18} />
        No
      </span>
    );
  }
  return <>{props.value}</>;
}

export function Pricing() {
  return (
    <>
      <div className="wrap">
        <div className="page-head">
          <h1>Free in the field. One price for the whole club.</h1>
          <p className="lede">
            Everything that travels over the radios is free, for good. A club pays for the shared
            setup and the admin tools, and its members pay nothing.
          </p>
        </div>

        <div className="plans">
          <div className="plan-heads">
            <p>What each one includes</p>
            <div className="plan">
              <h2>Free</h2>
              <p className="amount">$0</p>
              <p>Any hunter. No account. Parties of up to {FREE_PARTY_MAX_MEMBERS}.</p>
              <a className="btn" href={GET_THE_APP.href}>
                {GET_THE_APP.label}
              </a>
            </div>
            <div className="plan">
              <h2>Club</h2>
              <p className="amount">
                {CLUB_AMOUNT}
                <small>{CLUB_UNIT}</small>
              </p>
              <p>{CLUB_ALTERNATIVE}</p>
              <a className="btn go" href={START_A_CLUB.href}>
                {START_A_CLUB.label}
              </a>
              <p className="fine">{CLUB_PRICING.terms}</p>
            </div>
          </div>
          <table className="compare">
            <caption className="sr-only">Free and Club compared</caption>
            <colgroup>
              <col className="feature" />
              <col className="plan-col" />
              <col className="plan-col" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Free</th>
                <th scope="col">Club</th>
              </tr>
            </thead>
            {COMPARISON.map((part) => (
              <tbody key={part.group}>
                <tr className="group">
                  <th scope="colgroup" colSpan={3}>
                    {part.group}
                  </th>
                </tr>
                {part.rows.map((row) => (
                  <tr key={row.feature}>
                    <th scope="row">{row.feature}</th>
                    <td>
                      <Value value={row.free} />
                    </td>
                    <td>
                      <Value value={row.club} />
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>

      <section className="band">
        <div className="wrap two">
          <div>
            <h2>If a club stops paying</h2>
            <p className="lede">
              The radios, the map, chat, Ask for a Hand and overdue alerts keep working. Only the
              club&apos;s shared setup and admin tools pause until it renews.
            </p>
            <h3>What you need</h3>
            <ul className="ticks">
              <li>A phone: iPhone or Android.</li>
              <li>A Meshtastic radio with GPS for each hunter, sold separately.</li>
            </ul>
          </div>
          <div className="faq">
            <h2>Billing questions</h2>
            {BILLING_FAQ.map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q}
                  <ChevronDown className="ic" aria-hidden="true" size={22} />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
