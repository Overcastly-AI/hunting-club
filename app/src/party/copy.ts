/** Words for party screens. Plain language: no channels or keys (CLAUDE.md). */
export const partyCopy = {
  step: {
    title: 'Your party',
    body: 'Hunt with up to two friends. Start a party, then they scan your Party QR code from the Party tab.',
    start: 'Start a party',
    starting: 'Starting your party…',
    started: 'Your party is ready. Friends can join from your Party QR code on the Party tab.',
    joined: 'You are in the party. Your party sees you on the map once you check in.',
    scan: 'Scan a Party QR code',
    continue: 'Continue',
    needsRadio: 'Pair your radio first to start a party. You can do it later from the Party tab.',
    failed: 'Could not set up your radio for the party. Check it is connected and try again.',
  },
  scan: {
    title: 'Scan a Party QR code',
    hint: 'Point your camera at the Party QR code on a friend’s phone. They find it on their Party tab.',
    cameraLabel: 'Camera, looking for a Party QR code',
    joining: 'Joining the party…',
    full: (max: number) => `That party is full. A party has room for ${max} hunters.`,
    notACode: 'That isn’t a Hunt Club Party QR code. Try scanning again.',
    clubCode:
      'That is a Club QR code. Joining a club in the app isn’t ready yet, so start or join a party for now.',
    failed: 'Could not join the party. Check your radio is connected and try again.',
  },
  qr: {
    title: 'Party QR code',
    body: 'Friends scan this in Hunt Club to join your party.',
    imageLabel: 'Party QR code for friends to scan',
    full: (max: number) =>
      `Your party is full, so the QR code is hidden. A party has room for ${max} hunters.`,
  },
} as const;
