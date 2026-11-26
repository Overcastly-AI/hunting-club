/** Words for party screens. Plain language: no channels or keys (CLAUDE.md). */
export const partyCopy = {
  step: {
    title: 'Your party',
    body: 'Hunt with up to two friends. Start a party, then they scan your Party QR code from the Party tab.',
    start: 'Start a party',
    starting: 'Starting your party…',
    started: 'Your party is ready. Friends can join from your Party QR code on the Party tab.',
    alreadyIn: 'You are already in a party.',
    continue: 'Continue',
    needsRadio: 'Pair your radio first to start a party. You can do it later from the Party tab.',
    failed: 'Could not set up your radio for the party. Check it is connected and try again.',
  },
  qr: {
    title: 'Party QR code',
    body: 'Friends scan this in Hunt Club to join your party.',
    imageLabel: 'Party QR code for friends to scan',
    full: (max: number) =>
      `Your party is full, so the QR code is hidden. A party has room for ${max} hunters.`,
  },
} as const;
