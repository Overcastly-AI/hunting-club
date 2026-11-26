// The product's features, by group: the one source for the /features page and the home
// page's feature cards. Copy follows docs/SPEC.md ("Free vs Club", "Ways to hunt",
// "Safety"): only what the app does today, nothing marked Later, no range numbers.
import { FREE_PARTY_MAX_MEMBERS } from '@huntclub/shared';

export interface FeatureGroup {
  /** Anchor on /features. */
  readonly id: string;
  readonly title: string;
  /** One sentence for the home page card. */
  readonly summary: string;
  /** What a free hunter gets; absent for club-only features. */
  readonly free?: string;
  /** What a club gets (on top of Free where both are set). */
  readonly club?: string;
  /** The screenshot that will go here: what it shows, and its crop. */
  readonly shot: { readonly label: string; readonly aspect: '4:5' | '16:10' };
}

export const FEATURE_GROUPS: readonly FeatureGroup[] = [
  {
    id: 'map',
    title: 'A live map that works offline',
    summary:
      'Topo and aerial maps downloaded to your phone, with wind, a scent cone, sunrise and sunset.',
    free: 'Free USGS topo and aerial maps, downloaded to your phone before you go. Your party on the map with no cell service. Wind, a scent cone, sunrise and sunset.',
    club: "The club's property line, stands and areas on everyone's map.",
    shot: { label: 'The live map with hunters in a party', aspect: '4:5' },
  },
  {
    id: 'check-in',
    title: 'Check in your way',
    summary:
      'At a stand, at a spot or on the move. Your location is shared only while you are checked in.',
    free: 'Check in at a spot (a log, a field edge, a portable stand) or on the move while you still-hunt or stalk. Switch without checking out.',
    club: 'Also check in at a club stand, which then shows as occupied, or in a named club area.',
    shot: { label: 'The check-in sheet', aspect: '4:5' },
  },
  {
    id: 'safety',
    title: 'Ask for a Hand and overdue alerts',
    summary:
      'Ask for a Hand pings your party or club. If you are not back after sunset, they are told.',
    free: 'Ask for a Hand sends your current location to your party and keeps trying until someone answers. If you are still out at sunset plus your grace time, your party gets an overdue alert.',
    club: 'Both go to the whole club and the clubhouse board. They keep working whatever a club pays.',
    shot: { label: 'Ask for a Hand on the map', aspect: '4:5' },
  },
  {
    id: 'chat',
    title: 'Chat over the radio',
    summary: 'Party chat, quick replies and direct messages, with no cell service.',
    free: `Chat, quick replies and direct messages with your party of up to ${FREE_PARTY_MAX_MEMBERS}.`,
    club: 'Whole-club chat, plus parties.',
    shot: { label: 'Party chat with quick replies', aspect: '4:5' },
  },
  {
    id: 'harvests',
    title: 'Harvest log',
    summary: 'Log a harvest in a few taps. It stays private unless you share it.',
    free: 'Log a harvest. It is private; you choose, one at a time, whether to share it with your party.',
    club: 'Share with the club, and admins get harvest reports and season summaries with CSV export.',
    shot: { label: 'A season harvest report', aspect: '16:10' },
  },
  {
    id: 'club-board',
    title: 'Clubhouse board',
    summary: 'A tablet on the clubhouse wall that replaces the paper sign-in sheet.',
    club: 'A tablet on the clubhouse wall shows who is in which stand, open stands and who is overdue.',
    shot: { label: 'The clubhouse board on a tablet', aspect: '16:10' },
  },
  {
    id: 'roster',
    title: 'Roster, roles and invites',
    summary: 'Admins, members and guests, invited by link or QR code.',
    club: 'Admins, members and guests. Invite by link or QR code; guest passes expire on their own.',
    shot: { label: 'The club roster', aspect: '16:10' },
  },
  {
    id: 'map-packs',
    title: 'Offline map pack of the property',
    summary: "A high-resolution offline map of the club's property.",
    club: "A high-resolution offline map of the club's property, downloaded to every member's phone.",
    shot: { label: 'A club map pack', aspect: '4:5' },
  },
];
