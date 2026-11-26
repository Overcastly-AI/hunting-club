// The dawn scene's CSS (@huntclub/design/dawnScene) as a CSS module the sign-in page's
// background imports: Vite bundles it into that lazy chunk's hashed stylesheet and links it
// when the chunk loads, so the Content-Security-Policy needs no inline styles, and pages
// other than sign-in never download it. `vite dev` and the tests get the same CSS.
import { dawnSceneCss } from '@huntclub/design/dawnScene';
import type { Plugin } from 'vite';

/** What src/components/DawnBackground.tsx imports. */
export const DAWN_STYLESHEET_ID = 'virtual:dawn-scene.css';
const RESOLVED = `\0${DAWN_STYLESHEET_ID}`;

export function dawnStylesheet(): Plugin {
  return {
    name: 'huntclub-dawn-stylesheet',
    resolveId: (id) => (id === DAWN_STYLESHEET_ID ? RESOLVED : undefined),
    load: (id) => (id === RESOLVED ? dawnSceneCss() : undefined),
  };
}
