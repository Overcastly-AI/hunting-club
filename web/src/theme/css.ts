// Archivo, Latin subset of the app's font file (see packages/design/fonts/README.md).
import fontUrl from '@huntclub/design/fonts/Archivo-Latin.woff2?url';
import { globalCssFor } from './global';

// The token CSS helpers live in @huntclub/design (shared with the public site).
export { textStyleCss, tokenVariables } from '@huntclub/design';

/** The stylesheet with the bundled font's URL (tests, and `vite dev`). */
export const globalCss = () => globalCssFor(fontUrl);
