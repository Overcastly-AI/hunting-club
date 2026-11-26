/**
 * Every word the radio screens show, in one place. Plain language for hunters:
 * no channels, keys, presets or regions (CLAUDE.md).
 */
export const radioCopy = {
  pair: {
    title: 'Pair your radio',
    intro: 'Turn your radio on and hold it near your phone.',
    findRadios: 'Find radios',
    searching: 'Looking for radios…',
    searchAgain: 'Search again',
    noneFound:
      'No radios found. Make sure your radio is on, close by, and not connected to another phone.',
    connect: 'Connect',
    connecting: 'Connecting…',
    connectedTo: (name: string) => `Connected to ${name}`,
    done: 'Done',
    disconnect: 'Disconnect',
    failed: 'Could not connect. Check the PIN and try again.',
    tryAgain: 'Try again',
  },
  pin: {
    title: 'Pairing PIN',
    body: 'Your phone may ask for a PIN. If your radio has a screen, type the number it shows. If it has no screen, the PIN is',
  },
  repair: {
    title: 'Forget and re-pair',
    body: [
      'If your radio keeps disconnecting or will not connect, your phone and radio need to pair again.',
      'Open your phone’s Bluetooth settings, find the radio, and choose Forget (iPhone) or Unpair (Android).',
      'Then come back here and tap Find radios.',
    ],
    needed: 'Your phone and radio need to pair again.',
    openSettings: 'Open Bluetooth settings',
    forgetHere: 'Forget this radio',
  },
  signal: {
    strong: 'Strong signal',
    good: 'Good signal',
    weak: 'Weak signal',
  },
  link: {
    none: 'No radio paired',
    connecting: 'Connecting to your radio…',
    loading: 'Reading your radio…',
    ready: 'Connected to your radio',
    reconnecting: 'Radio out of reach. Reconnecting…',
    disconnected: 'Radio disconnected',
  },
  info: {
    battery: (percent: number) => `Battery ${percent}%`,
    plugged: 'Plugged in',
    firmware: (version: string) => `Software ${version}`,
  },
  permissions: {
    /** iOS system prompt (NSBluetoothAlwaysUsageDescription), set in app.config.ts. */
    iosBluetoothUsage:
      'Hunt Club Mesh uses Bluetooth to talk to your radio, so you can text and share your location with your party without cell service.',
    bluetoothOff: 'Bluetooth is off. Turn it on to use your radio.',
  },
  service: {
    title: 'Connected to your radio',
    body: 'Keeping your radio link open for texts and alerts.',
    channelName: 'Radio link',
  },
  test: {
    title: 'Radio test',
    hint: 'Send a text to everyone on your radio’s main channel. No cell service needed.',
    placeholder: 'Type a message',
    send: 'Send',
    remaining: (n: number) => `${n} characters left`,
    you: 'You',
    status: {
      sending: 'Sending…',
      sent: 'Sent',
      heard: 'Heard by the mesh',
      delivered: 'Delivered',
      failed: 'Not delivered',
      noReply: 'No reply yet',
    },
  },
  settingsEntry: 'Your radio',
} as const;
