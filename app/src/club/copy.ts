import { type MemberRole, signInCopy } from '@huntclub/shared';

/** Every word the club screens show. Plain language; never channels or keys (CLAUDE.md). */
export const clubCopy = {
  section: {
    heading: 'Club',
    none: 'Hunting with a club? Scan your Club QR code with the phone camera to join.',
    role: { admin: 'Admin', member: 'Member', guest: 'Guest' } satisfies Record<MemberRole, string>,
    pending: 'Joined on the radio. Sign in when you have signal to finish joining the club.',
    featuresOpen: 'Club features are on.',
    featuresClosed:
      'Club features are paused until the club renews. Radio, chat and Ask for a Hand still work.',
    stands: (n: number) => (n === 1 ? '1 stand' : `${n} stands`),
    signIn: 'Sign in',
    signOut: 'Sign out',
    sync: 'Update club info',
    syncing: 'Updating…',
    syncFailed: 'Could not reach the club service. Your club still works on the radio.',
    unavailable: 'Club sign-in is not available yet.',
  },
  signIn: signInCopy,
  join: {
    title: 'Join club',
    intro: 'Tell your club who you are. This shows on the club roster.',
    name: 'Your name',
    initials: 'Initials (up to 3)',
    join: 'Join club',
    joined: 'You joined the club on the radio.',
    signInToFinish: 'Sign in to finish joining',
    done: 'Done',
    notClub: 'This QR code is for a hunting party. Open the Party tab to join a party.',
    badLink: 'This QR code is not a Hunt Club code.',
  },
};
