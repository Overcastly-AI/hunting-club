// Plain answers, the one source for /faq, the home page's preview and the FAQPage JSON-LD.
// From docs/SPEC.md only: no range numbers (they depend on terrain and antenna), and the
// emergency answer uses SAFETY_NOTE word for word.
import { APP_NAME, CLUB_PRICING, FREE_PARTY_MAX_MEMBERS, SAFETY_NOTE } from '@huntclub/shared';

export interface FaqItem {
  readonly q: string;
  readonly a: string;
}

const { intervals } = CLUB_PRICING;

export const FAQ: readonly FaqItem[] = [
  {
    q: 'Do I need cell service?',
    a: 'No. Download your maps before you go. Positions, chat and check-ins travel between radios, with no cell service.',
  },
  {
    q: 'Do I need a radio?',
    a: 'Yes. Each hunter needs a Meshtastic radio with GPS. The app pairs with it over Bluetooth and sets it up for you. Radios are sold separately.',
  },
  {
    q: 'Which radio?',
    a: 'A LoRa radio that runs stock Meshtastic firmware and has GPS, so it can share your position. No custom firmware.',
  },
  {
    q: 'How far does it reach?',
    a: 'It depends on the terrain, the trees and the antenna. Radios pass messages along for each other, and a radio on high ground helps cover a property.',
  },
  {
    q: 'Is it free?',
    a: `Yes, for hunters and parties. Everything that works over the radio is free, always. Clubs pay ${intervals.year.price} or ${intervals.month.price} for the shared setup and admin tools.`,
  },
  {
    q: 'How many people in a free party?',
    a: `Up to ${FREE_PARTY_MAX_MEMBERS}, including you. Inside a club, the cap does not apply.`,
  },
  {
    q: 'What can a club do?',
    a: 'Share the property line, stands and areas, keep a roster with invites and guest passes, run a clubhouse board, download an offline map pack of the property and get harvest reports.',
  },
  {
    q: 'Do members pay?',
    a: 'No. The club pays once for everyone. Members join free and sign in once with a code sent to their email.',
  },
  {
    q: 'What data do you collect?',
    a: `Free hunters have no account, and ${APP_NAME} never contacts our servers for them. Your location is shared only with your party or club, only while you are checked in, and there is no location history.`,
  },
  {
    q: 'Is it an emergency service?',
    a: `No. It helps hunters look out for each other. ${SAFETY_NOTE}`,
  },
  {
    q: 'Which phones?',
    a: 'iPhone and Android, with the same features on both.',
  },
  {
    q: 'Does it show when I can legally hunt?',
    a: "No. It shows sunrise and sunset only, because the rules vary by state. Check your state's rules.",
  },
];

/** The questions the home page previews. */
export const FAQ_PREVIEW = [0, 1, 4, 9].map((i) => FAQ[i]!);
