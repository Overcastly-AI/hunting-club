import {
  APP_NAME,
  FREE_PARTY_MAX_MEMBERS,
  FRESHNESS_THRESHOLDS_MS,
  MINUTE_MS,
} from '@huntclub/shared';
import { Check, ChevronDown } from 'lucide-react';
import { FAQ_PREVIEW } from '../faq';
import { FEATURE_GROUPS, planWord } from '../features';
import { HunterMarker, MapHero, ScentCone, StandMarker, YouMarker } from '../map/MapView';
import { CLUB_PRICE_LINE, GET_THE_APP, HOME_SECTIONS, PAGE_PATHS } from '../routes';

const minutes = (ms: number) => ms / MINUTE_MS;

/**
 * What the map adds to the land: your party, live, with no cell service, and how long ago each
 * radio was heard. Worded without naming or claiming anything about other apps.
 */
export const HOME_PROMISE =
  'A map of the land is easy to find. This one shows your party on it, live, with no cell service: each hunter’s radio tells your phone where they are, and the ring says how long ago it was heard.';

/** The freshness-ring legend: what each mark on the map means (freshness.ts thresholds). */
export const LEGEND = [
  {
    title: 'You',
    text: 'The one orange dot. Your scent cone points downwind.',
    sym: (
      <>
        <ScentCone />
        <YouMarker />
      </>
    ),
  },
  {
    title: 'A hunter heard just now',
    text: `A solid green ring: their radio was heard in the last ${minutes(FRESHNESS_THRESHOLDS_MS.fresh)} minutes. The plate says where and how long ago.`,
    sym: <HunterMarker initials="DB" freshness="fresh" />,
  },
  {
    title: 'A hunter not heard lately',
    text: `A broken gold ring: not heard for ${minutes(FRESHNESS_THRESHOLDS_MS.fresh)} to ${minutes(FRESHNESS_THRESHOLDS_MS.stale)} minutes. An old position is never drawn as a live one.`,
    sym: <HunterMarker initials="RT" freshness="stale" />,
  },
  {
    title: 'A last known position',
    text: `After ${minutes(FRESHNESS_THRESHOLDS_MS.stale)} minutes the marker fades: it shows where they were, not where they are.`,
    sym: <HunterMarker initials="JH" freshness="faded" />,
  },
  {
    title: 'A stand',
    text: 'Open, or the name of who is in it. Stands are optional: check in at a spot or on the move.',
    sym: <StandMarker type="ladder" />,
  },
  {
    title: 'The property line',
    text: 'Drawn once by the club and sent to every member’s phone.',
    sym: (
      <svg className="draw" viewBox="0 0 76 60" aria-hidden="true" focusable="false">
        <path className="s-line" d="M-4 44L30 14l50 10" />
        <path className="s-inner" d="M-4 44L30 14l50 10" />
      </svg>
    ),
  },
  {
    title: 'A club area',
    text: 'A named part of the property, such as Creek Bottom.',
    sym: (
      <svg className="draw" viewBox="0 0 76 60" aria-hidden="true" focusable="false">
        <path className="s-area" d="M12 12l44-4 10 30-30 14-26-12z" />
      </svg>
    ),
  },
] as const;

const STEPS = [
  {
    title: 'Pair a radio',
    text: 'Any radio with GPS that runs stock Meshtastic firmware. The app connects over Bluetooth and sets it up for you.',
  },
  {
    title: 'Scan your party’s QR code',
    text: `That puts up to ${FREE_PARTY_MAX_MEMBERS} of you on the same map and chat. There are no channels or radio settings to learn.`,
  },
  {
    title: 'Check in',
    text: 'At a stand, right where you are, or on the move. Your location is shared only while you are checked in.',
  },
] as const;

const FREE_TICKS = [
  'Live map, sunrise and sunset, and the last known wind',
  `Party chat and check-in for up to ${FREE_PARTY_MAX_MEMBERS} people`,
  'Ask for a Hand, and an alert if someone is not back after sunset',
] as const;

const CLUB_TICKS = [
  'The property line, stands and areas on every member’s map',
  'A roster, invites and guest passes',
  'A clubhouse board that replaces the paper sign-in sheet',
] as const;

function Ticks(props: { items: readonly string[] }) {
  return (
    <ul className="ticks">
      {props.items.map((item) => (
        <li key={item}>
          <Check className="ic" aria-hidden="true" size={20} />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Home(props: { aerialUrl: string }) {
  return (
    <>
      <MapHero aerialUrl={props.aerialUrl}>
        <div className="pitch plate">
          <h1>See where everyone is hunting, with no cell service</h1>
          <p className="lede">
            Your phone pairs with a small radio. The radios carry your party’s positions, texts and
            check-ins across the property, so the map stays live where your phone has no bars.
          </p>
          <div className="actions">
            <a className="btn go big" href={GET_THE_APP.href}>
              {GET_THE_APP.label}
            </a>
            <a className="btn big" href={PAGE_PATHS.clubs}>
              Set up your club
            </a>
          </div>
          <p className="fine">
            Free for parties of up to {FREE_PARTY_MAX_MEMBERS}, with no account. iPhone and Android.
          </p>
        </div>
      </MapHero>

      <section className="band">
        <div className="wrap two">
          <div>
            <h2>What you see on the map</h2>
            <p className="lede">{HOME_PROMISE}</p>
          </div>
          <dl className="legend rows">
            {LEGEND.map((row) => (
              <div key={row.title}>
                <dt>
                  <span className="sym" aria-hidden="true">
                    {row.sym}
                  </span>
                  <span className="term">{row.title}</span>
                </dt>
                <dd>{row.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="band lifted">
        <div className="wrap">
          <h2>What {APP_NAME} does</h2>
          <ul className="rows cols">
            {FEATURE_GROUPS.map((f) => (
              <li key={f.id}>
                <h3>
                  <a className="tap" href={`${PAGE_PATHS.features}#${f.id}`}>
                    {f.title}
                  </a>
                  <span className="plan-word">{planWord(f)}</span>
                </h3>
                <p>{f.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="band">
        <div className="wrap two">
          <div>
            <h2>In the woods in three steps</h2>
            <p className="lede">If you can scan a QR code, you can use it.</p>
          </div>
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

      <section className="band" id={HOME_SECTIONS.forClubs}>
        <div className="wrap split">
          <div>
            <h2>Free for hunters</h2>
            <p className="price">$0, with no account</p>
            <Ticks items={FREE_TICKS} />
            <a className="btn go" href={GET_THE_APP.href}>
              {GET_THE_APP.label}
            </a>
          </div>
          <div>
            <h2>For hunting clubs</h2>
            <p className="price">{CLUB_PRICE_LINE} per club</p>
            <Ticks items={CLUB_TICKS} />
            <a className="btn" href={PAGE_PATHS.pricing}>
              See what a club gets
            </a>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap two">
          <h2>Questions</h2>
          <div className="faq">
            {FAQ_PREVIEW.map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q}
                  <ChevronDown className="ic" aria-hidden="true" size={22} />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
            <a className="tap" href={PAGE_PATHS.faq}>
              All questions
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
