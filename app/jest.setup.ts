// Screens and sheets read safe-area insets; Jest has no native safe area.
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
