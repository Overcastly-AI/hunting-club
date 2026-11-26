// The /join page's one script (bundled by `vite build --mode client`, self-hosted).
import { showInvite } from './show';

showInvite(document, location.href);
