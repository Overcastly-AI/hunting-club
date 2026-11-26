// Privacy and Terms copy, shared by the web page and the app. Plain language, and only
// what docs/SPEC.md states: no promises beyond it. Both are drafts until the owner
// reviews them; every screen that shows them must show LEGAL_DRAFT_NOTICE too.
import { APP_NAME } from './app';
import { CLOUD_ENVIRONMENTS } from './cloud';
import { FREE_PARTY_MAX_MEMBERS } from './pricing';

export const LEGAL_DRAFT_NOTICE = 'Draft, pending owner review';

/**
 * The plain safety note (docs/SPEC.md "Safety"): the app's settings and the Terms say it
 * word for word. The only wording anywhere that mentions 911.
 */
export const SAFETY_NOTE = 'For emergencies, call 911 from your phone if you have service.';

export interface LegalSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export interface LegalDoc {
  readonly title: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
}

/** Where club data is stored (the one cloud environment so far). */
const CLUB_DATA_REGION = CLOUD_ENVIRONMENTS.dev.region;

const QUESTIONS: LegalSection = {
  heading: 'Questions',
  paragraphs: [
    'Ask your club admin. They run your club in the app and on the club admin page, and manage its members.',
  ],
};

export const privacyPolicy: LegalDoc = {
  title: 'Privacy',
  intro: `What ${APP_NAME} does with your information.`,
  sections: [
    {
      heading: 'Free hunters',
      paragraphs: [
        'If you hunt with a party and not a club, you have no account. The app never contacts our servers for you, and nothing about you is stored on them.',
        'Maps come straight from public USGS servers.',
      ],
    },
    {
      heading: 'Your location',
      paragraphs: [
        'Your location is shared only while you are checked in, unless you change that in settings.',
        'It goes over the radio mesh to your party or club. Only the last-known position is kept; there is no location history.',
      ],
    },
    {
      heading: 'Messages and keys',
      paragraphs: [
        'Messages over the mesh are encrypted with your party or club key.',
        'Channel keys and message bodies are never written to logs.',
      ],
    },
    {
      heading: 'Harvests',
      paragraphs: [
        'Harvests you log are private. You choose, one harvest at a time, whether to share it with your party or club.',
      ],
    },
    {
      heading: 'Clubs',
      paragraphs: [
        'Club members sign in with an email address and a one-time code. There is no password.',
        `Club data (the club, its members, stands, areas, invites, subscription, club radio key and shared harvests) is stored with Amazon Web Services (AWS) in the ${CLUB_DATA_REGION} region. The club service checks your club role on every request.`,
        'The app works in the field without the internet; the club service is never needed there.',
      ],
    },
    {
      heading: 'Payments',
      paragraphs: [
        "Clubs pay through Stripe, on Stripe's checkout page.",
        'We keep the Stripe customer and subscription IDs, the plan, its status and the paid-through date.',
      ],
    },
    QUESTIONS,
  ],
};

export const termsOfUse: LegalDoc = {
  title: 'Terms',
  intro: `The terms for using ${APP_NAME}.`,
  sections: [
    {
      heading: 'Not an emergency service',
      paragraphs: [
        `${APP_NAME} helps hunters look out for each other over radios. It is not an emergency service.`,
        SAFETY_NOTE,
      ],
    },
    {
      heading: 'Free and paid',
      paragraphs: [
        `The app is free for hunting parties of up to ${FREE_PARTY_MAX_MEMBERS} people, with no account.`,
        'Clubs pay a subscription for the club admin page and cloud features.',
        "Everything that works over the radio mesh, including Ask for a Hand, is free and keeps working whatever a club's payment status.",
      ],
    },
    {
      heading: 'Radios',
      paragraphs: [
        'The app pairs with Meshtastic radios over Bluetooth and works with stock Meshtastic firmware.',
      ],
    },
    {
      heading: 'Clubs',
      paragraphs: [
        "A club's admin manages its members, stands, areas and map packs, and pays for the club through Stripe.",
      ],
    },
    QUESTIONS,
  ],
};

/** Privacy and Terms by id: the web paths (LEGAL_PATHS) and the app routes use these ids. */
export const LEGAL_DOCS = { privacy: privacyPolicy, terms: termsOfUse } as const;
export type LegalDocId = keyof typeof LEGAL_DOCS;

export function isLegalDocId(value: unknown): value is LegalDocId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEGAL_DOCS, value);
}
