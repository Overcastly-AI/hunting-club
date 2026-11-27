/** Words for the onboarding flow (docs/SPEC.md, Screens → 5. Onboarding). */
export const onboardingCopy = {
  welcome: {
    title: 'Welcome to Hunt Club Mesh',
    body: 'Text your party and see each other on the map with no cell service. First, pair the radio you carry.',
    start: 'Get started',
  },
  /** The rest of the name step's words are the name prompt's (profile/copy.ts). */
  name: {
    continue: 'Continue',
  },
  permissions: {
    title: 'Allow access',
    body: 'Hunt Club needs these to work in the woods. You can change them any time in your phone’s Settings.',
    location: 'Location',
    bluetooth: 'Bluetooth',
    notifications: 'Alerts',
    allow: {
      location: 'Allow location',
      bluetooth: 'Allow Bluetooth',
      notifications: 'Allow alerts',
    },
    allowed: 'Allowed',
    notAllowed: 'Not allowed. You can allow it later in your phone’s Settings.',
    continue: 'Continue',
  },
  map: {
    title: 'Download your map',
    body: 'Save the map around you now, so it works in the woods with no signal. You can save more areas from the Map tab.',
    sheetIntro:
      'Saves the map about 2 miles around where you are, so it works with no signal. Maps come free from USGS. Use Wi-Fi if you can.',
    findArea: 'Download the map around me',
    finding: 'Finding where you are…',
    noLocation: 'We couldn’t find where you are. You can download maps from the Map tab later.',
    downloading: 'Your map is downloading. It keeps going while you use the app.',
    continue: 'Continue',
  },
} as const;
