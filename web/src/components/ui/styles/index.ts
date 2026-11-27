// The component library's stylesheet (web/src/components/ui), appended to the admin's
// global stylesheet so it ships as a file under the strict CSP (no inline styles).
import { contentCss } from './content';
import { controlsCss } from './controls';
import { overlaysCss } from './overlays';

export const uiCss = () => [controlsCss(), contentCss(), overlaysCss()].join('\n');
