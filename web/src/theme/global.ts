// The admin's whole stylesheet as a pure function of the font URL: the Vite plugin
// (../../global-stylesheet.ts) writes it to a hashed file at build time, so the page needs
// no inline styles under its Content-Security-Policy; tests and `vite dev` use globalCss().
// Colours are the theme's (`--theme-*`), so dark and daylight both work.
import { baseCss, textClasses, textScale, textStyleCss } from '@huntclub/design';
import { uiCss } from '../components/ui/styles';
import { color, FOCUS_OUTLINE, gap } from '../components/ui/styles/shared';
import { mapCss } from '../map/styles';
import { pagesCss } from '../pages/styles';
import { shellCss } from '../shell/styles';

/** The whole stylesheet: font face, tokens, base elements, components, the map, pages and shell. */
export function globalCssFor(fontUrl: string): string {
  return `
${baseCss(fontUrl)}
body { ${textStyleCss(textScale.body)}; }
${textClasses()}
h1, h2, h3, p { margin: 0; }
a { color: ${color('accentText')}; text-underline-offset: 3px; }
:focus-visible { ${FOCUS_OUTLINE} }
/* Before the shell: "not available yet" and the first load. */
.layout { max-width: calc(960px + 2 * ${gap(4)}); margin: 0 auto; padding: ${gap(6)} ${gap(4)}; }
.skip-link { position: absolute; left: ${gap(4)}; top: -100px; z-index: 100; padding: ${gap(2)} ${gap(4)};
  border-radius: var(--radius-md); background: ${color('raised')}; color: ${color('text')}; }
.skip-link:focus { top: ${gap(4)}; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap; }
${uiCss()}
${mapCss()}
${pagesCss()}
${shellCss()}
`;
}
