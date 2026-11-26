import { Modal } from 'react-native';

// Screens and sheets read safe-area insets; Jest has no native safe area.
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

// Load React Native's Modal (behind Sheet) here, outside any test's 5 s timeout.
// Its first load pulls in a large module graph: on a cold CI transform cache that
// took over 3 s inside the first test that rendered a sheet (PartyStep, 2026-11-26).
void Modal;
