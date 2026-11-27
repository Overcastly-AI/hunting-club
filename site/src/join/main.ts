// The /join page's one script (bundled by `vite build --mode client`, self-hosted).
import { showInvite } from './show';

const render = () => showInvite(document, location.href);
render();
// Editing only the #fragment of a loaded page does not reload it: decode and draw it again.
addEventListener('hashchange', render);
