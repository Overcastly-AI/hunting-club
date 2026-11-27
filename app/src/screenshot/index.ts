// Screenshot mode, for the Android screenshot job only (.github/workflows/app-screenshots.yml).
// On only in a dev build whose bundler was started with EXPO_PUBLIC_SCREENSHOT_MODE=1. A release
// bundle has __DEV__ false, so Metro folds this condition away and never bundles ./mode, its
// sample data or its stand-in radio: production builds have no screenshot mode and no way in.
import type { ScreenshotMode } from './mode';

export const screenshotMode: ScreenshotMode | null =
  __DEV__ && process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1'
    ? // A require inside the condition, so the module is dropped with it (an import would not be).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./mode') as typeof import('./mode')).startScreenshotMode()
    : null;
